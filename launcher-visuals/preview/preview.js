const elements = {
  background: document.getElementById("previewBackground"),
  logo: document.getElementById("brandLogo"),
  username: document.getElementById("username"),
  usernameError: document.getElementById("usernameError"),
  play: document.getElementById("playBtn"),
  account: document.getElementById("accountBtn"),
  status: document.getElementById("previewStatus"),
  assetStatus: document.getElementById("assetStatus"),
  backgroundSelect: document.getElementById("backgroundSelect"),
  stateSelect: document.getElementById("stateSelect"),
  toolbar: document.getElementById("previewToolbar"),
  shell: document.querySelector(".preview-shell")
};

let model;
let backgrounds = [];

function setStatus(message, type = "info") {
  elements.status.textContent = message;
  elements.status.className = `preview-status status-bar ${type}`;
}

function applyLayout(config) {
  const root = document.documentElement.style;
  const { logo, loginForm } = config.elements;
  root.setProperty("--logo-x", `${logo.x}vw`);
  root.setProperty("--logo-y", `${logo.y}vh`);
  root.setProperty("--logo-width", `${logo.width}vw`);
  root.setProperty("--form-x", `${loginForm.x}vw`);
  root.setProperty("--form-bottom", `${loginForm.bottom}vh`);
  root.setProperty("--form-width", `${loginForm.width}vw`);
  root.setProperty("--form-max-width", `${loginForm.maxWidth}px`);
  root.setProperty("--controls-right", `${config.elements.windowControls.right}vw`);
  root.setProperty("--controls-top", `${config.elements.windowControls.top}vh`);
  root.setProperty("--card-opacity", String(config.readability.cardOpacity / 100));
  root.setProperty("--blur", `${config.readability.cardBlur}px`);
  const tint = config.readability.leftGradientEnabled
    ? config.readability.leftGradientStrength / 100
    : 0;
  root.setProperty("--left-tint", String(tint));
  root.setProperty("--left-tint-soft", String(tint * 0.5));

  document.body.classList.toggle(
    "compact-layout",
    window.innerWidth < config.responsive.compactBelowWidth
  );
}

function showBackground(index) {
  if (!backgrounds.length) return;
  const normalizedIndex = (index + backgrounds.length) % backgrounds.length;
  const background = backgrounds[normalizedIndex];
  elements.backgroundSelect.selectedIndex = normalizedIndex;
  elements.background.style.backgroundImage = `url("${background.url}")`;
  elements.background.style.backgroundSize = model.config.backgrounds.fit;
  const focal = model.config.backgrounds.defaultFocalPoint;
  elements.background.style.backgroundPosition = `${focal.x}% ${focal.y}%`;
  elements.assetStatus.textContent =
    `${normalizedIndex + 1}/${backgrounds.length}: ${background.name}`;
  try {
    localStorage.setItem("preview.lastBackground", background.id);
  } catch (_) {}
}

function selectInitialBackground() {
  let previousId = "";
  try {
    previousId = localStorage.getItem("preview.lastBackground") || "";
  } catch (_) {}

  const candidates = backgrounds.filter((item) => item.id !== previousId);
  const pool = candidates.length ? candidates : backgrounds;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  showBackground(backgrounds.findIndex((item) => item.id === chosen.id));
}

function buildOptions(list) {
  backgrounds = list;
  elements.backgroundSelect.textContent = "";
  for (const background of backgrounds) {
    const option = document.createElement("option");
    option.value = background.id;
    option.textContent = background.name;
    elements.backgroundSelect.append(option);
  }
}

function applyBackgroundList(list, { preserve = true, random = false } = {}) {
  const current = backgrounds[elements.backgroundSelect.selectedIndex];
  const previousId = preserve && current ? current.id : "";
  buildOptions(list);

  if (!backgrounds.length) {
    elements.background.style.backgroundImage = "none";
    elements.assetStatus.textContent = "Фоны не найдены в source/optimized";
    return;
  }

  if (random) {
    selectInitialBackground();
    return;
  }

  const index = previousId
    ? backgrounds.findIndex((item) => item.id === previousId)
    : -1;
  showBackground(index >= 0 ? index : 0);
  void verifyAssetLoading();
}

async function refreshBackgrounds() {
  const list = await window.visualPreview.refreshBackgrounds();
  applyBackgroundList(list);
  setStatus(`Список фонов обновлён: ${list.length}`, "info");
}

function showValidationError(message) {
  elements.username.classList.add("invalid");
  elements.usernameError.textContent = message;
  elements.usernameError.hidden = false;
}

function clearValidationError() {
  elements.username.classList.remove("invalid");
  elements.usernameError.textContent = "";
  elements.usernameError.hidden = true;
}

function setDemoState(state) {
  clearValidationError();
  elements.play.disabled = state === "loading";
  if (state === "error") {
    showValidationError("Проверьте введённые данные (демо)");
    setStatus("Демонстрационное состояние ошибки", "error");
  } else if (state === "loading") {
    setStatus("Проверка данных… (демо)", "loading");
  } else {
    setStatus("Предпросмотр: запуск игры отключён", "info");
  }
}

