const { spawn } = require('child_process');
const path = require('path');

function startPythonAI(rootDir) {
    const pythonScript = path.join(rootDir, 'ai_server.py');
    console.log(`[Main]: Tentando iniciar IA em: ${pythonScript}`);
    
    const pythonProcess = spawn('python', [pythonScript]);

    pythonProcess.on('error', (err) => {
        console.error(`[Python AI]: Falha ao iniciar com 'python'. Erro: ${err.message}`);
    });

    pythonProcess.stdout.on('data', (data) => {
        console.log(`[Python AI]: ${data.toString()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[Python AI ERRO]: ${data.toString()}`);
    });

    return pythonProcess;
}

function stopPythonAI(pythonProcess) {
    if (pythonProcess) pythonProcess.kill();
}

module.exports = { startPythonAI, stopPythonAI };
