import { describe, it, expect, vi } from 'vitest';
const { createMixerActions } = require('../src/server/mixer-actions');

vi.mock('../src/server/mixer-singleton', () => ({
    updateChannelState: vi.fn(),
    updateMasterState: vi.fn(),
    updateAuxState: vi.fn(),
    getChannelState: vi.fn(() => ({})),
    getMasterState: vi.fn(() => ({}))
}));

describe('Mixer Actions', () => {
    function createMockMixer() {
        return {
            conn: { sendMessage: vi.fn() },
            input: vi.fn((channel) => ({
                eq: () => ({
                    setHpfFreq: vi.fn(),
                    setHpfSlope: vi.fn(),
                    band: vi.fn(() => ({ setFreq: vi.fn(), setGain: vi.fn(), setQ: vi.fn(), setType: vi.fn() }))
                }),
                gate: () => ({ enable: vi.fn(), disable: vi.fn(), setThreshold: vi.fn() }),
                compressor: () => ({ enable: vi.fn(), setRatio: vi.fn(), setThreshold: vi.fn(), setAttack: vi.fn(), setRelease: vi.fn() }),
                aux: vi.fn(() => ({ setFaderLevel: vi.fn() })),
                fx: vi.fn(() => ({ setFaderLevel: vi.fn() }))
            })),
            master: {
                eq: () => ({ band: vi.fn(() => ({ setFreq: vi.fn(), setGain: vi.fn(), setQ: vi.fn(), setType: vi.fn() })) })
            },
            hw: vi.fn(() => ({ setGain: vi.fn(), phantomOn: vi.fn(), phantomOff: vi.fn() }))
        };
    }

    it('should clamp values correctly', () => {
        const mockMixer = createMockMixer();
        const actions = createMixerActions(() => mockMixer);
        
        // Testando HPF clamp (20-400)
        actions.applyChannelHpf(1, 10); // Abaixo do min
        expect(mockMixer.input).toHaveBeenCalledWith(1);
        
        actions.applyChannelHpf(1, 500); // Acima do max
        expect(mockMixer.input).toHaveBeenCalledWith(1);
    });

    it('should throw error for invalid channel', () => {
        const actions = createMixerActions(() => createMockMixer());
        expect(() => actions.executeMixerCommand({ action: 'unknown' })).toThrow('Acao nao suportada');
    });

    it('should apply channel gate correctly', () => {
        const mockMixer = createMockMixer();
        const actions = createMixerActions(() => mockMixer);
        
        actions.applyChannelGate(5, true, -40);
        expect(mockMixer.input).toHaveBeenCalledWith(5);
    });

    it('should execute aux and fx commands from AI contract', () => {
        const mockMixer = createMockMixer();
        const actions = createMixerActions(() => mockMixer);

        expect(actions.executeMixerCommand({ action: 'set_aux_level', channel: 2, aux: 3, level: 0.7 })).toContain('AUX 3');
        expect(actions.executeMixerCommand({ action: 'set_fx_level', channel: 2, fx: 1, level: 0.5 })).toContain('FX 1');
    });
});
