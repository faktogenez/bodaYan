const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const crypto = require("crypto");
const { URL } = require("url");

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleLauncher";
const MAX_REDIRECTS = 5;

// SHA1 файла (потоково, без загрузки целиком в память).
function sha1File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (d) => hash.update(d));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

// GET с полным телом в память (для манифеста и страницы подтверждения Google Drive).
function fetchBuffer(urlStr, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) return reject(new Error("Слишком много редиректов"));
    const u = new URL(urlStr);
    const mod = u.protocol === "http:" ? http : https;
    const req = mod.get(urlStr, { headers: { "User-Agent": USER_AGENT } }, (res) => {
      const { statusCode, headers } = res;
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        res.resume();
        return resolve(fetchBuffer(new URL(headers.location, urlStr).href, redirects + 1));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ statusCode, headers, buffer: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
  });
}

function driveUrl(id) {
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

// Разбор страницы "Google Drive can't scan this file" → confirm/uuid.
function parseConfirm(html) {
  const confirm = (html.match(/confirm=([0-9A-Za-z_-]+)/) || [])[1];
  const uuid = (html.match(/uuid=([0-9A-Za-z_-]+)/) || [])[1];
  return { confirm, uuid };
}

// Потоковая загрузка URL в файл с подсчётом SHA1 и прогрессом по байтам.
// Для Google Drive автоматически обрабатывает предупреждение о вирусах (confirm token).
// При обрыве — до 3 попыток с докачкой через HTTP Range (bytes=<received>-).
async function downloadToFile(urlStr, destPath, onBytes, opts = {}) {
  const maxAttempts = opts.maxAttempts || 3;
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await streamDownload(urlStr, destPath, onBytes, opts, 0);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempt - 1); // 1s → 2s → 4s
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// Догружает содержимое существующего файла в hash перед продолжением загрузки.
function hashExistingFile(hash, filePath) {
  return new Promise((resolve, reject) => {
    const s = fs.createReadStream(filePath);
    s.on("data", (d) => hash.update(d));
    s.on("end", resolve);
    s.on("error", reject);
  });
}

function streamDownload(urlStr, destPath, onBytes, opts, redirects) {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) return reject(new Error("Слишком много редиректов"));
    const u = new URL(urlStr);
    const mod = u.protocol === "http:" ? http : https;

    const tmpPath = destPath + ".part";
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    // Докачка: если есть неполный .part — продолжаем с его конца через Range.
    let startBytes = 0;
    try { if (fs.existsSync(tmpPath)) startBytes = fs.statSync(tmpPath).size; } catch (_) { startBytes = 0; }

    const reqHeaders = { "User-Agent": USER_AGENT };
    if (startBytes > 0) reqHeaders["Range"] = `bytes=${startBytes}-`;

    const req = mod.get(urlStr, { headers: reqHeaders }, (res) => {
      const { statusCode, headers } = res;

      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        res.resume();
        return resolve(streamDownload(new URL(headers.location, urlStr).href, destPath, onBytes, opts, redirects + 1));
      }

      const contentType = String(headers["content-type"] || "");

      // Google Drive вернул страницу подтверждения — извлекаем токен и повторяем.
      if (statusCode === 200 && contentType.includes("text/html") && opts.gdriveId && !opts._confirmed) {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const { confirm, uuid } = parseConfirm(Buffer.concat(chunks).toString("utf8"));
          if (!confirm) return reject(new Error("Не удалось получить confirm-токен Google Drive"));
          let retryUrl = `${driveUrl(opts.gdriveId)}&confirm=${confirm}`;
          if (uuid) retryUrl += `&uuid=${uuid}`;
          resolve(streamDownload(retryUrl, destPath, onBytes, { ...opts, _confirmed: true }, redirects));
        });
        res.on("error", reject);
        return;
      }

      if (statusCode !== 200 && statusCode !== 206) {
        res.resume();
        return reject(new Error("HTTP " + statusCode));
      }

      // Сервер может проигнорировать Range и вернуть 200 → начинаем файл заново.
      const append = statusCode === 206 && startBytes > 0;
      if (!append) startBytes = 0;

      const len = parseInt(headers["content-length"] || "0", 10);
      const total = len ? startBytes + len : 0;

      const hash = crypto.createHash("sha1");
      const out = fs.createWriteStream(tmpPath, { flags: append ? "a" : "w" });
      let received = startBytes;

      const proceed = () => {
        res.on("data", (chunk) => {
          received += chunk.length;
          hash.update(chunk);
          if (onBytes) onBytes(received, total);
        });
        res.on("error", reject);
        res.pipe(out);

        out.on("error", reject);
        out.on("finish", () => {
          out.close(() => {
            try {
              fs.renameSync(tmpPath, destPath);
              resolve({ sha1: hash.digest("hex"), size: received });
            } catch (err) {
              reject(err);
            }
          });
        });
      };

      if (append) {
        hashExistingFile(hash, tmpPath).then(proceed).catch(reject);
      } else {
        proceed();
      }
    });

    req.on("error", reject);
  });
}

