const fs = require("fs");
const path = require("path");
const os = require("os");
const logger = require("./logger");

// Автоматизированный сбор диагностики при любых ошибках лаунчера.
// Пишет читаемый текстовый отчёт на Рабочий стол пользователя с уникальным именем,
// содержащим отметку времени. Отчёт содержит ошибку, стек, окружение, версии
// компонентов, ключевые пути и последние строки лога — этого достаточно, чтобы
// определить причину без дополнительных вопросов к пользователю.

// Контекст, который заполняет main.js (circular dependency: main -> diagnostic).
// Через configure() передаём пути/конфиг, чтобы отчёт был полным.
const ctx = {
  dataDir: "",
  exeDir: "",
  gameDir: "",
  config: null,
  javaPath: ""
};

function configure(partial) {
  Object.assign(ctx, partial || {});
}

// Последняя перехваченная ошибка (для отчёта, если пишем не из catch).
let lastError = null;

function captureError(err, scope) {
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    lastError = { scope: scope || "", name: e.name, message: e.message, stack: e.stack || "" };
  } catch (_) {
    // некритично
  }
}

// Каталог для отчётов: Рабочий стол, с отказоустойчивым fallback.
function reportDir() {
  const candidates = [];
  try {
    // eslint-disable-next-line global-require
    const { app } = require("electron");
    if (app && app.getPath) {
      // app.getPath("desktop") корректно учитывает перенаправление Рабочего стола (в т.ч. OneDrive).
      candidates.push(app.getPath("desktop"));
      candidates.push(app.getPath("home"));
    }
  } catch (_) {
    // electron недоступен (например, юнит-тест) — переходим к переменным окружения
  }
  // Рабочий стол, перенаправленный в OneDrive (частый случай на Windows).
  if (process.env.OneDrive) candidates.push(path.join(process.env.OneDrive, "Desktop"));
  if (process.env.OneDriveCommercial) candidates.push(path.join(process.env.OneDriveCommercial, "Desktop"));
  candidates.push(path.join(os.homedir(), "Desktop"));
  candidates.push(path.join(os.homedir(), "Рабочий стол"));
  candidates.push(ctx.dataDir);

  for (const dir of candidates) {
    try {
      if (dir && fs.existsSync(dir)) return dir;
    } catch (_) {
      // пробуем следующий вариант
    }
  }
  // Последний вариант: создаём «Desktop» в домашнем каталоге.
  const fallback = path.join(os.homedir(), "Desktop");
  try { fs.mkdirSync(fallback, { recursive: true }); } catch (_) {}
  return fallback;
}

// Имя файла: bodaYan-error-2026-11-21_14-30-05.log (при коллизии добавляется суффикс).
function buildFileName(now) {
  const pad = (n) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `bodaYan-error-${stamp}.log`;
}

function safe(fn, fallback = "") {
  try { return fn(); } catch (_) { return fallback; }
}

// Сводка конфига без чувствительных данных (только то, что важно для диагностики).
function configSummary(cfg) {
  if (!cfg) return null;
  const l = cfg.launcher || {};
  return {
    version: l.version,
    memory: l.memory,
    server: l.server,
    offline: l.offline,
    javaPath: l.javaPath || "(не задан)",
    gameDirectory: l.gameDirectory,
    updater: cfg.updater ? { enabled: cfg.updater.enabled, manifestUrl: cfg.updater.manifestUrl } : null,
    selfUpdate: cfg.selfUpdate
      ? { enabled: cfg.selfUpdate.enabled, manifestUrl: cfg.selfUpdate.manifestUrl, currentVersion: cfg.selfUpdate.currentVersion }
      : null,
    serversEnforce: cfg.servers ? cfg.servers.enforce : null
  };
}

// Собирает структуру отчёта (данные без записи файла).
function buildReport(title, context) {
  const now = new Date();
  const err = (context && context.error) || lastError;

  let electron = "";
  let app = null;
  try {
    // eslint-disable-next-line global-require
    const e = require("electron");
    app = e && e.app;
    electron = process.versions.electron || "";
  } catch (_) {}

  const cpus = safe(() => os.cpus(), []);
  const cpu0 = cpus[0] || {};

  const report = {
    generatedAt: now.toISOString(),
    title: title || "Неизвестная ошибка",
    scope: (context && context.scope) || (err && err.scope) || "",
    note: "Автоматический отчёт об ошибке лаунчера bodaYan. Передайте этот файл разработчику.",
    error: err
      ? { name: err.name, message: err.message, stack: err.stack, code: err.code }
      : null,
    context: (context && context.details) || null,
    app: {
      name: safe(() => (app ? app.getName() : "bodaYan Launcher"), "bodaYan Launcher"),
      version: safe(() => (app ? app.getVersion() : ""), ""),
      packaged: safe(() => (app ? app.isPackaged : false), false)
    },
    runtime: {
      electron: electron || process.versions.electron || "",
      chrome: process.versions.chrome || "",
      node: process.versions.node || "",
      v8: process.versions.v8 || "",
      pid: process.pid,
      ppid: process.ppid,
      uptimeSec: Math.round(process.uptime())
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      release: safe(() => os.release(), ""),
      type: safe(() => os.type(), ""),
      version: safe(() => os.version(), ""),
      cpu: cpu0.model || "",
      cores: cpus.length,
      totalMemMB: Math.round(safe(() => os.totalmem(), 0) / 1048576),
      freeMemMB: Math.round(safe(() => os.freemem(), 0) / 1048576)
    },
    paths: {
      dataDir: ctx.dataDir || "",
      exeDir: ctx.exeDir || "",
      gameDir: ctx.gameDir || "",
      cwd: process.cwd(),
      execPath: process.execPath,
      portableExecutableFile: process.env.PORTABLE_EXECUTABLE_FILE || "",
      portableExecutableDir: process.env.PORTABLE_EXECUTABLE_DIR || ""
    },
    javaPath: ctx.javaPath || "(не определено)",
    config: configSummary(ctx.config),
    env: {
      DEBUG: process.env.DEBUG || "",
      APPDATA: process.env.APPDATA || "",
      TEMP: process.env.TEMP || process.env.TMP || "",
      OS: process.env.OS || ""
    },
    recentLogs: safe(() => logger.getRecent(), [])
  };
  return report;
}

