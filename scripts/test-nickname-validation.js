const assert = require("assert");
const { validate } = require("../src/nicknameValidation");

const validCases = [
  ["минимальная длина", "abc", "abc"],
  ["максимальная длина", "Player_123456789", "Player_123456789"],
  ["цифры и подчёркивание", "123_456", "123_456"],
  ["смешанный регистр", "MiXeD_Name", "MiXeD_Name"],
  ["обрезка внешних пробелов", "  Player_1  ", "Player_1"],
  ["ранее зарезервированный ник", "bodayan", "bodayan"],
  ["ранее зарезервированный ник в верхнем регистре", "BODAYAN", "BODAYAN"],
  ["ранее зарезервированный ник с пробелами", " BodaYan ", "BodaYan"]
];

const invalidCases = [
  ["пустое значение", "", /Введите никнейм/],
  ["только пробелы", "   ", /Введите никнейм/],
  ["два символа", "ab", /3 до 16/],
  ["17 символов", "Player_1234567890", /3 до 16/],
  ["кириллица", "Игрок123", /латинские/],
  ["внутренний пробел", "Player One", /латинские/],
  ["дефис", "Player-One", /латинские/],
  ["табуляция внутри ника", "Player\tOne", /латинские/]
];

console.log("nicknameValidation tests");
for (const [name, input, expected] of validCases) {
  const result = validate(input);
  assert.strictEqual(result.ok, true, name);
  assert.strictEqual(result.username, expected, name);
  assert.strictEqual(result.message, "", name);
  console.log(`  PASS ${name}`);
}

for (const [name, input, expectedMessage] of invalidCases) {
  const result = validate(input);
  assert.strictEqual(result.ok, false, name);
  assert.match(result.message, expectedMessage, name);
  console.log(`  PASS ${name}`);
}

assert.strictEqual(validate(null).ok, false);
assert.strictEqual(validate(undefined).ok, false);
console.log("  PASS null и undefined отклоняются");
console.log(`\n${validCases.length + invalidCases.length + 1} проверок пройдено.`);
