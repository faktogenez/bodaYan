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
  assert.match(result.message, /Введите никнейм/);
  assert.strictEqual(session.requireAuthenticatedUser().ok, false);
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
  assert.strictEqual(session.login("Player-1").ok, false);
  assert.strictEqual(session.login("Player_1234567890").ok, false);
});

check("нельзя запустить игру без входа", () => {
  session.clear();
  assert.strictEqual(session.requireAuthenticatedUser().ok, false);
});

check("собственный ник после входа доступен игровой сессии", () => {
  const result = session.login("  Player_2026  ");
  assert.deepStrictEqual(result, { ok: true, username: "Player_2026" });
  assert.deepStrictEqual(session.requireAuthenticatedUser(), { ok: true, username: "Player_2026" });
  session.clear();
  assert.strictEqual(session.requireAuthenticatedUser().ok, false);
});

check("неудачный вход сбрасывает предыдущую пользовательскую сессию", () => {
  assert.strictEqual(session.login("Player_A").ok, true);
  assert.strictEqual(session.requireAuthenticatedUser().username, "Player_A");
  assert.strictEqual(session.login("bodayan").ok, false);
  assert.strictEqual(session.requireAuthenticatedUser().ok, false);
});

check("границы длины 3 и 16 символов принимаются", () => {
  assert.strictEqual(session.login("abc").ok, true);
  assert.strictEqual(session.login("Player_123456789").ok, true);
  session.clear();
});

console.log("\n7 тестов пройдено.");
