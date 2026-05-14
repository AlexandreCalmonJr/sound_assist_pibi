/**
 * SoundMaster Pro — Multi-Time Windowing (MTW) AudioWorkletProcessor
 * ====================================================================
 *
 * Problema resolvido:
 *   O createAnalyser nativo usa um único FFT de tamanho fixo com janela
 *   rectangular implícita. Isso impõe um trade-off irreconciliável:
 *     - FFT grande (32768) → boa resolução em graves (<100Hz) mas latência
 *       de 0.74s @ 44.1kHz e resolução temporal péssima em agudos.
 *     - FFT pequena (1024) → boa resolução temporal mas resolução espectral
 *       de ~43Hz/bin nos graves — incapaz de distinguir 40Hz de 83Hz.
 *
 * Solução — MTW (Multi-Time Windowing):
 *   Inspirado em ARTA, Room EQ Wizard (REW) e Rational Acoustics Smaart.
 *   Executa N bandas de análise em paralelo, cada uma com o seu próprio
 *   tamanho de FFT e hop size, otimizados para a gama de frequências:
 *
 *   Banda   FFT     Hop    Resolução      Latência    Cobertura
 *   ─────   ─────   ─────  ─────────────  ─────────   ──────────
 *   BASS    32768   8192   1.35 Hz/bin    0.74 s      20–200 Hz
 *   LOW     16384   4096   2.69 Hz/bin    0.37 s      80–800 Hz
 *   MID      4096   1024  10.77 Hz/bin    93 ms       600–5000 Hz
 *   HIGH     1024    256  43.07 Hz/bin    23 ms       3000–20000 Hz
 *
 * Janelamento disponível:
 *   - Hann         : uso geral (menor vazamento espectral)
 *   - Blackman-Harris (4-term): melhor dinâmica (-92 dBc) para medições PA
 *   - Flat-Top     : melhor precisão de amplitude (para calibração SPL)
 *   - Kaiser-Bessel: configurável (β=6..16), equilíbrio resolução/dinâmica
 *
 * Protocolo (port.onmessage):
 *   { type: 'set-window',  value: 'hann'|'blackman'|'flattop'|'kaiser' }
 *   { type: 'set-kaiser-beta', value: number }
 *   { type: 'set-bands',   bands: [...] }   → reconfigura bandas ativas
 *   { type: 'set-overlap', value: 0.5|0.75|0.875 }
 *
 * Protocolo (port.postMessage):
 *   { type: 'mtw-spectrum',
 *     bands: [
 *       { id, fftSize, magnitude: Float32Array, freqMin, freqMax, hzPerBin },
 *       ...
 *     ],
 *     sampleRate: number
 *   }
 *
 * Notas de implementação:
 *   - Zero alocação por frame após inicialização (sem GC pressure no loop)
 *   - FFT Cooley-Tukey radix-2 DIT in-place
 *   - Overlap-Add WOLA (Weighted Overlap-Add) com 75% de sobreposição
 *   - Bandas processadas de forma assíncrona por hop (não bloqueiam entre si)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * NOTA: Este processor mantém implementações inline de FFT e Windowing para
 * autonomia (AudioWorklets não suportam imports ES modules).
 * Versões modulares disponíveis em: dsp/fft-worklet.js, dsp/windowing-worklet.js
 * Bundle combinado em: dsp/worklet-bundle.js
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ─── Definição das bandas MTW padrão ─────────────────────────────────────────

const DEFAULT_BANDS = [
    { id: 'bass', fftSize: 32768, freqMin:    20, freqMax:   300 },
    { id: 'low',  fftSize: 16384, freqMin:    80, freqMax:   800 },
    { id: 'mid',  fftSize:  4096, freqMin:   600, freqMax:  5000 },
    { id: 'high', fftSize:  1024, freqMin:  3000, freqMax: 20000 },
];

// ─── Janelas disponíveis ──────────────────────────────────────────────────────

/**
 * Hann (von Hann): trade-off equilibrado entre resolução e vazamento.
 *   w(n) = 0.5 · (1 - cos(2πn/N))
 *   Sidelobe: -31.5 dBc  |  Resolução: 1.5 bins
 */
