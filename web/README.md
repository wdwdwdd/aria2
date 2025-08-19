# OKX WebSocket 客户端测试工具

这是一个用于测试连接到 OKX WebSocket API 的前端工具，可以帮助你诊断和解决 WebSocket 连接问题。

## 功能特性

- ✅ 支持安全 WebSocket (WSS) 连接
- ✅ 自动重连机制（简单重连和指数退避）
- ✅ 心跳检测和超时处理
- ✅ 实时消息日志显示
- ✅ 支持发送自定义 JSON 消息
- ✅ 连接状态可视化
- ✅ CORS 跨域支持

## 快速开始

### 1. 启动本地服务器

```bash
cd web
python3 server.py
```

默认端口是 8000，如果端口被占用，可以指定其他端口：

```bash
python3 server.py 8080
```

### 2. 打开浏览器

访问 `http://localhost:8000` 打开测试页面。

### 3. 连接测试

1. 确认 WebSocket URL 是否正确：`wss://wspap.okx.com:8443/ws/v5/public?brokerId=9999`
2. 选择重连策略（推荐使用"指数退避重连"）
3. 点击"连接"按钮
4. 观察连接状态和日志信息

## 常见问题解决

### 1. 连接被拒绝 (Connection Refused)

**可能原因：**
- 网络防火墙阻止了连接
- OKX 服务器暂时不可用
- URL 地址错误

**解决方法：**
```javascript
// 尝试不同的 OKX WebSocket 端点
wss://ws.okx.com:8443/ws/v5/public
wss://wspap.okx.com:8443/ws/v5/public?brokerId=9999
```

### 2. SSL/TLS 证书错误

**可能原因：**
- 浏览器不信任证书
- 系统时间不正确

**解决方法：**
- 检查系统时间是否正确
- 在浏览器中手动访问 `https://wspap.okx.com:8443` 并接受证书

### 3. CORS 跨域错误

**可能原因：**
- 浏览器阻止了跨域 WebSocket 连接

**解决方法：**
- 使用本地服务器（已包含 CORS 头部）
- 或者使用浏览器扩展禁用 CORS 检查

### 4. 网络代理问题

**可能原因：**
- 公司网络或代理服务器阻止 WebSocket 连接

**解决方法：**
```bash
# 如果使用代理，可能需要配置代理设置
# 或者尝试使用不同的网络环境
```

## 消息格式示例

### 订阅市场数据

```json
{
  "op": "subscribe",
  "args": [
    {
      "channel": "tickers",
      "instId": "BTC-USDT"
    }
  ]
}
```

### 订阅深度数据

```json
{
  "op": "subscribe",
  "args": [
    {
      "channel": "books",
      "instId": "BTC-USDT"
    }
  ]
}
```

### 心跳检测

```json
{
  "op": "ping"
}
```

## 高级配置

### 修改重连参数

在 `websocket-client.js` 中可以调整以下参数：

```javascript
this.maxReconnectAttempts = 5;     // 最大重连次数
this.reconnectDelay = 1000;        // 重连延迟（毫秒）
```

### 修改心跳间隔

```javascript
// 在 startHeartbeat() 方法中修改
setInterval(() => {
    // 心跳逻辑
}, 30000);  // 30秒间隔
```

## 调试技巧

1. **查看浏览器控制台**：按 F12 打开开发者工具，查看 Console 和 Network 标签页
2. **检查网络连接**：确保能够访问 `https://www.okx.com`
3. **测试其他 WebSocket**：先测试连接到其他公开的 WebSocket 服务
4. **检查防火墙设置**：确保端口 8443 没有被阻止

## 文件说明

- `index.html` - 主页面，包含用户界面
- `websocket-client.js` - WebSocket 客户端逻辑
- `server.py` - 本地 HTTP 服务器
- `README.md` - 使用说明文档

## 技术支持

如果仍然无法连接，请检查：

1. 网络连接是否正常
2. 是否在受限网络环境中（如公司网络）
3. 浏览器是否为最新版本
4. 是否有安全软件阻止连接

## 许可证

MIT License
