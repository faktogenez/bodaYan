const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");
const { Client } = require("minecraft-launcher-core");
const updater = require("./src/updater");
const servers = require("./src/servers");
const selfUpdate = require("./src/selfUpdate");
const nicknameSession = require("./src/nicknameSession");
const nicknameValidation = require("./src/nicknameValidation");
const logger = require("./src/logger");
const diagnostic = require("./src/diagnostic");

const ROOT = __dirname;

// Папка, из которой запущен EXE. В portable-сборке electron-builder распаковывает приложение
// в %TEMP%, поэтому реальную папку запуска берём из PORTABLE_EXECUTABLE_DIR, а не из process.execPath.
// Используется только для поиска встроенной JRE рядом с EXE и для миграции старых данных.
const EXE_DIR = app.isPackaged
  ? (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath))
  : ROOT;

// Постоянный каталог данных (записываемый). НЕ зависит от места EXE: при запуске EXE с рабочего
// стола рядом создавались бы config/minecraft/updater — теперь всё хранится в %APPDATA%\AppleLauncher.
// В dev-режиме используется корень проекта.
const DATA_DIR = app.isPackaged ? path.join(app.getPath("appData"), "AppleLauncher") : ROOT;

// Лог (debug.log в каталоге данных) — только при process.env.DEBUG.
logger.setLogDir(DATA_DIR);

// Однократный перенос игровых данных из старого каталога (рядом с EXE) в постоянный,
// чтобы пользователи предыдущих версий не качали модпак заново.
function migrateDataDir() {
  try {
    if (path.resolve(EXE_DIR) === path.resolve(DATA_DIR)) return;
    const from = path.join(EXE_DIR, "minecraft");
    const to = path.join(DATA_DIR, "minecraft");
    if (!fs.existsSync(from) || fs.existsSync(to)) return;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    try {
      fs.renameSync(from, to); // быстро, если оба каталога на одном диске
    } catch (_) {
      fs.cpSync(from, to, { recursive: true });
      fs.rmSync(from, { recursive: true, force: true });
    }
    logger.log("[data] игровые данные перенесены:", from, "->", to);
  } catch (err) {
    logger.error("[data] не удалось перенести игровые данные:", err.message);
  }
}
migrateDataDir();

// Встроенный шаблон конфига (в dev — в проекте, в сборке — в resources).
const BUNDLED_CONFIG = app.isPackaged
  ? path.join(process.resourcesPath, "config", "config.json")
  : path.join(ROOT, "config", "config.json");

const CONFIG_DIR = path.join(DATA_DIR, "config");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

// Первый запуск: внешний конфиг в каталоге данных создаётся из встроенного шаблона.
function ensureConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return;
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    if (fs.existsSync(BUNDLED_CONFIG)) {
      fs.copyFileSync(BUNDLED_CONFIG, CONFIG_PATH);
      logger.log("[config] создан внешний конфиг:", CONFIG_PATH);
    }
  } catch (err) {
    logger.error("[config] не удалось создать внешний конфиг:", err.message);
  }
}
ensureConfig();

const AUTHLIB_FIX_VERSION = "2.3.31";

const DEFAULT_CONFIG = {
  launcher: {
    title: "AppleLauncher",
    width: 920,
    height: 600,
    offline: true,
    server: { host: "127.0.0.1", port: 25565 },
    memory: { min: "2048", max: "4096" },
    version: { number: "1.16.5", type: "release", custom: "Forge 1.16.5" },
    javaPath: "",
    gameDirectory: path.join(DATA_DIR, "minecraft", "game")
  },
  theme: {},
  backgrounds: {
    path: path.join(ROOT, "assets", "backgrounds"),
    additionalPaths: [path.join(DATA_DIR, "assets", "backgrounds")]
  },
  updater: {
    enabled: true,
    manifestUrl: "",
    manifestPath: path.join(DATA_DIR, "updater", "manifest.json"),
    targetPath: path.join(DATA_DIR, "minecraft", "game")
  },
  servers: {
    enforce: true,
    name: "Мой сервер",
    // Кандидаты адреса сервера (в порядке приоритета). Лаунчер подключается к первому ДОСТУПНОМУ
    // (TCP-проба порта): 127.0.0.1 — для машины, где сервер запущен локально; далее сетевые адреса
    // того же сервера (Wi-Fi-локаль / Radmin VPN) — для второго компьютера. Список задаётся и здесь
    // (доставляется вместе с EXE), и в config.json (можно переопределить без пересборки).
    candidates: ["127.0.0.1:25565", "192.168.35.189:25565", "26.178.173.72:25565"],
    list: [{ name: "Мой сервер", ip: "127.0.0.1:25565" }]
  },
  selfUpdate: {
    enabled: false,
    manifestUrl: "",
    manifestPath: path.join(DATA_DIR, "updater", "launcher-version.json"),
    currentVersion: "1.0.0",
    autoApply: true
  }
};

function readConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return {
      launcher: { ...DEFAULT_CONFIG.launcher, ...(cfg.launcher || {}) },
      theme: { ...DEFAULT_CONFIG.theme, ...(cfg.theme || {}) },
      backgrounds: { ...DEFAULT_CONFIG.backgrounds, ...(cfg.backgrounds || {}) },
      updater: { ...DEFAULT_CONFIG.updater, ...(cfg.updater || {}) },
      servers: { ...DEFAULT_CONFIG.servers, ...(cfg.servers || {}) },
      selfUpdate: { ...DEFAULT_CONFIG.selfUpdate, ...(cfg.selfUpdate || {}) }
    };
  } catch (err) {
    logger.error("[config] не удалось прочитать config.json, используются значения по умолчанию:", err.message);
    return DEFAULT_CONFIG;
  }
}

const CONFIG = readConfig();
const GAME_DIR = CONFIG.launcher.gameDirectory;
const VERSION_CUSTOM = CONFIG.launcher.version.custom;
const VERSION_NUMBER = CONFIG.launcher.version.number;
const VERSION_TYPE = CONFIG.launcher.version.type;
const SERVER_HOST = CONFIG.launcher.server.host;
const SERVER_PORT = CONFIG.launcher.server.port;

// Контекст для диагностических отчётов: пути и конфиг, которые нужны модулю diagnostic.
diagnostic.configure({
  dataDir: DATA_DIR,
  exeDir: EXE_DIR,
  gameDir: GAME_DIR,
  config: CONFIG,
  javaPath: resolveJavaPath()
});

// Автосбор диагностики при необработанных ошибках/отклонённых промисах в главном процессе.
// Отчёт кладётся на Рабочий стол; лаунчер при этом продолжает работу.
process.on("uncaughtException", (err) => {
  diagnostic.handleError("Необработанное исключение (main process)", err, { scope: "uncaughtException" });
});
process.on("unhandledRejection", (reason) => {
  diagnostic.handleError("Необработанный отказ промиса (main process)", reason, { scope: "unhandledRejection" });
});

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

// Маркеры в логе игры, означающие, что клиент загрузился и отрисовал окно.
const GAME_START_MARKERS = ["Backend library:", "OpenAL initialized", "Sound engine started"];

let mainWindow = null;
let launching = false;
let gameStarted = false;
let gameProcess = null;

