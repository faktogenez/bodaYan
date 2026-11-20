const elements = {
  username: document.getElementById("username"),
  usernameError: document.getElementById("usernameError"),
  playBtn: document.getElementById("playBtn"),
  stopBtn: document.getElementById("stopBtn"),
  status: document.getElementById("statusText"),
  bgLayer: document.getElementById("bgLayer"),
  progressWrap: document.getElementById("progressWrap"),
  progressTrack: document.getElementById("progressTrack"),
  progressBar: document.getElementById("progressBar"),
  progressLabel: document.getElementById("progressLabel"),
  metaVersion: document.getElementById("metaVersion"),
  metaMemory: document.getElementById("metaMemory"),
  metaServer: document.getElementById("metaServer")
};

// Никнейм Minecraft: 3–16 символов, латиница/цифры/«_» (совпадает с проверкой в main.js).
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

function usernameError(value) {
  const name = (value || "").trim();
  if (!name) return "Введите никнейм";
  if (name.length < 3) return "Слишком короткий ник (минимум 3 символа)";
  if (!USERNAME_RE.test(name)) return "Только латиница, цифры и «_» (3–16 символов)";
  return "";
}

// Обновляет индикацию ошибки и доступность кнопки «Играть».
function validateUsername() {
  const error = usernameError(elements.username.value);
  const valid = !error;
  elements.username.classList.toggle("invalid", !valid);
  elements.usernameError.textContent = error;
  elements.usernameError.hidden = valid;
  elements.playBtn.disabled = !valid;
  return valid;
}

function formatMemory(value) {
  const num = parseInt(value, 10);
  if (!Number.isFinite(num)) return String(value);
  return num % 1024 === 0 ? `${num / 1024}G` : `${num}M`;
}

function applyMeta(config) {
  const launcher = (config && config.launcher) || {};
  const version = launcher.version || {};
  const server = launcher.server || {};
  const memory = launcher.memory || {};

  if (version.custom) elements.metaVersion.textContent = version.custom;
  if (memory.min || memory.max) {
    elements.metaMemory.textContent = `${formatMemory(memory.min)} / ${formatMemory(memory.max)}`;
  }
  if (server.host) elements.metaServer.textContent = `${server.host}:${server.port}`;
}

const PROGRESS_LABELS = {
  assets: "Загрузка ассетов",
  "assets-copy": "Копирование ассетов",
  natives: "Загрузка нативных библиотек",
  classes: "Загрузка библиотек",
  forge: "Подготовка Forge"
};

const THEME_VARS = {
  accent: "--accent",
  accentHover: "--accent-hover",
  textPrimary: "--text-primary",
  textSecondary: "--text-secondary",
  surface: "--surface",
  surfaceBorder: "--surface-border",
  inputBg: "--input-bg",
  inputBorder: "--input-border",
  backdropBlur: "--blur",
  backdropSaturate: "--saturate",
  radius: "--radius"
};

function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement.style;
  for (const [key, cssVar] of Object.entries(THEME_VARS)) {
    if (theme[key]) root.setProperty(cssVar, theme[key]);
  }
}

async function applyBackground() {
  const url = await window.electronAPI.getRandomBackground();
  if (url) elements.bgLayer.style.backgroundImage = `url("${url}")`;
}

function setStatus(text, type = "info") {
  elements.status.textContent = text;
  elements.status.className = "status-bar " + type;
}