async function verifyAssetLoading() {
  const backgroundChecks = backgrounds.map((background) => new Promise((resolve) => {
    const image = new Image();
    const timeout = setTimeout(() => resolve({ name: background.name, ok: false }), 10000);
    image.onload = () => {
      clearTimeout(timeout);
      resolve({ name: background.name, ok: true });
    };
    image.onerror = () => {
      clearTimeout(timeout);
      resolve({ name: background.name, ok: false });
    };
    image.src = background.url;
  }));

  const results = await Promise.all(backgroundChecks);
  const failed = results.filter((result) => !result.ok).map((result) => result.name);
  const logoLoaded = elements.logo.complete && elements.logo.naturalWidth > 0;
  const loadedCount = results.length - failed.length;

  if (failed.length || (model.logo && !logoLoaded)) {
    const details = failed.length ? `Фоны с ошибками: ${failed.join(", ")}` : "Ошибка загрузки логотипа";
    elements.assetStatus.textContent = details;
    console.error("[visual-preview] Ошибка ресурсов:", details);
    return;
  }

  elements.assetStatus.textContent =
    `Ресурсы загружены: логотип${logoLoaded ? " OK" : " отсутствует"}, фонов ${loadedCount}/${results.length}`;
}

function bindInteractions() {
  elements.backgroundSelect.addEventListener("change", () => {
    showBackground(elements.backgroundSelect.selectedIndex);
  });
  document.getElementById("previousBackgroundBtn").addEventListener("click", () => {
    showBackground(elements.backgroundSelect.selectedIndex - 1);
  });
  document.getElementById("nextBackgroundBtn").addEventListener("click", () => {
    showBackground(elements.backgroundSelect.selectedIndex + 1);
  });
  document.getElementById("refreshBackgroundsBtn").addEventListener("click", () => {
    refreshBackgrounds().catch((error) =>
      setStatus(`Не удалось обновить фоны: ${error.message}`, "error"));
  });
  window.visualPreview.onBackgroundsChanged((list) => {
    applyBackgroundList(list);
    setStatus(`Обнаружены изменения фонов: ${list.length}`, "info");
  });

  document.querySelectorAll(".viewport-presets button").forEach((button) => {
    button.addEventListener("click", () => {
      window.visualPreview.resize(
        Number(button.dataset.width),
        Number(button.dataset.height)
      );
    });
  });

  elements.stateSelect.addEventListener("change", () => {
    setDemoState(elements.stateSelect.value);
  });
  elements.username.addEventListener("input", () => {
    clearValidationError();
    elements.stateSelect.value = "ready";
    elements.play.disabled = false;
    setStatus("Предпросмотр: запуск игры отключён", "info");
  });

  elements.play.addEventListener("click", () => {
    if (!elements.username.value.trim()) {
      showValidationError("Введите никнейм");
      setStatus("Для демонстрации введите никнейм", "error");
      elements.username.focus();
      return;
    }
    setStatus("Авторизация не подключена: это визуальный прототип", "info");
  });
  elements.account.addEventListener("click", () => {
    setStatus("Создание аккаунта — заглушка, действие пока не подключено", "info");
  });

  document.getElementById("closeBtn").addEventListener("click", () => {
    window.visualPreview.close();
  });
  document.getElementById("minimizeBtn").addEventListener("click", () => {
    window.visualPreview.minimize();
  });

  document.getElementById("hideToolbarBtn").addEventListener("click", () => {
    elements.shell.classList.add("toolbar-hidden");
  });
  document.getElementById("showToolbarBtn").addEventListener("click", () => {
    elements.shell.classList.remove("toolbar-hidden");
  });
  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "p") {
      elements.shell.classList.toggle("toolbar-hidden");
    }
  });
  window.addEventListener("resize", () => {
    if (model) applyLayout(model.config);
  });
}

async function initialize() {
  bindInteractions();
  try {
    model = await window.visualPreview.getModel();
    applyLayout(model.config);
    backgrounds = model.backgrounds || [];

    if (model.logo) {
      elements.logo.src = model.logo;
      elements.logo.addEventListener("error", () => {
        elements.logo.hidden = true;
        elements.assetStatus.textContent = "Не удалось загрузить логотип";
      });
    } else {
      elements.logo.hidden = true;
    }

    applyBackgroundList(backgrounds, { preserve: false, random: true });

    if (!backgrounds.length) {
      elements.background.style.backgroundColor = "#302a28";
    }
    void verifyAssetLoading();
  } catch (error) {
    elements.assetStatus.textContent = `Ошибка загрузки настроек: ${error.message}`;
    setStatus("Не удалось загрузить визуальные ресурсы", "error");
    console.error("[visual-preview]", error);
  }
}

initialize();
