const assert = require("assert");
const session = require("../src/nicknameSession");

function check(name, test) {
  test();
  console.log(`  PASS ${name}`);
}

session.clear();
console.log("nicknameSession tests");

check("пустое значение запрещено", () => {
  const result = session.login("   ");
  assert.strictEqual(result.ok, false);
  assert.match(result.message, /Введите собственный никнейм/);
});

check("стандартный ник запрещён без учёта регистра", () => {
  for (const username of ["bodayan", "BodaYan", "BODAYAN"]) {
    const result = session.login(username);
    assert.strictEqual(result.ok, false);
    assert.match(result.message, /стандартным/);
  }
});

check("недопустимый формат ника запрещён", () => {
  assert.strictEqual(session.login("имя").ok, false);
  assert.strictEqual(session.login("ab").ok, false);
  assert.strictEqual(session.login("user name").ok, false);
});

check("нельзя запустить игру без входа", () => {
  session.clear();
  assert.strictEqual(session.requireAuthenticatedUser().ok, false);
});

check("собственный ник после входа доступен игровой сессии", () => {
  const result = session.login("Player_2026");
  assert.deepStrictEqual(result, { ok: true, username: "Player_2026" });
  assert.deepStrictEqual(session.requireAuthenticatedUser(), { ok: true, username: "Player_2026" });
  session.clear();
  assert.strictEqual(session.requireAuthenticatedUser().ok, false);
});

console.log("\n5 тестов пройдено.");
