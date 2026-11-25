const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const updater = require("./updater");

// Автообновление самого лаунчера: проверка версии по манифесту, загрузка нового EXE,
// подмена собственного файла и перезапуск.

// Экранирование строки для использования внутри .bat (cmd.exe):
// удваиваем кавычки уже снаружи, здесь защищаем спецсимволы cmd.
function escapeBat(str) {
  return String(str)
    .replace(/\^/g, "^^")
    .replace(/&/g, "^&")
    .replace(/\|/g, "^|")
    .replace(/</g, "^<")
    .replace(/>/g, "^>")
    .replace(/%/g, "%%");
}

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

  const dl = await updater.downloadToFile(url, destFile, (received, total) => {
    if (onProgress) onProgress(received, total);
  });

  if (sha1 && dl.sha1.toLowerCase() !== String(sha1).toLowerCase()) {
    throw new Error("Несовпадение SHA1 обновления лаунчера");
  }
  return dl;
}

// Запускает отсоединённый .bat, который дождётся выхода текущего процесса,
// подменит exe и перезапустит его. На Windows работает, т.к. сам Electron уже завершится.
function applyUpdateAndRestart({ newExePath, targetExePath, pid }) {
  const batPath = path.join(path.dirname(newExePath), "apply-launcher-update.bat");
  const safeTarget = escapeBat(targetExePath);
  const safeSource = escapeBat(newExePath);
  const safePid = escapeBat(String(pid));
  const lines = [
    "@echo off",
    "setlocal",
    `set "TARGET=${safeTarget}"`,
    `set "SOURCE=${safeSource}"`,
    `set "PID=${safePid}"`,
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

  const child = spawn("cmd.exe", ["/c", batPath], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  return batPath;
}

module.exports = { parseVersion, isNewer, checkForUpdate, downloadUpdate, applyUpdateAndRestart, loadVersionInfo };
