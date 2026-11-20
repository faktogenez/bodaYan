const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const nicknameSession = require("../src/nicknameSession");

const rendererSource = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");
const elementIds = [
  "username", "usernameError", "loginBtn", "playBtn", "stopBtn", "reportBtn",
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

function makeRenderer(storage) {
  const elements = Object.fromEntries(elementIds.map((id) => [id, new FakeElement(id)]));
  let domReady;
  let launcherUpdateHandler;
  const apiCalls = [];
  const electronAPI = {
    getConfig: async () => ({}),
    getRandomBackground: async () => null,
    loginByNickname: async (username) => {
      apiCalls.push(username);
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
    launchGame: async () => ({ ok: true }),
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
  return { elements, apiCalls, domReady, emitUpdate: (event) => launcherUpdateHandler(event) };
}

async function initialize(app) {
  await app.domReady();
}

async function main() {
  console.log("renderer nickname login tests");
  const values = new Map();
  const storage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value))
  };

  nicknameSession.clear();
  const first = makeRenderer(storage);
  await initialize(first);
  assert.strictEqual(first.elements.username.value, "");
  console.log("  PASS первый запуск оставляет поле никнейма пустым");

  await first.elements.loginBtn.listeners.click();
  assert.strictEqual(first.apiCalls.length, 0);
  assert.match(first.elements.usernameError.textContent, /Введите никнейм/);
  console.log("  PASS пустой ник отклоняется с понятной ошибкой");

  first.elements.username.value = "bodayan";
  await first.elements.loginBtn.listeners.click();
  assert.strictEqual(first.apiCalls.length, 0);
  assert.match(first.elements.usernameError.textContent, /стандартный ник/);
  console.log("  PASS стандартный ник отклоняется");

  first.elements.username.value = "Player_2026";
  await first.elements.loginBtn.listeners.click();
  assert.deepStrictEqual(first.apiCalls, ["Player_2026"]);
  assert.strictEqual(values.get("appleLauncher.username"), "Player_2026");
  assert.strictEqual(first.elements.playBtn.disabled, false);
  assert.strictEqual(first.elements.loginBtn.hidden, true);
  console.log("  PASS успешный вход сохраняет ник и разрешает запуск");

  nicknameSession.clear();
  const second = makeRenderer(storage);
  await initialize(second);
  assert.strictEqual(second.elements.username.value, "Player_2026");
  assert.deepStrictEqual(second.apiCalls, ["Player_2026"]);
  assert.strictEqual(second.elements.playBtn.disabled, false);
  console.log("  PASS сохранённый ник подставляется и автоматически входит при следующем запуске");

  second.emitUpdate({ phase: "checking", currentVersion: "1.0.12" });
  assert.match(second.elements.progressLabel.textContent, /Проверка обновлений/);
  second.emitUpdate({ phase: "downloading", version: "1.0.13", bytes: 50, bytesTotal: 100 });
  assert.strictEqual(second.elements.progressBar.style.width, "50%");
  second.emitUpdate({ phase: "applying", version: "1.0.13", restartRequired: true });
  assert.match(second.elements.statusText.textContent, /перезапустится автоматически/);
  console.log("  PASS проверка/загрузка обновления показывает прогресс и предупреждает о перезапуске");
  console.log("\n6 проверок пройдено.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
