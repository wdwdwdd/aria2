/**
 * 高级 WebSocket 客户端
 * 包含更多的错误处理、连接优化和调试功能
 */

class AdvancedWebSocketClient {
    constructor(options = {}) {
        this.options = {
            url: 'wss://wspap.okx.com:8443/ws/v5/public?brokerId=9999',
            protocols: [],
            reconnect: true,
            reconnectInterval: 1000,
            maxReconnectInterval: 30000,
            reconnectDecay: 1.5,
            timeoutInterval: 2000,
            maxReconnectAttempts: 5,
            binaryType: 'arraybuffer',
            ...options
        };

        this.ws = null;
        this.forcedClose = false;
        this.timedOut = false;
        this.reconnectAttempts = 0;
        this.readyState = WebSocket.CONNECTING;
        
        // 事件监听器
        this.listeners = {
            open: [],
            close: [],
            connecting: [],
            message: [],
            error: []
        };

        // 统计信息
        this.stats = {
            connectTime: null,
            lastMessageTime: null,
            messageCount: 0,
            reconnectCount: 0,
            totalDowntime: 0
        };

        this.connect();
    }

    // 添加事件监听器
    addEventListener(event, listener) {
        if (this.listeners[event]) {
            this.listeners[event].push(listener);
        }
    }

    // 移除事件监听器
    removeEventListener(event, listener) {
        if (this.listeners[event]) {
            const index = this.listeners[event].indexOf(listener);
            if (index !== -1) {
                this.listeners[event].splice(index, 1);
            }
        }
    }

    // 触发事件
    dispatchEvent(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    console.error('Event listener error:', error);
                }
            });
        }
    }

    // 连接到 WebSocket
    connect() {
        this.forcedClose = false;
        this.timedOut = false;
        
        this.dispatchEvent('connecting', {
            url: this.options.url,
            attempt: this.reconnectAttempts + 1
        });

        try {
            this.ws = new WebSocket(this.options.url, this.options.protocols);
            this.ws.binaryType = this.options.binaryType;

            const connectTimeout = setTimeout(() => {
                this.timedOut = true;
                this.ws.close();
                this.timedOut = false;
            }, this.options.timeoutInterval);

            this.ws.onopen = (event) => {
                clearTimeout(connectTimeout);
                this.readyState = WebSocket.OPEN;
                this.reconnectAttempts = 0;
                this.stats.connectTime = Date.now();
                
                this.dispatchEvent('open', {
                    event,
                    reconnectCount: this.stats.reconnectCount
                });
            };

            this.ws.onclose = (event) => {
                clearTimeout(connectTimeout);
                this.readyState = WebSocket.CLOSED;
                
                if (this.stats.connectTime) {
                    this.stats.totalDowntime += Date.now() - this.stats.connectTime;
                }

                this.dispatchEvent('close', {
                    event,
                    wasClean: event.wasClean,
                    code: event.code,
                    reason: event.reason,
                    reconnectAttempts: this.reconnectAttempts
                });

                if (!this.forcedClose && this.options.reconnect && 
                    this.reconnectAttempts < this.options.maxReconnectAttempts) {
                    
                    this.reconnectAttempts++;
                    this.stats.reconnectCount++;
                    
                    const timeout = this.options.reconnectInterval * 
                        Math.pow(this.options.reconnectDecay, this.reconnectAttempts - 1);
                    
                    setTimeout(() => {
                        if (!this.forcedClose) {
                            this.connect();
                        }
                    }, Math.min(timeout, this.options.maxReconnectInterval));
                }
            };

            this.ws.onmessage = (event) => {
                this.stats.lastMessageTime = Date.now();
                this.stats.messageCount++;
                
                this.dispatchEvent('message', {
                    event,
                    data: event.data,
                    timestamp: this.stats.lastMessageTime
                });
            };

            this.ws.onerror = (event) => {
                this.dispatchEvent('error', {
                    event,
                    reconnectAttempts: this.reconnectAttempts,
                    readyState: this.readyState
                });
            };

        } catch (error) {
            this.dispatchEvent('error', {
                error,
                message: 'Failed to create WebSocket connection'
            });
        }
    }

    // 发送消息
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                if (typeof data === 'object' && data !== null) {
                    this.ws.send(JSON.stringify(data));
                } else {
                    this.ws.send(data);
                }
                return true;
            } catch (error) {
                this.dispatchEvent('error', {
                    error,
                    message: 'Failed to send message'
                });
                return false;
            }
        } else {
            this.dispatchEvent('error', {
                message: 'WebSocket is not connected',
                readyState: this.readyState
            });
            return false;
        }
    }

    // 关闭连接
    close(code = 1000, reason = '') {
        this.forcedClose = true;
        if (this.ws) {
            this.ws.close(code, reason);
        }
    }

    // 获取连接状态
    getReadyState() {
        return this.ws ? this.ws.readyState : WebSocket.CLOSED;
    }

    // 获取统计信息
    getStats() {
        return {
            ...this.stats,
            uptime: this.stats.connectTime ? Date.now() - this.stats.connectTime : 0,
            isConnected: this.getReadyState() === WebSocket.OPEN
        };
    }

    // 检查连接健康状态
    isHealthy() {
        const now = Date.now();
        const timeSinceLastMessage = this.stats.lastMessageTime ? 
            now - this.stats.lastMessageTime : Infinity;
        
        return this.getReadyState() === WebSocket.OPEN && 
               timeSinceLastMessage < 60000; // 60秒内有消息则认为健康
    }

    // 重置统计信息
    resetStats() {
        this.stats = {
            connectTime: null,
            lastMessageTime: null,
            messageCount: 0,
            reconnectCount: 0,
            totalDowntime: 0
        };
    }
}

