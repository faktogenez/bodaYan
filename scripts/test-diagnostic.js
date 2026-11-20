// Временный тест системы сбора диагностики (не входит в сборку).
const fs = require("fs");
const os = require("os");
const path = require("path");
const logger = require("../src/logger");
const diagnostic = require("../src/diagnostic");

diagnostic.configure({
  dataDir: path.join(os.homedir(), "AppData", "Roaming", "AppleLauncher"),
  exeDir: process.cwd(),
  gameDir: path.join(os.homedir(), "AppData", "Roaming", "AppleLauncher", "minecraft", "game"),
  config: { launcher: { version: { custom: "Forge 1.16.5" }, memory: { min: "2048", max: "4096" }, server: { host: "127.0.0.1", port: 25565 }, javaPath: "" } },
  javaPath: "C:\\jre\\bin\\javaw.exe"
});

function check(label, res) {
  const ok = res && res.ok && res.path && fs.existsSync(res.path);
  const size = ok ? fs.statSync(res.path).size : 0;
  console.log(`${ok ? "PASS" : "FAIL"} | ${label} | ${res && res.path} | ${size} Б`);
  return ok;
}

let allOk = true;

// Сценарий 1: обычное исключение (try/catch + handleError).
try {
  throw new Error("Тестовое исключение лаунчера");
} catch (err) {
  logger.log("[test] подготовка сценария 1");
  allOk = check("try/catch", diagnostic.handleError("Тестовое исключение", err, { scope: "test/throw" })) && allOk;
}

// Сценарий 2: отказ промиса.
Promise.reject(new Error("Тестовый unhandledRejection")).catch((r) => {
  allOk = check("unhandledRejection", diagnostic.handleError("Необработанный отказ промиса", r, { scope: "test/rejection" })) && allOk;

  // Сценарий 3: ручной отчёт без ошибки (кнопка пользователя).
  allOk = check("manual", diagnostic.writeReport("Отчёт по запросу пользователя", { scope: "manual", details: { lastStatus: "Готов к запуску" } })) && allOk;

  // Сценарий 4: ошибка в нестроковом виде (number).
  allOk = check("non-error", diagnostic.handleError("Странный тип ошибки", 42, { scope: "test/nonerror" })) && allOk;

  // Проверка содержимого отчёта (все обязательные секции + текст ошибки).
  logger.log("[test] маркер для секции логов");
  const first = diagnostic.writeReport("Проверка содержимого", {
    scope: "content",
    error: { name: "Error", message: "Тестовое исключение", stack: "Error: Тестовое исключение\n    at test" }
  });
  const text = fs.readFileSync(first.path, "utf8");
  const needles = [
    "bodaYan Launcher — отчёт об ошибке", "ОШИБКА", "СРЕДА ВЫПОЛНЕНИЯ", "СИСТЕМА",
    "ПУТИ", "КОНФИГУРАЦИЯ", "ОКРУЖЕНИЕ", "ПОСЛЕДНИЕ СТРОКИ ЛОГА", "Тестовое исключение",
    "маркер для секции логов"
  ];
  const missing = needles.filter((n) => !text.includes(n));
  const contentOk = missing.length === 0;
  console.log(`${contentOk ? "PASS" : "FAIL"} | содержимое | ${contentOk ? "все секции присутствуют" : "отсутствует: " + missing.join(", ")}`);
  allOk = allOk && contentOk;

  console.log("\n---- пример отчёта (первые 45 строк) ----");
  console.log(text.split("\n").slice(0, 45).join("\n"));

  console.log(`\nИТОГ: ${allOk ? "ВСЕ ТЕСТЫ ПРОЙДЕНЫ" : "ЕСТЬ ОШИБКИ"}`);
  process.exitCode = allOk ? 0 : 1;
});
