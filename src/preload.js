const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  close: () => ipcRenderer.invoke("window:close"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  loginByNickname: (username) => ipcRenderer.invoke("auth:login", username),
  getRandomBackground: () => ipcRenderer.invoke("backgrounds:random"),
  launchGame: () => ipcRenderer.invoke("game:launch"),
  stopGame: () => ipcRenderer.invoke("game:stop"),
  checkUpdate: () => ipcRenderer.invoke("updater:check"),
  checkLauncherUpdate: () => ipcRenderer.invoke("launcher:checkUpdate"),
  // Сбор диагностического отчёта на Рабочий стол (ручная кнопка и авто-ошибки UI).
  sendReport: (payload) => ipcRenderer.invoke("diagnostics:report", payload),
  reportError: (scope, error) =>
    ipcRenderer.invoke("diagnostics:report", {
      scope,
      error: error
        ? { name: error.name, message: error.message, stack: error.stack }
        : null
    }),
  onGameData: (cb) => ipcRenderer.on("game:data", (_e, data) => cb(data)),
  onGameProgress: (cb) => ipcRenderer.on("game:progress", (_e, progress) => cb(progress)),
  onGameClose: (cb) => ipcRenderer.on("game:close", (_e, code) => cb(code)),
  onGameError: (cb) => ipcRenderer.on("game:error", (_e, err) => cb(err)),
  onUpdateProgress: (cb) => ipcRenderer.on("updater:progress", (_e, progress) => cb(progress)),
  onLauncherUpdate: (cb) => ipcRenderer.on("launcher:update", (_e, info) => cb(info))
});
