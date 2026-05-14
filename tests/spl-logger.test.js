import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SERVICE_PATH = resolve(process.cwd(), 'frontend/js/services/spl-logger.service.js');

function loadSplLogger() {
    const state = {};
    globalThis.window = globalThis;
    globalThis.AppStore = {
        setState: vi.fn((patch) => Object.assign(state, patch)),
        getState: vi.fn(() => ({ ...state })),
        subscribe: vi.fn(),
    };
    globalThis.console = { ...console, log: vi.fn() };

    delete globalThis.SplLogger;

    const code = readFileSync(SERVICE_PATH, 'utf8');
    const run = new Function('globalThis', `
        var window = globalThis.window;
        var AppStore = globalThis.AppStore;
        ${code}
    `);
    run(globalThis);

    globalThis.SplLogger.init(48000);
    globalThis.SplLogger.setWeighting('Z');
    return globalThis.SplLogger;
}

function pushOneSecond(logger, splDb) {
    const freqData = new Float32Array([-120, splDb - logger.REF_DB]);
    const timeData = new Float32Array([0, 0, 0, 0]);
    logger.push(freqData, timeData, 4);
    vi.advanceTimersByTime(1000);
}

function runExposure(logger, splDb, seconds, isoStart = '2026-05-14T12:00:00.000') {
    vi.setSystemTime(new Date(isoStart));
    logger.start();
    for (let i = 0; i < seconds; i++) {
        pushOneSecond(logger, splDb);
    }
    logger.stop();
    return logger.getStats();
}

describe('SplLogger occupational dose and Lden', () => {
    let logger;

    beforeEach(() => {
        vi.useFakeTimers();
        logger = loadSplLogger();
    });

    afterEach(() => {
        logger.stop();
        logger.reset();
        vi.useRealTimers();
        delete globalThis.SplLogger;
        delete globalThis.AppStore;
        delete globalThis.window;
    });

    it('accumulates about 100% dose at 85 dB over 8 hours', () => {
        const stats = runExposure(logger, 85, 8 * 3600);

        expect(stats.ldose).toBeCloseTo(100, 1);
        expect(stats.dose8h).toBe(100);
        expect(stats.doseProfile).toBe('NHO_NIOSH_85_3');
        expect(stats.doseCriterionDb).toBe(85);
        expect(stats.doseExchangeRateDb).toBe(3);
        expect(stats.doseThresholdDb).toBe(80);
        expect(stats.doseSecondsAboveThreshold).toBe(8 * 3600);
    });

    it('accumulates about 100% dose at 88 dB over 4 hours', () => {
        const stats = runExposure(logger, 88, 4 * 3600);

        expect(stats.ldose).toBeCloseTo(100, 1);
        expect(stats.dose8h).toBe(100);
    });

    it('accumulates about 100% dose at 82 dB over 16 hours', () => {
        const stats = runExposure(logger, 82, 16 * 3600);

        expect(stats.ldose).toBeCloseTo(100, 1);
        expect(stats.dose8h).toBe(100);
    });

    it('does not accumulate dose below the 80 dB integration threshold', () => {
        const stats = runExposure(logger, 79, 3600);

        expect(stats.ldose).toBe(0);
        expect(stats.dose8h).toBe(0);
        expect(stats.doseSecondsAboveThreshold).toBe(0);
    });

    it('resets dose and Lden accumulators', () => {
        runExposure(logger, 85, 60);

        logger.reset();
        const stats = logger.getStats();

        expect(stats.ldose).toBe(0);
        expect(stats.dose8h).toBe(0);
        expect(stats.doseSecondsAboveThreshold).toBe(0);
        expect(stats.lden).toBeNull();
        expect(stats.lday).toBeNull();
        expect(stats.levening).toBeNull();
        expect(stats.lnight).toBeNull();
    });

    it('keeps day samples unpenalized in Lden', () => {
        const stats = runExposure(logger, 70, 60, '2026-05-14T12:00:00.000');

        expect(stats.lday).toBeCloseTo(70, 1);
        expect(stats.lden).toBeCloseTo(70, 1);
        expect(stats.levening).toBeNull();
        expect(stats.lnight).toBeNull();
    });

    it('applies a +5 dB evening penalty to Lden', () => {
        const stats = runExposure(logger, 70, 60, '2026-05-14T20:00:00.000');

        expect(stats.levening).toBeCloseTo(70, 1);
        expect(stats.lden).toBeCloseTo(75, 1);
        expect(stats.lday).toBeNull();
        expect(stats.lnight).toBeNull();
    });

    it('applies a +10 dB night penalty to Lden', () => {
        const stats = runExposure(logger, 70, 60, '2026-05-14T02:00:00.000');

        expect(stats.lnight).toBeCloseTo(70, 1);
        expect(stats.lden).toBeCloseTo(80, 1);
        expect(stats.lday).toBeNull();
        expect(stats.levening).toBeNull();
    });
});
