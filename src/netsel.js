const net = require("net");

// Сетевые помощники для автоподбора адреса сервера.
// Вынесены в отдельный модуль, чтобы код можно было покрыть автотестами
// (scripts/test-netsel.js) без запуска Electron.

// Проверяет доступность TCP-порта: true, если соединение установлено за timeoutMs.
function probeTcp(host, port, timeoutMs = 700) {
  return new Promise((resolve) => {
    let done = false;
    const socket = new net.Socket();
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    try {
      socket.connect(port, host);
    } catch (_) {
      finish(false);
    }
  });
}

// Разбирает "host:port" в { host, port }; при отсутствии порта берётся defaultPort.
// Поддерживает IPv6 в скобках: "[::1]:25565".
function parseAddr(addr, defaultPort) {
  const s = String(addr || "").trim();
  if (!s) return null;
  // IPv6 в квадратных скобках
  if (s.startsWith("[")) {
    const close = s.indexOf("]");
    if (close === -1) return null;
    const host = s.slice(1, close);
    const rest = s.slice(close + 1).replace(/^:/, "");
    const port = parseInt(rest, 10) || defaultPort;
    return { host, port };
  }
  const idx = s.lastIndexOf(":");
  if (idx === -1) return { host: s, port: defaultPort };
  const host = s.slice(0, idx) || "127.0.0.1";
  const port = parseInt(s.slice(idx + 1), 10) || defaultPort;
  return { host, port };
}

// Преобразует список строк-кандидатов в уникальные { host, port } (порядок сохраняется).
function buildCandidates(list, defaultPort) {
  const seen = new Set();
  const out = [];
  for (const a of Array.isArray(list) ? list : []) {
    const parsed = parseAddr(a, defaultPort);
    if (!parsed || !parsed.host) continue;
    const key = `${parsed.host}:${parsed.port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }
  return out;
}

// Возвращает ПЕРВЫЙ ДОСТУПНЫЙ адрес из списка (по порядку приоритета).
// Если недоступны все — первый кандидат, чтобы список серверов не остался пустым.
// probe инъектируется для тестов (по умолчанию — реальная TCP-проба).
async function pickAddress(candidates, probe = probeTcp, onLog = null) {
  if (!candidates || !candidates.length) return null;
  for (const c of candidates) {
    if (await probe(c.host, c.port)) {
      if (onLog) onLog(`[servers] доступен адрес ${c.host}:${c.port}`);
      return c;
    }
  }
  const fallback = candidates[0];
  if (onLog) onLog(`[servers] ни один адрес не доступен, используется первый: ${fallback.host}:${fallback.port}`);
  return fallback;
}

module.exports = { probeTcp, parseAddr, buildCandidates, pickAddress };