// Загрузка/чтение манифеста: из URL или локального файла.
async function loadManifest({ manifestUrl, manifestPath }) {
  if (manifestUrl) {
    const res = await fetchBuffer(manifestUrl);
    if (res.statusCode !== 200) throw new Error("Манифест: HTTP " + res.statusCode);
    return JSON.parse(res.buffer.toString("utf8"));
  }
  if (manifestPath) {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  }
  throw new Error("Не задан manifestUrl или manifestPath");
}

// Нужно ли обновлять файл (отсутствует / другой sha1 / другой размер).
async function needsUpdate(file, destPath) {
  if (!fs.existsSync(destPath)) return { need: true, reason: "отсутствует" };

  if (file.sha1) {
    const local = await sha1File(destPath);
    if (local.toLowerCase() !== String(file.sha1).toLowerCase()) {
      return { need: true, reason: "несовпадение sha1" };
    }
    return { need: false, reason: "ok" };
  }

  if (typeof file.size === "number") {
    const st = fs.statSync(destPath);
    if (st.size !== file.size) return { need: true, reason: "размер" };
  }

  return { need: false, reason: "ok" };
}

// Основной прогон: проверить все файлы манифеста и дозагрузить недостающие/устаревшие.
async function runUpdate({ manifestUrl, manifestPath, targetPath, onProgress }) {
  const report = (p) => { if (onProgress) onProgress(p); };

  const manifest = await loadManifest({ manifestUrl, manifestPath });
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  const results = { total: files.length, updated: 0, skipped: 0, failed: [] };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const rel = file.path;
    const dest = path.join(targetPath, rel);

    report({ phase: "check", current: i + 1, total: files.length, file: rel });

    const { need, reason } = await needsUpdate(file, dest);
    if (!need) {
      results.skipped++;
      continue;
    }

    const url = file.url || (file.gdriveId ? driveUrl(file.gdriveId) : null);
    if (!url) {
      results.failed.push({ path: rel, error: "не задан url/gdriveId" });
      continue;
    }

    try {
      report({ phase: "download", current: i + 1, total: files.length, file: rel, reason, bytes: 0, bytesTotal: file.size || 0 });
      const dl = await downloadToFile(url, dest, (received, total) => {
        report({ phase: "download", current: i + 1, total: files.length, file: rel, reason, bytes: received, bytesTotal: total || file.size || 0 });
      }, { gdriveId: file.gdriveId });

      if (file.sha1 && dl.sha1.toLowerCase() !== String(file.sha1).toLowerCase()) {
        throw new Error("несовпадение SHA1 после загрузки");
      }
      results.updated++;
    } catch (err) {
      results.failed.push({ path: rel, error: err.message });
    }
  }

  report({ phase: "done", current: files.length, total: files.length });
  return results;
}

module.exports = { sha1File, loadManifest, runUpdate, downloadToFile, driveUrl, fetchBuffer };
