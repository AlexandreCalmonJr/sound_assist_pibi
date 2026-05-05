const { BrowserWindow, session } = require('electron');

async function configureElectronSession() {
    await session.defaultSession.clearStorageData();

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(permission === 'media');
    });

    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
        return permission === 'media';
    });
}

function createWindow(port) {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true
    });

    win.loadURL(`http://localhost:${port}`);
}

module.exports = { configureElectronSession, createWindow };
