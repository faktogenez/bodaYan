// CDP-проверка интегрированной обложки в реальном лаунчере (electron .).
// Запускает приложение, подключается к renderer и проверяет визуальный слой и раскладку.
const assert = require("assert");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
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

// Возвращает значение выражения, как только оно станет истинным (для проверок с ожиданием данных).
async function waitForValue(cdp, expression, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await evaluate(cdp, expression);
    if (value) return value;
    await delay(200);
  }
  throw new Error(`Таймаут ожидания значения: ${expression}`);
}

async function main() {
  // Гарантируем dev-режим: если в окружении случайно выставлен ELECTRON_FORCE_IS_PACKAGED,
  // Electron «притворится» собранным приложением и визуальный слой ищется в resources —
  // проверка обложки тогда ложно падает. Для чистоты прогона переменную убираем.
  const childEnv = { ...process.env };
  delete childEnv.ELECTRON_FORCE_IS_PACKAGED;
  const child = spawn(ELECTRON, [`--remote-debugging-port=${PORT}`, PROJECT_ROOT], {
    cwd: PROJECT_ROOT,
    env: childEnv,
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
        statusText: document.getElementById('statusText').textContent.trim(),
        savedNickname: localStorage.getItem('launcher.username'),
        nicknameValue: document.getElementById('username').value,
        legacyNickname: localStorage.getItem('appleLauncher.username'),
        legacyNickname2: localStorage.getItem('minecraft_username')
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
    assert.strictEqual(initial.legacyNickname, null, "Legacy-ключ appleLauncher.username не удалён");
    assert.strictEqual(initial.legacyNickname2, null, "Legacy-ключ minecraft_username не удалён");
    if (initial.savedNickname === null) {
      assert.strictEqual(initial.nicknameValue, "", "Без сохранённого ника поле должно быть пустым");
    } else {
      assert.strictEqual(initial.nicknameValue, initial.savedNickname, "Сохранённый ник не подставлен в поле");
      assert.match(initial.savedNickname, /^[A-Za-z0-9_]{3,16}$/, "Сохранённый ник невалиден");
    }
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
    // После снятия эмуляции размера ждём возврат раскладки к исходному окну, иначе замер
    // карточки может попасть на промежуточный кадр.
    await waitFor(cdp, "!document.body.classList.contains('compact-layout')");

    // Состояние загрузки: индикатор занимает место ссылки «Создать аккаунт», форма статична,
    // отдельной кнопки отмены/остановки нет (закрытие — только иконкой-крестиком).
    // Замеры «до» и «после» showProgress делаем в одном кадре — это исключает гонку с фоновым
    // обновлением и пересчётом раскладки, из-за которой карточка ложно «смещалась».
    const loading = await evaluate(cdp, `(() => {
      if (typeof window.showProgress !== 'function') return null;
      // Снимаем режим ожидания: проверяем именно индикатор на месте «Создать аккаунт»,
      // а не панель ожидания, которая тоже скрывает строку статуса.
      if (typeof window.setBusy === 'function') window.setBusy(false);
      const card = document.querySelector('.login-card');
      const before = card.getBoundingClientRect();
      window.showProgress('Проверка файлов…', 42);
      const after = card.getBoundingClientRect();
      const slot = document.getElementById('accountSlot').getBoundingClientRect();
      const wrap = document.getElementById('progressWrap').getBoundingClientRect();
      return {
        readyTop: Math.round(before.top),
        readyHeight: Math.round(before.height),
        cardTop: Math.round(after.top),
        cardHeight: Math.round(after.height),
        progressVisible: wrap.width > 0 && wrap.height > 0,
        progressInsideSlot: wrap.top >= slot.top - 1 && wrap.bottom <= slot.bottom + 1 &&
          wrap.left >= slot.left - 1 && wrap.right <= slot.right + 1,
        accountHidden: getComputedStyle(document.getElementById('accountBtn')).visibility === 'hidden',
        statusHidden: getComputedStyle(document.getElementById('statusText')).visibility === 'hidden',
        cancelButtons: Array.from(document.querySelectorAll('button')).filter((button) =>
          !button.hidden && button.offsetParent !== null &&
          /Остановить|Отмена/.test(button.textContent)).length
      };
    })()`);
    assert.ok(loading, "Функция showProgress недоступна в renderer");
    assert.ok(loading.progressVisible, "Индикатор загрузки не отображается");
    assert.ok(loading.progressInsideSlot, "Индикатор загрузки вышел за пределы места «Создать аккаунт»");
    assert.ok(loading.accountHidden, "Ссылка «Создать аккаунт» не скрыта в состоянии загрузки");
    assert.ok(loading.statusHidden, "Нижняя строка статуса не скрыта во время загрузки");
    assert.strictEqual(loading.cancelButtons, 0, "В состоянии загрузки появилась кнопка отмены/остановки");
    assert.strictEqual(loading.cardTop, loading.readyTop, "Карточка сместилась по вертикали в состоянии загрузки");
    assert.strictEqual(loading.cardHeight, loading.readyHeight, "Высота карточки изменилась в состоянии загрузки");
    console.log("PASS состояние загрузки: индикатор на месте «Создать аккаунт», форма статична, статус скрыт");
    // Сброс и чтение выполняем одним выражением: между двумя отдельными evaluate в renderer
    // могут прийти фоновые события обновления, которые снова включат режим ожидания и скроют строку.
    const statusAfterReset = await evaluate(cdp, `(() => {
      if (typeof window.setBusy === 'function') window.setBusy(false);
      if (typeof window.resetProgress === 'function') window.resetProgress();
      return getComputedStyle(document.getElementById('statusText')).visibility;
    })()`);
    assert.strictEqual(statusAfterReset, "visible", "Строка статуса не вернулась после завершения загрузки");

    // Состояние загрузки/обновления: форма входа и кнопка «Играть» скрыты, панель ожидания
    // занимает их место, карточка сохраняет размер — текст не выходит за рамки.
    const busy = await evaluate(cdp, `(() => {
      if (typeof window.setBusy !== 'function') return null;
      const card = document.getElementById('loginCard');
      const before = card.getBoundingClientRect();
      window.setBusy(true, 'Загрузка файлов: 42%');
      const after = card.getBoundingClientRect();
      const panel = document.getElementById('loginBusy');
      const result = {
        sameTop: Math.round(before.top) === Math.round(after.top),
        sameHeight: Math.round(before.height) === Math.round(after.height),
        panelVisible: panel.offsetParent !== null && getComputedStyle(panel).display !== 'none',
        formHidden: getComputedStyle(document.getElementById('username')).visibility === 'hidden',
        playHidden: getComputedStyle(document.getElementById('playBtn')).visibility === 'hidden',
        title: document.getElementById('busyTitle').textContent
      };
      window.setBusy(false);
      return result;
    })()`);
    assert.ok(busy, "Функция setBusy недоступна в renderer");
    assert.ok(busy.sameTop, "Карточка сместилась по вертикали в состоянии ожидания");
    assert.ok(busy.sameHeight, "Высота карточки изменилась в состоянии ожидания");
    assert.ok(busy.panelVisible, "Панель ожидания не отображается");
    assert.ok(busy.formHidden, "Форма ввода не скрыта во время загрузки");
    assert.ok(busy.playHidden, "Кнопка «Играть» не скрыта во время загрузки");
    assert.match(busy.title, /42%/, "Заголовок панели ожидания не обновился");
    console.log("PASS состояние ожидания: форма и кнопка скрыты, панель показана, карточка статична");

    // Живой подхват фонов: копируем картинку в пользовательскую папку без перезапуска лаунчера.
    // В dev-режиме каталог данных — корень проекта, поэтому папка совпадает с BACKGROUNDS_DIR из main.js.
    const userBackgroundsDir = path.join(PROJECT_ROOT, "backgrounds");
    const liveName = "__verify_live_bg.webp";
    const livePath = path.join(userBackgroundsDir, liveName);
    const sourceImage = path.join(PROJECT_ROOT, "launcher-visuals", "backgrounds", "optimized", "1.webp");
    fs.mkdirSync(userBackgroundsDir, { recursive: true });
    try {
      fs.copyFileSync(sourceImage, livePath);
      const appliedUrl = await waitForValue(cdp, `(() => {
        const bg = document.getElementById('bgLayer').style.backgroundImage;
        return bg.includes('${liveName}') ? bg : '';
      })()`);
      assert.ok(appliedUrl.includes(liveName), "Новый фон из папки не применился без перезапуска");
      console.log("PASS живой подхват: добавленный фон применён без перезапуска");

      fs.rmSync(livePath, { force: true });
      await waitFor(cdp, `!document.getElementById('bgLayer').style.backgroundImage.includes('${liveName}')`);
      console.log("PASS живой подхват: удалённый фон убран из ротации без перезапуска");
    } finally {
      fs.rmSync(livePath, { force: true });
    }

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
