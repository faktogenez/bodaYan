const assert = require("assert");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const ELECTRON = path.join(PROJECT_ROOT, "node_modules", "electron", "dist", "electron.exe");
const PORT = 19337;
const PREVIEW_DIR = __dirname;
const OPTIMIZED_DIR = path.join(PROJECT_ROOT, "launcher-visuals", "backgrounds", "optimized");
const PROBE_BACKGROUND = path.join(OPTIMIZED_DIR, "999.webp");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getPageTarget(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await response.json();
      const page = targets.find((item) =>
        item.type === "page" && item.url.includes("preview.html") && item.webSocketDebuggerUrl
      );
      if (page) return page;
    } catch (_) {}
    await delay(250);
  }
  throw new Error("CDP target предпросмотра не появился");
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
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || "Renderer evaluation failed");
  }
  return response.result.value;
}

async function waitFor(cdp, expression, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return;
    await delay(200);
  }
  throw new Error(`Таймаут ожидания условия: ${expression}`);
}

async function main() {
  const child = spawn(ELECTRON, [`--remote-debugging-port=${PORT}`, PREVIEW_DIR], {
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
      const select = document.getElementById('backgroundSelect');
      return select && select.options.length > 0 &&
        document.getElementById('brandLogo').complete &&
        document.getElementById('brandLogo').naturalWidth > 0 &&
        document.getElementById('assetStatus').textContent.includes('Ресурсы загружены');
    })()`);

    const initial = await evaluate(cdp, `(() => {
      const card = document.querySelector('.preview-card').getBoundingClientRect();
      return {
        viewport: innerWidth + 'x' + innerHeight,
        backgroundCount: document.getElementById('backgroundSelect').options.length,
        optionNames: Array.from(document.getElementById('backgroundSelect').options)
          .map((option) => option.textContent),
        assetStatus: document.getElementById('assetStatus').textContent,
        logoLoaded: document.getElementById('brandLogo').naturalWidth > 0,
        backgroundApplied: getComputedStyle(document.getElementById('previewBackground')).backgroundImage !== 'none',
        cardVisible: card.width > 0 && card.height > 0,
        cardInsideViewport: card.left >= 0 && card.right <= innerWidth &&
          card.top >= 0 && card.bottom <= innerHeight,
        nicknameAlign: getComputedStyle(document.getElementById('username')).textAlign,
        nicknameLabelAlign: getComputedStyle(document.querySelector('label[for="username"]')).textAlign,
        onlineText: document.getElementById('onlineStatus').textContent.trim(),
        accountText: document.getElementById('accountBtn').textContent.trim(),
        closeIconColor: getComputedStyle(document.getElementById('closeBtn'), '::before').backgroundColor,
        minimizeIconColor: getComputedStyle(document.getElementById('minimizeBtn'), '::before').backgroundColor,
        controlShape: getComputedStyle(document.getElementById('closeBtn')).borderRadius
      };
    })()`);
    assert.ok(initial.backgroundCount > 0, "Фоны не найдены");
    assert.ok(
      initial.optionNames.every((name) => /^\d+$/.test(name)),
      `Имена фонов должны быть числовыми: ${initial.optionNames.join(", ")}`
    );
    assert.deepStrictEqual(
      initial.optionNames,
      [...initial.optionNames].sort((a, b) => Number(a) - Number(b)),
      "Фоны не упорядочены по возрастанию номера"
    );
    assert.ok(initial.logoLoaded, "Оптимизированный логотип не загрузился");
    assert.ok(initial.backgroundApplied, "Фоновое изображение не применено");
    assert.ok(initial.cardVisible, "Карточка входа не отображается");
    assert.ok(initial.cardInsideViewport, "Карточка выходит за границы стандартного окна");
    assert.match(initial.assetStatus, /фонов (\d+)\/\1/, "Не все фоны прошли загрузочную проверку");
    assert.strictEqual(initial.nicknameAlign, "center", "Введённый никнейм не центрирован");
    assert.strictEqual(initial.nicknameLabelAlign, "center", "Подпись поля не центрирована");
    assert.strictEqual(initial.onlineText, "Онлайн: 4/100", "Текст онлайн-счётчика не обновлён");
    assert.strictEqual(initial.accountText, "Создать аккаунт", "Подпись кнопки аккаунта не обновлена");
    assert.strictEqual(initial.closeIconColor, "rgb(255, 95, 86)", "Крестик закрытия не красный");
    assert.strictEqual(initial.minimizeIconColor, "rgb(255, 189, 46)", "Минус сворачивания не жёлтый");
    assert.notStrictEqual(initial.controlShape, "50%", "Остались круглые кнопки управления");
    console.log("PASS загрузка UI и ресурсов:", JSON.stringify(initial));

    const oldIndex = await evaluate(cdp, "document.getElementById('backgroundSelect').selectedIndex");
    await evaluate(cdp, "document.getElementById('nextBackgroundBtn').click()");
    await waitFor(cdp, `document.getElementById('backgroundSelect').selectedIndex !== ${oldIndex}`);
    console.log("PASS переключение фоновых изображений");

    const countBefore = await evaluate(cdp, "document.getElementById('backgroundSelect').options.length");
    fs.copyFileSync(path.join(OPTIMIZED_DIR, "1.webp"), PROBE_BACKGROUND);
    await waitFor(cdp,
      `document.getElementById('backgroundSelect').options.length === ${countBefore + 1}`);
    const namesAfterAdd = await evaluate(cdp,
      "Array.from(document.getElementById('backgroundSelect').options).map((option) => option.textContent)");
    assert.ok(namesAfterAdd.includes("999"), "Новый фон не подхватился без перезапуска");
    console.log("PASS новый фон обнаружен без перезапуска:", namesAfterAdd.length);

    fs.rmSync(PROBE_BACKGROUND, { force: true });
    await waitFor(cdp,
      `document.getElementById('backgroundSelect').options.length === ${countBefore}`);
    console.log("PASS удалённый фон убран из списка автоматически");

    await evaluate(cdp, "window.visualPreview.resize(640, 460)");
    await waitFor(cdp, "innerWidth === 640 && innerHeight === 460 && document.body.classList.contains('compact-layout')");
    const compact = await evaluate(cdp, `(() => {
      const card = document.querySelector('.preview-card').getBoundingClientRect();
      return {
        viewport: innerWidth + 'x' + innerHeight,
        compactClass: document.body.classList.contains('compact-layout'),
        cardInsideViewport: card.left >= 0 && card.right <= innerWidth &&
          card.top >= 0 && card.bottom <= innerHeight
      };
    })()`);
    console.log("Состояние компактной раскладки:", JSON.stringify(compact));
    assert.ok(compact.compactClass, "Компактная раскладка не включилась");
    assert.ok(compact.cardInsideViewport, "Карточка выходит за границы минимального окна");
    console.log("PASS минимальный размер и адаптивная раскладка:", JSON.stringify(compact));

    await evaluate(cdp, "document.getElementById('stateSelect').value='error'; document.getElementById('stateSelect').dispatchEvent(new Event('change'))");
    const errorState = await evaluate(cdp, `(() => ({
      visible: !document.getElementById('usernameError').hidden,
      text: document.getElementById('usernameError').textContent
    }))()`);
    assert.ok(errorState.visible && errorState.text, "Демо-состояние ошибки не отображается");
    assert.strictEqual(cdp.errors.length, 0, "В консоли предпросмотра есть ошибки");
    console.log("PASS состояние ошибки ввода; ошибок renderer-консоли нет");
  } finally {
    fs.rmSync(PROBE_BACKGROUND, { force: true });
    if (cdp) {
      try { await evaluate(cdp, "window.visualPreview.close()"); } catch (_) {}
      cdp.close();
    }
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
  console.error("FAIL предпросмотр:", error.message);
  process.exitCode = 1;
});
