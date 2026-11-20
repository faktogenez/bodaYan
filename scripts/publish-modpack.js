const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { assetName } = require("./assetName");

// Публикация модпака в GitHub Releases одной командой.
//   1) пересобирает updater/manifest.json (через gen-manifest.js);
//   2) раскладывает копии файлов во временный каталог под именами ассетов (path→"a__b");
//   3) пересоздаёт релиз модпака и загружает туда все ассеты + manifest.json.
//
// Почему через стейджинг: у gh флаг "#label" задаёт лишь подпись, а имя ассета = имя файла,
// поэтому имена файлов на диске обязаны совпадать с URL в манифесте.
//
// Требуется авторизованный gh CLI (gh auth status).
//
// Использование:
//   node scripts/publish-modpack.js [--game-dir <путь>] [--repo <owner/name>] [--tag <тег>]

const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = { repo: "faktogenez/bodaYan", tag: "modpack-v2", gameDir: path.join(ROOT, "minecraft", "game") };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--repo" && val) { args.repo = val; i++; }
    else if (key === "--tag" && val) { args.tag = val; i++; }
    else if (key === "--game-dir" && val) { args.gameDir = path.resolve(val); i++; }
  }
  return args;
}

function run(cmd, cmdArgs) {
  console.log(">", cmd, ...cmdArgs);
  const res = spawnSync(cmd, cmdArgs, { stdio: "inherit", shell: false });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`${cmd} завершился с кодом ${res.status}`);
}

(async () => {
  const { repo, tag, gameDir } = parseArgs(process.argv.slice(2));
  const manifestPath = path.join(ROOT, "updater", "manifest.json");

  // 1) Пересобрать манифест под публикуемый тег.
  run(process.execPath, [
    path.join(ROOT, "scripts", "gen-manifest.js"),
    "--game-dir", gameDir,
    "--base-url", `https://github.com/${repo}/releases/download/${tag}`
  ]);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  if (!files.length) throw new Error("Манифест пуст — нечего публиковать");

  // 2) Стейджинг: копии файлов во временный каталог под именами ассетов.
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "applelauncher-modpack-"));
  const assets = [];
  try {
    for (const f of files) {
      const src = path.join(gameDir, f.path.split("/").join(path.sep));
      if (!fs.existsSync(src)) {
        console.warn("[publish] нет файла, пропуск:", src);
        continue;
      }
      const dest = path.join(stage, assetName(f.path));
      fs.copyFileSync(src, dest);
      assets.push(dest);
    }
    const manifestStage = path.join(stage, "manifest.json");
    fs.copyFileSync(manifestPath, manifestStage);
    assets.push(manifestStage);

    // 3) Пересоздать релиз (со старыми ассетами не остаётся «мусора» с неверными именами).
    const view = spawnSync("gh", ["release", "view", tag, "--repo", repo], { stdio: "ignore", shell: false });
    if (view.status === 0) {
      console.log(`[publish] удаляю существующий релиз ${tag}`);
      run("gh", ["release", "delete", tag, "--repo", repo, "--yes", "--cleanup-tag"]);
    }
    run("gh", ["release", "create", tag, "--repo", repo, "--title", `Modpack ${tag}`, "--notes", `Модпак ${tag}`]);

    // 4) Загрузить ассеты. gh принимает несколько файлов за раз.
    run("gh", ["release", "upload", tag, "--repo", repo, "--clobber", ...assets]);
    console.log(`[publish] готово: ${assets.length} ассет(ов) в релизе ${tag} (${repo})`);
  } finally {
    try { fs.rmSync(stage, { recursive: true, force: true }); } catch (_) { /* некритично */ }
  }
})().catch((err) => {
  console.error("[publish] ошибка:", err.message);
  process.exit(1);
});
