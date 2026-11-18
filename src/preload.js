const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  close: () => ipcRenderer.invoke("window:close"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  getRandomBackground: () => ipcRenderer.invoke("backgrounds:random"),
  launchGame: (username) => ipcRenderer.invoke("game:launch", username),
  checkUpdate: () => ipcRenderer.invoke("updater:check"),
  checkLauncherUpdate: () => ipcRenderer.invoke("launcher:checkUpdate"),
  onGameData: (cb) => ipcRenderer.on("game:data", (_e, data) => cb(data)),
  onGameProgress: (cb) => ipcRenderer.on("game:progress", (_e, progress) => cb(progress)),
  onGameClose: (cb) => ipcRenderer.on("game:close", (_e, code) => cb(code)),
  onGameError: (cb) => ipcRenderer.on("game:error", (_e, err) => cb(err)),
  onUpdateProgress: (cb) => ipcRenderer.on("updater:progress", (_e, progress) => cb(progress)),
  onLauncherUpdate: (cb) => ipcRenderer.on("launcher:update", (_e, info) => cb(info))
});
