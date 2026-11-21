#!/usr/bin/env node
"use strict";

// Оптимизирует исходные фоны из backgrounds/source без потери качества и
// раскладывает результат в backgrounds/optimized последовательными числовыми
// именами (1, 2, 3, ...). Пиксели проверяются через PSNR: для lossless-сжатия
// значение должно быть inf. Если lossless-WebP получается больше исходника
// (обычная ситуация для готового JPEG), сохраняется исходный формат и файл.

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const VISUAL_ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(VISUAL_ROOT, "backgrounds", "source");
const DEST_DIR = path.join(VISUAL_ROOT, "backgrounds", "optimized");
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);
const FFMPEG_CANDIDATES = [
  process.env.FFMPEG_PATH,
  "ffmpeg",
  "C:\\ffmpeg\\bin\\ffmpeg.exe"
].filter(Boolean);

function run(ffmpeg, args) {
  const result = spawnSync(ffmpeg, args, { encoding: "utf8" });
  return {
    ok: result.status === 0,
    output: `${result.stdout || ""}${result.stderr || ""}`
  };
}

function resolveFfmpeg() {
  for (const candidate of FFMPEG_CANDIDATES) {
    try {
      if (run(candidate, ["-version"]).ok) return candidate;
    } catch (_) {}
  }
  throw new Error("ffmpeg не найден. Укажите путь через переменную FFMPEG_PATH.");
}

function listSources() {
  if (!fs.existsSync(SOURCE_DIR)) return [];
  return fs.readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() &&
      IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
}

function encodeLosslessWebp(ffmpeg, source, target) {
  return run(ffmpeg, [
    "-y", "-loglevel", "error",
    "-i", source,
    "-c:v", "libwebp", "-lossless", "1", "-compression_level", "6",
    target
  ]).ok;
}

function verifyLossless(ffmpeg, source, output) {
  const { output: log } = run(ffmpeg, [
    "-hide_banner", "-i", source, "-i", output,
    "-lavfi", "psnr", "-f", "null", "-"
  ]);
  return /average:inf/.test(log);
}

function main() {
  const ffmpeg = resolveFfmpeg();
  const sources = listSources();
  if (!sources.length) {
    console.log("Исходные фоны не найдены в backgrounds/source.");
    return;
  }

  fs.mkdirSync(DEST_DIR, { recursive: true });
  const tempDir = path.join(DEST_DIR, ".tmp-encode");
  fs.mkdirSync(tempDir, { recursive: true });

  let sourceTotal = 0;
  let outputTotal = 0;
  const rows = [];

  try {
    sources.forEach((name, index) => {
      const number = index + 1;
      const sourcePath = path.join(SOURCE_DIR, name);
      const candidatePath = path.join(tempDir, `${number}.webp`);
      const sourceSize = fs.statSync(sourcePath).size;
      const sourceExt = path.extname(name).toLowerCase();

      let outputPath;
      let outputExt;
      if (encodeLosslessWebp(ffmpeg, sourcePath, candidatePath) &&
          fs.statSync(candidatePath).size < sourceSize) {
        outputPath = candidatePath;
        outputExt = ".webp";
      } else {
        outputPath = sourcePath;
        outputExt = sourceExt;
      }

      const finalPath = path.join(DEST_DIR, `${number}${outputExt}`);
      fs.copyFileSync(outputPath, finalPath);
      const outputSize = fs.statSync(finalPath).size;

      if (!verifyLossless(ffmpeg, sourcePath, finalPath)) {
        throw new Error(`Проверка lossless не пройдена для ${name}`);
      }

      sourceTotal += sourceSize;
      outputTotal += outputSize;
      rows.push({
        file: `${number}${outputExt}`,
        from: name,
        sourceSize,
        outputSize
      });
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const kb = (value) => `${(value / 1024).toFixed(0)} КБ`;
  for (const row of rows) {
    const saved = row.sourceSize - row.outputSize;
    const percent = ((saved / row.sourceSize) * 100).toFixed(1);
    console.log(
      `${row.file}\t${kb(row.sourceSize)} -> ${kb(row.outputSize)} ` +
      `(-${percent}%)\t${row.from}`
    );
  }
  const savedTotal = sourceTotal - outputTotal;
  console.log(
    `\nИтого: ${rows.length} файлов, ${kb(sourceTotal)} -> ${kb(outputTotal)} ` +
    `(экономия ${kb(savedTotal)} / ${((savedTotal / sourceTotal) * 100).toFixed(1)}%)`
  );
}

main();