// 创建专门用于 OKX 的 WebSocket 客户端
class OKXWebSocketClient extends AdvancedWebSocketClient {
    constructor(options = {}) {
        const okxOptions = {
            url: 'wss://wspap.okx.com:8443/ws/v5/public?brokerId=9999',
            reconnectInterval: 1000,
            maxReconnectInterval: 30000,
            maxReconnectAttempts: 10,
            ...options
        };

        super(okxOptions);
        
        this.subscriptions = new Set();
        this.pingInterval = null;
        this.pongTimeout = null;
        
        this.setupOKXHandlers();
    }

    setupOKXHandlers() {
        // 连接成功后的处理
        this.addEventListener('open', () => {
            console.log('OKX WebSocket connected successfully');
            this.startPingPong();
            this.resubscribe();
        });

        // 消息处理
        this.addEventListener('message', ({ data }) => {
            try {
                const message = JSON.parse(data);
                this.handleOKXMessage(message);
            } catch (error) {
                console.error('Failed to parse OKX message:', error);
            }
        });

        // 连接关闭处理
        this.addEventListener('close', () => {
            this.stopPingPong();
        });
    }

    handleOKXMessage(message) {
        if (message.event === 'pong') {
            this.handlePong();
        } else if (message.event === 'error') {
            console.error('OKX WebSocket error:', message);
        } else if (message.data) {
            // 处理市场数据
            console.log('Market data received:', message);
        }
    }

    // 订阅频道
    subscribe(channel, instId) {
        const subscription = { channel, instId };
        const message = {
            op: 'subscribe',
            args: [subscription]
        };

        if (this.send(message)) {
            this.subscriptions.add(JSON.stringify(subscription));
            console.log(`Subscribed to ${channel} for ${instId}`);
            return true;
        }
        return false;
    }

    // 取消订阅
    unsubscribe(channel, instId) {
        const subscription = { channel, instId };
        const message = {
            op: 'unsubscribe',
            args: [subscription]
        };

        if (this.send(message)) {
            this.subscriptions.delete(JSON.stringify(subscription));
            console.log(`Unsubscribed from ${channel} for ${instId}`);
            return true;
        }
        return false;
    }

    // 重新订阅所有频道
    resubscribe() {
        if (this.subscriptions.size > 0) {
            const args = Array.from(this.subscriptions).map(sub => JSON.parse(sub));
            const message = {
                op: 'subscribe',
                args: args
            };
            this.send(message);
            console.log('Resubscribed to all channels');
        }
    }

    // 开始心跳检测
    startPingPong() {
        this.pingInterval = setInterval(() => {
            if (this.getReadyState() === WebSocket.OPEN) {
                this.send({ op: 'ping' });
                
                // 设置 pong 超时
                this.pongTimeout = setTimeout(() => {
                    console.warn('Pong timeout, closing connection');
                    this.close();
                }, 10000);
            }
        }, 30000);
    }

    // 停止心跳检测
    stopPingPong() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
        }
    }

    // 处理 pong 响应
    handlePong() {
        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
        }
        console.log('Received pong from OKX');
    }

    // 关闭连接
    close(code, reason) {
        this.stopPingPong();
        super.close(code, reason);
    }
}

// 导出类供其他文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdvancedWebSocketClient, OKXWebSocketClient };
}
