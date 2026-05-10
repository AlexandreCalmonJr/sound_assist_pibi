const path = require('path');
const fs = require('fs');

/**
 * AI Predictor Lite
 * Agora o processamento pesado é feito no servidor Python nativo
 * para evitar travar o event loop do Node.js.
 */
class FeedbackPredictor {
    constructor() {
        this.pythonUrl = 'http://127.0.0.1:3002/analyze-feedback';
        this.apiKey = process.env.AI_API_KEY || '';
    }

    async init() {
        if (!this.apiKey) {
            console.warn('[AI Predictor] Aviso: AI_API_KEY não configurada. A comunicação com o servidor Python pode falhar em produção.');
        }
        console.log('[AI Predictor] Operando em modo Remoto (Offloading para Python).');
    }

    /**
     * Envia dados para o Python analisar o risco
     */
    async predictRisk(freq, db, prevDb, gain) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        try {
            const res = await fetch(this.pythonUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey
                },
                body: JSON.stringify({ freq, db, prevDb, gain }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            const data = await res.json();
            return data.risk || 0;
        } catch (e) {
            clearTimeout(timeout);
            // Em caso de erro ou timeout, retorna risco zero para não travar
            return 0;
        }
    }

    async trainOnEvent(freq, db, prevDb, gain, isFeedback) {
        // Envia evento de treino para o Python
        try {
            await fetch('http://127.0.0.1:3002/train', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey
                },
                body: JSON.stringify({ freq, db, prevDb, gain, isFeedback })
            });
        } catch (e) {
            console.warn('[AI Predictor] Erro ao enviar treino para o Python.');
        }
    }
}

module.exports = new FeedbackPredictor();
