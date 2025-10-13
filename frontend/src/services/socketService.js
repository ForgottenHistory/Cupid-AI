import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.typingStates = new Map(); // Track which characters are typing
  }

  connect(userId) {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    // Dynamically determine backend URL based on current host
    const currentHost = window.location.hostname;
    const backendUrl = (currentHost !== 'localhost' && currentHost !== '127.0.0.1')
      ? `http://${currentHost}:3000`
      : 'http://localhost:3000';

    this.socket = io(backendUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      // Join user room
      this.socket.emit('join', userId);
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
      console.log('🔌 WebSocket disconnected manually');
    }
  }

  on(event, callback) {
    if (!this.socket) {
      console.warn('Socket not connected');
      return;
    }

    // Store listener for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    this.socket.on(event, callback);
  }

  off(event, callback) {
    if (!this.socket) return;

    this.socket.off(event, callback);

    // Remove from listeners map
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (!this.socket) {
      console.warn('Socket not connected');
      return;
    }

    this.socket.emit(event, data);
  }

  // Typing state management
  setTyping(characterId, isTyping) {
    if (isTyping) {
      this.typingStates.set(characterId, true);
      console.log(`🔄 Global typing state SET for ${characterId}. Active typing:`, Array.from(this.typingStates.keys()));
    } else {
      this.typingStates.delete(characterId);
      console.log(`🔄 Global typing state CLEARED for ${characterId}. Active typing:`, Array.from(this.typingStates.keys()));
    }
  }

  isTyping(characterId) {
    const typing = this.typingStates.has(characterId);
    console.log(`🔍 Checking typing state for ${characterId}: ${typing}. Active typing:`, Array.from(this.typingStates.keys()));
    return typing;
  }

  clearTyping(characterId) {
    this.typingStates.delete(characterId);
    console.log(`🔄 Global typing state CLEARED for ${characterId}. Active typing:`, Array.from(this.typingStates.keys()));
  }
}

export default new SocketService();
