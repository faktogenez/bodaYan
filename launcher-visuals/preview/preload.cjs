const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("visualPreview", {
  getModel: () => ipcRenderer.invoke("visual-preview:model"),
  refreshBackgrounds: () => ipcRenderer.invoke("visual-preview:refresh"),
  onBackgroundsChanged: (callback) => {
    const listener = (_event, backgrounds) => callback(backgrounds);
    ipcRenderer.on("visual-preview:backgrounds-changed", listener);
    return () => ipcRenderer.removeListener("visual-preview:backgrounds-changed", listener);
  },
  resize: (width, height) => ipcRenderer.invoke("visual-preview:resize", width, height),
  minimize: () => ipcRenderer.send("visual-preview:minimize"),
  close: () => ipcRenderer.send("visual-preview:close")
});
