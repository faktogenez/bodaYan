// Автотест сетевого модуля (src/netsel.js): разбор адресов, дедупликация, выбор доступного
// адреса и реальная TCP-проба. Запуск: node scripts/test-netsel.js
const net = require("net");
const assert = require("assert");
const netsel = require("../src/netsel");

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  OK  ${name}`);
    })
    .catch((err) => {
      console.error(`FAIL  ${name}\n      ${err.message}`);
      process.exitCode = 1;
    });
}

async function main() {
  console.log("netsel tests");

  await check("parseAddr: host:port", () => {
    assert.deepStrictEqual(netsel.parseAddr("127.0.0.1:25565", 1), { host: "127.0.0.1", port: 25565 });
  });

  await check("parseAddr: без порта → defaultPort", () => {
    assert.deepStrictEqual(netsel.parseAddr("192.168.1.5", 25565), { host: "192.168.1.5", port: 25565 });
  });

  await check("parseAddr: IPv6 в скобках", () => {
    assert.deepStrictEqual(netsel.parseAddr("[::1]:25565", 1), { host: "::1", port: 25565 });
  });

  await check("parseAddr: пустая строка → null", () => {
    assert.strictEqual(netsel.parseAddr("", 25565), null);
  });

  await check("buildCandidates: дедупликация с сохранением порядка", () => {
    const out = netsel.buildCandidates(["127.0.0.1:25565", "1.2.3.4:25565", "127.0.0.1:25565", "1.2.3.4"], 25565);
    assert.deepStrictEqual(out, [
      { host: "127.0.0.1", port: 25565 },
      { host: "1.2.3.4", port: 25565 }
    ]);
  });

  await check("pickAddress: выбирает первый ДОСТУПНЫЙ (не первый в списке)", async () => {
    const probe = async (host) => host === "b";
    const picked = await netsel.pickAddress([{ host: "a", port: 1 }, { host: "b", port: 2 }], probe);
    assert.strictEqual(picked.host, "b");
  });

  await check("pickAddress: все недоступны → первый кандидат (фолбэк)", async () => {
    const probe = async () => false;
    const picked = await netsel.pickAddress([{ host: "a", port: 1 }, { host: "b", port: 2 }], probe);
    assert.strictEqual(picked.host, "a");
  });

  await check("pickAddress: пустой список → null", async () => {
    assert.strictEqual(await netsel.pickAddress([], async () => true), null);
  });

  await check("probeTcp: реальный сервер на локальном порту", async () => {
    const srv = net.createServer(() => {});
    await new Promise((res) => srv.listen(0, "127.0.0.1", res));
    const port = srv.address().port;
    const ok = await netsel.probeTcp("127.0.0.1", port, 1000);
    await new Promise((res) => srv.close(res));
    assert.strictEqual(ok, true);
  });

  await check("probeTcp: закрытый порт → false (не зависает)", async () => {
    const srv = net.createServer(() => {});
    await new Promise((res) => srv.listen(0, "127.0.0.1", res));
    const port = srv.address().port;
    await new Promise((res) => srv.close(res)); // порт освобождён
    const t0 = Date.now();
    const ok = await netsel.probeTcp("127.0.0.1", port, 700);
    assert.strictEqual(ok, false);
    assert.ok(Date.now() - t0 < 2000, "проба не должна длиться слишком долго");
  });

  console.log(`\n${passed} проверок пройдено.`);
}

main();
