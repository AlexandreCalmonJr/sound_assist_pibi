const { app, ipcMain } = require('electron');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const GITHUB_REPO = 'AlexandreCalmonJr/sound_assist_pibi';
const VERSION_FILE = path.join(__dirname, '..', '..', 'version.json');

async function getLocalVersion() {
    try {
        const data = fs.readFileSync(VERSION_FILE, 'utf8');
        return JSON.parse(data).version;
    } catch (e) {
        return '1.0.0';
    }
}

async function checkForUpdates() {
    try {
        const response = await axios.get(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
        const latestVersion = response.data.tag_name.replace('v', '');
        const currentVersion = await getLocalVersion();

        if (latestVersion !== currentVersion) {
            // Procura pelo asset .zip que contém o bundle
            const asset = response.data.assets.find(a => a.name.endsWith('.zip'));
            return {
                available: true,
                version: latestVersion,
                downloadUrl: asset ? asset.browser_download_url : null,
                notes: response.data.body
            };
        }
    } catch (error) {
        console.error('[Updater] Erro ao verificar atualizações:', error.message);
    }
    return { available: false };
}

async function downloadAndInstallUpdate(downloadUrl, newVersion) {
    const updateDir = path.join(app.getPath('userData'), 'updates', newVersion);
    const zipPath = path.join(app.getPath('userData'), 'update.zip');

    if (!fs.existsSync(path.dirname(updateDir))) {
        fs.mkdirSync(path.dirname(updateDir), { recursive: true });
    }

    try {
        console.log(`[Updater] Baixando atualização ${newVersion}...`);
        const response = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(zipPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log('[Updater] Download concluído. Extraindo...');
                try {
                    const zip = new AdmZip(zipPath);
                    zip.extractAllTo(updateDir, true);
                    
                    // Salva a versão atual em um arquivo de controle no userData
                    const configPath = path.join(app.getPath('userData'), 'current_update.json');
                    fs.writeFileSync(configPath, JSON.stringify({
                        version: newVersion,
                        path: updateDir
                    }));

                    fs.unlinkSync(zipPath); // Remove o zip
                    console.log('[Updater] Atualização instalada com sucesso em:', updateDir);
                    resolve(true);
                } catch (err) {
                    reject(err);
                }
            });
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('[Updater] Erro no download:', error.message);
        return false;
    }
}

function setupUpdater(mainWindow) {
    ipcMain.handle('check-update', async () => {
        return await checkForUpdates();
    });

    ipcMain.handle('start-update', async (event, { url, version }) => {
        const success = await downloadAndInstallUpdate(url, version);
        if (success) {
            // Notifica o front que está pronto para reiniciar
            mainWindow.webContents.send('update-ready');
        }
        return success;
    });

    ipcMain.on('restart-app', () => {
        app.relaunch();
        app.exit();
    });
}

module.exports = { setupUpdater };
