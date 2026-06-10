import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    const socketUrl = import.meta.env.VITE_FLASK_SOCKET_URL || process.env.VITE_FLASK_SOCKET_URL || 'http://localhost:5002';

    this.socket = io(socketUrl, {
      // Let socket.io negotiate transports (avoids websocket-only failures in some envs)
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 500,
    });
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }
}

export default new SocketService();