const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { assetName } = require("./assetName");

// Генерация updater/manifest.json из локальной игровой папки.
// Считает sha1 + размер каждого файла и формирует прямые ссылки на GitHub Releases.
//
// Соглашение об именах ассетов: GitHub Releases не поддерживает "/" в именах,
// поэтому имя ассета = путь с заменой "/" на "__" (например mods/foo.jar → mods__foo.jar).
// Лаунчер раскладывает файлы по полю "path", поэтому имя ассета не влияет на размещение.
//
// Использование:
//   node scripts/gen-manifest.js [--game-dir <путь>] [--base-url <url>] [--out <файл>]

const ROOT = path.resolve(__dirname, "..");

// Что включаем в модпак (клиентский контент).
// Каталоги обходим рекурсивно; отдельные файлы добавляем точечно.
// libraries/assets/base-версию клиента MCLC качает сам, поэтому их не публикуем.
const INCLUDE_DIRS = ["mods", "customnpcs"];
const INCLUDE_FILES = ["versions/Forge 1.16.5/Forge 1.16.5.json"];

const DEFAULT_BASE_URL = "https://github.com/faktogenez/bodaYan/releases/download/modpack-v2";

function parseArgs(argv) {
  const args = { gameDir: path.join(ROOT, "minecraft", "game"), baseUrl: DEFAULT_BASE_URL, out: path.join(ROOT, "updater", "manifest.json") };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--game-dir" && val) { args.gameDir = path.resolve(val); i++; }
    else if (key === "--base-url" && val) { args.baseUrl = val.replace(/\/+$/, ""); i++; }
    else if (key === "--out" && val) { args.out = path.resolve(val); i++; }
  }
  return args;
}

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

(async () => {
  const { gameDir: GAME_DIR, baseUrl: BASE_URL, out: OUT } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(GAME_DIR)) {
    console.error("[manifest] игровая директория не найдена:", GAME_DIR);
    process.exit(1);
  }

  const queue = [];

  for (const inc of INCLUDE_DIRS) {
    const dir = path.join(GAME_DIR, inc);
    if (!fs.existsSync(dir)) {
      console.warn("[manifest] нет каталога, пропуск:", dir);
      continue;
    }
    queue.push(...walk(dir));
  }

  for (const rel of INCLUDE_FILES) {
    const full = path.join(GAME_DIR, rel.split("/").join(path.sep));
    if (!fs.existsSync(full)) {
      console.warn("[manifest] нет файла, пропуск:", full);
      continue;
    }
    queue.push(full);
  }

  const files = [];
  for (const full of queue) {
    const rel = path.relative(GAME_DIR, full).split(path.sep).join("/");
    files.push({
      path: rel,
      url: `${BASE_URL}/${assetName(rel)}`,
      sha1: await sha1File(full),
      size: fs.statSync(full).size
    });
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ version: 1, files }, null, 2) + "\n");
  console.log("[manifest] игровая директория:", GAME_DIR);
  console.log("[manifest] base-url:", BASE_URL);
  console.log("[manifest] записано:", OUT);
  console.log("[manifest] файлов:", files.length);
  for (const f of files) {
    console.log(`  ${f.path}  ${f.size} Б  ${f.sha1.slice(0, 12)}…  → ${f.url.split("/").pop()}`);
  }
})().catch((err) => {
  console.error("[manifest] ошибка:", err.message);
  process.exit(1);
});
