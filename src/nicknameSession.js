const STANDARD_USERNAME = "bodayan";
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

let authenticatedUsername = null;

function login(username) {
  const value = String(username || "").trim();
  if (!value) {
    return { ok: false, message: "Введите собственный никнейм для входа." };
  }
  if (value.toLowerCase() === STANDARD_USERNAME) {
    return { ok: false, message: "Никнейм «bodayan» является стандартным. Введите собственный уникальный никнейм." };
  }
  if (!USERNAME_PATTERN.test(value)) {
    return { ok: false, message: "Никнейм должен содержать 3–16 символов: латинские буквы, цифры или «_»." };
  }

  authenticatedUsername = value;
  return { ok: true, username: value };
}

function clear() {
  authenticatedUsername = null;
}

function requireAuthenticatedUser() {
  if (!authenticatedUsername) {
    return { ok: false, message: "Сначала войдите по своему никнейму." };
  }
  return { ok: true, username: authenticatedUsername };
}

module.exports = { STANDARD_USERNAME, login, clear, requireAuthenticatedUser };
