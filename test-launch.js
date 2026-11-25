const { Client } = require("minecraft-launcher-core");
const crypto = require("crypto");
const path = require("path");

function offlineUUID(name) {
  const hash = crypto.createHash("md5").update("OfflinePlayer:" + name, "utf8").digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const name = "bodayan";
const uuid = offlineUUID(name);

const opts = {
  authorization: {
    access_token: "0",
    client_token: uuid,
    uuid,
    name,
    user_properties: "{}",
    meta: { type: "mojang" }
  },
  root: process.env.MC_ROOT || path.join(__dirname, "minecraft", "game"),
  javaPath: process.env.MC_JAVA || undefined,
  version: { number: "1.16.5", type: "release", custom: "Forge 1.16.5" },
  memory: { max: "4096", min: "2048" },
  os: "windows",
  customArgs: [
    "-XX:+IgnoreUnrecognizedVMOptions",
    "--add-opens=java.base/java.util=ALL-UNNAMED",
    "--add-opens=java.base/java.lang=ALL-UNNAMED",
    "--add-opens=java.base/java.lang.invoke=ALL-UNNAMED",
    "--add-opens=java.base/java.util.jar=ALL-UNNAMED",
    "--add-opens=java.base/sun.security.util=ALL-UNNAMED",
    "--add-opens=java.base/sun.net.www.protocol.jar=ALL-UNNAMED",
    "--add-opens=java.base/java.io=ALL-UNNAMED",
    "--add-opens=java.base/java.util.stream=ALL-UNNAMED",
    "--add-opens=java.base/java.nio=ALL-UNNAMED",
    "--add-opens=java.base/sun.nio.ch=ALL-UNNAMED",
    "-Dfml.earlyprogresswindow=false"
  ]
};

const client = new Client();
client.on("debug", (e) => console.log("[DEBUG]", String(e).slice(0, 400)));
client.on("data", (e) => process.stdout.write("[DATA] " + String(e)));
client.on("download", (e) => console.log("[DOWNLOAD]", e));
client.on("download-status", (e) => console.log("[DL-STATUS]", e.name, e.current + "/" + e.total));
client.on("close", (code) => { console.log("[CLOSE]", code); process.exit(0); });
client.on("error", (e) => { console.error("[ERROR]", Buffer.isBuffer(e) ? e.toString("utf8") : String(e)); });

console.log("Launching Forge 1.16.5...");
client.launch(opts).catch((err) => { console.error("[CORE ERR]", err); process.exit(1); });

setTimeout(() => { console.log("[TIMEOUT 300s]"); process.exit(0); }, 300000);
