const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function startPythonAI(rootDir) {
    const pythonScript = path.join(rootDir, 'ai_server.py');

    if (!fs.existsSync(pythonScript)) {
        console.warn(`[Python AI] Script não encontrado: ${pythonScript}. IA desativada.`);
        return null;
    }

    // Detector de Ambiente Virtual (venv)
    const isWin = process.platform === 'win32';
    const venvPython = isWin 
        ? path.join(rootDir, 'venv', 'Scripts', 'python.exe')
        : path.join(rootDir, 'venv', 'bin', 'python');

    const commands = [];
    
    // 1. Prioridade: Venv local
    if (fs.existsSync(venvPython)) {
        console.log(`[Python AI] Ambiente virtual detectado em: ${venvPython}`);
        commands.push(venvPython);
    }

    // 2. Fallbacks globais
    commands.push('python');
    commands.push('python3');
    if (isWin) commands.push('py');

    console.log(`[Python AI] Tentando iniciar servidor em: ${pythonScript}`);

    let pythonProcess = null;
    for (const cmd of commands) {
        pythonProcess = _trySpawn(cmd, pythonScript);
        if (pythonProcess) break;
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
