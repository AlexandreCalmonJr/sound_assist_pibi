/**
 * SoundMaster — MixerGit Service (Tópico 13)
 * =============================================
 * "Git para Mesa de Som" — captura, diff e rollback de estados da Ui24R.
 *
 * TERMINOLOGIA:
 *   commit  — snapshot completo do estado da mesa num momento
 *   diff    — lista de diferenças entre dois commits (ou commit vs estado atual)
 *   rollback — reverter apenas um subconjunto de parâmetros para um commit anterior
 *
 * ESTRUTURA DE UM COMMIT:
 *   {
 *     _id, hash, label, createdAt, auto,
 *     state: {
 *       master: { level, mute },
 *       inputs: [{ level, mute, phantom, hpf, name, eq: {band1..4}, gate, comp, delay }],
 *       aux:    [{ level }],
 *       fx:     [{ level }],
 *     }
 *   }
 *
 * API pública:
 *   commit(label, auto?)          → { _id, hash, label, createdAt }
 *   list(limit?)                  → [commits...]
 *   getById(id)                   → commit
 *   diff(idA, idB?)               → [{ path, label, from, to, category }]
 *   rollback(id, scope?)          → [commands sent to mixer]
 *   deleteById(id)                → ok
 */

'use strict';

const Datastore = require('@seald-io/nedb');
const path      = require('path');
const crypto    = require('crypto');

// ─── Categorias legíveis de parâmetros ────────────────────────────────────────
const PARAM_LABELS = {
    'master.level':   { label: 'Master — Fader', fmt: v => `${Math.round(v * 100)}%`, cat: 'Master' },
    'master.mute':    { label: 'Master — Mute',  fmt: v => v ? 'Mudo' : 'Ativo',       cat: 'Master' },
};

for (let ch = 1; ch <= 24; ch++) {
    const p = `inputs.${ch - 1}`;
    PARAM_LABELS[`${p}.level`]       = { label: `Ch${ch} — Fader`,       fmt: v => `${Math.round(v * 100)}%`,   cat: `Canal ${ch}` };
    PARAM_LABELS[`${p}.mute`]        = { label: `Ch${ch} — Mute`,        fmt: v => v ? 'Mudo' : 'Ativo',        cat: `Canal ${ch}` };
    PARAM_LABELS[`${p}.phantom`]     = { label: `Ch${ch} — Phantom 48V`, fmt: v => v ? 'ON' : 'OFF',            cat: `Canal ${ch}` };
    PARAM_LABELS[`${p}.hpf`]         = { label: `Ch${ch} — HPF`,         fmt: v => `${v} Hz`,                   cat: `Canal ${ch} EQ` };
    PARAM_LABELS[`${p}.gate`]        = { label: `Ch${ch} — Gate`,        fmt: v => `${v}`,                      cat: `Canal ${ch}` };
    PARAM_LABELS[`${p}.comp`]        = { label: `Ch${ch} — Comp`,        fmt: v => `${v}`,                      cat: `Canal ${ch}` };
    PARAM_LABELS[`${p}.delay`]       = { label: `Ch${ch} — Delay`,       fmt: v => `${v} ms`,                   cat: `Canal ${ch}` };
    PARAM_LABELS[`${p}.name`]        = { label: `Ch${ch} — Nome`,        fmt: v => `"${v}"`,                    cat: `Canal ${ch}` };
    for (let b = 1; b <= 4; b++) {
        PARAM_LABELS[`${p}.eq.band${b}.hz`]   = { label: `Ch${ch} — EQ Band${b} Freq`, fmt: v => `${v} Hz`, cat: `Canal ${ch} EQ` };
        PARAM_LABELS[`${p}.eq.band${b}.gain`] = { label: `Ch${ch} — EQ Band${b} Gain`, fmt: v => `${v} dB`, cat: `Canal ${ch} EQ` };
        PARAM_LABELS[`${p}.eq.band${b}.q`]    = { label: `Ch${ch} — EQ Band${b} Q`,    fmt: v => `Q${v}`,   cat: `Canal ${ch} EQ` };
    }
}
for (let a = 1; a <= 10; a++) {
    PARAM_LABELS[`aux.${a - 1}.level`] = { label: `Aux${a} — Fader`, fmt: v => `${Math.round(v * 100)}%`, cat: `Aux ${a}` };
}

