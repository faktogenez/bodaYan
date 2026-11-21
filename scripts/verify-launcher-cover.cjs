// CDP-проверка интегрированной обложки в реальном лаунчере (electron .).
// Запускает приложение, подключается к renderer и проверяет визуальный слой и раскладку.
const assert = require("assert");
const { spawn, execFileSync } = require("child_process");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ELECTRON = path.join(PROJECT_ROOT, "node_modules", "electron", "dist", "electron.exe");
const PORT = 19338;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getPageTarget(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await response.json();
      const page = targets.find((item) =>
        item.type === "page" && item.url.includes("index.html") && item.webSocketDebuggerUrl
      );
      if (page) return page;
    } catch (_) {}
    await delay(250);
  }
  throw new Error("CDP target лаунчера не появился");
}

function connectCdp(url) {
  const socket = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();
  const errors = [];

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown" ||
        (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")) {
      errors.push(message);
    }
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("CDP websocket connection failed")), { once: true });
  });

  return {
    ready,
    errors,
    close: () => socket.close(),
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
  };
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "Renderer evaluation failed");
  return response.result.value;
}

async function waitFor(cdp, expression, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return;
    await delay(200);
  }
  throw new Error(`Таймаут ожидания условия: ${expression}`);
}

async function main() {
  const child = spawn(ELECTRON, [`--remote-debugging-port=${PORT}`, PROJECT_ROOT], {
    cwd: PROJECT_ROOT,
    stdio: "ignore",
    windowsHide: true
  });
  let cdp;

  try {
    const target = await getPageTarget();
    cdp = connectCdp(target.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    await waitFor(cdp, `(() => {
      const logo = document.getElementById('brandLogo');
      const bg = document.getElementById('bgLayer');
      return document.getElementById('splash').classList.contains('splash-hidden') &&
        bg.style.backgroundImage !== '' &&
        (logo.hidden || (logo.complete && logo.naturalWidth > 0));
    })()`);

    const initial = await evaluate(cdp, `(() => {
      const card = document.querySelector('.login-card').getBoundingClientRect();
      return {
        viewport: innerWidth + 'x' + innerHeight,
        logoLoaded: document.getElementById('brandLogo').naturalWidth > 0,
        backgroundApplied: getComputedStyle(document.getElementById('bgLayer')).backgroundImage !== 'none',
        splashHidden: document.getElementById('splash').classList.contains('splash-hidden'),
        cardVisible: card.width > 0 && card.height > 0,
        cardInsideViewport: card.left >= 0 && card.right <= innerWidth &&
          card.top >= 0 && card.bottom <= innerHeight,
        nicknameAlign: getComputedStyle(document.getElementById('username')).textAlign,
        onlineText: document.getElementById('onlineStatus').textContent.trim(),
        accountText: document.getElementById('accountBtn').textContent.trim(),
        closeIconColor: getComputedStyle(document.getElementById('closeBtn'), '::before').backgroundColor,
        minimizeIconColor: getComputedStyle(document.getElementById('minimizeBtn'), '::before').backgroundColor,
        controlShape: getComputedStyle(document.getElementById('closeBtn')).borderRadius,
        statusText: document.getElementById('statusText').textContent.trim()
      };
    })()`);
    assert.ok(initial.logoLoaded, "Оптимизированный логотип не загрузился");
    assert.ok(initial.backgroundApplied, "Фоновое изображение не применено");
    assert.ok(initial.splashHidden, "Экран-заглушка не скрылся");
    assert.ok(initial.cardVisible, "Карточка входа не отображается");
    assert.ok(initial.cardInsideViewport, "Карточка выходит за границы стандартного окна");
    assert.strictEqual(initial.nicknameAlign, "center", "Введённый никнейм не центрирован");
    assert.strictEqual(initial.onlineText, "Онлайн: 4/100", "Текст онлайн-счётчика не обновлён");
    assert.strictEqual(initial.accountText, "Создать аккаунт", "Подпись кнопки аккаунта не обновлена");
    assert.strictEqual(initial.closeIconColor, "rgb(255, 95, 86)", "Крестик закрытия не красный");
    assert.strictEqual(initial.minimizeIconColor, "rgb(255, 189, 46)", "Минус сворачивания не жёлтый");
    assert.notStrictEqual(initial.controlShape, "50%", "Остались круглые кнопки управления");
    console.log("PASS загрузка UI и визуального слоя:", JSON.stringify(initial));

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 640, height: 460, deviceScaleFactor: 1, mobile: false
    });
    await waitFor(cdp, "innerWidth === 640 && document.body.classList.contains('compact-layout')");
    const compact = await evaluate(cdp, `(() => {
      const card = document.querySelector('.login-card').getBoundingClientRect();
      return {
        viewport: innerWidth + 'x' + innerHeight,
        compactClass: document.body.classList.contains('compact-layout'),
        cardInsideViewport: card.left >= 0 && card.right <= innerWidth &&
          card.top >= 0 && card.bottom <= innerHeight
      };
    })()`);
    assert.ok(compact.compactClass, "Компактная раскладка не включилась");
    assert.ok(compact.cardInsideViewport, "Карточка выходит за границы минимального окна");
    console.log("PASS минимальный размер и адаптивная раскладка:", JSON.stringify(compact));

    await cdp.send("Emulation.clearDeviceMetricsOverride");

    assert.strictEqual(cdp.errors.length, 0, "В консоли лаунчера есть ошибки");
    console.log("PASS ошибок renderer-консоли нет");
  } finally {
    if (cdp) cdp.close();
    if (child.exitCode === null) {
      try {
        execFileSync(path.join(process.env.SystemRoot, "System32", "taskkill.exe"), [
          "/PID", String(child.pid), "/T", "/F"
        ], { stdio: "ignore" });
      } catch (_) {
        child.kill();
      }
    }
  }
}

main().catch((error) => {
  console.error("FAIL лаунчер:", error.message);
  process.exitCode = 1;
});
