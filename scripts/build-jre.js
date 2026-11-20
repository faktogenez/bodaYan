const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Сборка минимальной Java 17 (JRE) для Minecraft 1.16.5 + Forge через jlink.
// Результат: <корень проекта>/jre (упаковывается в EXE как extraResources → resources/jre).

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "jre");

// Модули, необходимые клиенту Minecraft/Forge: Mixin/Unsafe (jdk.unsupported),
// java.instrument (агенты), TLS/DNS (jdk.crypto.ec, jdk.naming.dns), шрифты (java.desktop),
// jdk.dynalink (нужен Nashorn из Forge coremods, иначе NoClassDefFoundError при запуске).
const MODULES = [
  "java.base", "java.compiler", "java.datatransfer", "java.desktop", "java.instrument",
  "java.logging", "java.management", "java.management.rmi", "java.naming", "java.net.http",
  "java.prefs", "java.rmi", "java.scripting", "java.security.jgss", "java.security.sasl",
  "java.sql", "java.sql.rowset", "java.transaction.xa", "java.xml", "java.xml.crypto",
  "jdk.charsets", "jdk.crypto.cryptoki", "jdk.crypto.ec", "jdk.dynalink", "jdk.jfr",
  "jdk.management", "jdk.naming.dns", "jdk.unsupported", "jdk.unsupported.desktop", "jdk.zipfs"
].join(",");

function findJlink() {
  const exe = os.platform() === "win32" ? "jlink.exe" : "jlink";

  // 1) JAVA_HOME
  if (process.env.JAVA_HOME) {
    const p = path.join(process.env.JAVA_HOME, "bin", exe);
    if (fs.existsSync(p)) return p;
  }

  // 2) Каждый каталог из PATH
  for (const dir of String(process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    const p = path.join(dir, exe);
    if (fs.existsSync(p)) return p;
  }

  // 3) Типовые каталоги установки JDK (Windows: Adoptium / Java / Zulu / MS)
  if (os.platform() === "win32") {
    const roots = [
      "C:\\Program Files\\Eclipse Adoptium",
      "C:\\Program Files\\Java",
      "C:\\Program Files\\Zulu",
      "C:\\Program Files\\Microsoft"
    ];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      for (const name of fs.readdirSync(root)) {
        const p = path.join(root, name, "bin", exe);
        if (fs.existsSync(p)) return p;
      }
    }
  }

  throw new Error("jlink не найден: установите JDK 17 и добавьте в PATH (или задайте JAVA_HOME)");
}

const jlink = findJlink();
console.log("[jre] jlink:", jlink);

fs.rmSync(OUT, { recursive: true, force: true });

const args = [
  "--add-modules", MODULES,
  "--strip-debug", "--no-header-files", "--no-man-pages",
  "--compress=2", "--output", OUT
];
const res = spawnSync(jlink, args, { stdio: "inherit" });
if (res.status !== 0) {
  console.error("[jre] jlink завершился с кодом", res.status);
  process.exit(res.status || 1);
}

let total = 0;
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else total += fs.statSync(p).size;
  }
})(OUT);
console.log("[jre] готово:", OUT, (total / 1048576).toFixed(1), "МБ");
