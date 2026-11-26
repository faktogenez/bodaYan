const elements = {
  username: document.getElementById("username"),
  usernameError: document.getElementById("usernameError"),
  playBtn: document.getElementById("playBtn"),
  reportBtn: document.getElementById("reportBtn"),
  accountBtn: document.getElementById("accountBtn"),
  accountSlot: document.getElementById("accountSlot"),
  status: document.getElementById("statusText"),
  bgLayer: document.getElementById("bgLayer"),
  brandLogo: document.getElementById("brandLogo"),
  progressWrap: document.getElementById("progressWrap"),
  progressTrack: document.getElementById("progressTrack"),
  progressBar: document.getElementById("progressBar"),
  progressLabel: document.getElementById("progressLabel"),
  loginCard: document.getElementById("loginCard"),
  busyTitle: document.getElementById("busyTitle"),
  splash: document.getElementById("splash")
};

const nicknameValidation = window.NicknameValidation;
const LEGACY_USERNAME_KEYS = ["appleLauncher.username", "minecraft_username"];
const LAST_BACKGROUND_KEY = "launcher.lastBackground";
// Собственный ключ для сохранения ника между сессиями (отдельно от legacy-ключей).
const SAVED_USERNAME_KEY = "launcher.username";

function clearNicknameState() {
  elements.username.value = "";
  try {
    for (const key of LEGACY_USERNAME_KEYS) localStorage.removeItem(key);
  } catch (_) {}
}

// Подставляет ник прошлой сессии, если он сохранён и проходит валидацию.
function restoreSavedNickname() {
  let saved = "";
  try {
    saved = localStorage.getItem(SAVED_USERNAME_KEY) || "";
  } catch (_) {}
  if (!saved) return;
  const validation = nicknameValidation.validate(saved);
  if (!validation.ok) {
    try { localStorage.removeItem(SAVED_USERNAME_KEY); } catch (_) {}
    return;
  }
  elements.username.value = validation.username;
  validateUsername();
}

// Запоминает ник для следующего запуска (только после успешного входа).
function saveNickname(username) {
  try { localStorage.setItem(SAVED_USERNAME_KEY, username); } catch (_) {}
}

// При старте очищаем browser autofill и legacy-ключи старых версий;
// сохранённый ник восстанавливается отдельно после инициализации.
clearNicknameState();

function usernameError(value) {
  return nicknameValidation.validate(value).message;
}

// Обновляет индикацию ошибки поля никнейма. Возвращает true, если ник валиден.
function validateUsername() {
  const error = usernameError(elements.username.value);
  const valid = !error;
  elements.username.classList.toggle("invalid", !valid);
  elements.usernameError.textContent = error;
  elements.usernameError.hidden = valid;
  return valid;
}