function createWindow() {
  const iconPath = process.platform === "win32"
    ? path.join(ROOT, "assets", "icon.ico")
    : (process.platform === "darwin"
        ? path.join(ROOT, "assets", "icon.icns")
        : path.join(ROOT, "assets", "icon.png"));
  mainWindow = new BrowserWindow({
    title: CONFIG.launcher.title,
    icon: iconPath,
    width: CONFIG.launcher.width,
    height: CONFIG.launcher.height,
    minWidth: 640,
    minHeight: 460,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: true,
    webPreferences: {
      preload: path.join(ROOT, "src", "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(ROOT, "index.html"));

  // Сначала проверяем self-update; при обновлении не запускаем фоновую загрузку модпака.
  // Проверка файлов игры начинается после self-update, если перезапуск не потребовался.
  mainWindow.webContents.on("did-finish-load", async () => {
    if (CONFIG.selfUpdate && CONFIG.selfUpdate.enabled) {
      const update = await runSelfUpdate();
      if (update && update.applied) return;
    }
    ensureGameFiles("startup");
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// Автообновление самого лаунчера: проверить версию, скачать новый EXE и перезапуститься.
async function runSelfUpdate() {
  const s = CONFIG.selfUpdate || {};
  if (!s.enabled) return { ok: true, skipped: true, message: "Автообновление лаунчера отключено" };
  if (!app.isPackaged) {
    logger.log("[selfupdate] пропуск: dev-режим (electron .) — обновление применяется только к собранному EXE");
    return { ok: true, skipped: true, message: "dev-режим" };
  }
  if (process.platform !== "win32") {
    logger.log("[selfupdate] пропуск: подмена запущенного EXE поддерживается только на Windows");
    return { ok: true, skipped: true, message: "Поддерживается только Windows" };
  }

  const send = (payload) => { if (mainWindow) mainWindow.webContents.send("launcher:update", payload); };

  try {
    // Текущую версию берём из самого EXE (app.getVersion), а НЕ из внешнего config.json:
    // внешний конфиг обновляется вручную и легко «застревает» на старой версии, из-за чего
    // self-update срабатывал при каждом запуске (в т.ч. бесконечным циклом).
    const current = app.getVersion();
    send({ phase: "checking", currentVersion: current });
    const check = await selfUpdate.checkForUpdate({
      manifestUrl: s.manifestUrl,
      manifestPath: s.manifestPath,
      currentVersion: current
    });

    if (!check.hasUpdate) {
      logger.log(`[selfupdate] обновлений нет (текущая ${current}, удалённая ${check.remote.version})`);
      send({ phase: "up-to-date", currentVersion: current });
      return { ok: true, hasUpdate: false, version: current };
    }

    const remote = check.remote;
    logger.log(`[selfupdate] доступно обновление ${remote.version} (текущая ${current})`);
    send({ phase: "start", version: remote.version, currentVersion: current });

    const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
    const artifact = selfUpdate.resolveUpdateArtifact(remote, isPortable);
    const dest = path.join(app.getPath("temp"), artifact.fileName);
    await selfUpdate.downloadUpdate({
      url: artifact.url,
      destFile: dest,
      sha1: artifact.sha1,
      size: artifact.size,
      onProgress: (received, total) => send({ phase: "downloading", version: remote.version, bytes: received, bytesTotal: total || artifact.size || 0 })
    });

    if (s.autoApply === false) {
      send({ phase: "ready", version: remote.version, path: dest, artifactType: artifact.type });
      return { ok: true, hasUpdate: true, downloaded: true, version: remote.version, path: dest, artifactType: artifact.type };
    }

    send({ phase: "applying", version: remote.version, restartRequired: true });
    if (artifact.type === "portable") {
      // В portable-сборке electron-builder process.execPath указывает на распакованную
      // копию в %TEMP%, а исходный EXE пользователя задаётся PORTABLE_EXECUTABLE_FILE.
      const targetExePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
      selfUpdate.applyUpdateAndRestart({ newExePath: dest, targetExePath, pid: process.pid });
    } else {
      // NSIS устанавливается per-user в каталог с правом записи; apply-скрипт ждёт
      // освобождения EXE, запускает Setup /S и возвращает лаунчер после обновления.
      selfUpdate.applyInstallerUpdateAndRestart({ installerPath: dest, targetExePath: process.execPath });
    }
    setTimeout(() => app.quit(), 500);
    return { ok: true, hasUpdate: true, applied: true, version: remote.version, artifactType: artifact.type };
  } catch (err) {
    logger.error("[selfupdate] ошибка:", err.message);
    diagnostic.handleError("Ошибка автообновления лаунчера", err, { scope: "selfupdate" });
    send({ phase: "error", message: err.message });
    return { ok: false, message: err.message };
  }
}

// Проверка целостности игровых файлов и дозагрузка недостающих/повреждённых из облака.
// Запускается автоматически: при старте лаунчера, по кнопке и перед запуском игры.
// Сравнивает sha1/размер каждого файла манифеста с локальным и качает только расхождения.
async function ensureGameFiles(reason) {
  const u = CONFIG.updater || {};
  if (!u.manifestUrl || u.enabled === false) {
    return { ok: true, skipped: true, message: "Манифест не задан" };
  }

  try {
    logger.log(`[updater] проверка целостности файлов (${reason})…`);
    const results = await updater.runUpdate({
      manifestUrl: u.manifestUrl,
      manifestPath: u.manifestPath,
      targetPath: u.targetPath,
      onProgress: (p) => {
        if (mainWindow) mainWindow.webContents.send("updater:progress", p);
      }
    });
    logger.log(`[updater] проверка завершена (${reason}):`, results);
    return { ok: results.failed.length === 0, results };
  } catch (err) {
    logger.error("[updater] ошибка:", err.message);
    diagnostic.handleError("Ошибка проверки/дозагрузки файлов", err, { scope: "updater", details: { reason } });
    return { ok: false, message: err.message };
  }
}

// Проверка доступности TCP-порта, разбор адресов и автоподбор рабочего адреса сервера
// (локаль 127.0.0.1 / LAN / Radmin VPN) вынесены в src/netsel.js.
const netsel = require("./src/netsel");

// Упорядоченный список адресов-кандидатов: config.servers.candidates → ip из servers.list →
// launcher.server. Дубликаты и некорректные записи отбрасываются.
function serverCandidates() {
  const s = CONFIG.servers || {};
  const raw = [];
  if (Array.isArray(s.candidates)) raw.push(...s.candidates);
  if (Array.isArray(s.list)) for (const it of s.list) if (it && it.ip) raw.push(it.ip);
  raw.push(`${SERVER_HOST}:${SERVER_PORT}`);
  return netsel.buildCandidates(raw, SERVER_PORT);
}

// Выбирает ПЕРВЫЙ ДОСТУПНЫЙ адрес сервера через TCP-пробы. Если недоступны все —
// возвращает первый кандидат (обычно 127.0.0.1), чтобы список серверов не остался пустым.
async function resolveServerAddress() {
  return netsel.pickAddress(serverCandidates(), netsel.probeTcp, (msg) => logger.log(msg));
}

// Оставить в списке серверов игры только сервер из config.json (servers.enforce),
// автоматически подставив первый ДОСТУПНЫЙ адрес (локаль / LAN / Radmin VPN).
async function applyPinnedServers() {
  const s = CONFIG.servers || {};
  if (!s.enforce) return false;
  const baseList = Array.isArray(s.list) ? s.list.filter((x) => x && x.ip) : [];
  if (!baseList.length) return false;

  const resolved = await resolveServerAddress();
  const list = baseList.map((x) => ({
    name: x.name || s.name || "Сервер",
    ip: resolved ? `${resolved.host}:${resolved.port}` : x.ip
  }));

  // Фиксируем выбранный адрес в конфиге, чтобы интерфейс показывал реальный сервер.
  if (resolved) CONFIG.launcher.server = { host: resolved.host, port: resolved.port };

  try {
    servers.writeServersDat(GAME_DIR, list);
    logger.log(`[servers] servers.dat перезаписан: ${list.length} сервер(ов) — ${list.map((x) => x.ip).join(", ")}`);
    return true;
  } catch (err) {
    logger.error("[servers] ошибка записи servers.dat:", err.message);
    return false;
  }
}

function collectBackgrounds() {
  const dirs = [CONFIG.backgrounds.path, ...(CONFIG.backgrounds.additionalPaths || [])];
  const files = [];
  for (const dir of dirs) {
    try {
      for (const file of fs.readdirSync(dir)) {
        if (IMAGE_EXTS.includes(path.extname(file).toLowerCase())) {
          files.push(path.join(dir, file));
        }
      }
    } catch (_) {
      // каталог может отсутствовать — пропускаем
    }
  }
  return files;
}

// ---------- Визуальный слой (обложка) ----------
// Единый источник визуальных ресурсов — каталог launcher-visuals: в dev он лежит в проекте,
// в сборке — в resources (см. extraResources в package.json). Конфиг раскладки — visual-layout.json.
const VISUAL_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, "launcher-visuals")
  : path.join(ROOT, "launcher-visuals");
const VISUAL_CONFIG_DIR = path.join(VISUAL_ROOT, "config");
const VISUAL_CONFIG_PATH = path.join(VISUAL_CONFIG_DIR, "visual-layout.json");
const VISUAL_IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".avif"];

function readVisualConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(VISUAL_CONFIG_PATH, "utf8"));
    if (parsed.schemaVersion !== 1) {
      logger.warn("[visual] неподдерживаемая схема visual-layout.json:", parsed.schemaVersion);
      return null;
    }
    return parsed;
  } catch (err) {
    logger.error("[visual] не удалось прочитать visual-layout.json:", err.message);
    return null;
  }
}

// Путь ресурса относительно каталога конфигурации; выход за пределы launcher-visuals запрещён.
function resolveVisualPath(relativePath) {
  const resolved = path.resolve(VISUAL_CONFIG_DIR, relativePath);
  if (!resolved.startsWith(VISUAL_ROOT + path.sep)) {
    logger.warn("[visual] путь ресурса вне launcher-visuals:", relativePath);
    return null;
  }
  return resolved;
}

function listVisualImages(directory) {
  if (!directory || !fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() &&
      VISUAL_IMAGE_EXTS.includes(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name);
}

// Фоны из launcher-visuals: приоритет — optimized, иначе source; берутся только числовые имена,
// поэтому новые фоны подхватываются автоматически без правок кода.
function listVisualBackgrounds(config) {
  const optimized = resolveVisualPath(config.backgrounds.optimizedDirectory);
  const source = resolveVisualPath(config.backgrounds.sourceDirectory);
  const directory = listVisualImages(optimized).length ? optimized : source;

  const numeric = listVisualImages(directory)
    .filter((name) => /^\d+$/.test(path.parse(name).name))
    .sort((a, b) => Number(path.parse(a).name) - Number(path.parse(b).name));

  return numeric.map((name) => ({
    id: name,
    name: path.parse(name).name,
    url: pathToFileURL(path.join(directory, name)).href
  }));
}

// Модель визуального слоя для renderer: конфиг раскладки, логотип и список фонов.
// Если каталог launcher-visuals недоступен — откатываемся на прежний набор assets/backgrounds.
function getVisualModel() {
  const config = readVisualConfig();
  if (!config) return null;

  const logoPath = resolveVisualPath(config.elements.logo.asset);
  let backgrounds = listVisualBackgrounds(config);

  if (!backgrounds.length) {
    backgrounds = collectBackgrounds().map((file) => ({
      id: path.basename(file),
      name: path.parse(file).name,
      url: pathToFileURL(file).href
    }));
  }

  return {
    config,
    logo: logoPath && fs.existsSync(logoPath) ? pathToFileURL(logoPath).href : null,
    backgrounds
  };
}

// Оффлайн-UUID (пиратский режим): MD5 от "OfflinePlayer:<ник>" с битами version 3 / RFC 4122.
// Тот же алгоритм, что используют Spigot/Paper при online-mode=false.
function offlineUUID(name) {
  const hash = crypto.createHash("md5").update("OfflinePlayer:" + name, "utf8").digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Фикс бага "Сетевая игра отключена" в Minecraft 1.16.5:
// authlib 2.1.28 при неудачной авторизации блокирует мультиплеер по умолчанию.
// Заменяем authlib на 2.3.31 в version JSON перед запуском.
function patchAuthlib(versionJsonPath) {
  try {
    if (!fs.existsSync(versionJsonPath)) return false;
    const raw = fs.readFileSync(versionJsonPath, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data.libraries)) return false;

    let changed = false;
    for (const lib of data.libraries) {
      if (lib.name && lib.name.startsWith("com.mojang:authlib:")) {
        const wanted = `com.mojang:authlib:${AUTHLIB_FIX_VERSION}`;
        if (lib.name !== wanted) {
          lib.name = wanted;
          if (lib.downloads && lib.downloads.artifact) {
            lib.downloads.artifact.url = `https://libraries.minecraft.net/com/mojang/authlib/${AUTHLIB_FIX_VERSION}/authlib-${AUTHLIB_FIX_VERSION}.jar`;
            delete lib.downloads.artifact.sha1;
            delete lib.downloads.artifact.size;
          }
          changed = true;
        }
      }
    }

    if (changed) {
      fs.writeFileSync(versionJsonPath, JSON.stringify(data, null, 2));
      logger.log(`[authlib] обновлён до ${AUTHLIB_FIX_VERSION} в ${path.basename(versionJsonPath)}`);
    }
    return changed;
  } catch (err) {
    logger.error("[authlib] ошибка патча:", err.message);
    return false;
  }
}

// Поиск Java 17: 1) явный путь из config.json; 2) встроенная JRE внутри EXE
// (resources/jre — extraResources); 3) JRE рядом с EXE (EXE_DIR/jre);
// 4) иначе пусто — minecraft-launcher-core возьмёт java/javaw из PATH.
function resolveJavaPath() {
  const configured = String(CONFIG.launcher.javaPath || "").trim();
  if (configured) {
    if (fs.existsSync(configured)) return configured;
    logger.warn("[java] путь из config.json не найден:", configured);
  }

  const bundled = process.resourcesPath || "";
  const candidates = process.platform === "win32"
    ? [
        path.join(bundled, "jre", "bin", "javaw.exe"),
        path.join(bundled, "jre", "bin", "java.exe"),
        path.join(EXE_DIR, "jre", "bin", "javaw.exe"),
        path.join(EXE_DIR, "jre", "bin", "java.exe"),
        path.join(ROOT, "jre", "bin", "javaw.exe")
      ]
    : [
        path.join(bundled, "jre", "bin", "java"),
        path.join(EXE_DIR, "jre", "bin", "java"),
        path.join(ROOT, "jre", "bin", "java")
      ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return "";
}

ipcMain.handle("window:minimize", () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.handle("window:close", () => { if (mainWindow) mainWindow.close(); });

// Принудительная остановка запущенного процесса игры (вместе с дочерними JVM).
function stopGame() {
  if (!gameProcess || !gameProcess.pid) return false;
  const pid = gameProcess.pid;
  try {
    if (process.platform === "win32") {
      const taskkill = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe");
      const child = spawn(taskkill, ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
      // spawn-ошибки асинхронные (событие "error") — без слушателя процесс упал бы uncaught.
      child.on("error", (err) => logger.error("[game] taskkill не запущен:", err.message));
    } else {
      gameProcess.kill("SIGTERM");
    }
    return true;
  } catch (err) {
    logger.error("[game] не удалось остановить игру:", err.message);
    return false;
  }
}

ipcMain.handle("game:stop", () => {
  if (!launching && !gameProcess) return { ok: false, message: "Игра не запущена" };
  return { ok: stopGame(), message: "Остановка игры" };
});

ipcMain.handle("config:get", () => CONFIG);
ipcMain.handle("auth:login", (_event, username) => nicknameSession.login(username));

// Ручная/автоматическая отправка отчёта из renderer (кнопка «Сообщить об ошибке»,
// window.onerror, неудачный вызов API). Возвращает путь к созданному файлу.
ipcMain.handle("diagnostics:report", (_event, payload) => {
  const p = payload || {};
  const err = p.error
    ? Object.assign(new Error(p.error.message || "Ошибка рендерера"), {
        name: p.error.name || "Error",
        stack: p.error.stack || ""
      })
    : null;
  return diagnostic.handleError(p.title || "Ошибка интерфейса лаунчера", err, {
    scope: p.scope || "renderer",
    details: p.details || null
  });
});

ipcMain.handle("updater:check", () => ensureGameFiles("manual"));

ipcMain.handle("launcher:checkUpdate", () => runSelfUpdate());

// Единая модель визуального слоя (обложка): конфиг раскладки, логотип, список фонов.
ipcMain.handle("visual:model", () => getVisualModel());

ipcMain.handle("game:launch", async () => {
  if (launching) return { ok: false, message: "Игра уже запускается" };

  const session = nicknameSession.requireAuthenticatedUser();
  if (!session.ok) return session;
  const validNickname = nicknameValidation.validate(session.username);
  if (!validNickname.ok) return { ok: false, message: validNickname.message };
  const name = validNickname.username;

  launching = true;

  // Перед запуском гарантируем наличие и целостность файлов игры — докачиваем недостающие.
  await ensureGameFiles("pre-launch");

  const versionDir = path.join(GAME_DIR, "versions", VERSION_CUSTOM);
  const versionJson = path.join(versionDir, VERSION_CUSTOM + ".json");

  if (!fs.existsSync(versionJson)) {
    launching = false;
    return { ok: false, message: `Не найдена версия ${VERSION_CUSTOM}. Проверьте соединение с интернетом и повторите запуск.` };
  }

  patchAuthlib(versionJson);
  const baseVersionJson = path.join(GAME_DIR, "versions", VERSION_NUMBER, VERSION_NUMBER + ".json");
  patchAuthlib(baseVersionJson);

  const offlineMode = CONFIG.launcher.offline !== false;
  const uuid = offlineUUID(name);

  const opts = {
    authorization: offlineMode
      ? {
          access_token: "0",
          client_token: uuid,
          uuid,
          name,
          user_properties: "{}",
          meta: { type: "mojang" }
        }
      : {
          access_token: "",
          client_token: uuid,
          uuid,
          name,
          user_properties: "{}",
          meta: { type: "msa" }
        },
    root: GAME_DIR,
    version: {
      number: VERSION_NUMBER,
      type: VERSION_TYPE,
      custom: VERSION_CUSTOM
    },
    memory: {
      min: String(CONFIG.launcher.memory.min),
      max: String(CONFIG.launcher.memory.max)
    },
    os: process.platform === "win32" ? "windows" : (process.platform === "darwin" ? "osx" : "linux"),
    customArgs: [
      "-XX:+IgnoreUnrecognizedVMOptions",
      "--add-opens=java.base/java.util=ALL-UNNAMED",
      "--add-opens=java.base/java.lang=ALL-UNNAMED",
      "--add-opens=java.base/java.lang.invoke=ALL-UNNAMED",
      "--add-opens=java.base/java.util.jar=ALL-UNNAMED",
      "--add-opens=java.base/sun.security.util=ALL-UNNAMED",
      "--add-opens=java.base/sun.net.www.protocol.jar=ALL-UNNAMED",
      "--add-opens=java.base/java.io=ALL-UNNAMED",
      "--add-opens=java.base/java.util.stream=ALL-UNNAMED",
      "--add-opens=java.base/java.nio=ALL-UNNAMED",
      "--add-opens=java.base/sun.nio.ch=ALL-UNNAMED",
      "-Dfml.earlyprogresswindow=false"
    ]
  };

  // Java: явный путь / встроенная JRE рядом с EXE; иначе — из PATH.
  const javaPath = resolveJavaPath();
  if (javaPath) {
    opts.javaPath = javaPath;
    logger.log("[java] используется:", javaPath);
  } else {
    logger.warn("[java] JRE не найдена рядом с EXE, будет использована java из PATH");
  }

  // Автоподключение к серверу отключено: игра всегда открывает главное меню Minecraft,
  // игрок сам выбирает «Одиночная игра» / «Сетевая игра».
  // Перед запуском оставляем в списке серверов только сервер из config.json, подставив
  // первый ДОСТУПНЫЙ адрес (локаль / LAN / Radmin VPN) — это ключ к работе со второго ноутбука.
  await applyPinnedServers();

  try {
    const client = new Client();
    gameStarted = false;

    client.on("data", (e) => {
      const text = String(e);
      if (mainWindow) mainWindow.webContents.send("game:data", text);

      // Как только игра отрисовала окно — скрываем лаунчер с экрана.
      if (!gameStarted && GAME_START_MARKERS.some((m) => text.includes(m))) {
        gameStarted = true;
        if (mainWindow) mainWindow.hide();
      }
    });
    client.on("progress", (e) => {
      if (mainWindow) mainWindow.webContents.send("game:progress", e);
    });
    client.on("close", (code) => {
      launching = false;
      gameStarted = false;
      gameProcess = null;
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send("game:close", code);
      }
    });
    client.on("error", (err) => {
      launching = false;
      gameStarted = false;
      gameProcess = null;
      const msg = err && err.message ? err.message : String(err);
      logger.error("[mlc error]", msg);
      diagnostic.handleError("Ошибка клиента Minecraft", err, { scope: "game-client" });
      if (mainWindow) {
        mainWindow.show();
        mainWindow.webContents.send("game:error", msg);
      }
    });
    client.on("debug", (e) => logger.log("[mlc debug]", e));

    gameProcess = await client.launch(opts);
    // MCLC при внутренней ошибке НЕ отклоняет промис, а возвращает null и пишет причину
    // только в debug. Без этой проверки UI «зависает» на последнем прогрессе (например 77%),
    // т.к. события game:error / game:close не приходят.
    if (!gameProcess) {
      launching = false;
      diagnostic.handleError(
        "MCLC: не удалось запустить игру (launch вернул null)",
        null,
        { scope: "game-launch/no-process", details: { username: name, version: VERSION_CUSTOM } }
      );
      return { ok: false, message: "Не удалось запустить игру. Отчёт сохранён на Рабочем столе." };
    }
    return { ok: true };
  } catch (err) {
    launching = false;
    const msg = err && err.message ? err.message : String(err);
    logger.error("[launcher] launch failed", msg);
    diagnostic.handleError("Не удалось запустить игру", err, { scope: "game-launch", details: { username: name } });
    return { ok: false, message: msg };
  }
});

app.whenReady().then(async () => {
  // Автоподбор адреса сервера до создания окна, чтобы интерфейс сразу показывал реальный адрес.
  try {
    await applyPinnedServers();
  } catch (err) {
    logger.error("[servers] автоподбор адреса не удался:", err.message);
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
