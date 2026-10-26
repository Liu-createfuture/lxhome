# 猜数字 · 4 位 1A2B + 游戏大厅

站点首页是**游戏大厅**（好友、聊天、邀请），第一款游戏是猜数字。
前端纯静态，后端是单文件 Node 服务，**零第三方依赖**，`node server.js` 即可跑。

## 目录结构

```
../index.html        游戏大厅（好友列表 / 聊天 / 邀请）
../lobby.css         大厅样式
../lobby.js          大厅逻辑
index.html           猜数字页面
styles.css           猜数字样式
app.js               猜数字逻辑（单人 + 联机客户端）
config.js            联机服务地址（部署到静态站时改这里）
lib/ws.js            极简 WebSocket 服务端（Node 内置模块实现）
lib/social.js        大厅社交层：身份 / 在线状态 / 私聊 / 邀请
server.js            静态文件服务 + 房间管理 + 判分
test/e2e.js          联机对局端到端测试
test/social-e2e.js   大厅社交层端到端测试
```

## 本地运行

```bash
node server.js          # 默认 http://localhost:3000
PORT=8080 node server.js
```

无需 `npm install`（项目没有任何依赖）。

想把大厅也一起在本机看，用任意静态服务器托管仓库根目录（大厅在 `/`，游戏在 `/猜数字/`），
并让 `config.js` 指向这个 Node 服务的地址即可。

## 部署

| 部分 | 内容 | 要求 |
| --- | --- | --- |
| 前端 | `index.html` `lobby.*` + `猜数字/` 整个目录 | 任意静态托管；`/猜数字/` 要能访问到 `index.html` |
| 后端 | `server.js` + `lib/` | 支持长连接的 Node（≥18），监听 `PORT`、绑定 `0.0.0.0` |

后端地址写在 `猜数字/config.js`（大厅也读同一份）：

```js
window.GN_CONFIG = {
  server: 'https://your-backend.example.com', // 留空 = 与页面同源
  sharecode: ''                               // 托管平台要访问码时填这里
};
```

- 换后端只改这两个值，前后端代码都不用动
- 后端对 `/api/stats` 开放 CORS；WebSocket 不受同源限制
- 想完全本地玩，把 `server` 清空即可

当前现网：前端在 lxhome 站点，后端在 WorkBuddy 云托管
（`https://guess-number-1a2b.app.workbuddy.host`）。

## 游戏大厅

- **身份**：首次打开自动生成 8 位号码，存在浏览器本地（`hub.me.v1`），昵称可改
- **加好友**：把号码发给对方，输入号码即添加（单向添加即可聊天）
- **在线状态**：客户端订阅好友列表，服务端推送上下线、昵称变更
- **聊天**：1 对 1，记录存在各自浏览器（`hub.chat.v1.<id>`）；未读数、送达状态、正在输入
- **邀请**：好友聊天里点「一起玩」→ 自动开房并把房间号推给对方 → 对方在大厅收到邀请卡片 →
  接受后直接进同一个房间
- **加新游戏**：大厅的 `GAMES` 数组加一条即可（`href` 指向新游戏目录）

设计取舍：**好友关系与聊天记录只存在浏览器**，服务端只做在线路由 + 离线消息暂存（内存，40 条）。
所以服务重启不会丢好友和聊天，代价是重启后尚未送达的离线消息会丢。

### 社交协议

客户端 → 服务端：`hello` `profile` `watch` `dm` `typing` `invite` `invite-reply`

服务端 → 客户端：`hello-ok` `presence-list` `presence` `dm` `dm-ack` `typing`
`invite` `invite-sent` `invite-fail` `invite-reply`

## 玩法

系统生成 4 位数字，每一位互不相同（首位可以是 0）。每次输入 4 位：

- **A**：数字对、位置也对
- **B**：数字对、位置不对
- `4A0B` 即破解成功

**单人**：实时显示次数、用时、以及「剩余可能」（按历史反馈推算还有多少种答案）；记录存本地。

**联机**：4 位房间号 / 邀请链接 → 房主开始 → 3 秒倒计时同题抢答，先猜中者胜；
实时显示对手已猜次数；掉线 90 秒内可凭席位 token 回到原局，超时判负。

## 连接方式（微信内置浏览器兼容）

客户端默认走 WebSocket。微信内置浏览器（安卓 X5 / iOS WKWebView）常把 WebSocket 握手静默丢掉——
不报错、不触发 onerror，页面表现就是「点了没反应」。

`net-lite.js` 处理了这件事：WebSocket 4 秒内没连上、握手失败、或连上即断开时，
自动切换到 **SSE（服务端下行）+ POST（客户端上行）** 的兼容通道，
对外暴露和 WebSocket 一样的事件接口，业务代码无感。

- 想确认自己的环境是否被限制：链接后加 `?forceSse=1`（如 `/猜数字/?forceSse=1`），
  强制走兼容通道；能正常建房就说明这个环境在拦 WebSocket
- 兼容通道同样支撑大厅的好友、在线状态、聊天与邀请
- 两条通道跑的是同一套房间/社交逻辑（服务端 `registerConn` 抽出来了）

## 测试

```bash
# 终端 1
GN_SECRET=8374 PORT=3100 node server.js

# 终端 2：对局流程 / 大厅社交层 / 兼容通道
GN_SECRET=8374 node test/e2e.js
node test/social-e2e.js
node test/sse-e2e.js
```

线上冒烟（不校验固定答案）：

```bash
WS_URL="wss://<服务地址>/?sharecode=<访问码>" node test/e2e.js
```

## 说明

- 房间数据在内存里，重启即清空；单房间上限 2 人
- 联机时答案只存在服务端，判分在服务端完成
- `GN_SECRET` 环境变量可固定答案，仅供本地测试
- 社交层没有账号密码体系：知道号码就能给对方发消息，适合熟人小范围使用
- **改了 `styles.css` / `lobby.css` / `*.js` 后，记得把 `index.html` 里引用它们的 `?v=` 版本号加一**
  （静态托管下浏览器可能继续用旧缓存，出现「HTML 是新的、CSS 是旧的」这种错配）
