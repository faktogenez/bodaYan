const { Client } = require("minecraft-launcher-core");

const opts = {
  authorization: {
    access_token: "00000000000000000000000000000000",
    client_token: "bcc82eb8-ca12-47d2-a4c5-442aa528f318",
    uuid: "92f5f16514e63b35a3909170db778f75",
    name: "bodayan",
    user_type: "mojang"
  },
  root: "C:\\Users\\LEO\\AppData\\Roaming\\.tlauncher\\legacy\\Minecraft\\game",
  version: { number: "1.16.5", type: "release", custom: "Forge 1.16.5" },
  memory: { max: "4096", min: "2048" },
  server: { host: "127.0.0.1", port: 25565 },
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
client.on("debug", (e) => console.log("[DEBUG]", String(e).slice(0, 300)));
client.on("data", (e) => process.stdout.write("[DATA] " + String(e)));
client.on("close", (code) => { console.log("[CLOSE]", code); process.exit(0); });
client.on("error", (e) => { console.error("[ERROR]", String(e)); });

console.log("Launching with user_type=mojang...");
client.launch(opts).catch((err) => { console.error("[CORE ERR]", err); process.exit(1); });

setTimeout(() => { console.log("[TIMEOUT 300s]"); process.exit(0); }, 300000);
