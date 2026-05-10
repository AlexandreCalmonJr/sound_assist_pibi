const fs = require('fs');
const path = require('path');

class Logger {
    static instance = null;

    static getInstance(logDir = './logs') {
        if (!Logger.instance) {
            Logger.instance = new Logger(logDir);
        }
        return Logger.instance;
    }

    constructor(logDir) {
        this.logFile = path.join(logDir, `audit_${new Date().toISOString().split('T')[0]}.log`);
        if (!fs.existsSync(logDir)) {
            try { fs.mkdirSync(logDir, { recursive: true }); } catch(e) {}
        }
        this.onLog = null;
    }

    log(level, socketId, event, data) {
        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            level: level.toUpperCase(),
            socketId: socketId || 'SYSTEM',
            event,
            data
        };
        const logString = JSON.stringify(entry);
        
        const colors = {
            info: '\x1b[32m',
            warn: '\x1b[33m',
            error: '\x1b[31m',
            system: '\x1b[36m'
        };
        const color = colors[level] || '\x1b[37m';
        
        // Log para console
        console.log(`${color}[${timestamp}] [${level.toUpperCase()}] [${socketId || 'SYSTEM'}] ${event}\x1b[0m`, data || '');

        // Persistência
        try { fs.appendFileSync(this.logFile, logString + '\n'); } catch(e) {}

        // Broadcast
        if (this.onLog) this.onLog(entry);
    }

    info(socketId, event, data) { this.log('info', socketId, event, data); }
    warn(socketId, event, data) { this.log('warn', socketId, event, data); }
    error(socketId, event, data) { this.log('error', socketId, event, data); }
    system(event, data) { this.log('system', 'SYSTEM', event, data); }
}

module.exports = Logger;
