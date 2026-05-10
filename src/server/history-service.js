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

                if (!docs || docs.length === 0) {
                    return resolve(stats);
                }

                docs.forEach(doc => {
                    // Normalização robusta do status (vazio/empty vs cheio/full)
                    let rawStatus = (doc.crowdStatus || 'empty').toLowerCase().trim();
                    let status = 'empty';
                    if (rawStatus.startsWith('v') || rawStatus === 'empty') status = 'empty';
                    else if (rawStatus.startsWith('c') || rawStatus === 'full' || rawStatus.startsWith('f')) status = 'full';
                    
                    if (stats[status] && doc.rt60) {
                        const val = parseFloat(doc.rt60);
                        if (!isNaN(val)) {
                            stats[status].rt60 += val;
                            stats[status].count++;
                        }
                    }
                });

                if (stats.empty.count > 0) stats.empty.rt60 = Number((stats.empty.rt60 / stats.empty.count).toFixed(2));
                if (stats.full.count > 0) stats.full.rt60 = Number((stats.full.rt60 / stats.full.count).toFixed(2));

                resolve(stats);
            });
        });
    }
}

module.exports = new HistoryService();
