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

function resolveUpdateArtifact(remote, isPortable) {
  if (isPortable) {
    return {
      type: "portable",
      fileName: "bodaYan Launcher-update.exe",
      url: remote.url,
      sha1: remote.sha1,
      size: remote.size
    };
  }

  if (!remote.installerUrl) {
    throw new Error("В манифесте отсутствует installerUrl для установленной версии лаунчера");
  }

  return {
    type: "installer",
    fileName: "bodaYan Launcher Setup.exe",
    url: remote.installerUrl,
    sha1: remote.installerSha1,
    size: remote.installerSize
  };
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
// КРИТИЧНО: скрипт НЕ использует конвейеры (`|`) и внешние утилиты (tasklist/find).
// В detached-cmd (spawn: { detached:true, stdio:"ignore" }) конвейер вида `tasklist | find`
// зависает НАВСЕГДА, поэтому прежний `:wait`-цикл никогда не завершался и move не вызывался —
// именно это и было причиной остановки на 77%. Замена построена на чистой ретрай-логике:
//   повторяем `move /Y` (встроенная команда, без конвейеров), пока целевой файл занят
//   запущенным лаунчером/portable-обёрткой; как только оба процесса завершатся, move проходит.
//   1) при исчерпании ретраев — резервный путь copy /Y + del;
//   2) любой исход завершает скрипт (нет зависания без следов).
function buildApplyScript({ newExePath, targetExePath, pid }) {
  const dir = path.dirname(newExePath);
  const batPath = path.join(dir, "apply-launcher-update.bat");
  const logPath = path.join(dir, "apply-launcher-update.log");
  const content = [
    "@echo off",
    "setlocal",
    // PATH гарантирует наличие ping.exe; move/copy/del/start — встроенные команды cmd.
    `set "PATH=%SystemRoot%\\System32;%PATH%"`,
    `set "TARGET=${targetExePath}"`,
    `set "SOURCE=${newExePath}"`,
    `set "PID=${pid}"`,
    `set "LOG=${logPath}"`,
    `echo [%date% %time%] apply start TARGET=%TARGET% SOURCE=%SOURCE% PID=%PID%>>"%LOG%"`,
    // Если источник уже отсутствует — нечего подменять, просто перезапускаем прежний файл.
    `if not exist "%SOURCE%" goto nosource`,
    // Подмена: ошибка move НЕ глушится, а пишется в лог — иначе причина сбоя скрыта.
    "set /a r=0",
    ":replace",
    `move /Y "%SOURCE%" "%TARGET%" >>"%LOG%" 2>&1`,
    "if not errorlevel 1 goto replace_ok",
    "set /a r+=1",
    "if %r% GEQ 90 goto fallback",
    "ping -n 2 127.0.0.1 >nul",
    "goto replace",
    ":replace_ok",
    `echo [%date% %time%] move OK (tries: %r%)>>"%LOG%"`,
    "goto launch",
    // Резервный путь, если move не срабатывает (например, удержание файла оболочкой/AV).
    ":fallback",
    `echo [%date% %time%] move failed %r% times -> copy fallback>>"%LOG%"`,
    `copy /Y "%SOURCE%" "%TARGET%" >>"%LOG%" 2>&1`,
    "if errorlevel 1 goto giveup",
    `del /F /Q "%SOURCE%" >>"%LOG%" 2>&1`,
    `echo [%date% %time%] copy fallback OK>>"%LOG%"`,
    "goto launch",
    ":nosource",
    `echo [%date% %time%] SOURCE missing -> relaunch current target>>"%LOG%"`,
    "goto launch",
    ":giveup",
    `echo [%date% %time%] UPDATE FAILED: cannot replace target>>"%LOG%"`,
    "goto end",
    ":launch",
    `start "" "%TARGET%"`,
    ":end",
    "(goto) 2>nul & del \"%~f0\""
  ].join("\r\n");
  return { batPath, logPath, content };
}

function buildInstallerApplyScript({ installerPath, targetExePath }) {
  const dir = path.dirname(installerPath);
  const batPath = path.join(dir, "apply-launcher-installer-update.bat");
  const logPath = path.join(dir, "apply-launcher-installer-update.log");
  const backupPath = path.join(dir, path.basename(targetExePath) + ".update-backup");
  const content = [
    "@echo off",
    "setlocal",
    `set "TARGET=${targetExePath}"`,
    `set "BACKUP=${backupPath}"`,
    `set "SETUP=${installerPath}"`,
    `set "LOG=${logPath}"`,
    `echo [%date% %time%] installer update start TARGET=%TARGET%>>"%LOG%"`,
    `if not exist "%SETUP%" goto noinstaller`,
    "set /a r=0",
    ":replace",
    `move /Y "%TARGET%" "%BACKUP%" >>"%LOG%" 2>&1`,
    "if not errorlevel 1 goto install",
    "set /a r+=1",
    "if %r% GEQ 90 goto giveup",
    "ping -n 2 127.0.0.1 >nul",
    "goto replace",
    ":install",
    `echo [%date% %time%] target unlocked after %r% retries>>"%LOG%"`,
    `start /wait "" "%SETUP%" /S >>"%LOG%" 2>&1`,
    "if errorlevel 1 goto rollback",
    `if not exist "%TARGET%" goto rollback`,
    `del /F /Q "%BACKUP%" >>"%LOG%" 2>&1`,
    `echo [%date% %time%] installer update OK>>"%LOG%"`,
    `start "" "%TARGET%"`,
    "goto end",
    ":rollback",
    `echo [%date% %time%] installer failed; restoring previous EXE>>"%LOG%"`,
    `if exist "%BACKUP%" move /Y "%BACKUP%" "%TARGET%" >>"%LOG%" 2>&1`,
    `if exist "%TARGET%" start "" "%TARGET%"`,
    "goto end",
    ":noinstaller",
    `echo [%date% %time%] installer missing>>"%LOG%"`,
    `if exist "%TARGET%" start "" "%TARGET%"`,
    "goto end",
    ":giveup",
    `echo [%date% %time%] target EXE remained locked after %r% retries>>"%LOG%"`,
    `if exist "%TARGET%" start "" "%TARGET%"`,
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

function applyInstallerUpdateAndRestart({ installerPath, targetExePath }) {
  const { batPath, content } = buildInstallerApplyScript({ installerPath, targetExePath });
  fs.writeFileSync(batPath, content, "utf8");

  let child;
  try {
    child = spawn(resolveCmdExe(), ["/c", batPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      cwd: path.dirname(targetExePath),
      env: winEnv()
    });
  } catch (err) {
    throw new Error("не удалось запустить NSIS apply-скрипт: " + err.message);
  }
  child.on("error", (err) => {
    logger.error("[selfupdate] NSIS apply-скрипт не запущен:", err.message);
  });
  child.unref();
  return batPath;
}

module.exports = {
  parseVersion,
  isNewer,
  checkForUpdate,
  resolveUpdateArtifact,
  downloadUpdate,
  buildApplyScript,
  applyUpdateAndRestart,
  buildInstallerApplyScript,
  applyInstallerUpdateAndRestart,
  loadVersionInfo
};