// Человекочитаемая текстовая форма отчёта.
function formatReport(r) {
  const L = [];
  const line = "-".repeat(72);
  const j = (v) => {
    try { return JSON.stringify(v, null, 2); } catch (_) { return String(v); }
  };

  L.push("=".repeat(72));
  L.push("bodaYan Launcher — отчёт об ошибке");
  L.push("=".repeat(72));
  L.push(`Что:      ${r.title}`);
  if (r.scope) L.push(`Где:      ${r.scope}`);
  L.push(`Время:    ${r.generatedAt}`);
  L.push(r.note);
  L.push("");

  L.push("ОШИБКА");
  L.push(line);
  if (r.error) {
    L.push(`Тип:      ${r.error.name || "-"}`);
    L.push(`Сообщение: ${r.error.message || "-"}`);
    if (r.error.code !== undefined && r.error.code !== null) L.push(`Код:      ${r.error.code}`);
    L.push("Стек:");
    L.push(r.error.stack || "(стек недоступен)");
  } else {
    L.push("(подробности ошибки отсутствуют)");
  }
  L.push("");

  if (r.context) {
    L.push("КОНТЕКСТ ВЫПОЛНЕНИЯ");
    L.push(line);
    L.push(j(r.context));
    L.push("");
  }

  L.push("ПРИЛОЖЕНИЕ");
  L.push(line);
  L.push(`Название:      ${r.app.name}`);
  L.push(`Версия:        ${r.app.version || "-"}`);
  L.push(`Собрано (exe): ${r.app.packaged ? "да" : "нет"}`);
  L.push("");

  L.push("СРЕДА ВЫПОЛНЕНИЯ");
  L.push(line);
  L.push(`Electron: ${r.runtime.electron || "-"}  Chrome: ${r.runtime.chrome || "-"}`);
  L.push(`Node:     ${r.runtime.node || "-"}  V8: ${r.runtime.v8 || "-"}`);
  L.push(`PID:      ${r.runtime.pid}  PPID: ${r.runtime.ppid}  Uptime: ${r.runtime.uptimeSec} c`);
  L.push("");

  L.push("СИСТЕМА");
  L.push(line);
  L.push(`${r.system.type} ${r.system.release} (${r.system.version})`);
  L.push(`Платформа: ${r.system.platform} ${r.system.arch}`);
  L.push(`CPU: ${r.system.cpu} (${r.system.cores} ядер)`);
  L.push(`RAM: ${r.system.freeMemMB} МБ свободно из ${r.system.totalMemMB} МБ`);
  L.push("");

  L.push("ПУТИ");
  L.push(line);
  L.push(`Данные:     ${r.paths.dataDir}`);
  L.push(`EXE:        ${r.paths.exeDir}`);
  L.push(`Игра:       ${r.paths.gameDir}`);
  L.push(`CWD:        ${r.paths.cwd}`);
  L.push(`execPath:   ${r.paths.execPath}`);
  if (r.paths.portableExecutableFile) L.push(`portable:   ${r.paths.portableExecutableFile}`);
  L.push(`Java:       ${r.javaPath}`);
  L.push("");

  L.push("КОНФИГУРАЦИЯ (сводка)");
  L.push(line);
  L.push(j(r.config));
  L.push("");

  L.push("ОКРУЖЕНИЕ");
  L.push(line);
  L.push(j(r.env));
  L.push("");

  L.push(`ПОСЛЕДНИЕ СТРОКИ ЛОГА (${r.recentLogs.length})`);
  L.push(line);
  if (r.recentLogs.length) L.push(r.recentLogs.join("\n"));
  else L.push("(лог пуст)");
  L.push("");
  L.push("=".repeat(72));

  return L.join("\n");
}

// Записывает отчёт на Рабочий стол. Возвращает { ok, path, error }.
function writeReport(title, context) {
  try {
    const now = new Date();
    const report = buildReport(title, context);
    const dir = reportDir();
    let filePath = path.join(dir, buildFileName(now));
    // Гарантируем уникальность, если два отчёта в одну секунду.
    let n = 1;
    while (fs.existsSync(filePath)) {
      filePath = path.join(dir, buildFileName(now).replace(/\.log$/, `_${n}.log`));
      n++;
    }
    fs.writeFileSync(filePath, formatReport(report), "utf8");
    logger.error(`[diagnostic] отчёт записан: ${filePath}`);
    return { ok: true, path: filePath };
  } catch (err) {
    logger.error("[diagnostic] не удалось записать отчёт:", err && err.message);
    return { ok: false, error: err && err.message };
  }
}

// Полный цикл: перехватить ошибку и записать отчёт (используется обработчиками ошибок).
function handleError(title, err, context) {
  captureError(err, context && context.scope);
  return writeReport(title, { ...(context || {}), error: lastError });
}

module.exports = {
  configure,
  captureError,
  buildReport,
  writeReport,
  handleError,
  reportDir
};
