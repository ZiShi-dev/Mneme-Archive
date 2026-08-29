const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cinevaultDesktop", {
  isElectron: true,
  focusApp: () => ipcRenderer.send("cinevault:focus"),
});
