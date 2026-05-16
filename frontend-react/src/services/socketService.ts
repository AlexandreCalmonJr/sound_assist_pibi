import { io, Socket } from 'socket.io-client'

// URL do backend local (geralmente 3001 para Express)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

class SocketService {
  private socket: Socket | null = null

  connect() {
    if (this.socket) return this.socket

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
    })

    this.socket.on('connect', () => {
      console.log('[Socket] Conectado ao servidor:', SOCKET_URL)
    })

    this.socket.on('disconnect', () => {
      console.log('[Socket] Desconectado')
    })

    return this.socket
  }

  getSocket() {
    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  emit(event: string, data: any) {
    if (this.socket) {
      this.socket.emit(event, data)
    }
  }
}

export const socketService = new SocketService()