function formatBytes(bytes) {
  if (!bytes) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

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

// ---------- Визуальный слой (обложка) ----------

let visualConfig = null;
let backgrounds = [];

// Переносит координаты и параметры читаемости из visual-layout.json в CSS-переменные.
function applyLayout(config) {
  const root = document.documentElement.style;
  const { logo, loginForm, windowControls } = config.elements;
  root.setProperty("--logo-x", `${logo.x}vw`);
  root.setProperty("--logo-y", `${logo.y}vh`);
  root.setProperty("--logo-width", `${logo.width}vw`);
  root.setProperty("--form-x", `${loginForm.x}vw`);
  root.setProperty("--form-bottom", `${loginForm.bottom}vh`);
  root.setProperty("--form-width", `${loginForm.width}vw`);
  root.setProperty("--form-max-width", `${loginForm.maxWidth}px`);
  root.setProperty("--controls-right", `${windowControls.right}vw`);
  root.setProperty("--controls-top", `${windowControls.top}vh`);
  root.setProperty("--card-opacity", String(config.readability.cardOpacity / 100));
  root.setProperty("--blur", `${config.readability.cardBlur}px`);
  const tint = config.readability.leftGradientEnabled
    ? config.readability.leftGradientStrength / 100
    : 0;
  root.setProperty("--left-tint", String(tint));
  root.setProperty("--left-tint-soft", String(tint * 0.5));

  document.body.classList.toggle(
    "compact-layout",
    window.innerWidth < config.responsive.compactBelowWidth
  );
}

// Случайный фон при запуске с защитой от немедленного повтора (как в утверждённом макете).
function applyBackground() {
  if (!backgrounds.length) return;
  let previousId = "";
  try {
    previousId = localStorage.getItem(LAST_BACKGROUND_KEY) || "";
  } catch (_) {}

  const candidates = backgrounds.filter((item) => item.id !== previousId);
  const pool = candidates.length ? candidates : backgrounds;
  const picked = pool[Math.floor(Math.random() * pool.length)];

  elements.bgLayer.style.backgroundImage = `url("${picked.url}")`;
  const backgroundsConfig = (visualConfig && visualConfig.backgrounds) || {};
  elements.bgLayer.style.backgroundSize = backgroundsConfig.fit || "cover";
  const focal = backgroundsConfig.defaultFocalPoint || { x: 50, y: 50 };
  elements.bgLayer.style.backgroundPosition = `${focal.x}% ${focal.y}%`;

  try {
    localStorage.setItem(LAST_BACKGROUND_KEY, picked.id);
  } catch (_) {}
}

async function applyVisualLayer() {
  const model = await window.electronAPI.getVisualModel();
  if (!model) return;

  visualConfig = model.config;
  applyLayout(model.config);

  if (model.logo) {
    elements.brandLogo.src = model.logo;
    elements.brandLogo.addEventListener("error", () => { elements.brandLogo.hidden = true; });
  } else {
    elements.brandLogo.hidden = true;
  }

  backgrounds = model.backgrounds || [];
  applyBackground();
}

function setStatus(text, type = "info") {
  elements.status.textContent = text;
  elements.status.className = "status-bar " + type;
}

// Режим ожидания: во время загрузки/обновления форма входа и кнопка «Играть» скрыты,
// а вместо них показывается сообщение. Панель ложится поверх тем же прямоугольником,
// поэтому карточка остаётся статичной и текст не выходит за её рамки.
function setBusy(active, title) {
  elements.loginCard.classList.toggle("is-busy", active);
  if (active) {
    resetProgress();
    if (typeof title === "string") elements.busyTitle.textContent = title;
  }
}

// Автосбор диагностики при ошибках интерфейса: отчёт уходит в main и пишется на Рабочий стол.
window.addEventListener("error", (e) => {
  const err = e.error || { name: "Error", message: e.message, stack: "" };
  window.electronAPI.reportError("renderer:window.onerror", err);
});
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason;
  const err = r instanceof Error ? r : { name: "UnhandledRejection", message: String(r), stack: "" };
  window.electronAPI.reportError("renderer:unhandledrejection", err);
});

// Ручная отправка отчёта (кнопка «Сообщить об ошибке»).
async function sendReport() {
  elements.reportBtn.disabled = true;
  const prevStatus = elements.status.textContent;
  setStatus("Сбор диагностики…", "loading");
  try {
    const result = await window.electronAPI.sendReport({
      title: "Отчёт по запросу пользователя",
      scope: "manual",
      details: {
        lastStatus: prevStatus,
        username: elements.username.value
      }
    });
    if (result && result.ok) {
      setStatus("Отчёт сохранён: " + result.path, "success");
    } else {
      setStatus("Не удалось сохранить отчёт" + (result && result.error ? ": " + result.error : ""), "error");
    }
  } catch (err) {
    setStatus("Не удалось сохранить отчёт: " + err.message, "error");
  } finally {
    elements.reportBtn.disabled = false;
  }
}

