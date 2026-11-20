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
    defaultUsername: "bodayan",
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
const DEFAULT_USERNAME = CONFIG.launcher.defaultUsername;
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

// Допустимый никнейм Minecraft: 3–16 символов, только латиница, цифры и «_».
// Важно для оффлайн-UUID: никнейм напрямую попадает в MD5("OfflinePlayer:" + name).
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

// Маркеры в логе игры, означающие, что клиент загрузился и отрисовал окно.
const GAME_START_MARKERS = ["Backend library:", "OpenAL initialized", "Sound engine started"];

let mainWindow = null;
let launching = false;
let gameStarted = false;
let gameProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: CONFIG.launcher.title,
    icon: path.join(ROOT, "assets", "icon.ico"),
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

  // Автопроверка при запуске: сначала самообновление лаунчера, затем целостность файлов игры.
  // Проверка файлов идёт ВСЕГДА при старте (если задан манифест), без участия пользователя.
  mainWindow.webContents.on("did-finish-load", () => {
    if (CONFIG.selfUpdate && CONFIG.selfUpdate.enabled) runSelfUpdate();
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
    const check = await selfUpdate.checkForUpdate({
      manifestUrl: s.manifestUrl,
      manifestPath: s.manifestPath,
      currentVersion: current
    });

    if (!check.hasUpdate) {
      logger.log(`[selfupdate] обновлений нет (текущая ${current}, удалённая ${check.remote.version})`);
      return { ok: true, hasUpdate: false, version: current };
    }

    const remote = check.remote;
    logger.log(`[selfupdate] доступно обновление ${remote.version} (текущая ${current})`);
    send({ phase: "start", version: remote.version, currentVersion: current });

    const dest = path.join(app.getPath("temp"), "AppleLauncher-update.exe");
    await selfUpdate.downloadUpdate({
      url: remote.url,
      destFile: dest,
      sha1: remote.sha1,
      onProgress: (received, total) => send({ phase: "downloading", version: remote.version, bytes: received, bytesTotal: total || remote.size || 0 })
    });

    if (s.autoApply === false) {
      send({ phase: "ready", version: remote.version, path: dest });
      return { ok: true, hasUpdate: true, downloaded: true, version: remote.version, path: dest };
    }

    // В portable-сборке electron-builder process.execPath указывает на распакованную
    // копию в %TEMP%, а исходный EXE пользователя задаётся переменной PORTABLE_EXECUTABLE_FILE.
    const targetExePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
    send({ phase: "applying", version: remote.version });
    selfUpdate.applyUpdateAndRestart({ newExePath: dest, targetExePath, pid: process.pid });
    setTimeout(() => app.quit(), 500);
    return { ok: true, hasUpdate: true, applied: true, version: remote.version };
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

// Оставить в списке серверов игры только серверы из config.json (servers.enforce).
function applyPinnedServers() {
  const s = CONFIG.servers || {};
  if (!s.enforce) return false;
  const list = Array.isArray(s.list) ? s.list.filter((x) => x && x.ip) : [];
  if (!list.length) return false;
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

ipcMain.handle("backgrounds:random", () => {
  const files = collectBackgrounds();
  if (!files.length) return null;
  const picked = files[Math.floor(Math.random() * files.length)];
  return pathToFileURL(picked).href;
});

ipcMain.handle("game:launch", async (event, username) => {
  if (launching) return { ok: false, message: "Игра уже запускается" };

  const name = (username || "").trim() || DEFAULT_USERNAME;
  if (!USERNAME_RE.test(name)) {
    return { ok: false, message: "Никнейм: 3–16 символов, только латиница, цифры и «_»" };
  }

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
  // Перед запуском оставляем в списке серверов только сервер из config.json.
  applyPinnedServers();

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
    return { ok: true };
  } catch (err) {
    launching = false;
    const msg = err && err.message ? err.message : String(err);
    logger.error("[launcher] launch failed", msg);
    diagnostic.handleError("Не удалось запустить игру", err, { scope: "game-launch", details: { username: name } });
    return { ok: false, message: msg };
  }
});

app.whenReady().then(() => {
  applyPinnedServers();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
