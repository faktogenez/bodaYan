const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const updater = require("./updater");
const logger = require("./logger");

// Автообновление самого лаунчера: проверка версии по манифесту, загрузка нового EXE,
// подмена собственного файла и перезапуск.

function parseVersion(v) {
  return String(v || "0")
    .trim()
    .replace(/^v/i, "")
    .split(".")
    .map((x) => parseInt(x, 10) || 0);
}

// true, если remote новее current (сравнение по numeric-сегментам).
function isNewer(remote, current) {
  const a = parseVersion(remote);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

// Манифест версии: { version, url, sha1?, size?, notes? } из URL или локального файла.
async function loadVersionInfo({ manifestUrl, manifestPath }) {
  if (manifestUrl) {
    const res = await updater.fetchBuffer(manifestUrl);
    if (res.statusCode !== 200) throw new Error("Манифест обновления: HTTP " + res.statusCode);
    return JSON.parse(res.buffer.toString("utf8"));
  }
  if (manifestPath) {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  }
  throw new Error("Не задан manifestUrl или manifestPath");
}

async function checkForUpdate({ manifestUrl, manifestPath, currentVersion }) {
  const remote = await loadVersionInfo({ manifestUrl, manifestPath });
  return { hasUpdate: isNewer(remote.version, currentVersion), remote, currentVersion };
}

async function downloadUpdate({ url, destFile, sha1, onProgress }) {
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  if (fs.existsSync(destFile)) fs.unlinkSync(destFile);
  // Свежая загрузка: убираем возможный фрагмент докачки от прежней попытки.
  const partFile = destFile + ".part";
  if (fs.existsSync(partFile)) fs.unlinkSync(partFile);

  const dl = await updater.downloadToFile(url, destFile, (received, total) => {
    if (onProgress) onProgress(received, total);
  });

  if (sha1 && dl.sha1.toLowerCase() !== String(sha1).toLowerCase()) {
    throw new Error("Несовпадение SHA1 обновления лаунчера");
  }
  return dl;
}

// Полный путь к cmd.exe: %ComSpec% надёжнее, чем поиск по PATH (в portable/PATH может быть урезан).
function resolveCmdExe() {
  return process.env.ComSpec || path.join(process.env.SystemRoot || "C:\\Windows", "System32", "cmd.exe");
}

// Окружение для дочернего cmd.exe: гарантируем %SystemRoot%\System32 в PATH.
// При урезанном PATH не находятся ни сам cmd.exe (при запуске по имени), ни его встроенные
// утилиты tasklist/find/ping/move — тогда apply-скрипт молча не сработает.
function winEnv() {
  const sys32 = path.join(process.env.SystemRoot || "C:\\Windows", "System32");
  const key = Object.keys(process.env).find((k) => k.toUpperCase() === "PATH") || "Path";
  const env = { ...process.env };
  const cur = env[key] || "";
  const has = cur
    .split(";")
    .some((p) => p.replace(/[\\/]+$/, "").toLowerCase() === sys32.toLowerCase());
  if (!has) env[key] = sys32 + ";" + cur;
  return env;
}

// Запускает отсоединённый .bat, который дождётся выхода текущего процесса,
// подменит exe и перезапустит его. На Windows работает, т.к. сам Electron уже завершится.
function applyUpdateAndRestart({ newExePath, targetExePath, pid }) {
  const batPath = path.join(path.dirname(newExePath), "apply-launcher-update.bat");
  const lines = [
    "@echo off",
    "setlocal",
    `set "TARGET=${targetExePath}"`,
    `set "SOURCE=${newExePath}"`,
    `set "PID=${pid}"`,
    ":wait",
    `tasklist /FI "PID eq %PID%" 2>nul | find "%PID%" >nul`,
    "if not errorlevel 1 (",
    "  ping -n 2 127.0.0.1 >nul",
    "  goto wait",
    ")",
    ":replace",
    `move /Y "%SOURCE%" "%TARGET%" >nul 2>&1`,
    "if errorlevel 1 (",
    "  ping -n 2 127.0.0.1 >nul",
    "  goto replace",
    ")",
    `start "" "%TARGET%"`,
    "(goto) 2>nul & del \"%~f0\""
  ];
  fs.writeFileSync(batPath, lines.join("\r\n"), "utf8");

  let child;
  try {
    child = spawn(resolveCmdExe(), ["/c", batPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: winEnv()
    });
  } catch (err) {
    throw new Error("не удалось запустить apply-скрипт: " + err.message);
  }
  // spawn-ошибки асинхронные (событие "error"), try/catch их не ловит —
  // без этого слушателя процесс падает uncaught-исключением при ENOENT.
  child.on("error", (err) => {
    logger.error("[selfupdate] apply-скрипт не запущен:", err.message);
  });
  child.unref();
  return batPath;
}

module.exports = { parseVersion, isNewer, checkForUpdate, downloadUpdate, applyUpdateAndRestart, loadVersionInfo };
