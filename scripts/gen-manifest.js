const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Генерация updater/manifest.json из локальной игровой папки.
// Считает sha1 + размер каждого файла и формирует прямые ссылки на GitHub Releases.
//
// Соглашение об именах ассетов: GitHub Releases не поддерживает "/" в именах,
// поэтому имя ассета = путь с заменой "/" на "__" (например config/forge.cfg → config__forge.cfg).
// Лаунчер раскладывает файлы по полю "path", поэтому имя ассета не влияет на размещение.

const ROOT = path.resolve(__dirname, "..");
const GAME_DIR = path.join(ROOT, "minecraft", "game");
const OUT = path.join(ROOT, "updater", "manifest.json");

// Что включаем в модпак (клиентский контент) и куда публикуем.
const INCLUDE = ["mods", "customnpcs"];
const BASE_URL = "https://github.com/faktogenez/bodaYan/releases/download/modpack-v1";

function sha1File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (d) => hash.update(d));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const assetName = (rel) => rel.split("/").join("__");

(async () => {
  const files = [];

  for (const inc of INCLUDE) {
    const dir = path.join(GAME_DIR, inc);
    if (!fs.existsSync(dir)) {
      console.warn("[manifest] нет каталога, пропуск:", dir);
      continue;
    }
    for (const full of walk(dir)) {
      const rel = path.relative(GAME_DIR, full).split(path.sep).join("/");
      files.push({
        path: rel,
        url: `${BASE_URL}/${assetName(rel)}`,
        sha1: await sha1File(full),
        size: fs.statSync(full).size
      });
    }
  }

  fs.writeFileSync(OUT, JSON.stringify({ version: 1, files }, null, 2) + "\n");
  console.log("[manifest] записано:", OUT);
  console.log("[manifest] файлов:", files.length);
  for (const f of files) {
    console.log(`  ${f.path}  ${f.size} Б  ${f.sha1.slice(0, 12)}…  → ${f.url.split("/").pop()}`);
  }
})().catch((err) => {
  console.error("[manifest] ошибка:", err.message);
  process.exit(1);
});
