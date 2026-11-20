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

async function downloadUpdate({ url, destFile, sha1, size, onProgress }) {
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
  if (Number.isFinite(Number(size)) && Number(size) > 0 && dl.size !== Number(size)) {
    throw new Error(`Несовпадение размера обновления лаунчера: ожидалось ${size}, получено ${dl.size}`);
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

// Формирует содержимое apply-скрипта (чистая функция — пишется отдельно, удобно тестировать).
// Логика замены перенесена из старого бесконечного цикла в устойчивый протокол:
//   1) ждём завершения И процесса приложения (по PID), И portable-обёртки (по имени образа EXE) —
//      оба держат целевой файл открытым, пока живы;
//   2) заменяем с ретраями, НЕ глуша ошибку move (пишем её в лог);
//   3) при исчерпании ретраев — резервный путь copy /Y + del;
//   4) любой исход завершает скрипт (нет зависания без следов).
function buildApplyScript({ newExePath, targetExePath, pid }) {
  const dir = path.dirname(newExePath);
  const batPath = path.join(dir, "apply-launcher-update.bat");
  const logPath = path.join(dir, "apply-launcher-update.log");
  const targetName = path.basename(targetExePath);
  const content = [
    "@echo off",
    "setlocal",
    `set "TARGET=${targetExePath}"`,
    `set "SOURCE=${newExePath}"`,
    `set "PID=${pid}"`,
    `set "IMG=${targetName}"`,
    `set "LOG=${logPath}"`,
    `echo [%date% %time%] apply start TARGET=%TARGET% SOURCE=%SOURCE% PID=%PID%>>"%LOG%"`,
    // Ждём выхода приложения и portable-обёртки. Ограничено по числу итераций (~5 мин),
    // чтобы при неустранимом состоянии не зависать навсегда.
    "set /a w=0",
    ":wait",
    "set /a w+=1",
    "if %w% GEQ 300 goto timeout",
    `tasklist /FI "PID eq %PID%" 2>nul | find "%PID%" >nul`,
    "if not errorlevel 1 goto wait_pause",
    `tasklist /FI "IMAGENAME eq %IMG%" 2>nul | find /I "%IMG%" >nul`,
    "if not errorlevel 1 goto wait_pause",
    `echo [%date% %time%] launcher processes exited (waited %w%)>>"%LOG%"`,
    "goto replace",
    ":wait_pause",
    "ping -n 2 127.0.0.1 >nul",
    "goto wait",
    // Подмена: ошибка move НЕ глушится, а пишется в лог — раньше это скрывало причину сбоя.
    "set /a r=0",
    ":replace",
    `move /Y "%SOURCE%" "%TARGET%" >>"%LOG%" 2>&1`,
    "if not errorlevel 1 goto replace_ok",
    "set /a r+=1",
    "if %r% GEQ 300 goto fallback",
    "ping -n 2 127.0.0.1 >nul",
    "goto replace",
    ":replace_ok",
    `echo [%date% %time%] move OK (failed tries: %r%)>>"%LOG%"`,
    "goto launch",
    // Резервный путь, если move не срабатывает (например, удержание файла оболочкой/AV).
    ":fallback",
    `echo [%date% %time%] move failed %r% times -> copy fallback>>"%LOG%"`,
    `copy /Y "%SOURCE%" "%TARGET%" >>"%LOG%" 2>&1`,
    "if errorlevel 1 goto giveup",
    `del /F /Q "%SOURCE%" >>"%LOG%" 2>&1`,
    `echo [%date% %time%] copy fallback OK>>"%LOG%"`,
    "goto launch",
    ":giveup",
    `echo [%date% %time%] UPDATE FAILED: cannot replace target>>"%LOG%"`,
    "goto end",
    ":timeout",
    `echo [%date% %time%] UPDATE FAILED: timeout waiting for processes>>"%LOG%"`,
    "goto end",
    ":launch",
    `start "" "%TARGET%"`,
    ":end",
    "(goto) 2>nul & del \"%~f0\""
  ].join("\r\n");
  return { batPath, logPath, content };
}

// Запускает отсоединённый .bat, который дождётся выхода текущего процесса,
// подменит exe и перезапустит его. На Windows работает, т.к. сам Electron уже завершится.
function applyUpdateAndRestart({ newExePath, targetExePath, pid }) {
  const { batPath, content } = buildApplyScript({ newExePath, targetExePath, pid });
  fs.writeFileSync(batPath, content, "utf8");

  let child;
  try {
    child = spawn(resolveCmdExe(), ["/c", batPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      // CWD — рядом с целевым EXE, а НЕ в каталоге распаковки portable-обёртки:
      // иначе её самоочистка не сможет удалить временный каталог, удерживая целевой файл.
      cwd: path.dirname(targetExePath),
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

module.exports = { parseVersion, isNewer, checkForUpdate, downloadUpdate, buildApplyScript, applyUpdateAndRestart, loadVersionInfo };
