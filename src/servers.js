const fs = require("fs");
const path = require("path");

// Минимальный писатель NBT (uncompressed) для servers.dat Minecraft 1.16.5.

const TAG_END = 0x00;
const TAG_BYTE = 0x01;
const TAG_SHORT = 0x02;
const TAG_INT = 0x03;
const TAG_STRING = 0x08;
const TAG_LIST = 0x09;
const TAG_COMPOUND = 0x0a;

function nameBytes(name) {
  return Buffer.from(name, "utf8");
}

function tagByte(name, value) {
  const n = nameBytes(name);
  const buf = Buffer.alloc(1 + 2 + n.length + 1);
  let o = 0;
  buf.writeUInt8(TAG_BYTE, o); o += 1;
  buf.writeUInt16BE(n.length, o); o += 2;
  n.copy(buf, o); o += n.length;
  buf.writeInt8(value, o);
  return buf;
}

function tagString(name, value) {
  const n = nameBytes(name);
  const v = Buffer.from(String(value), "utf8");
  const buf = Buffer.alloc(1 + 2 + n.length + 2 + v.length);
  let o = 0;
  buf.writeUInt8(TAG_STRING, o); o += 1;
  buf.writeUInt16BE(n.length, o); o += 2;
  n.copy(buf, o); o += n.length;
  buf.writeUInt16BE(v.length, o); o += 2;
  v.copy(buf, o);
  return buf;
}

// Один сервер → compound-запись списка.
function serverEntry({ name, ip }) {
  return Buffer.concat([
    tagString("name", name),
    tagString("ip", ip),
    tagByte("acceptTextures", 1),
    Buffer.from([TAG_END])
  ]);
}

// Список серверов → тег TAG_List("servers") из compound-элементов.
function serversList(servers) {
  const n = nameBytes("servers");
  const entries = servers.map(serverEntry);

  const header = Buffer.alloc(1 + 2 + n.length + 1 + 4);
  let o = 0;
  header.writeUInt8(TAG_LIST, o); o += 1;
  header.writeUInt16BE(n.length, o); o += 2;
  n.copy(header, o); o += n.length;
  header.writeUInt8(TAG_COMPOUND, o); o += 1; // тип элементов
  header.writeInt32BE(entries.length, o); // длина списка

  return Buffer.concat([header, ...entries]);
}

// Сформировать содержимое servers.dat (корневой TAG_Compound "").
function buildServersDat(servers) {
  const root = Buffer.from([TAG_COMPOUND, 0x00, 0x00]); // TAG_Compound + пустое имя
  return Buffer.concat([root, serversList(servers), Buffer.from([TAG_END])]);
}

// Записать servers.dat в gameDir, перезаписав существующий список.
function writeServersDat(gameDir, servers) {
  const dest = path.join(gameDir, "servers.dat");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buildServersDat(servers));
  return dest;
}

module.exports = { buildServersDat, writeServersDat };