// ─── NeDB instance ────────────────────────────────────────────────────────────

class MixerGitService {
    constructor() {
        this.db = null;
    }

    init(dbDir) {
        this.db = new Datastore({
            filename: path.join(dbDir, 'mixer_commits.db'),
            autoload: true,
        });
        this.db.ensureIndex({ fieldName: 'createdAt' });
        console.log('[MixerGit] Banco de commits carregado.');
    }

    // ─── Commit ───────────────────────────────────────────────────────────────

    /**
     * Captura o estado atual da mesa (do State Tree) e salva como commit.
     * @param {string}  label - Mensagem do commit
     * @param {boolean} auto  - true = commit automático (sem interação do usuário)
     * @param {object}  stateTree - estado capturado do mixer-singleton
     */
    commit(label, auto = false, stateTree) {
        const snapshot = _deepClone(stateTree);
        const hash     = _shortHash(snapshot);
        const doc = {
            hash,
            label: label || `Commit ${new Date().toLocaleTimeString('pt-BR')}`,
            createdAt: new Date(),
            auto,
            state: snapshot,
        };

        return new Promise((resolve, reject) => {
            this.db.insert(doc, (err, saved) => {
                if (err) reject(err);
                else resolve({ _id: saved._id, hash: saved.hash, label: saved.label, createdAt: saved.createdAt });
            });
        });
    }

    // ─── List ─────────────────────────────────────────────────────────────────

    list(limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.find({}).sort({ createdAt: -1 }).limit(limit).exec((err, docs) => {
                if (err) reject(err);
                else resolve(docs.map(d => ({ _id: d._id, hash: d.hash, label: d.label, createdAt: d.createdAt, auto: d.auto })));
            });
        });
    }

    getById(id) {
        return new Promise((resolve, reject) => {
            this.db.findOne({ _id: id }, (err, doc) => {
                if (err) reject(err);
                else resolve(doc);
            });
        });
    }

    deleteById(id) {
        return new Promise((resolve, reject) => {
            this.db.remove({ _id: id }, {}, (err, n) => {
                if (err) reject(err);
                else resolve({ removed: n });
            });
        });
    }

    // ─── Diff ─────────────────────────────────────────────────────────────────

    /**
     * Compara dois estados (objetos) e retorna lista de diferenças.
     * @param {object} stateA - estado "antes" (commit salvo)
     * @param {object} stateB - estado "depois" (commit salvo ou atual)
     * @returns {Array<{ path, label, from, to, fromFmt, toFmt, category }>}
     */
    diff(stateA, stateB) {
        const changes = [];
        _diffObjects(stateA, stateB, '', changes);
        return changes.map(c => {
            const meta = PARAM_LABELS[c.path];
            return {
                path:     c.path,
                label:    meta?.label  ?? c.path,
                category: meta?.cat    ?? _inferCategory(c.path),
                from:     c.from,
                to:       c.to,
                fromFmt:  meta ? meta.fmt(c.from) : String(c.from),
                toFmt:    meta ? meta.fmt(c.to)   : String(c.to),
            };
        });
    }

    /**
     * Compara o commit salvo com o stateTree atual.
     * @param {string} commitId
     * @param {object} currentState
     */
    async diffWithCurrent(commitId, currentState) {
        const commit = await this.getById(commitId);
        if (!commit) throw new Error('Commit não encontrado: ' + commitId);
        return this.diff(commit.state, currentState);
    }

    /**
     * Compara dois commits pelo ID.
     */
    async diffById(idA, idB) {
        const [a, b] = await Promise.all([this.getById(idA), this.getById(idB)]);
        if (!a) throw new Error('Commit A não encontrado');
        if (!b) throw new Error('Commit B não encontrado');
        return this.diff(a.state, b.state);
    }

    // ─── Rollback ─────────────────────────────────────────────────────────────

    /**
     * Gera os comandos Socket.IO para reverter parâmetros de um commit.
     * @param {string}   commitId
     * @param {object}   currentState  - estado atual (para contexto)
     * @param {string[]} scope         - categorias a reverter, ex: ['Canal 3 EQ', 'Master']
     *                                   Se vazio, reverte TUDO.
     * @returns {Array<{ event, data }>}  - lista de comandos a emitir
     */
    async buildRollbackCommands(commitId, currentState, scope = []) {
        const commit = await this.getById(commitId);
        if (!commit) throw new Error('Commit não encontrado: ' + commitId);

        const diffs = this.diff(commit.state, currentState);
        const toRevert = scope.length
            ? diffs.filter(d => scope.some(s => d.category.startsWith(s)))
            : diffs;

        const commands = [];
        for (const d of toRevert) {
            const cmd = _diffToCommand(d, commit.state);
            if (cmd) commands.push(cmd);
        }
        return commands;
    }
}

