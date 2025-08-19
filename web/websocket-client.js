class WebSocketClient {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isManualDisconnect = false;
        this.heartbeatInterval = null;
        this.heartbeatTimeout = null;
        
        this.statusElement = document.getElementById('status');
        this.logElement = document.getElementById('log');
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.urlInput = document.getElementById('wsUrl');
        this.strategySelect = document.getElementById('reconnectStrategy');
        this.messageInput = document.getElementById('messageInput');
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.style.color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'black';
        logEntry.textContent = `[${timestamp}] ${message}`;
        this.logElement.appendChild(logEntry);
        this.logElement.scrollTop = this.logElement.scrollHeight;
    }

    updateStatus(status, className) {
        this.statusElement.textContent = status;
        this.statusElement.className = `status ${className}`;
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.log('WebSocket 已经连接', 'info');
            return;
        }

        const url = this.urlInput.value.trim();
        if (!url) {
            this.log('请输入有效的WebSocket URL', 'error');
            return;
        }

        this.isManualDisconnect = false;
        this.updateStatus('正在连接...', 'connecting');
        this.connectBtn.disabled = true;
        
        this.log(`尝试连接到: ${url}`);

        try {
            // 创建WebSocket连接，添加一些常用的协议和选项
            this.ws = new WebSocket(url);
            
            // 设置二进制数据类型
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = (event) => {
                this.log('WebSocket 连接成功!', 'success');
                this.updateStatus('已连接', 'connected');
                this.connectBtn.disabled = false;
                this.disconnectBtn.disabled = false;
                this.reconnectAttempts = 0;
                
                // 开始心跳检测
                this.startHeartbeat();
                
                // 发送初始订阅消息（如果需要）
                this.sendInitialSubscription();
            };

            this.ws.onmessage = (event) => {
                try {
                    let data;
                    if (typeof event.data === 'string') {
                        data = JSON.parse(event.data);
                        this.log(`收到消息: ${JSON.stringify(data, null, 2)}`, 'success');
                    } else {
                        // 处理二进制数据
                        this.log(`收到二进制数据: ${event.data.byteLength} bytes`, 'success');
                        data = event.data;
                    }
                    
                    // 处理心跳响应
                    if (data.event === 'pong') {
                        this.log('收到心跳响应', 'info');
                        this.resetHeartbeatTimeout();
                    }
                } catch (error) {
                    this.log(`解析消息失败: ${error.message}`, 'error');
                    this.log(`原始消息: ${event.data}`, 'info');
                }
            };

            this.ws.onclose = (event) => {
                this.log(`WebSocket 连接关闭. Code: ${event.code}, Reason: ${event.reason}`, 'error');
                this.updateStatus('连接已断开', 'disconnected');
                this.connectBtn.disabled = false;
                this.disconnectBtn.disabled = true;
                
                this.stopHeartbeat();
                
                // 根据关闭代码判断是否需要重连
                if (!this.isManualDisconnect && this.shouldReconnect(event.code)) {
                    this.scheduleReconnect();
                }
            };

            this.ws.onerror = (error) => {
                this.log(`WebSocket 错误: ${error.message || '连接失败'}`, 'error');
                this.updateStatus('连接错误', 'error');
                this.connectBtn.disabled = false;
                this.disconnectBtn.disabled = true;
            };

        } catch (error) {
            this.log(`创建WebSocket连接失败: ${error.message}`, 'error');
            this.updateStatus('连接失败', 'error');
            this.connectBtn.disabled = false;
        }
    }

    disconnect() {
        this.isManualDisconnect = true;
        this.stopHeartbeat();
        
        if (this.ws) {
            this.ws.close(1000, '用户主动断开连接');
            this.ws = null;
        }
        
        this.log('手动断开连接', 'info');
        this.updateStatus('已断开连接', 'disconnected');
        this.connectBtn.disabled = false;
        this.disconnectBtn.disabled = true;
    }

    shouldReconnect(closeCode) {
        // 某些关闭代码不应该重连
        const noReconnectCodes = [1000, 1001, 1005, 4000, 4001, 4002];
        return !noReconnectCodes.includes(closeCode) && 
               this.reconnectAttempts < this.maxReconnectAttempts &&
               this.strategySelect.value !== 'none';
    }

    scheduleReconnect() {
        this.reconnectAttempts++;
        
        let delay = this.reconnectDelay;
        if (this.strategySelect.value === 'exponential') {
            delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
        }
        
        this.log(`${delay/1000}秒后尝试第${this.reconnectAttempts}次重连...`, 'info');
        
        setTimeout(() => {
            if (!this.isManualDisconnect) {
                this.connect();
            }
        }, delay);
    }

    sendMessage(message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.log('WebSocket 未连接，无法发送消息', 'error');
            return false;
        }

        try {
            if (typeof message === 'string') {
                this.ws.send(message);
                this.log(`发送消息: ${message}`, 'info');
            } else {
                this.ws.send(JSON.stringify(message));
                this.log(`发送消息: ${JSON.stringify(message)}`, 'info');
            }
            return true;
        } catch (error) {
            this.log(`发送消息失败: ${error.message}`, 'error');
            return false;
        }
    }

    sendInitialSubscription() {
        // OKX WebSocket 通常需要订阅特定频道
        const subscribeMessage = {
            "op": "subscribe",
            "args": [
                {
                    "channel": "tickers",
                    "instId": "BTC-USDT"
                }
            ]
        };
        
        setTimeout(() => {
            this.sendMessage(subscribeMessage);
        }, 1000);
    }

    startHeartbeat() {
        // 每30秒发送一次心跳
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const pingMessage = { "op": "ping" };
                this.sendMessage(pingMessage);
                
                // 设置心跳超时检测
                this.heartbeatTimeout = setTimeout(() => {
                    this.log('心跳超时，连接可能已断开', 'error');
                    this.ws.close();
                }, 10000);
            }
        }, 30000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this.resetHeartbeatTimeout();
    }

    resetHeartbeatTimeout() {
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    clearLog() {
        this.logElement.innerHTML = '';
    }

    testPing() {
        const pingMessage = { "op": "ping" };
        this.sendMessage(pingMessage);
    }
}

// 全局实例
const wsClient = new WebSocketClient();

// 全局函数供HTML调用
function connect() {
    wsClient.connect();
}

function disconnect() {
    wsClient.disconnect();
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) {
        wsClient.log('请输入要发送的消息', 'error');
        return;
    }
    
    try {
        const jsonMessage = JSON.parse(message);
        wsClient.sendMessage(jsonMessage);
        messageInput.value = '';
    } catch (error) {
        wsClient.log(`消息格式错误: ${error.message}`, 'error');
    }
}

function clearLog() {
    wsClient.clearLog();
}

function testPing() {
    wsClient.testPing();
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
    wsClient.log('WebSocket 客户端已初始化', 'info');
    wsClient.log('点击"连接"按钮开始连接到 OKX WebSocket', 'info');
});
