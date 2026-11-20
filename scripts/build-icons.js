const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const assetsDir = path.join(root, "assets");
const source = path.join(assetsDir, "icon-source.jpg");
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";

const pngSizes = [16, 32, 48, 64, 128, 256, 512, 1024];
const icnsTypes = new Map([
  [16, "icp4"],
  [32, "icp5"],
  [64, "icp6"],
  [128, "ic07"],
  [256, "ic08"],
  [512, "ic09"],
  [1024, "ic10"]
]);

function renderPng(tempDir, size) {
  const output = path.join(tempDir, `${size}.png`);
  const result = spawnSync(ffmpeg, [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-i", source,
    "-vf", `crop=720:720:152:152,scale=${size}:${size}:flags=lanczos`,
    "-frames:v", "1",
    output
  ], { encoding: "utf8", windowsHide: true });

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `ffmpeg завершился с кодом ${result.status}`);
  return fs.readFileSync(output);
}

function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const directory = [];
  const images = [];
  for (const { size, png } of entries) {
    const row = Buffer.alloc(16);
    row.writeUInt8(size === 256 ? 0 : size, 0);
    row.writeUInt8(size === 256 ? 0 : size, 1);
    row.writeUInt8(0, 2);
    row.writeUInt8(0, 3);
    row.writeUInt16LE(1, 4);
    row.writeUInt16LE(32, 6);
    row.writeUInt32LE(png.length, 8);
    row.writeUInt32LE(offset, 12);
    directory.push(row);
    images.push(png);
    offset += png.length;
  }
  return Buffer.concat([header, ...directory, ...images]);
}

function buildIcns(entries) {
  const chunks = entries.map(({ size, png }) => {
    const chunk = Buffer.alloc(8);
    chunk.write(icnsTypes.get(size), 0, 4, "ascii");
    chunk.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([chunk, png]);
  });
  const payload = Buffer.concat(chunks);
  const header = Buffer.alloc(8);
  header.write("icns", 0, 4, "ascii");
  header.writeUInt32BE(payload.length + 8, 4);
  return Buffer.concat([header, payload]);
}

function main() {
  if (!fs.existsSync(source)) throw new Error(`Не найден исходник иконки: ${source}`);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bodayan-icons-"));
  try {
    const pngEntries = pngSizes.map((size) => ({ size, png: renderPng(tempDir, size) }));
    const iconEntries = pngEntries.filter(({ size }) => size <= 256);
    const icnsEntries = pngEntries.filter(({ size }) => icnsTypes.has(size));

    fs.writeFileSync(path.join(assetsDir, "icon.png"), pngEntries.find(({ size }) => size === 512).png);
    fs.writeFileSync(path.join(assetsDir, "icon.ico"), buildIco(iconEntries));
    fs.writeFileSync(path.join(assetsDir, "icon.icns"), buildIcns(icnsEntries));
    console.log(`Иконки собраны: ${iconEntries.map(({ size }) => `${size}px`).join(", ")} ICO; ${icnsEntries.length} размеров ICNS; PNG 512px.`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (err) {
  console.error("[icons] ошибка:", err.message);
  process.exitCode = 1;
}
