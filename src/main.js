const { app, BrowserWindow } = require('electron');
const path = require('path');
const { createAppServer } = require('./server/app-server');
const { configureElectronSession, createWindow } = require('./server/electron-window');
const { getLocalIp } = require('./server/network');
const { startPythonAI, stopPythonAI } = require('./server/python-ai');

const ROOT_DIR = path.join(__dirname, '..');
const PORT = 3001;
const localIp = getLocalIp();

let pythonProcess = null;

function createHttpServer() {
    const dbDir = app.getPath('userData');
    return createAppServer({
        app,
        rootDir: ROOT_DIR,
        localIp,
        port: PORT,
        dbDir
    });
}

function startServer() {
    const server = createHttpServer();
    server.listen(PORT, () => {
        console.log('====================================');
        console.log('SoundMaster Backend Rodando!');
        console.log(`IP Local para acesso: http://${localIp}:${PORT}`);
        console.log('====================================');
    });
}

app.whenReady().then(async () => {
    const aiPath = path.join(ROOT_DIR, 'backend', 'ai');
    pythonProcess = startPythonAI(aiPath);
    startServer();
    await configureElectronSession();
    createWindow(PORT);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow(PORT);
        }
    });
});

app.on('window-all-closed', () => {
    stopPythonAI(pythonProcess);
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('quit', () => {
    stopPythonAI(pythonProcess);
});
