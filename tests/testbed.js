/**
 * 🛠️ SOUNDMASTER TESTBED - AMBIENTE DE TESTE TÉCNICO
 * Este script valida a conexão com o mixer e o motor de IA.
 */

const { SoundcraftUI } = require('soundcraft-ui-connection');
const { createMixerActions } = require('../src/server/mixer-actions');
const aiPredictor = require('../src/server/ai-predictor');
const dotenv = require('dotenv');
const path = require('path');

// Carregar variáveis de ambiente
dotenv.config();

async function runTestbed() {
    console.log('\n=============================================');
    console.log('      🔊 SOUNDMASTER PRO - TESTBED 🔊');
    console.log('=============================================\n');

    // 1. Inicializar Mixer (Modo Simulado por padrão para o teste)
    console.log('[1/4] Inicializando Mixer Simulado...');
    let mixer = {
        isSimulated: true,
        conn: { sendMessage: (msg) => console.log(`   [Mixer] RAW: ${msg}`) },
        master: {
            setFaderLevel: (v) => console.log(`   [Mixer] Master -> ${v}`),
            mute: () => console.log('   [Mixer] Master MUTADO'),
            unmute: () => console.log('   [Mixer] Master ATIVADO'),
            eq: () => ({
                band: (b) => ({
                    setFreq: (f) => console.log(`   [Mixer] EQ B${b} Freq -> ${f}Hz`),
                    setGain: (g) => console.log(`   [Mixer] EQ B${b} Gain -> ${g}dB`),
                    setQ: (q) => console.log(`   [Mixer] EQ B${b} Q -> ${q}`)
                })
            })
        },
        input: (ch) => ({
            setFaderLevel: (v) => console.log(`   [Mixer] Canal ${ch} -> ${v}`),
            eq: () => ({
                setHpfFreq: (f) => console.log(`   [Mixer] Ch ${ch} HPF -> ${f}Hz`)
            })
        })
    };

    const actions = createMixerActions(() => mixer);
    console.log('✅ Mixer Pronto.\n');

    // 2. Testar Motor de IA
    console.log('[2/4] Testando Motor de IA (Conexão Python)...');
    await aiPredictor.init();
    
    const feedbackRisk = await aiPredictor.predictRisk(1000, -10, -15, 0.5);
    console.log(`   Risco de Microfonia em 1kHz: ${feedbackRisk}`);
    console.log('✅ Motor de IA Respondendo.\n');

    // 3. Simular Pedido de Relatório Técnico
    console.log('[3/4] Gerando Relatório Técnico AI...');
    
    // Simular dados de análise técnica
    const mockAnalysis = {
        rt60: 1.8,
        rt60_multiband: { '125': 2.4, '500': 1.6, '1k': 1.2, '4k': 0.8 },
        peakHz: 250,
        db: -12
    };

    try {
        const apiKey = process.env.AI_API_KEY;
        const res = await fetch('http://127.0.0.1:3002/chat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify({ 
                message: "Gere um relatório completo da acústica",
                analysis: mockAnalysis
            })
        });
        
        const data = await res.json();
        console.log('\n--- RELATÓRIO RECEBIDO ---\n');
        console.log(data.report || 'Relatório não gerado.');
        console.log('\n--- FIM DO RELATÓRIO ---\n');
    } catch (e) {
        console.warn('❌ Erro ao buscar relatório do Python. Verifique se o servidor AI está rodando na porta 3002.');
    }

    // 4. Executar Comando da IA no Mixer
    console.log('[4/4] Validando Novos Recursos do Master (Fade, DIM, Pan, Delay)...');
    
    // Atualizar mock do mixer para suportar novos métodos
    mixer.master.toggleDim = () => console.log('   [Mixer] DIM Alternado');
    mixer.master.setPan = (v) => console.log(`   [Mixer] Master Pan -> ${v}`);
    mixer.master.fadeTo = (v, t) => console.log(`   [Mixer] Fading Master para ${v} em ${t}ms`);
    mixer.master.setDelayL = (ms) => console.log(`   [Mixer] Master Delay L -> ${ms}ms`);
    mixer.master.setDelayR = (ms) => console.log(`   [Mixer] Master Delay R -> ${ms}ms`);
    mixer.input = (ch) => ({
        setFaderLevel: (v) => console.log(`   [Mixer] Canal ${ch} -> ${v}`),
        toggleSolo: () => console.log(`   [Mixer] Canal ${ch} SOLO Alternado`),
        setPan: (v) => console.log(`   [Mixer] Canal ${ch} Pan -> ${v}`),
        setDelay: (ms) => console.log(`   [Mixer] Canal ${ch} Delay -> ${ms}ms`),
        aux: (auxId) => ({
            setFaderLevel: (v) => console.log(`   [Mixer] Ch ${ch} -> AUX ${auxId} Level: ${v}`),
            setPost: (v) => console.log(`   [Mixer] Ch ${ch} -> AUX ${auxId} Mode: ${v === 1 ? 'POST' : 'PRE'}`),
            setPostProc: (v) => console.log(`   [Mixer] Ch ${ch} -> AUX ${auxId} Proc: ${v === 1 ? 'POST-PROC' : 'PRE-PROC'}`),
            setPan: (v) => console.log(`   [Mixer] Ch ${ch} -> AUX ${auxId} Pan: ${v}`)
        }),
        fx: (fxId) => ({
            setFaderLevel: (v) => console.log(`   [Mixer] Ch ${ch} -> FX ${fxId} Level: ${v}`),
            setPost: (v) => console.log(`   [Mixer] Ch ${ch} -> FX ${fxId} Mode: ${v === 1 ? 'POST' : 'PRE'}`)
        }),
        eq: () => ({
            setHpfFreq: (f) => console.log(`   [Mixer] Ch ${ch} HPF -> ${f}Hz`)
        })
    });

    mixer.hw = (id) => ({
        setGain: (v) => console.log(`   [Mixer] Hardware Input ${id} Gain -> ${v}`),
        phantomOn: () => console.log(`   [Mixer] Hardware Input ${id} 48V ON ⚠️`),
        phantomOff: () => console.log(`   [Mixer] Hardware Input ${id} 48V OFF`),
        oscillator: () => ({
            enable: () => console.log('   [Mixer] OSC ON'),
            disable: () => console.log('   [Mixer] OSC OFF'),
            setType: (t) => console.log(`   [Mixer] OSC Type -> ${t}`),
            setFaderLevel: (v) => console.log(`   [Mixer] OSC Level -> ${v}dB`)
        })
    });

    mixer.volume = {
        solo: { setFaderLevel: (v) => console.log(`   [Mixer] SOLO Volume -> ${v}`) },
        headphone: (id) => ({
            setFaderLevel: (v) => console.log(`   [Mixer] Headphone ${id} Volume -> ${v}`)
        })
    };

    mixer.channelSync = {
        selectChannel: (type, num, id) => console.log(`   [Mixer] SYNC: Selecionando ${type} ${num || ''} no SyncID: ${id}`)
    };

    mixer.fx = (id) => ({
        setBpm: (v) => console.log(`   [Mixer] FX Engine ${id} BPM -> ${v}`),
        setParam: (p, v) => console.log(`   [Mixer] FX Engine ${id} Param ${p} -> ${v}`),
        input: (ch) => ({
            setFaderLevel: (v) => console.log(`   [Mixer] Ch ${ch} -> FX ${id} Level: ${v}`),
            setPost: (v) => console.log(`   [Mixer] Ch ${ch} -> FX ${id} Mode: ${v === 1 ? 'POST' : 'PRE'}`)
        })
    });

    mixer.player = {
        play: () => console.log('   [Mixer] Player -> PLAY'),
        pause: () => console.log('   [Mixer] Player -> PAUSE'),
        stop: () => console.log('   [Mixer] Player -> STOP'),
        next: () => console.log('   [Mixer] Player -> NEXT'),
        loadPlaylist: (name) => console.log(`   [Mixer] Player -> Carregando Playlist: ${name}`)
    };

    mixer.recorderDualTrack = {
        recordStart: () => console.log('   [Mixer] RECORDER -> Gravando 🔴'),
        recordStop: () => console.log('   [Mixer] RECORDER -> Parado ⏹️'),
        recordToggle: () => console.log('   [Mixer] RECORDER -> Alternando Gravação')
    };

    mixer.recorderMultiTrack = {
        recordStart: () => console.log('   [Mixer] MTK -> Gravando Multitrack 🎙️'),
        recordStop: () => console.log('   [Mixer] MTK -> Parado ⏹️'),
        activateSoundcheck: () => console.log('   [Mixer] MTK -> VIRTUAL SOUNDCHECK ATIVADO 🎚️'),
        deactivateSoundcheck: () => console.log('   [Mixer] MTK -> VIRTUAL SOUNDCHECK DESATIVADO')
    };

    mixer.shows = {
        loadShow: (name) => console.log(`   [Mixer] SHOW -> Carregando Show: ${name}`),
        loadSnapshot: (show, snap) => console.log(`   [Mixer] SHOW -> Carregando Snapshot: ${snap} (Show: ${show})`),
        updateCurrentSnapshot: () => console.log('   [Mixer] SHOW -> Snapshot ATUALIZADO 💾')
    };

    mixer.muteGroup = (id) => ({
        mute: () => console.log(`   [Mixer] Mute Group ${id} MUTADO 🔇`),
        unmute: () => console.log(`   [Mixer] Mute Group ${id} ATIVADO 🔊`)
    });
    mixer.clearMuteGroups = () => console.log('   [Mixer] Todos os Mute Groups LIMPOS 🧹');

    mixer.input = (ch) => ({
        setFaderLevel: (v) => console.log(`   [Mixer] Canal ${ch} -> ${v}`),
        toggleSolo: () => console.log(`   [Mixer] Canal ${ch} SOLO Alternado`),
        setPan: (v) => console.log(`   [Mixer] Canal ${ch} Pan -> ${v}`),
        setDelay: (ms) => console.log(`   [Mixer] Canal ${ch} Delay -> ${ms}ms`),
        multiTrackSelect: () => console.log(`   [Mixer] Canal ${ch} -> Selecionado para MTK`),
        multiTrackUnselect: () => console.log(`   [Mixer] Canal ${ch} -> Removido do MTK`),
        aux: (auxId) => ({
            setFaderLevel: (v) => console.log(`   [Mixer] Ch ${ch} -> AUX ${auxId} Level: ${v}`),
            setPost: (v) => console.log(`   [Mixer] Ch ${ch} -> AUX ${auxId} Mode: ${v === 1 ? 'POST' : 'PRE'}`),
            setPostProc: (v) => console.log(`   [Mixer] Ch ${ch} -> AUX ${auxId} Proc: ${v === 1 ? 'POST-PROC' : 'PRE-PROC'}`),
            setPan: (v) => console.log(`   [Mixer] Ch ${ch} -> AUX ${auxId} Pan: ${v}`)
        }),
        fx: (fxId) => ({
            setFaderLevel: (v) => console.log(`   [Mixer] Ch ${ch} -> FX ${fxId} Level: ${v}`),
            setPost: (v) => console.log(`   [Mixer] Ch ${ch} -> FX ${fxId} Mode: ${v === 1 ? 'POST' : 'PRE'}`)
        }),
        eq: () => ({
            setHpfFreq: (f) => console.log(`   [Mixer] Ch ${ch} HPF -> ${f}Hz`)
        })
    });

    const tests = [
        { action: 'toggle_dim' },
        { action: 'set_master_pan', val: 0.2 },
        { action: 'fade_master', level: 0.1, time: 3000 },
        { action: 'set_delay', target: 'master', ms: 150 },
        { action: 'toggle_solo', ch: 3 },
        { action: 'set_channel_pan', ch: 5, val: 0.8 },
        { action: 'set_delay', target: 'channel', id: 2, ms: 45 },
        { action: 'set_aux_post', channel: 1, aux: 2, enabled: 0 }, 
        { action: 'set_aux_post_proc', channel: 1, aux: 2, enabled: 1 },
        { action: 'set_aux_pan', channel: 4, aux: 1, val: 0.3 },
        { action: 'set_fx_post', channel: 2, fx: 1, enabled: 1 },
        { action: 'set_hw_gain', input: 1, val: 0.65 },
        { action: 'set_phantom', input: 1, enabled: 1 },
        { action: 'set_monitor_volume', target: 'solo', val: 0.7 },
        { action: 'set_monitor_volume', target: 'hp1', val: 0.5 },
        { action: 'select_channel', type: 'input', ch: 8 },
        { action: 'select_channel', type: 'master' },
        { action: 'player_cmd', action_type: 'play' },
        { action: 'player_cmd', action_type: 'load_playlist', val: 'Hinos_PIBI' },
        { action: 'recorder_cmd', action_type: 'start' },
        { action: 'mtk_cmd', action_type: 'soundcheck_on' },
        { action: 'mtk_select', channel: 12, enabled: 1 },
        { action: 'set_fx_bpm', fx: 2, val: 125 },
        { action: 'set_fx_param', fx: 1, param: 3, val: 0.8 },
        { action: 'show_cmd', action_type: 'load_snapshot', show: 'PIBI_Geral', target: 'Culto_Domingo' },
        { action: 'show_cmd', action_type: 'update_snapshot' },
        { action: 'mute_group_cmd', id: 'all', enabled: 1 },
        { action: 'clear_mute_groups' }
    ];

    tests.forEach(t => {
        console.log(`\n> Testando: ${t.action}...`);
        const res = actions.executeMixerCommand(t);
        console.log(`   Resultado: ${res}`);
    });
    
    console.log('\n=============================================');
    console.log('         TESTBED CONCLUÍDO COM SUCESSO');
    console.log('=============================================\n');
}

runTestbed().catch(console.error);
