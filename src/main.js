const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { createAppServer } = require('./server/app-server');
const { configureElectronSession, createWindow } = require('./server/electron-window');
const { getLocalIp } = require('./server/network');
const { startPythonAI, stopPythonAI } = require('./server/python-ai');
const { setupUpdater } = require('./server/updater');
const historyService = require('./server/history-service');
const aiPredictor = require('./server/ai-predictor');
const aes67Service = require('./server/aes67-service');

let ROOT_DIR = path.join(__dirname, '..');
const updateConfigPath = path.join(app.getPath('userData'), 'current_update.json');

if (fs.existsSync(updateConfigPath)) {
    try {
        const config = JSON.parse(fs.readFileSync(updateConfigPath, 'utf8'));
        if (fs.existsSync(config.path)) {
            ROOT_DIR = config.path;
            console.log('[Main] Usando arquivos da versão atualizada:', config.version);
        }
    } catch (e) {
        console.error('[Main] Erro ao ler configuração de update:', e.message);
    }
}

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
    
    const mainWindow = createWindow(PORT);
    
    // Inicializa Serviços de Engenharia
    historyService.init(app.getPath('userData'));
    await aiPredictor.init();
    
    // Inicia receptor de rede (opcional, configurável via UI futuramente)
    // aes67Service.start(); 

    // Configura o sistema de update
    setupUpdater(mainWindow);

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
