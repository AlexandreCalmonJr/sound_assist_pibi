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
        { action: 'set_delay', target: 'channel', id: 2, ms: 45 }
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
