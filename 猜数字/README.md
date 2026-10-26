# 猜数字 · 4 位 1A2B

一个双模式猜数字游戏：**单人练习** + **联机对战房间**。前端是纯静态页面，后端是单文件的 Node 服务，
**零第三方依赖**（WebSocket 由 `lib/ws.js` 用 Node 内置模块实现），`node server.js` 即可跑。

## 目录结构

```
index.html      页面结构
styles.css      样式
app.js          单人逻辑 + 联机客户端
config.js       联机服务地址（部署到静态站时改这里）
lib/ws.js       极简 WebSocket 服务端（Node 内置模块实现）
server.js       静态文件服务 + 房间管理 + 判分
test/e2e.js     联机端到端测试（Node 内置 WebSocket 客户端）
```

## 本地运行

```bash
node server.js          # 默认 http://localhost:3000
PORT=8080 node server.js
```

启动后终端会打印局域网地址，同一 WiFi 下用手机打开即可对战。
无需 `npm install`（项目没有任何依赖）。

## 部署到公网

游戏分两部分，可以分开放在不同地方：

| 部分 | 内容 | 要求 |
| --- | --- | --- |
| 前端 | `index.html` / `styles.css` / `app.js` / `config.js` | 任意静态托管（Cloudflare Pages、Nginx…），目录名保证 `/猜数字/` 能访问到 `index.html` |
| 后端 | `server.js` + `lib/ws.js` | 支持长连接的 Node 环境（≥18），监听 `PORT` 并绑定 `0.0.0.0` |

前端通过 `config.js` 找后端：

```js
window.GN_CONFIG = {
  server: 'https://your-backend.example.com', // 联机服务地址，留空=与页面同源
  sharecode: ''                                // 托管平台要求访问码时填这里，自建服务留空
};
```

- 在 `localhost` / 局域网 IP 打开时，会自动走后端同源，不受 `config.js` 影响
- 换后端只改这两个值，页面代码不用动
- 后端已对 `/api/stats` 开放 CORS，跨域可用；WebSocket 不受同源限制

当前现网配置：前端静态页放在 lxhome 站点，后端由 WorkBuddy 云托管
（`https://guess-number-1a2b.app.workbuddy.host`，带 sharecode 访问码）。

## 玩法

系统生成 4 位数字，每一位互不相同（首位可以是 0）。每次输入 4 位：

- **A**：数字对、位置也对
- **B**：数字对、位置不对
- `4A0B` 即破解成功

**单人**：实时显示次数、用时、以及「剩余可能」（按历史反馈推算还有多少种答案）；记录存 localStorage，可展开看每次猜测。

**联机**：创建房间 → 4 位房间号 / 邀请链接 → 两人就位后房主开始 → 3 秒倒计时同题抢答，
先猜中者胜；实时显示对手已猜次数；掉线 90 秒内可凭席位 token 回到原局，超时判负。

## 测试

```bash
# 终端 1：固定答案起一个测试实例
GN_SECRET=8374 PORT=3100 node server.js

# 终端 2：跑完整联机流程（建房、加入、判分、结算、再来一局、重连、离开）
GN_SECRET=8374 node test/e2e.js
```

线上冒烟测试（不校验固定答案）：

```bash
WS_URL="wss://<你的服务地址>/?sharecode=<访问码>" node test/e2e.js
```

## 说明

- 房间数据在内存里，重启服务即清空；单房间上限 2 人
- 联机时答案只存在服务端，前端拿不到，判分也在服务端完成
- `GN_SECRET` 环境变量可固定答案，仅供本地测试
