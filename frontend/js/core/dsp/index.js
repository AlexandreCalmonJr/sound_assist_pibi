/**
 * SoundMaster Pro — DSP Module Index
 * ===================================
 * Exporta todos os módulos DSP para uso no main thread.
 * 
 * Para AudioWorklets, use: dsp/worklet-bundle.js
 */

export { FFT } from './fft-engine.js';
export { Windowing, buildHann, buildBlackmanHarris, buildFlatTop, buildKaiser, buildRectangular } from './windowing-helper.js';
export { SpectrumCalculator } from './spectrum-calculator.js';
export { DelayFinder } from './delay-finder.js';

// Worklet-ready versions (for documentation/bundling)
export { FFT as FFTWorklet } from './fft-worklet.js';
export { Windowing as WindowingWorklet, buildHann as buildHannWL, buildBlackmanHarris as buildBlackmanHarrisWL, buildFlatTop as buildFlatTopWL, buildKaiser as buildKaiserWL } from './windowing-worklet.js';
export { SpectrumWorklet } from './spectrum-worklet.js';

export default {
    FFT: null, // filled after imports
    Windowing: null,
    SpectrumCalculator: null,
    DelayFinder: null
};