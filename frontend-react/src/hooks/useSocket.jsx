import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [mixerStatus, setMixerStatus] = useState({ connected: false, msg: 'Desconectado', isSimulated: false });
    const [lastLog, setLastLog] = useState('');

    useEffect(() => {
        // Em produção (Electron), o backend roda na mesma porta ou em 3001
        const socketInstance = io(window.location.origin.includes('5173') ? 'http://localhost:3001' : window.location.origin);

        socketInstance.on('connect', () => {
            setIsConnected(true);
            console.log('[Socket] Conectado ao servidor');
        });

        socketInstance.on('disconnect', () => {
            setIsConnected(false);
            setMixerStatus(prev => ({ ...prev, connected: false }));
        });

        socketInstance.on('mixer_status', (status) => {
            setMixerStatus(status);
        });

        socketInstance.on('mixer_log', (log) => {
            setLastLog(log);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    const emit = useCallback((event, data) => {
        if (socket) {
            socket.emit(event, data);
        }
    }, [socket]);

    const value = {
        socket,
        isConnected,
        mixerStatus,
        lastLog,
        emit
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket deve ser usado dentro de um SocketProvider');
    }
    return context;
};
