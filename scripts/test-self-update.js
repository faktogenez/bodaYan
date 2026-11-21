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
    installerUrl: "",
    installerSha1: crypto.createHash("sha1").update(payload).digest("hex"),
    installerSize: payload.length,
    notes: "fixture"
  };
  const server = http.createServer((req, res) => {
    if (req.url === "/manifest.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(manifest));
      return;
    }
    if (req.url === "/launcher.exe" || req.url === "/setup.exe") {
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
  manifest.installerUrl = `${baseUrl}/setup.exe`;
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

    await check("манифест выбирает portable EXE или NSIS Setup для нужного типа установки", async () => {
      assert.deepStrictEqual(selfUpdate.resolveUpdateArtifact(manifest, true), {
        type: "portable",
        fileName: "AppleLauncher-update.exe",
        url: manifest.url,
        sha1: manifest.sha1,
        size: manifest.size
      });
      assert.deepStrictEqual(selfUpdate.resolveUpdateArtifact(manifest, false), {
        type: "installer",
        fileName: "AppleLauncher-Setup.exe",
        url: manifest.installerUrl,
        sha1: manifest.installerSha1,
        size: manifest.installerSize
      });
      assert.throws(
        () => selfUpdate.resolveUpdateArtifact({ ...manifest, installerUrl: "" }, false),
        /installerUrl/
      );
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

    await check("apply-скрипт заменяет без конвейеров, с логами, ретраями и fallback", async () => {
      const { batPath, content } = selfUpdate.buildApplyScript({
        newExePath: path.join(tempDir, "AppleLauncher-update.exe"),
        targetExePath: path.join(tempDir, "AppleLauncher.exe"),
        pid: 4321
      });
      assert.strictEqual(batPath, path.join(tempDir, "apply-launcher-update.bat"));
      assert.ok(content.includes('set "PID=4321"'));
      // КРИТИЧНО: без конвейеров и внешних tasklist/find — они зависают в detached-cmd.
      assert.ok(!content.includes("|"), "конвейер в apply-скрипте недопустим");
      assert.ok(!/tasklist/i.test(content), "tasklist недопустим в apply-скрипте");
      assert.ok(!/\bfind\b/i.test(content), "find недопустим в apply-скрипте");
      // ошибка move НЕ глушится в >nul, а пишется в лог
      assert.ok(/move \/Y "%SOURCE%" "%TARGET%" >>"%LOG%" 2>&1/.test(content));
      assert.ok(!/move \/Y "%SOURCE%" "%TARGET%" >nul/.test(content));
      // есть резервный путь и гарантированное завершение
      assert.ok(content.includes(":fallback"));
      assert.ok(content.includes('copy /Y "%SOURCE%" "%TARGET%"'));
      assert.ok(content.includes(":giveup"));
      assert.ok(content.includes('start "" "%TARGET%"'));
    });

    await check("NSIS apply-скрипт ждёт разблокировки EXE, запускает тихий Setup и умеет откатить", async () => {
      const targetExePath = path.join(tempDir, "installed", "AppleLauncher.exe");
      const installerPath = path.join(tempDir, "AppleLauncher-Setup.exe");
      const { batPath, content } = selfUpdate.buildInstallerApplyScript({ installerPath, targetExePath });
      assert.strictEqual(batPath, path.join(tempDir, "apply-launcher-installer-update.bat"));
      assert.ok(content.includes(`set "TARGET=${targetExePath}"`));
      assert.ok(content.includes(`set "SETUP=${installerPath}"`));
      assert.ok(content.includes(`set "BACKUP=${path.join(tempDir, "AppleLauncher.exe.update-backup")}"`));
      assert.ok(content.includes(`move /Y "%TARGET%" "%BACKUP%"`));
      assert.ok(content.includes(`start /wait "" "%SETUP%" /S`));
      assert.ok(content.includes(":rollback"));
      assert.ok(content.includes(`move /Y "%BACKUP%" "%TARGET%"`));
      assert.ok(content.includes('start "" "%TARGET%"'));
      assert.ok(!content.includes("|"), "конвейер в NSIS apply-скрипте недопустим");
      assert.ok(!/tasklist|findstr/i.test(content), "apply-скрипт не должен опрашивать внешние процессы");
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
