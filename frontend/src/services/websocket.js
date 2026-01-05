const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

class WebSocketService {
    constructor() {
        this.ws = null;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.isConnecting = false;
        this.shouldReconnect = true;
    }

    connect(token) {
        // Prevent duplicate connections
        if (this.isConnecting) {
            return;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        // Prevent connection if we're in the process of closing
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            return;
        }

        this.isConnecting = true;
        this.shouldReconnect = true;

        try {
            this.ws = new WebSocket(WS_URL);

            this.ws.onopen = () => {
                console.log('✓ WebSocket connected');
                this.reconnectAttempts = 0;
                this.isConnecting = false;

                // Authenticate
                this.send({ type: 'auth', token });
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            this.ws.onclose = () => {
                this.isConnecting = false;
                if (this.shouldReconnect) {
                    this.attemptReconnect(token);
                }
            };

            this.ws.onerror = (error) => {
                this.isConnecting = false;
                // Only log if we're actually trying to connect
                if (this.shouldReconnect) {
                    console.error('WebSocket error:', error);
                }
            };
        } catch (error) {
            this.isConnecting = false;
            console.error('Failed to create WebSocket:', error);
        }
    }

    attemptReconnect(token) {
        if (!this.shouldReconnect) {
            return;
        }

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
            setTimeout(() => this.connect(token), this.reconnectDelay);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    disconnect() {
        this.shouldReconnect = false;
        this.isConnecting = false;

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.listeners.clear();
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not connected');
        }
    }

    on(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push(callback);
    }

    off(eventType, callback) {
        if (this.listeners.has(eventType)) {
            const callbacks = this.listeners.get(eventType);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    handleMessage(message) {
        const { type } = message;

        if (this.listeners.has(type)) {
            this.listeners.get(type).forEach(callback => callback(message));
        }

        // Also trigger 'message' event for all messages
        if (this.listeners.has('message')) {
            this.listeners.get('message').forEach(callback => callback(message));
        }
    }

    // Convenience methods
    joinChannel(channelId) {
        this.send({ type: 'join_channel', channelId });
    }

    leaveChannel(channelId) {
        this.send({ type: 'leave_channel', channelId });
    }

    sendMessage(channelId, messageText, fileId = null) {
        this.send({ type: 'send_message', channelId, messageText, fileId });
    }

    startTyping(channelId) {
        this.send({ type: 'typing_start', channelId });
    }

    stopTyping(channelId) {
        this.send({ type: 'typing_stop', channelId });
    }
}

export default new WebSocketService();
