(function exposeNicknameValidation(root, factory) {
  const validation = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = validation;
  } else {
    root.NicknameValidation = validation;
  }
})(typeof window !== "undefined" ? window : globalThis, function createNicknameValidation() {
  const STANDARD_USERNAME = "bodayan";
  const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

  function validate(value) {
    const username = String(value == null ? "" : value).trim();

    if (!username) {
      return { ok: false, username, message: "Введите никнейм." };
    }
    if (username.toLowerCase() === STANDARD_USERNAME) {
      return {
        ok: false,
        username,
        message: "Никнейм «bodayan» является стандартным. Введите собственный уникальный никнейм."
      };
    }
    if (username.length < 3 || username.length > 16) {
      return {
        ok: false,
        username,
        message: "Никнейм должен содержать от 3 до 16 символов."
      };
    }
    if (!USERNAME_PATTERN.test(username)) {
      return {
        ok: false,
        username,
        message: "Используйте только латинские буквы, цифры и символ «_»."
      };
    }

    return { ok: true, username, message: "" };
  }

  return { STANDARD_USERNAME, USERNAME_PATTERN, validate };
});
