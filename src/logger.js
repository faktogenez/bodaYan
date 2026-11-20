const fs = require("fs");
const path = require("path");

// Легковесный логгер (Node-аналог [Conditional("DEBUG")]):
//   - всегда пишет в консоль (stdout/stderr);
//   - дополнительно дублирует в debug.log рядом с EXE, но ТОЛЬКО если задан process.env.DEBUG.
// Каталог лога задаётся через setLogDir() (в main.js — APP_DIR).

let logPath = path.join(process.cwd(), "debug.log");

// Кольцевой буфер последних строк в памяти. Пишется ВСЕГДА (независимо от DEBUG),
// чтобы диагностический отчёт об ошибке содержал свежий лог даже без включённого debug.log.
const RING_MAX = 300;
const ring = [];

function setLogDir(dir) {
  try {
    if (dir) logPath = path.join(dir, "debug.log");
  } catch (_) {
    // некритично — остаётся путь по умолчанию
  }
}

function getLogPath() {
  return logPath;
}

// Приводит аргументы к строке безопасно (объекты → JSON).
function format(args) {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return a.stack || a.message;
      try {
        return JSON.stringify(a);
      } catch (_) {
        return String(a);
      }
    })
    .join(" ");
}

function toRing(level, args) {
  try {
    ring.push(`[${new Date().toISOString()}] [${level}] ${format(args)}`);
    if (ring.length > RING_MAX) ring.shift();
  } catch (_) {
    // некритично
  }
}

function toFile(level, args) {
  if (!process.env.DEBUG) return;
  const line = `[${new Date().toISOString()}] [${level}] ${format(args)}\n`;
  try {
    fs.appendFileSync(logPath, line);
  } catch (_) {
    // ошибка записи лога не должна ломать работу лаунчера
  }
}

// Последние строки лога (для диагностического отчёта).
function getRecent() {
  return ring.slice();
}

function log(...args) {
  console.log(...args);
  toRing("LOG", args);
  toFile("LOG", args);
}

function warn(...args) {
  console.warn(...args);
  toRing("WARN", args);
  toFile("WARN", args);
}

function error(...args) {
  console.error(...args);
  toRing("ERROR", args);
  toFile("ERROR", args);
}

module.exports = { log, warn, error, setLogDir, getLogPath, getRecent };