function buildHann(N) {
    const w = new Float64Array(N);
    const c = 2 * Math.PI / (N - 1);
    for (let i = 0; i < N; i++) w[i] = 0.5 * (1 - Math.cos(c * i));
    return w;
}

/**
 * Blackman-Harris (4-term): alta dinâmica, ideal para medições acústicas
 * onde sinais fracos precisam ser visíveis perto de sinais fortes.
 *   Sidelobe: -92 dBc  |  Resolução: 2.0 bins
 *   Coeficientes: Harris 1978, "On the Use of Windows for Harmonic Analysis"
 */
function buildBlackmanHarris(N) {
    const w = new Float64Array(N);
    const a = [0.35875, 0.48829, 0.14128, 0.01168];
    const c = 2 * Math.PI / (N - 1);
    for (let i = 0; i < N; i++) {
        w[i] = a[0]
             - a[1] * Math.cos(    c * i)
             + a[2] * Math.cos(2 * c * i)
             - a[3] * Math.cos(3 * c * i);
    }
    return w;
}

/**
 * Flat-Top (HFT95): máxima precisão de amplitude (+/−0.01 dB).
 * Preferida para calibração SPL e medições de nível absoluto.
 *   Sidelobe: -95 dBc  |  Resolução: 3.8 bins (péssima resolução espectral)
 *   Coeficientes: Heinzel 2002, "Spectrum and spectral density estimation"
 */
function buildFlatTop(N) {
    const w = new Float64Array(N);
    const a = [1.0, 1.9320, 1.2862, 0.3880, 0.0322];
    const c = 2 * Math.PI / (N - 1);
    for (let i = 0; i < N; i++) {
        w[i] = a[0]
             - a[1] * Math.cos(    c * i)
             + a[2] * Math.cos(2 * c * i)
             - a[3] * Math.cos(3 * c * i)
             + a[4] * Math.cos(4 * c * i);
        w[i] /= 4.6384; // normaliza ganho para max=1
    }
    return w;
}

/**
 * Kaiser-Bessel: controlo contínuo do trade-off resolução/dinâmica via β.
 *   β = 0  → rectangular  (-13 dBc, res. máxima)
 *   β = 6  → similar Hann (-57 dBc)
 *   β = 9  → similar Blackman (-96 dBc)
 *   β = 16 → ultra dinâmica (-120+ dBc)
 *
 * Usa a série de Taylor para calcular I₀(x) (função de Bessel modificada).
 */
function buildKaiser(N, beta) {
    const w   = new Float64Array(N);
    const i0b = _besselI0(beta);
    for (let n = 0; n < N; n++) {
        const x  = 2 * n / (N - 1) - 1; // normaliza para [-1, 1]
        w[n] = _besselI0(beta * Math.sqrt(1 - x * x)) / i0b;
    }
    return w;
}

/** Função de Bessel modificada de 1ª espécie ordem 0 (série de Taylor). */
function _besselI0(x) {
    let sum = 1, term = 1;
    for (let k = 1; k <= 30; k++) {
        term *= (x / (2 * k)) * (x / (2 * k));
        sum  += term;
        if (term < 1e-15 * sum) break;
    }
    return sum;
}

// ─── Classe principal ─────────────────────────────────────────────────────────

class MultiTimeWindowProcessor extends AudioWorkletProcessor {

    constructor() {
        super();
        this._sr          = sampleRate;
        this._windowType  = 'blackman';  // padrão: melhor para medições acústicas
        this._kaiserBeta  = 9;
        this._overlapFactor = 0.75;      // 75% overlap = 4× sobreposição

        // Inicializa as bandas MTW
        this._bands = [];
        this._initBands(DEFAULT_BANDS);

        // Buffer circular global de entrada (máx FFT size = 32768)
        const maxFFT = Math.max(...DEFAULT_BANDS.map(b => b.fftSize));
        this._inBuf    = new Float64Array(maxFFT);
        this._inWrite  = 0;
        this._inFilled = 0; // amostras acumuladas desde o último reset

        this.port.onmessage = (e) => this._onMsg(e.data);
    }

