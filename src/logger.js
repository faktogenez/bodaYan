const fs = require("fs");
const path = require("path");

// Легковесный логгер (Node-аналог [Conditional("DEBUG")]):
//   - всегда пишет в консоль (stdout/stderr);
//   - дополнительно дублирует в debug.log рядом с EXE, но ТОЛЬКО если задан process.env.DEBUG.
// Каталог лога задаётся через setLogDir() (в main.js — APP_DIR).

let logPath = path.join(process.cwd(), "debug.log");

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

function toFile(level, args) {
  if (!process.env.DEBUG) return;
  const line = `[${new Date().toISOString()}] [${level}] ${format(args)}\n`;
  try {
    fs.appendFileSync(logPath, line);
  } catch (_) {
    // ошибка записи лога не должна ломать работу лаунчера
  }
}

function log(...args) {
  console.log(...args);
  toFile("LOG", args);
}

function warn(...args) {
  console.warn(...args);
  toFile("WARN", args);
}

function error(...args) {
  console.error(...args);
  toFile("ERROR", args);
}

module.exports = { log, warn, error, setLogDir, getLogPath };
