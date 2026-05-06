const tf = require('@tensorflow/tfjs-node');
const path = require('path');
const fs = require('fs');

class FeedbackPredictor {
    constructor() {
        this.model = null;
        this.history = [];
    }

    async init() {
        // Cria um modelo sequencial simples para análise de séries temporais curtas
        this.model = tf.sequential();
        this.model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [4] })); // freq, db, db_delta, gain
        this.model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
        this.model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

        this.model.compile({
            optimizer: tf.train.adam(),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        console.log('[AI Predictor] Modelo de Previsão de Feedback inicializado.');
    }

    /**
     * Analisa o estado atual e prevê risco de feedback
     */
    async predictRisk(freq, db, prevDb, gain) {
        if (!this.model) return 0;

        const input = tf.tensor2d([[freq / 20000, db / 100, (db - prevDb) / 100, gain / 100]]);
        const prediction = this.model.predict(input);
        const risk = await prediction.data();
        
        tf.dispose([input, prediction]);
        return risk[0];
    }

    /**
     * Treina o modelo com um evento real de feedback
     */
    async trainOnEvent(freq, db, prevDb, gain, isFeedback) {
        const xs = tf.tensor2d([[freq / 20000, db / 100, (db - prevDb) / 100, gain / 100]]);
        const ys = tf.tensor2d([[isFeedback ? 1 : 0]]);
        
        await this.model.fit(xs, ys, { epochs: 1 });
        tf.dispose([xs, ys]);
    }
}

module.exports = new FeedbackPredictor();
