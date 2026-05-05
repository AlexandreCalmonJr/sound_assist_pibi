const Datastore = require('@seald-io/nedb');
const path = require('path');

const dbDir = path.join(__dirname, '..', 'data');
const presetsDb = new Datastore({ filename: path.join(dbDir, 'presets.db'), autoload: true });
const mappingsDb = new Datastore({ filename: path.join(dbDir, 'mappings.db'), autoload: true });

module.exports = {
    presets: presetsDb,
    mappings: mappingsDb
};
