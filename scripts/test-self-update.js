const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const selfUpdate = require("../src/selfUpdate");

async function main() {
  const payload = Buffer.from("bodaYan self-update integration fixture v1.0.14");
  const manifest = {
    version: "1.0.14",
    url: "",
    sha1: crypto.createHash("sha1").update(payload).digest("hex"),
    size: payload.length,
    notes: "fixture"
  };
  const server = http.createServer((req, res) => {
    if (req.url === "/manifest.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(manifest));
      return;
    }
    if (req.url === "/launcher.exe") {
      res.writeHead(200, { "Content-Length": payload.length, "Content-Type": "application/octet-stream" });
      res.end(payload);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bodayan-self-update-test-"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  manifest.url = `${baseUrl}/launcher.exe`;
  let passed = 0;

  async function check(name, test) {
    await test();
    passed++;
    console.log(`  PASS ${name}`);
  }

  try {
    console.log("selfUpdate tests");
    await check("сравнение версий корректно определяет новую версию", async () => {
      assert.strictEqual(selfUpdate.isNewer("1.0.14", "1.0.13"), true);
      assert.strictEqual(selfUpdate.isNewer("1.0.13", "1.0.13"), false);
      assert.strictEqual(selfUpdate.isNewer("1.0.9", "1.0.13"), false);
    });

    await check("манифест версии загружается с локального тестового HTTP-сервера", async () => {
      const checkResult = await selfUpdate.checkForUpdate({
        manifestUrl: `${baseUrl}/manifest.json`,
        currentVersion: "1.0.13"
      });
      assert.strictEqual(checkResult.hasUpdate, true);
      assert.strictEqual(checkResult.remote.version, "1.0.14");
      assert.strictEqual(checkResult.remote.url, manifest.url);
    });

    await check("загрузка передаёт прогресс и проверяет SHA1/размер", async () => {
      const destFile = path.join(tempDir, "valid-update.exe");
      let progressEvents = 0;
      const result = await selfUpdate.downloadUpdate({
        url: manifest.url,
        destFile,
        sha1: manifest.sha1,
        size: manifest.size,
        onProgress: () => progressEvents++
      });
      assert.strictEqual(result.sha1, manifest.sha1);
      assert.strictEqual(result.size, manifest.size);
      assert.deepStrictEqual(fs.readFileSync(destFile), payload);
      assert.ok(progressEvents > 0);
    });

    await check("обновление с неверным SHA1 отклоняется", async () => {
      await assert.rejects(selfUpdate.downloadUpdate({
        url: manifest.url,
        destFile: path.join(tempDir, "bad-hash.exe"),
        sha1: "0".repeat(40),
        size: manifest.size
      }), /SHA1/);
    });

    await check("обновление с неверным размером отклоняется", async () => {
      await assert.rejects(selfUpdate.downloadUpdate({
        url: manifest.url,
        destFile: path.join(tempDir, "bad-size.exe"),
        sha1: manifest.sha1,
        size: manifest.size + 1
      }), /размера/);
    });

    await check("apply-скрипт заменяет с логами, ждёт обёртку и имеет fallback", async () => {
      const { batPath, content } = selfUpdate.buildApplyScript({
        newExePath: path.join(tempDir, "AppleLauncher-update.exe"),
        targetExePath: path.join(tempDir, "AppleLauncher.exe"),
        pid: 4321
      });
      assert.strictEqual(batPath, path.join(tempDir, "apply-launcher-update.bat"));
      // ждём и по PID, и по имени образа portable-обёртки
      assert.ok(content.includes('set "PID=4321"'));
      assert.ok(content.includes('set "IMG=AppleLauncher.exe"'));
      assert.ok(content.includes('tasklist /FI "IMAGENAME eq %IMG%"'));
      // ошибка move больше НЕ глушится в >nul, а пишется в лог
      assert.ok(/move \/Y "%SOURCE%" "%TARGET%" >>"%LOG%" 2>&1/.test(content));
      assert.ok(!/move \/Y "%SOURCE%" "%TARGET%" >nul/.test(content));
      // есть резервный путь и гарантированное завершение
      assert.ok(content.includes(":fallback"));
      assert.ok(content.includes('copy /Y "%SOURCE%" "%TARGET%"'));
      assert.ok(content.includes(":giveup"));
      assert.ok(content.includes('start "" "%TARGET%"'));
    });

    console.log(`\n${passed} тестов пройдено.`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