// Определённый прогресс: label + процент. Если percent не задан — «бегущая» полоса.
// Индикатор показывается на месте ссылки «Создать аккаунт», поэтому карточка не смещается.
function showProgress(label, percent) {
  elements.progressWrap.hidden = false;
  elements.accountSlot.classList.add("is-loading");
  // Пока виден индикатор загрузки, нижняя строка статуса скрыта, чтобы её текст
  // не дублировал подпись прогресса (пространство сохраняется — карточка не смещается).
  elements.status.style.visibility = "hidden";
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
  elements.accountSlot.classList.remove("is-loading");
  elements.status.style.visibility = "";
  elements.progressTrack.classList.remove("indeterminate");
  elements.progressBar.style.width = "0%";
  elements.progressLabel.textContent = "";
}

window.electronAPI.onGameData(() => {
  setBusy(true, "Minecraft запускается — окно игры откроется автоматически");
  setStatus("Игра запускается...", "loading");
});

const PROGRESS_LABELS = {
  assets: "Загрузка ассетов",
  "assets-copy": "Копирование ассетов",
  natives: "Загрузка нативных библиотек",
  classes: "Загрузка библиотек",
  forge: "Подготовка Forge"
};

// Проверка/дозагрузка файлов игры. На время загрузки форма входа и кнопка «Играть» скрыты,
// вместо них показывается сообщение ожидания.
window.electronAPI.onUpdateProgress((p) => {
  if (!p) return;

  if (p.phase === "done") {
    setBusy(true, "Все файлы актуальны");
    setStatus("Все файлы актуальны", "info");
    setTimeout(() => { if (!elements.playBtn.disabled) setBusy(false); }, 1500);
    return;
  }

  if (p.phase === "check") {
    const percent = p.total ? Math.round((p.current / p.total) * 100) : 0;
    setBusy(true, `Проверка файлов: ${percent}%`);
    setStatus(`Проверка файлов... ${percent}%`, "loading");
    return;
  }

  // download
  const percent = p.bytesTotal
    ? Math.round((p.bytes / p.bytesTotal) * 100)
    : (p.total ? Math.round((p.current / p.total) * 100) : 0);
  const sizeInfo = p.bytesTotal ? ` — ${formatBytes(p.bytes)} / ${formatBytes(p.bytesTotal)}` : "";
  setBusy(true, `Загрузка файлов: ${percent}%${sizeInfo}`);
  setStatus(`Загрузка файлов... ${percent}%`, "loading");
});

// Загрузка ассетов/библиотек, выполняемая лаунчером Minecraft при запуске.
window.electronAPI.onGameProgress((p) => {
  if (!p || !p.total) return;
  const percent = Math.min(100, Math.round((p.task / p.total) * 100));
  const label = PROGRESS_LABELS[p.type] || "Загрузка";
  setBusy(true, `${label}: ${percent}%`);
  setStatus(`${label}... ${percent}%`, "loading");
});

window.electronAPI.onLauncherUpdate((u) => {
  if (!u) return;
  if (u.phase === "checking") {
    setBusy(true, `Проверяем обновления лаунчера (версия ${u.currentVersion})…`);
    setStatus("Проверяем новую версию лаунчера…", "loading");
    return;
  }
  if (u.phase === "up-to-date") {
    setBusy(false);
    setStatus("Установлена последняя версия лаунчера.", "success");
    return;
  }
  if (u.phase === "start") {
    setBusy(true, `Обновление лаунчера до ${u.version}…`);
    setStatus(`Найдено обновление лаунчера ${u.version}`, "loading");
    return;
  }
  if (u.phase === "downloading") {
    const percent = u.bytesTotal ? Math.round((u.bytes / u.bytesTotal) * 100) : 0;
    const sizeInfo = u.bytesTotal ? ` — ${formatBytes(u.bytes)} / ${formatBytes(u.bytesTotal)}` : "";
    setBusy(true, `Обновление лаунчера ${u.version}: ${percent}%${sizeInfo}`);
    setStatus(`Загрузка обновления лаунчера... ${percent}%`, "loading");
    return;
  }
  if (u.phase === "applying") {
    setBusy(true, `Обновление ${u.version} загружено. Перезапуск для применения…`);
    setStatus("Лаунчер перезапустится автоматически, чтобы применить обновление.", "loading");
    return;
  }
  if (u.phase === "ready") {
    setBusy(false);
    setStatus(`Обновление ${u.version} загружено. Перезапустите лаунчер.`, "info");
    return;
  }
  if (u.phase === "error") {
    setBusy(false);
    setStatus("Ошибка обновления лаунчера: " + u.message, "error");
  }
});

