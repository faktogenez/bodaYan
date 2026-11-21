const assert = require("assert");

const port = Number(process.env.LAUNCHER_CDP_PORT || 9230);
const debugUrl = `http://127.0.0.1:${port}/json/list`;

async function waitFor(check, message, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${message}`);
}

async function main() {
  const targets = await fetch(debugUrl).then((response) => {
    if (!response.ok) throw new Error(`CDP endpoint returned ${response.status}`);
    return response.json();
  });
  const target = targets.find((entry) => entry.type === "page" && entry.url.includes("index.html"));
  assert.ok(target, "Не найдено окно AppleLauncher с index.html");

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 0;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  function send(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  }

  let gameStopConfirmed = false;
  try {
    await send("Runtime.enable");
    await waitFor(
      () => evaluate("document.readyState === 'complete' && document.getElementById('splash')?.classList.contains('splash-hidden')"),
      "окно инициализируется"
    );

    const initial = await evaluate(`(() => {
      const input = document.getElementById("username");
      return {
        value: input.value,
        saved: localStorage.getItem("launcher.username"),
        autocomplete: input.autocomplete,
        nickname: localStorage.getItem("minecraft_username"),
        previousKey: localStorage.getItem("appleLauncher.username")
      };
    })()`);
    assert.strictEqual(initial.autocomplete, "off");
    assert.strictEqual(initial.nickname, null, "minecraft_username должен быть удалён");
    assert.strictEqual(initial.previousKey, null, "appleLauncher.username должен быть удалён");
    if (initial.saved === null) {
      assert.strictEqual(initial.value, "", "Без сохранённого ника поле должно быть пустым");
      console.log("PASS: окно стартовало без сохранённого ника, autofill отключён, legacy-ключи удалены");
    } else {
      assert.strictEqual(initial.value, initial.saved, "Сохранённый ник должен подставляться автоматически");
      assert.match(initial.saved, /^[A-Za-z0-9_]{3,16}$/, "Сохранённый ник должен быть валидным");
      console.log("PASS: сохранённый ник подставлен автоматически, legacy-ключи удалены");
    }

    const empty = await evaluate(`(async () => {
      const input = document.getElementById("username");
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("playBtn").click();
      await new Promise(resolve => setTimeout(resolve, 10));
      return document.getElementById("usernameError").textContent;
    })()`);
    assert.match(empty, /Введите никнейм/);
    console.log("PASS: пустой ник блокируется с сообщением об ошибке");

    const standard = await evaluate(`(async () => {
      const input = document.getElementById("username");
      input.value = " BodaYan ";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("playBtn").click();
      await new Promise(resolve => setTimeout(resolve, 10));
      return document.getElementById("usernameError").textContent;
    })()`);
    assert.match(standard, /стандартным/);
    console.log("PASS: legacy-ник отклоняется без учёта регистра и внешних пробелов");

    const launchStub = process.env.LAUNCHER_SMOKE_START_GAME !== "1" && await evaluate(`(() => {
      const api = window.electronAPI;
      const original = api.launchGame;
      try {
        window.__nicknameSmokeLaunchCalls = 0;
        api.launchGame = async () => {
          window.__nicknameSmokeLaunchCalls += 1;
          return { ok: true };
        };
        if (api.launchGame === original) return false;
        window.__nicknameSmokeOriginalLaunch = original;
        return true;
      } catch (_) {
        return false;
      }
    })()`);

    if (process.env.LAUNCHER_SMOKE_START_GAME === "1") {
      await evaluate(`(async () => {
        const input = document.getElementById("username");
        input.value = "  SmokeUser_17  ";
        document.getElementById("playBtn").click();
      })()`);
      const accepted = await waitFor(async () => {
        const state = await evaluate(`({
          username: document.getElementById("username").value,
          status: document.getElementById("statusText").textContent
        })`);
        return state.username === "SmokeUser_17" && !state.status.includes("Выполняется вход")
          ? state
          : null;
      }, "валидный ник не прошёл вход по кнопке «Играть»");
      assert.strictEqual(accepted.username, "SmokeUser_17");
      console.log("PASS: кнопка «Играть» отображает нормализованный ник после реального IPC-входа");

      await waitFor(async () => {
        const result = await evaluate("window.electronAPI.stopGame()");
        if (!result || !result.ok) return null;
        gameStopConfirmed = true;
        return result;
      }, "Minecraft не запустился, остановка по IPC не подтвердилась", 90000);
      await waitFor(
        () => evaluate("document.getElementById('progressWrap').hidden && !document.getElementById('playBtn').disabled"),
        "интерфейс не восстановился после остановки игры"
      );
      console.log("PASS: smoke-игра остановлена через штатный IPC, UI восстановлен");
    } else if (launchStub) {
      await evaluate(`(async () => {
        const input = document.getElementById("username");
        input.value = "  SmokeUser_17  ";
        document.getElementById("playBtn").click();
        await new Promise(resolve => setTimeout(resolve, 100));
      })()`);
      const accepted = await waitFor(async () => {
        const state = await evaluate(`({
          username: document.getElementById("username").value,
          calls: window.__nicknameSmokeLaunchCalls
        })`);
        return state.username === "SmokeUser_17" && state.calls === 1 ? state : null;
      }, "валидный ник не прошёл renderer-flow");
      assert.strictEqual(accepted.username, "SmokeUser_17");
      console.log("PASS: кнопка «Играть» нормализует и отображает валидный ник");
      await evaluate("window.electronAPI.launchGame = window.__nicknameSmokeOriginalLaunch");
    } else {
      const login = await evaluate("window.electronAPI.loginByNickname('  SmokeUser_17  ')");
      assert.deepStrictEqual(login, { ok: true, username: "SmokeUser_17" });
      console.log("PASS: main IPC принимает и нормализует валидный ник");
      console.log("SKIP: API launchGame неизменяем, поэтому реальный запуск игры не запускался");
    }

    const failedRetry = await evaluate("window.electronAPI.loginByNickname('bodayan')");
    assert.strictEqual(failedRetry.ok, false);
    console.log("PASS: неудачный повторный вход отклонён и сбрасывает сессию");
  } finally {
    if (process.env.LAUNCHER_SMOKE_START_GAME === "1" && !gameStopConfirmed) {
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        try {
          const result = await evaluate("window.electronAPI.stopGame()");
          if (result && result.ok) break;
        } catch (_) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    try { await send("Browser.close"); } catch (_) {}
    socket.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