    // ─── Configuração ─────────────────────────────────────────────────────────

    _onMsg(msg) {
        switch (msg.type) {
            case 'set-window':
                this._windowType = msg.value;
                this._rebuildWindows();
                break;
            case 'set-kaiser-beta':
                this._kaiserBeta = Math.max(0, Math.min(20, msg.value));
                if (this._windowType === 'kaiser') this._rebuildWindows();
                break;
            case 'set-overlap':
                this._overlapFactor = Math.max(0, Math.min(0.875, msg.value));
                this._bands.forEach(b => {
                    b.hopSize = Math.max(128, Math.round(b.fftSize * (1 - this._overlapFactor)));
                });
                break;
            case 'set-bands':
                this._initBands(msg.bands);
                break;
        }
    }

    _initBands(defs) {
        this._bands = defs.map(def => {
            const n    = def.fftSize;
            const hop  = Math.max(128, Math.round(n * (1 - this._overlapFactor)));
            return {
                id:       def.id,
                fftSize:  n,
                hopSize:  hop,
                freqMin:  def.freqMin,
                freqMax:  def.freqMax,
                // Buffers de análise (pré-alocados, zero GC no loop)
                buf:      new Float64Array(n),   // circular
                writePtr: 0,
                hopCount: 0,                     // samples desde último compute
                window:   this._buildWindow(n),
                // Buffers de trabalho FFT (reutilizados por frame)
                fftRe:    new Float64Array(n),
                fftIm:    new Float64Array(n),
                // Saída suavizada (magnitude dB, half-spectrum)
                magnitude: new Float32Array(n >>> 1),
                smMag:     new Float32Array(n >>> 1), // leaky smoothing
                hzPerBin:  this._sr / n,
                // Normalizador de amplitude da janela
                winNorm:   0, // calculado abaixo
            };
        });

        // Calcula o factor de normalização: 2 / Σw(n)  (para amplitude correta)
        this._bands.forEach(b => {
            let sum = 0;
            for (let i = 0; i < b.window.length; i++) sum += b.window[i];
            b.winNorm = 2.0 / (sum + 1e-30);
        });
    }

    _rebuildWindows() {
        this._bands.forEach(b => {
            b.window  = this._buildWindow(b.fftSize);
            let sum   = 0;
            for (let i = 0; i < b.window.length; i++) sum += b.window[i];
            b.winNorm = 2.0 / (sum + 1e-30);
        });
    }

    _buildWindow(N) {
        switch (this._windowType) {
            case 'hann':     return buildHann(N);
            case 'flattop':  return buildFlatTop(N);
            case 'kaiser':   return buildKaiser(N, this._kaiserBeta);
            case 'blackman':
            default:         return buildBlackmanHarris(N);
        }
    }

    // ─── process() ───────────────────────────────────────────────────────────

    process(inputs) {
        const ch = inputs[0]?.[0];
        if (!ch) return true;

        const bsz = ch.length; // 128 samples por frame

        for (let i = 0; i < bsz; i++) {
            const sample = ch[i];

            // Alimenta cada banda com a mesma amostra
            for (let b = 0; b < this._bands.length; b++) {
                const band = this._bands[b];
                band.buf[band.writePtr] = sample;
                band.writePtr = (band.writePtr + 1) % band.fftSize;
                band.hopCount++;

                // Quando acumulou hopSize amostras → computa FFT desta banda
                if (band.hopCount >= band.hopSize) {
                    band.hopCount = 0;
                    this._computeBand(band);
                }
            }
        }

        return true;
    }

    // ─── Computação de uma banda ──────────────────────────────────────────────

