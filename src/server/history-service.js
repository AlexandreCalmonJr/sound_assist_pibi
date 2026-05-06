const Datastore = require('@seald-io/nedb');
const path = require('path');

class HistoryService {
    constructor() {
        this.db = null;
    }

    init(dbDir) {
        this.db = new Datastore({
            filename: path.join(dbDir, 'acoustic_history.db'),
            autoload: true
        });
        console.log('[History] Banco de histórico acústico carregado.');
    }

    async saveSnapshot(data) {
        const snapshot = {
            timestamp: new Date(),
            ...data // rt60, spl, sti, channelData, crowdStatus (empty/full)
        };
        return new Promise((resolve, reject) => {
            this.db.insert(snapshot, (err, doc) => {
                if (err) reject(err);
                else resolve(doc);
            });
        });
    }

    async getComparison(limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.find({}).sort({ timestamp: -1 }).limit(limit).exec((err, docs) => {
                if (err) reject(err);
                else resolve(docs);
            });
        });
    }

    async getBenchmark() {
        // Retorna médias para comparação Vazio vs Cheio
        return new Promise((resolve, reject) => {
            this.db.find({}, (err, docs) => {
                if (err) return reject(err);
                
                const stats = {
                    empty: { rt60: 0, count: 0 },
                    full: { rt60: 0, count: 0 }
                };

                docs.forEach(doc => {
                    const status = doc.crowdStatus || 'empty';
                    if (doc.rt60) {
                        stats[status].rt60 += parseFloat(doc.rt60);
                        stats[status].count++;
                    }
                });

                if (stats.empty.count > 0) stats.empty.rt60 /= stats.empty.count;
                if (stats.full.count > 0) stats.full.rt60 /= stats.full.count;

                resolve(stats);
            });
        });
    }
}

module.exports = new HistoryService();
