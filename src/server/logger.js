const fs = require('fs');
const path = require('path');

class Logger {
    constructor(logDir) {
        this.logFile = path.join(logDir, `audit_${new Date().toISOString().split('T')[0]}.log`);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    log(level, socketId, event, data) {
        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            level: level.toUpperCase(),
            socketId,
            event,
            data
        };
        const logString = JSON.stringify(entry);
        
        // Log para o console (colorido para facilitar leitura)
        const color = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '\x1b[32m';
        console.log(`${color}[${timestamp}] [${level.toUpperCase()}] [${socketId}] ${event}\x1b[0m`, data || '');

        // Persistência em arquivo
        fs.appendFileSync(this.logFile, logString + '\n');
    }

    info(socketId, event, data) { this.log('info', socketId, event, data); }
    warn(socketId, event, data) { this.log('warn', socketId, event, data); }
    error(socketId, event, data) { this.log('error', socketId, event, data); }
}

module.exports = Logger;
