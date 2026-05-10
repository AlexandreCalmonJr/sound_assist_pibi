import { describe, it, expect, vi } from 'vitest';
const { createMixerActions } = require('../src/server/mixer-actions');

describe('Mixer Actions', () => {
    it('should clamp values correctly', () => {
        const mockMixer = {
            conn: { sendMessage: vi.fn() }
        };
        const actions = createMixerActions(() => mockMixer);
        
        // Testando HPF clamp (20-400)
        actions.applyChannelHpf(1, 10); // Abaixo do min
        expect(mockMixer.conn.sendMessage).toHaveBeenCalledWith('SETD^i.0.eq.hpf.freq^20');
        
        actions.applyChannelHpf(1, 500); // Acima do max
        expect(mockMixer.conn.sendMessage).toHaveBeenCalledWith('SETD^i.0.eq.hpf.freq^400');
    });

    it('should throw error for invalid channel', () => {
        const actions = createMixerActions(() => ({}));
        expect(() => actions.applyChannelHpf(25, 100)).toThrow('Canal invalido');
    });

    it('should apply channel gate correctly', () => {
        const mockMixer = {
            conn: { sendMessage: vi.fn() }
        };
        const actions = createMixerActions(() => mockMixer);
        
        actions.applyChannelGate(5, true, -40);
        expect(mockMixer.conn.sendMessage).toHaveBeenCalledWith('SETD^i.4.gate.enabled^1');
        expect(mockMixer.conn.sendMessage).toHaveBeenCalledWith('SETD^i.4.gate.thresh^-40');
    });
});