window.electronAPI.onGameClose((code) => {
  elements.playBtn.disabled = false;
  setBusy(false);
  resetProgress();
  setStatus(code === 0 ? "Игра закрыта" : `Игра закрыта с кодом ${code}`, code === 0 ? "info" : "error");
});

window.electronAPI.onGameError((err) => {
  elements.playBtn.disabled = false;
  setBusy(false);
  resetProgress();
  setStatus("Ошибка: " + err + " — отчёт сохранён на Рабочем столе", "error");
});

async function launchGame() {
  // Обязательная валидация: пустое или некорректное поле блокирует запуск игры.
  const validation = nicknameValidation.validate(elements.username.value);
  if (!validation.ok) {
    validateUsername();
    setStatus(elements.usernameError.textContent || "Введите никнейм", "error");
    elements.username.focus();
    return;
  }

  const username = validation.username;
  elements.playBtn.disabled = true;
  showProgress("Подготовка к запуску…");
  setStatus("Выполняется вход…", "loading");

  // Единственный путь авторизации — кнопка «Играть».
  let login;
  try {
    login = await window.electronAPI.loginByNickname(username);
  } catch (err) {
    login = { ok: false, message: "Ошибка входа: " + err.message };
  }
  const loggedInName = login && login.ok
    ? nicknameValidation.validate(login.username)
    : { ok: false };
  if (!login || !login.ok || !loggedInName.ok || loggedInName.username !== username) {
    elements.playBtn.disabled = false;
    resetProgress();
    setStatus((login && login.message) || "Не удалось выполнить вход.", "error");
    elements.username.focus();
    return;
  }

  elements.username.value = loggedInName.username;
  saveNickname(loggedInName.username);
  setStatus("Подготовка к запуску...", "loading");

  try {
    const result = await window.electronAPI.launchGame();
    if (result && result.ok) return;
    elements.playBtn.disabled = false;
    resetProgress();
    setStatus((result && result.message) || "Ошибка запуска", "error");
  } catch (err) {
    elements.playBtn.disabled = false;
    resetProgress();
    setStatus("Ошибка запуска: " + err.message, "error");
  }
}

// Прячет экран-заглушку после завершения инициализации лаунчера.
function hideSplash() {
  if (!elements.splash) return;
  elements.splash.classList.add("splash-hidden");
}

document.addEventListener("DOMContentLoaded", async () => {
  clearNicknameState();
  restoreSavedNickname();
  setStatus("Готов к запуску", "info");
  elements.playBtn.addEventListener("click", launchGame);
  elements.reportBtn.addEventListener("click", sendReport);
  elements.accountBtn.addEventListener("click", () => {
    setStatus("Создание аккаунта — заглушка, действие пока не подключено", "info");
  });
  elements.username.addEventListener("input", validateUsername);
  document.getElementById("minimizeBtn").addEventListener("click", () => window.electronAPI.minimize());
  document.getElementById("closeBtn").addEventListener("click", () => window.electronAPI.close());
  window.addEventListener("resize", () => {
    if (visualConfig) applyLayout(visualConfig);
  });

  try {
    const config = await window.electronAPI.getConfig();
    applyTheme(config && config.theme);
    await applyVisualLayer();
  } finally {
    // Заглушка держится на экране до полной инициализации и загрузки ресурсов.
    hideSplash();
  }
});
