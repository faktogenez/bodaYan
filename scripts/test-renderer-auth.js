const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const nicknameSession = require("../src/nicknameSession");
const nicknameValidation = require("../src/nicknameValidation");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const rendererSource = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");
const elementIds = [
  "username", "usernameError", "playBtn", "stopBtn", "reportBtn", "splash",
  "statusText", "bgLayer", "progressWrap", "progressTrack", "progressBar",
  "progressLabel", "metaVersion", "metaMemory", "metaServer", "minimizeBtn", "closeBtn"
];

class FakeElement {
  constructor(id) {
    this.id = id;
    this.value = "";
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.className = "";
    this.style = {};
    this.listeners = {};
    this.classList = { toggle() {}, add() {}, remove() {} };
  }

  addEventListener(type, callback) { this.listeners[type] = callback; }
  focus() {}
}

function makeRenderer(storage, options = {}) {
  const elements = Object.fromEntries(elementIds.map((id) => [id, new FakeElement(id)]));
  elements.username.value = options.autofilledValue || "";
  let domReady;
  let launcherUpdateHandler;
  const loginCalls = [];
  const launchCalls = [];
  const electronAPI = {
    getConfig: async () => ({}),
    getRandomBackground: async () => null,
    loginByNickname: async (username) => {
      loginCalls.push(username);
      return nicknameSession.login(username);
    },
    onGameData() {},
    onGameProgress() {},
    onGameClose() {},
    onGameError() {},
    onUpdateProgress() {},
    onLauncherUpdate: (callback) => { launcherUpdateHandler = callback; },
    reportError() {},
    sendReport: async () => ({ ok: true }),
    launchGame: async () => {
      launchCalls.push(true);
      if (options.launchError) throw options.launchError;
      return { ok: true };
    },
    stopGame: async () => ({ ok: true }),
    minimize() {},
    close() {}
  };
  const document = {
    getElementById: (id) => elements[id] || (elements[id] = new FakeElement(id)),
    documentElement: { style: { setProperty() {} } },
    addEventListener: (type, callback) => { if (type === "DOMContentLoaded") domReady = callback; }
  };
  const window = {
    electronAPI,
    NicknameValidation: nicknameValidation,
    addEventListener() {}
  };
  const context = {
    document,
    window,
    localStorage: storage,
    console,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(rendererSource, context, { filename: "renderer.js" });
  return {
    elements,
    loginCalls,
    launchCalls,
    domReady,
    emitUpdate: (event) => launcherUpdateHandler(event)
  };
}

async function initialize(app) {
  await app.domReady();
}

async function main() {
  console.log("renderer nickname login tests");
  const values = new Map([
    ["appleLauncher.username", "bodayan"],
    ["minecraft_username", "bodayan"]
  ]);
  const removedKeys = [];
  const storage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => {
      removedKeys.push(key);
      values.delete(key);
    }
  };

  nicknameSession.clear();
  const first = makeRenderer(storage, { autofilledValue: "bodayan" });
  assert.strictEqual(first.elements.username.value, "");
  console.log("  PASS при загрузке renderer немедленно очищает autofill-значение");
  first.elements.username.value = "bodayan";
  await initialize(first);
  assert.strictEqual(first.elements.username.value, "");
  assert.ok(removedKeys.includes("appleLauncher.username"));
  assert.ok(removedKeys.includes("minecraft_username"));
  assert.strictEqual(values.has("appleLauncher.username"), false);
  assert.strictEqual(values.has("minecraft_username"), false);
  assert.match(indexSource, /name="minecraftNickname"[^>]*autocomplete="off"/);
  assert.ok(indexSource.indexOf("src/nicknameValidation.js") < indexSource.indexOf("src/renderer.js"));
  console.log("  PASS legacy-хранилище очищено, browser autofill отключён");

  await first.elements.playBtn.listeners.click();
  assert.strictEqual(first.loginCalls.length, 0);
  assert.strictEqual(first.launchCalls.length, 0);
  assert.match(first.elements.usernameError.textContent, /Введите никнейм/);
  assert.match(first.elements.statusText.textContent, /Введите никнейм/);
  console.log("  PASS пустой ник блокирует запуск с понятной ошибкой");

  first.elements.username.value = "bodayan";
  await first.elements.playBtn.listeners.click();
  assert.strictEqual(first.loginCalls.length, 0);
  assert.strictEqual(first.launchCalls.length, 0);
  assert.match(first.elements.usernameError.textContent, /стандартным/);
  console.log("  PASS стандартный ник отклоняется");

  first.elements.username.value = "  Player_2026  ";
  await first.elements.playBtn.listeners.click();
  assert.deepStrictEqual(first.loginCalls, ["Player_2026"]);
  assert.strictEqual(first.launchCalls.length, 1);
  assert.strictEqual(first.elements.username.value, "Player_2026");
  assert.strictEqual(values.has("appleLauncher.username"), false);
  assert.strictEqual(values.has("minecraft_username"), false);
  console.log("  PASS кнопка «Играть» нормализует, отображает ник и запускает игру без сохранения");

  const second = makeRenderer(storage);
  await initialize(second);
  assert.strictEqual(second.elements.username.value, "");
  assert.strictEqual(second.loginCalls.length, 0);
  console.log("  PASS повторный запуск оставляет поле пустым");

  const launchFailure = makeRenderer(storage, { launchError: new Error("IPC offline") });
  await initialize(launchFailure);
  launchFailure.elements.username.value = "Player_2";
  await launchFailure.elements.playBtn.listeners.click();
  assert.strictEqual(launchFailure.elements.playBtn.disabled, false);
  assert.strictEqual(launchFailure.elements.stopBtn.hidden, true);
  assert.match(launchFailure.elements.statusText.textContent, /IPC offline/);
  console.log("  PASS ошибка IPC запуска снимает блокировку интерфейса");

  second.emitUpdate({ phase: "checking", currentVersion: "1.0.12" });
  assert.match(second.elements.progressLabel.textContent, /Проверка обновлений/);
  second.emitUpdate({ phase: "downloading", version: "1.0.13", bytes: 50, bytesTotal: 100 });
  assert.strictEqual(second.elements.progressBar.style.width, "50%");
  second.emitUpdate({ phase: "applying", version: "1.0.13", restartRequired: true });
  assert.match(second.elements.statusText.textContent, /перезапустится автоматически/);
  console.log("  PASS проверка/загрузка обновления показывает прогресс и предупреждает о перезапуске");
  console.log("\n8 проверок пройдено.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
