const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function startPythonAI(rootDir) {
    const pythonScript = path.join(rootDir, 'ai_server.py');

    if (!fs.existsSync(pythonScript)) {
        console.warn(`[Python AI] Script não encontrado: ${pythonScript}. IA desativada.`);
        return null;
    }

    console.log(`[Python AI] Iniciando: ${pythonScript}`);

    // Tenta 'python' primeiro, fallback para 'python3'
    let pythonProcess = _trySpawn('python', pythonScript);
    if (!pythonProcess) {
        pythonProcess = _trySpawn('python3', pythonScript);
    }

    return pythonProcess;
}

function _trySpawn(command, scriptPath) {
    try {
        const proc = spawn(command, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
        let started = false;

        proc.on('error', (err) => {
            if (!started) {
                console.warn(`[Python AI] '${command}' não disponível: ${err.message}`);
            }
        });

        proc.stdout.on('data', (data) => {
            started = true;
            console.log(`[Python AI]: ${data.toString().trim()}`);
        });

        proc.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            // uvicorn imprime info no stderr — não tratar como erro fatal
            if (msg.includes('Uvicorn running') || msg.includes('Started')) {
                started = true;
                console.log(`[Python AI]: ${msg}`);
            } else {
                console.error(`[Python AI ERRO]: ${msg}`);
            }
        });

        proc.on('exit', (code) => {
            if (code !== null && code !== 0) {
                console.error(`[Python AI] Processo encerrado com código ${code}`);
            }
        });

        return proc;
    } catch (_) {
        return null;
    }
}

function stopPythonAI(pythonProcess) {
    if (pythonProcess && !pythonProcess.killed) {
        pythonProcess.kill();
    }
}

module.exports = { startPythonAI, stopPythonAI };