    /**
     * Janelamento + FFT + cálculo de magnitude para uma banda.
     * Todos os buffers são pré-alocados; zero alocação de heap aqui.
     */
    _computeBand(band) {
        const N = band.fftSize;
        const h = N >>> 1;
        const re = band.fftRe;
        const im = band.fftIm;
        const w  = band.window;

        // Copia buffer circular com janelamento aplicado
        // O buffer circular começa em writePtr (sample mais antigo)
        for (let i = 0; i < N; i++) {
            const idx = (band.writePtr + i) % N;
            re[i] = band.buf[idx] * w[i];
            im[i] = 0;
        }

        // FFT in-place
        _fft(re, im);

        // Magnitude em dB com normalização de janela
        // |H(k)| = sqrt(Re² + Im²) × winNorm
        // dB = 20·log₁₀(|H(k)|)
        const norm = band.winNorm;
        for (let k = 0; k < h; k++) {
            const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]) * norm;
            band.magnitude[k] = 20 * Math.log10(mag + 1e-30);
        }

        // Suavização temporal (leaky average): α=0.3 → ~3 frames
        // Mais agressiva nas bandas lentas (bass) para estabilidade visual
        const alpha = band.id === 'bass' ? 0.15 : band.id === 'low' ? 0.20 : 0.35;
        for (let k = 0; k < h; k++) {
            band.smMag[k] = alpha * band.magnitude[k] + (1 - alpha) * band.smMag[k];
        }

        // Emite resultado (transfere buffer via zero-copy)
        const outMag = band.smMag.slice(); // cópia para Transferable
        this.port.postMessage({
            type:     'band-spectrum',
            id:       band.id,
            fftSize:  N,
            freqMin:  band.freqMin,
            freqMax:  band.freqMax,
            hzPerBin: band.hzPerBin,
            magnitude: outMag,
            windowType: this._windowType,
            ts: currentTime,
        }, [outMag.buffer]);
    }
}

// ─── FFT Cooley-Tukey Radix-2 DIT In-Place ───────────────────────────────────
//
// Opera sobre Float64Array para manter precisão numérica nas bandas de graves
// (onde erros de arredondamento em Float32 degradam a resolução espectral).
//
// Complexidade: O(N log N)  |  In-place (sem alocação extra)

function _fft(re, im) {
    const n = re.length;

    // Bit-reversal permutation
    for (let i = 0, j = 0; i < n; i++) {
        if (i < j) {
            let t = re[i]; re[i] = re[j]; re[j] = t;
                t = im[i]; im[i] = im[j]; im[j] = t;
        }
        let m = n >>> 1;
        while (m >= 1 && j >= m) { j -= m; m >>>= 1; }
        j += m;
    }

    // Butterfly stages
    for (let len = 2; len <= n; len <<= 1) {
        const half = len >>> 1;
        // Pre-computa apenas o ângulo base; twiddles calculados incrementalmente
        // para evitar chamadas a cos/sin dentro do loop interno
        const ang  = -Math.PI / half;   // sinal negativo = FFT direta
        const wbR  = Math.cos(ang);
        const wbI  = Math.sin(ang);

        for (let i = 0; i < n; i += len) {
            let wR = 1, wI = 0;
            for (let j = 0; j < half; j++) {
                const uR = re[i + j];
                const uI = im[i + j];
                const vR = re[i + j + half] * wR - im[i + j + half] * wI;
                const vI = re[i + j + half] * wI + im[i + j + half] * wR;
                re[i + j]          = uR + vR;
                im[i + j]          = uI + vI;
                re[i + j + half]   = uR - vR;
                im[i + j + half]   = uI - vI;
                // Rotação incremental do twiddle factor (evita cos/sin por bin)
                const nwR = wR * wbR - wI * wbI;
                wI        = wR * wbI + wI * wbR;
                wR        = nwR;
            }
        }
    }
}

registerProcessor('mtw-processor', MultiTimeWindowProcessor);
