const nicknameValidation = require("./nicknameValidation");

let authenticatedUsername = null;

function login(username) {
  // A failed login must never leave an earlier user's session active.
  authenticatedUsername = null;
  const result = nicknameValidation.validate(username);
  if (!result.ok) return { ok: false, message: result.message };

  authenticatedUsername = result.username;
  return { ok: true, username: result.username };
}

function clear() {
  authenticatedUsername = null;
}

function requireAuthenticatedUser() {
  const result = nicknameValidation.validate(authenticatedUsername);
  if (!result.ok) {
    authenticatedUsername = null;
    return { ok: false, message: "Сначала войдите по своему никнейму." };
  }
  return { ok: true, username: result.username };
}

module.exports = { login, clear, requireAuthenticatedUser };
