import { describe, it, expect, vi, beforeEach } from 'vitest';
const { registerSocketHandlers } = require('../src/server/socket-handlers');

// Mock das dependências externas
vi.mock('soundcraft-ui-connection', () => ({
    SoundcraftUI: vi.fn().mockImplementation(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        master: {
            faderLevel$: { subscribe: vi.fn() },
            faderLevelDB$: { subscribe: vi.fn() },
            setFaderLevel: vi.fn()
        }
    }))
}));

vi.mock('../src/server/database', () => ({
    presets: {
        insert: vi.fn(),
        find: vi.fn(() => ({ sort: vi.fn(() => ({ exec: vi.fn() })) })),
        findOne: vi.fn()
    }
}));

describe('Socket Handlers Integration', () => {
    let mockIo;
    let mockSocket;
    let registeredHandlers = {};

    beforeEach(() => {
        mockIo = {
            on: vi.fn((event, cb) => {
                if (event === 'connection') {
                    mockSocket = {
                        id: 'test-socket',
                        emit: vi.fn(),
                        on: vi.fn((ev, handler) => {
                            registeredHandlers[ev] = handler;
                        })
                    };
                    cb(mockSocket);
                }
            })
        };
        registerSocketHandlers(mockIo);
    });

    it('should validate and reject invalid connect_mixer IP', async () => {
        const handler = registeredHandlers['connect_mixer'];
        
        // "invalid" não passa no regex nem no enum
        await handler('invalid');
        
        expect(mockSocket.emit).toHaveBeenCalledWith('mixer_status', expect.objectContaining({
            msg: expect.stringContaining('Erro de conexao')
        }));
    });

    it('should validate and accept correct simulated IP', async () => {
        const handler = registeredHandlers['connect_mixer'];
        await handler('simulado');
        
        expect(mockSocket.emit).toHaveBeenCalledWith('mixer_status', expect.objectContaining({
            isSimulated: true
        }));
    });

    it('should reject invalid set_master_level data', async () => {
        const handler = registeredHandlers['set_master_level'];
        
        // Conectar primeiro
        await registeredHandlers['connect_mixer']('simulado');
        
        // Enviando string ao invés de número no level
        await handler({ level: 'invalid' });
        
        expect(mockSocket.emit).toHaveBeenCalledWith('mixer_status', expect.objectContaining({
            msg: expect.stringContaining('Dados inválidos')
        }));
    });

    it('should validate apply_channel_hpf with correct types', async () => {
        const handler = registeredHandlers['apply_channel_hpf'];
        
        // Primeiro conectar para ter um mixer ativo
        await registeredHandlers['connect_mixer']('simulado');
        
        await handler({ channel: 1, hz: 150 });
        
        expect(mockSocket.emit).toHaveBeenCalledWith('feedback_cut_success', expect.objectContaining({
            msg: expect.stringContaining('HPF 150Hz aplicado')
        }));
    });

    it('should reject apply_channel_hpf with out of range values', async () => {
        const handler = registeredHandlers['apply_channel_hpf'];
        await registeredHandlers['connect_mixer']('simulado');
        
        // Canal 25 não existe (max 24)
        await handler({ channel: 25, hz: 150 });
        
        expect(mockSocket.emit).toHaveBeenCalledWith('mixer_status', expect.objectContaining({
            connected: true
        }));
    });
});