function formatBytes(bytes) {
  if (!bytes) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// Определённый прогресс: label + процент. Если percent не задан — «бегущая» полоса.
function showProgress(label, percent) {
  elements.progressWrap.hidden = false;
  if (typeof percent === "number") {
    elements.progressTrack.classList.remove("indeterminate");
    elements.progressBar.style.width = Math.max(0, Math.min(100, percent)) + "%";
  } else {
    elements.progressTrack.classList.add("indeterminate");
  }
  elements.progressLabel.textContent = label || "";
}

function resetProgress() {
  elements.progressWrap.hidden = true;
  elements.progressTrack.classList.remove("indeterminate");
  elements.progressBar.style.width = "0%";
  elements.progressLabel.textContent = "";
}

window.electronAPI.onGameData(() => {
  showProgress("Запуск игры… окно Minecraft вот-вот откроется");
  setStatus("Игра запускается...", "loading");
});

const UPDATE_LABELS = {
  check: "Проверка файлов",
  download: "Загрузка файлов",
  done: "Проверка завершена"
};

window.electronAPI.onUpdateProgress((p) => {
  if (!p) return;
  const label = UPDATE_LABELS[p.phase] || "Обновление";

  if (p.phase === "done") {
    showProgress("Все файлы актуальны", 100);
    setStatus("Все файлы актуальны", "info");
    setTimeout(() => { if (!elements.playBtn.disabled) resetProgress(); }, 1500);
    return;
  }

  if (p.phase === "check") {
    const percent = p.total ? Math.round((p.current / p.total) * 100) : 0;
    showProgress(`Проверка файлов: ${p.file || ""} (${p.current}/${p.total})`, percent);
    setStatus(`Проверка файлов... ${percent}%`, "loading");
    return;
  }

  // download
  const percent = p.bytesTotal
    ? Math.round((p.bytes / p.bytesTotal) * 100)
    : (p.total ? Math.round((p.current / p.total) * 100) : 0);
  const sizeInfo = p.bytesTotal ? ` — ${formatBytes(p.bytes)} / ${formatBytes(p.bytesTotal)}` : "";
  showProgress(`Загрузка: ${p.file || ""}${sizeInfo}`, percent);
  setStatus(`Загрузка файлов... ${percent}%`, "loading");
});

window.electronAPI.onGameProgress((p) => {
  if (!p || !p.total) return;
  const percent = Math.min(100, Math.round((p.task / p.total) * 100));
  const label = PROGRESS_LABELS[p.type] || "Загрузка";
  showProgress(`${label}… ${percent}%`, percent);
  setStatus(`${label}... ${percent}%`, "loading");
});

window.electronAPI.onLauncherUpdate((u) => {
  if (!u) return;
  if (u.phase === "start") {
    showProgress(`Обновление лаунчера до ${u.version}…`);
    setStatus(`Найдено обновление лаунчера ${u.version}`, "loading");
    return;
  }
  if (u.phase === "downloading") {
    const percent = u.bytesTotal ? Math.round((u.bytes / u.bytesTotal) * 100) : 0;
    const sizeInfo = u.bytesTotal ? ` — ${formatBytes(u.bytes)} / ${formatBytes(u.bytesTotal)}` : "";
    showProgress(`Обновление лаунчера ${u.version}${sizeInfo}`, percent);
    setStatus(`Загрузка обновления лаунчера... ${percent}%`, "loading");
    return;
  }
  if (u.phase === "applying") {
    showProgress("Установка обновления, перезапуск…", 100);
    setStatus("Установка обновления лаунчера...", "loading");
    return;
  }
  if (u.phase === "ready") {
    setStatus(`Обновление ${u.version} загружено. Перезапустите лаунчер.`, "info");
    return;
  }
  if (u.phase === "error") {
    setStatus("Ошибка обновления лаунчера: " + u.message, "error");
  }
});

window.electronAPI.onGameClose((code) => {
  elements.stopBtn.hidden = true;
  elements.stopBtn.disabled = false;
  resetProgress();
  validateUsername();
  setStatus(code === 0 ? "Игра закрыта" : `Игра закрыта с кодом ${code}`, code === 0 ? "info" : "error");
});

window.electronAPI.onGameError((err) => {
  elements.stopBtn.hidden = true;
  elements.stopBtn.disabled = false;
  resetProgress();
  validateUsername();
  setStatus("Ошибка: " + err, "error");
});

async function launchGame() {
  if (!validateUsername()) {
    setStatus(elements.usernameError.textContent, "error");
    elements.username.focus();
    return;
  }

  const username = elements.username.value.trim();
  elements.playBtn.disabled = true;
  elements.stopBtn.hidden = false;
  elements.stopBtn.disabled = false;
  showProgress("Подготовка к запуску…");
  setStatus("Подготовка к запуску...", "loading");

  const result = await window.electronAPI.launchGame(username);
  if (!result.ok) {
    elements.stopBtn.hidden = true;
    resetProgress();
    validateUsername();
    setStatus(result.message || "Ошибка запуска", "error");
  }
}

async function stopGame() {
  elements.stopBtn.disabled = true;
  setStatus("Остановка игры...", "loading");
  const result = await window.electronAPI.stopGame();
  if (!result.ok) {
    elements.stopBtn.disabled = false;
    setStatus(result.message || "Не удалось остановить игру", "error");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  elements.playBtn.addEventListener("click", launchGame);
  elements.stopBtn.addEventListener("click", stopGame);
  elements.username.addEventListener("input", validateUsername);
  document.getElementById("minimizeBtn").addEventListener("click", () => window.electronAPI.minimize());
  document.getElementById("closeBtn").addEventListener("click", () => window.electronAPI.close());

  const config = await window.electronAPI.getConfig();
  applyTheme(config && config.theme);
  applyMeta(config);
  if (config && config.launcher && config.launcher.defaultUsername) {
    elements.username.value = config.launcher.defaultUsername;
  }
  validateUsername();
  await applyBackground();

  setStatus("Готов к запуску", "info");
});