// ─── Deep diff recursivo ──────────────────────────────────────────────────────

function _diffObjects(a, b, prefix, changes) {
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
        if (a !== b) changes.push({ path: prefix, from: a, to: b });
        return;
    }

    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const k of keys) {
        const fullPath = prefix ? `${prefix}.${k}` : k;
        const vA = a?.[k], vB = b?.[k];

        if (Array.isArray(vA) && Array.isArray(vB)) {
            // Arrays (inputs, aux, fx): itera por índice
            const len = Math.max(vA.length, vB.length);
            for (let i = 0; i < len; i++) {
                _diffObjects(vA[i], vB[i], `${fullPath}.${i}`, changes);
            }
        } else if (typeof vA === 'object' && typeof vB === 'object' && vA !== null && vB !== null) {
            _diffObjects(vA, vB, fullPath, changes);
        } else if (vA !== vB) {
            changes.push({ path: fullPath, from: vA, to: vB });
        }
    }
}

// ─── Converte um diff num comando Socket.IO ───────────────────────────────────

function _diffToCommand(diff, targetState) {
    const p = diff.path;

    // Master fader
    if (p === 'master.level') return { event: 'set_master_level', data: { level: diff.from } };
    if (p === 'master.mute')  return { event: 'set_master_mute',  data: { mute: diff.from } };

    // Canal fader/mute/phantom
    const chMatch = p.match(/^inputs\.(\d+)\.(level|mute|phantom|hpf|gate|comp|delay|name)$/);
    if (chMatch) {
        const ch   = parseInt(chMatch[1]) + 1;
        const param = chMatch[2];
        return { event: 'set_channel_param', data: { channel: ch, param, value: diff.from } };
    }

    // Canal EQ
    const eqMatch = p.match(/^inputs\.(\d+)\.eq\.band(\d+)\.(hz|gain|q)$/);
    if (eqMatch) {
        const ch   = parseInt(eqMatch[1]) + 1;
        const band = parseInt(eqMatch[2]);
        const prop = eqMatch[3];
        return { event: 'apply_eq_cut', data: { target: 'channel', channel: ch, band, [prop]: diff.from } };
    }

    // Aux
    const auxMatch = p.match(/^aux\.(\d+)\.level$/);
    if (auxMatch) {
        const aux = parseInt(auxMatch[1]) + 1;
        return { event: 'set_aux_level', data: { aux, level: diff.from } };
    }

    return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function _shortHash(obj) {
    return crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 7);
}

function _inferCategory(path) {
    if (path.startsWith('master')) return 'Master';
    const m = path.match(/^inputs\.(\d+)/);
    if (m) return `Canal ${parseInt(m[1]) + 1}`;
    if (path.startsWith('aux')) return 'Aux';
    if (path.startsWith('fx'))  return 'FX';
    return 'Outro';
}

// ─── Singleton ────────────────────────────────────────────────────────────────

module.exports = new MixerGitService();
