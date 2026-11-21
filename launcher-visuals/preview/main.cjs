const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const VISUAL_ROOT = path.resolve(__dirname, "..");
const CONFIG_DIR = path.join(VISUAL_ROOT, "config");
const CONFIG_PATH = path.join(CONFIG_DIR, "visual-layout.json");
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);
const NUMERIC_NAME = /^\d+$/;
const WATCH_DEBOUNCE_MS = 250;
let previewWindow;
let config;
let backgroundWatchers = [];
let backgroundRefreshTimer = null;

function readConfig() {
  const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  if (parsed.schemaVersion !== 1) {
    throw new Error(`Неподдерживаемая схема visual-layout.json: ${parsed.schemaVersion}`);
  }
  return parsed;
}

function resolveVisualPath(relativePath) {
  const resolved = path.resolve(CONFIG_DIR, relativePath);
  if (!resolved.startsWith(VISUAL_ROOT + path.sep)) {
    throw new Error(`Путь ресурса выходит за пределы launcher-visuals: ${relativePath}`);
  }
  return resolved;
}

function listImageNames(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() &&
      IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name);
}

function resolveBackgroundDirectory() {
  const optimizedDir = resolveVisualPath(config.backgrounds.optimizedDirectory);
  const sourceDir = resolveVisualPath(config.backgrounds.sourceDirectory);
  if (listImageNames(optimizedDir).length) return optimizedDir;
  return sourceDir;
}

function listBackgrounds() {
  const directory = resolveBackgroundDirectory();
  const names = listImageNames(directory);
  // Основной набор — файлы с чисто числовыми именами; конкретные номера
  // не прописаны в коде, поэтому новые фоны подхватываются автоматически.
  const numeric = names.filter((name) => NUMERIC_NAME.test(path.parse(name).name));
  const useNumeric = numeric.length > 0;
  const selected = useNumeric ? numeric : names;

  selected.sort(useNumeric
    ? (a, b) => Number(path.parse(a).name) - Number(path.parse(b).name)
    : (a, b) => a.localeCompare(b, "ru", { numeric: true }));

  return selected.map((name) => ({
    id: name,
    name: path.parse(name).name,
    url: pathToFileURL(path.join(directory, name)).href
  }));
}

function scheduleBackgroundRefresh() {
  clearTimeout(backgroundRefreshTimer);
  backgroundRefreshTimer = setTimeout(() => {
    if (!previewWindow || previewWindow.isDestroyed()) return;
    previewWindow.webContents.send("visual-preview:backgrounds-changed", listBackgrounds());
  }, WATCH_DEBOUNCE_MS);
}

function watchBackgroundDirectories() {
  const directories = [
    resolveVisualPath(config.backgrounds.optimizedDirectory),
    resolveVisualPath(config.backgrounds.sourceDirectory)
  ].filter((directory, index, list) => list.indexOf(directory) === index);

  for (const directory of directories) {
    if (!fs.existsSync(directory)) continue;
    try {
      backgroundWatchers.push(fs.watch(directory, scheduleBackgroundRefresh));
    } catch (error) {
      console.error("[visual-preview] Наблюдение недоступно:", directory, error.message);
    }
  }
}

function getVisualModel() {
  const logoPath = resolveVisualPath(config.elements.logo.asset);
  return {
    config,
    logo: fs.existsSync(logoPath) ? pathToFileURL(logoPath).href : null,
    backgrounds: listBackgrounds()
  };
}

function createWindow() {
  previewWindow = new BrowserWindow({
    title: "bodaYan — предпросмотр интерфейса",
    width: 920,
    height: 600,
    minWidth: 640,
    minHeight: 460,
    resizable: true,
    frame: false,
    backgroundColor: "#101014",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  previewWindow.removeMenu();
  previewWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  previewWindow.loadFile(path.join(__dirname, "preview.html"));
  previewWindow.once("ready-to-show", () => previewWindow.show());
  previewWindow.on("closed", () => { previewWindow = null; });
}

ipcMain.handle("visual-preview:model", () => getVisualModel());
ipcMain.handle("visual-preview:refresh", () => listBackgrounds());
ipcMain.handle("visual-preview:resize", (event, width, height) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || !Number.isInteger(width) || !Number.isInteger(height)) return false;
  window.setSize(width, height);
  window.center();
  return true;
});
ipcMain.on("visual-preview:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.on("visual-preview:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

app.whenReady().then(() => {
  try {
    config = readConfig();
    createWindow();
    watchBackgroundDirectories();
  } catch (error) {
    console.error("[visual-preview]", error);
    app.quit();
  }
});

app.on("will-quit", () => {
  for (const watcher of backgroundWatchers) watcher.close();
  backgroundWatchers = [];
});

app.on("window-all-closed", () => app.quit());
