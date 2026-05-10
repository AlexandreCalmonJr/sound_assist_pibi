const Datastore = require('@seald-io/nedb');
const path = require('path');

let presetsDb = null;
let mappingsDb = null;
let settingsDb = null;

/**
 * Inicializa os datastores com o diretório correto (userData do Electron).
 * Deve ser chamado uma vez em main.js antes de usar os DBs.
 * @param {string} dataDir - Caminho absoluto para o diretório de dados
 */
function initDatabase(dataDir) {
    presetsDb = new Datastore({ filename: path.join(dataDir, 'presets.db'), autoload: true });
    mappingsDb = new Datastore({ filename: path.join(dataDir, 'mappings.db'), autoload: true });
    settingsDb = new Datastore({ filename: path.join(dataDir, 'settings.db'), autoload: true });

    // Adicionar índices para performance
    mappingsDb.ensureIndex({ fieldName: 'hz' });
    mappingsDb.ensureIndex({ fieldName: 'date' });
}

module.exports = {
    get presets() {
        if (!presetsDb) throw new Error('Database não inicializado. Chame initDatabase() primeiro.');
        return presetsDb;
    },
    get mappings() {
        if (!mappingsDb) throw new Error('Database não inicializado. Chame initDatabase() primeiro.');
        return mappingsDb;
    },
    get settings() {
        if (!settingsDb) throw new Error('Database não inicializado. Chame initDatabase() primeiro.');
        return settingsDb;
    },
    initDatabase
};
