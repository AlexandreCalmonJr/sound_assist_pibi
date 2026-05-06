const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('updater', {
    checkUpdate: () => ipcRenderer.invoke('check-update'),
    startUpdate: (data) => ipcRenderer.invoke('start-update', data),
    onUpdateReady: (callback) => ipcRenderer.on('update-ready', callback),
    restartApp: () => ipcRenderer.send('restart-app')
});
