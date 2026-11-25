const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const crypto = require("crypto");
const { URL } = require("url");

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) bodaYan-Launcher";
const MAX_REDIRECTS = 5;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

// Безопасное соединение путей: запрещает выход за пределы targetPath (path traversal).
function safeJoin(targetPath, relPath) {
  const resolved = path.resolve(targetPath, relPath);
  const normalizedTarget = path.resolve(targetPath) + path.sep;
  if (!resolved.startsWith(normalizedTarget) && resolved !== path.resolve(targetPath)) {
    throw new Error(`Путь выходит за пределы целевой директории: ${relPath}`);
  }
  return resolved;
}

// Валидация URL: только http/https, корректный парсинг.
function assertSafeUrl(urlStr) {
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    throw new Error(`Некорректный URL: ${urlStr}`);
  }
  if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
    throw new Error(`Недопустимый протокол URL: ${u.protocol}`);
  }
  return u;
}

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
    const u = assertSafeUrl(urlStr);
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
async function downloadToFile(urlStr, destPath, onBytes, opts = {}) {
  const result = await streamDownload(urlStr, destPath, onBytes, opts, 0);
  return result;
}

function streamDownload(urlStr, destPath, onBytes, opts, redirects) {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) return reject(new Error("Слишком много редиректов"));
    const u = assertSafeUrl(urlStr);
    const mod = u.protocol === "http:" ? http : https;

    const req = mod.get(urlStr, { headers: { "User-Agent": USER_AGENT } }, (res) => {
      const { statusCode, headers } = res;

      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        res.resume();
        return resolve(streamDownload(new URL(headers.location, urlStr).href, destPath, onBytes, opts, redirects + 1));
      }
      if (statusCode !== 200) {
        res.resume();
        return reject(new Error("HTTP " + statusCode));
      }

      const contentType = String(headers["content-type"] || "");

      // Google Drive вернул страницу подтверждения — извлекаем токен и повторяем.
      if (contentType.includes("text/html") && opts.gdriveId && !opts._confirmed) {
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

      const total = parseInt(headers["content-length"] || "0", 10);
      const hash = crypto.createHash("sha1");
      const tmpPath = destPath + ".part";
      fs.mkdirSync(path.dirname(destPath), { recursive: true });

      const out = fs.createWriteStream(tmpPath);
      let received = 0;

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
    let dest;
    try {
      dest = safeJoin(targetPath, rel);
    } catch (err) {
      results.failed.push({ path: rel, error: err.message });
      continue;
    }

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
