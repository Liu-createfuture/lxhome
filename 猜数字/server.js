'use strict';

/**
 * 猜数字 · 4位 1A2B
 * 单文件服务端：静态资源 + WebSocket 房间对战
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('./lib/ws');
const { createSocial } = require('./lib/social');

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;

/* 只对外暴露这几个静态文件，避免把 server.js / package.json 等源码暴露出去 */
const STATIC_FILES = new Set(['index.html', 'styles.css', 'app.js', 'config.js', 'net-lite.js']);

const MAX_GUESSES = 60;              // 单人单局猜测上限（安全阀）
const RECONNECT_GRACE_MS = 90 * 1000; // 掉线后保留席位时长
const ROOM_IDLE_MS = 30 * 60 * 1000;  // 空房间回收
const COUNTDOWN_MS = 3000;

/* ------------------------------------------------------------------ */
/* 静态资源                                                            */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const rooms = new Map();

/* 大厅社交层（好友在线状态 / 私聊 / 邀请） */
const social = createSocial(sendTo);

function onlineCount() {
  let n = 0;
  for (const room of rooms.values()) {
    n += room.players.filter((p) => p.connected).length;
  }
  return n;
}

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    res.writeHead(400).end('Bad Request');
    return;
  }

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  /* 反向代理可能保留路径前缀，用后缀匹配 */
  if (url.pathname === '/api/stats' || url.pathname.endsWith('/api/stats')) {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...cors
    });
    res.end(
      JSON.stringify({
        rooms: rooms.size,
        online: onlineCount(),
        players: onlineCount(),
        ...social.stats()
      })
    );
    return;
  }

  /* ---- SSE 兼容通道：微信等屏蔽 WebSocket 的 WebView 走这条 ---- */
  if (req.method === 'GET' && url.pathname.endsWith('/api/sse')) {
    const sid = String(url.searchParams.get('sid') || '').slice(0, 40);
    if (!/^[A-Za-z0-9_-]{6,40}$/.test(sid)) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', ...cors });
      res.end('bad sid');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...cors
    });
    res.write('retry: 2000\n\n');

    const sock = new SseSocket((str) => res.write(`data: ${str}\n\n`));
    sseSockets.set(sid, sock);
    res.write(`data: ${JSON.stringify({ t: 'ready', sid })}\n\n`);

    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        /* ignore */
      }
    }, 25000);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(ping);
      if (sseSockets.get(sid) === sock) sseSockets.delete(sid);
      sock.close();
    };
    req.on('close', cleanup);
    res.on('close', cleanup);

    registerConn(sock);
    return;
  }

  if (req.method === 'POST' && url.pathname.endsWith('/api/post')) {
    let body = '';
    let tooBig = false;
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        tooBig = true;
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooBig) return;
      let payload = null;
      try {
        payload = JSON.parse(body);
      } catch {
        /* ignore */
      }
      const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...cors
      };
      const sock = payload ? sseSockets.get(String(payload.sid || '')) : null;
      if (!sock || sock.readyState !== 1) {
        res.writeHead(404, headers);
        res.end('{"ok":false}');
        return;
      }
      sock.emit('message', JSON.stringify(payload.msg || {}));
      res.writeHead(200, headers);
      res.end('{"ok":true}');
    });
    return;
  }

  const filePath = resolveStaticFile(decodeURIComponent(url.pathname));
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      ...cors
    });
    res.end(buf);
  });
});

function resolveStaticFile(pathname) {
  const clean = pathname.replace(/^\/+/, '').replace(/\\/g, '/');
  const candidate = clean === '' ? 'index.html' : clean;
  if (STATIC_FILES.has(candidate)) return path.join(ROOT_DIR, candidate);
  const base = candidate.split('/').pop();
  if (STATIC_FILES.has(base)) return path.join(ROOT_DIR, base);
  return null;
}

/* ------------------------------------------------------------------ */
/* 游戏工具                                                            */
/* ------------------------------------------------------------------ */

function randomSecret() {
  const forced = process.env.GN_SECRET;
  if (forced && /^\d{4}$/.test(forced) && new Set(forced).size === 4) return forced; // 仅用于本地调试
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 4).join('');
}

function isValidGuess(value) {
  return typeof value === 'string' && /^[0-9]{4}$/.test(value) && new Set(value).size === 4;
}

function judge(secret, guess) {
  let a = 0;
  let b = 0;
  for (let i = 0; i < 4; i += 1) {
    if (secret[i] === guess[i]) a += 1;
  }
  for (const ch of guess) {
    if (secret.includes(ch)) b += 1;
  }
  return { a, b: b - a };
}

const CODE_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY34679'; // 去掉易混淆字符
function makeCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function sanitizeNick(nick) {
  const raw = typeof nick === 'string' ? nick : '';
  const clean = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 12);
  return clean || '玩家';
}

/* ------------------------------------------------------------------ */
/* 房间                                                                */
/* ------------------------------------------------------------------ */

function sendTo(ws, msg) {
  if (ws && ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* ignore */
    }
  }
}

function buildState(room, index) {
  const me = room.players[index] || null;
  return {
    code: room.code,
    status: room.status,
    you: index,
    hostIdx: room.players.findIndex((p) => p.token === room.hostToken),
    players: room.players.map((p) => ({
      nick: p.nick,
      connected: p.connected,
      attempts: p.guesses.length,
      solved: Boolean(p.solvedAt)
    })),
    myGuesses: me ? me.guesses : [],
    secret: room.status === 'finished' ? room.secret : null,
    startAt: room.startAt || 0,
    endAt: room.endAt || 0,
    winnerIdx:
      room.status === 'finished' ? room.players.findIndex((p) => p.token === room.winnerToken) : -1,
    reason: room.winnerReason || null,
    finalGuesses:
      room.status === 'finished' ? room.players.map((p) => p.guesses) : null,
    durations:
      room.status === 'finished' ? room.players.map((p) => p.durationMs || null) : null
  };
}

function broadcastState(room) {
  room.updatedAt = Date.now();
  room.players.forEach((player, index) => {
    if (player.connected && player.ws) {
      sendTo(player.ws, { t: 'state', state: buildState(room, index), token: player.token });
    }
  });
}

function toastRoom(room, msg) {
  room.players.forEach((p) => {
    if (p.connected && p.ws) sendTo(p.ws, { t: 'toast', msg });
  });
}

function attachPlayer(room, ws, nick) {
  const player = {
    token: crypto.randomUUID(),
    nick: sanitizeNick(nick),
    ws,
    connected: true,
    guesses: [],
    solvedAt: 0,
    durationMs: null,
    disconnectAt: 0,
    forfeitTimer: null
  };
  room.players.push(player);
  return player;
}

function createRoom(ws, nick) {
  const room = {
    code: makeCode(),
    status: 'waiting',
    players: [],
    hostToken: null,
    secret: null,
    startAt: 0,
    endAt: 0,
    winnerToken: null,
    winnerReason: null,
    countdownTimer: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  rooms.set(room.code, room);
  const player = attachPlayer(room, ws, nick);
  room.hostToken = player.token;
  return { room, player };
}

function clearCountdown(room) {
  if (room.countdownTimer) {
    clearTimeout(room.countdownTimer);
    room.countdownTimer = null;
  }
}

function beginCountdown(room) {
  const active = room.players.filter((p) => p.connected);
  if (active.length < 2) {
    return false;
  }
  clearCountdown(room);
  room.players.forEach((p) => {
    p.guesses = [];
    p.solvedAt = 0;
    p.durationMs = null;
  });
  room.secret = randomSecret();
  room.status = 'countdown';
  room.startAt = Date.now() + COUNTDOWN_MS;
  room.endAt = 0;
  room.winnerToken = null;
  room.winnerReason = null;
  broadcastState(room);

  room.countdownTimer = setTimeout(() => {
    room.countdownTimer = null;
    if (room.status !== 'countdown') return;
    if (room.players.filter((p) => p.connected).length < 2) {
      room.status = 'waiting';
      broadcastState(room);
      return;
    }
    room.status = 'playing';
    room.startAt = Date.now();
    broadcastState(room);
    toastRoom(room, '对战开始！');
  }, COUNTDOWN_MS);

  return true;
}

function finishRound(room, winner, reason) {
  if (room.status === 'finished') return;
  clearCountdown(room);
  room.status = 'finished';
  room.endAt = Date.now();
  room.winnerToken = winner ? winner.token : null;
  room.winnerReason = reason || 'solved';
  room.players.forEach((p) => {
    if (p.solvedAt) p.durationMs = p.solvedAt - room.startAt;
  });
  broadcastState(room);
}

function detach(conn) {
  const room = conn.room;
  const player = conn.player;
  conn.room = null;
  conn.player = null;
  if (!room || !player) return;

  player.ws = null;
  player.connected = false;
  player.disconnectAt = Date.now();
  broadcastState(room);
  toastRoom(room, `${player.nick} 掉线了，等待重连…`);

  if (room.status === 'playing' || room.status === 'countdown') {
    player.forfeitTimer = setTimeout(() => {
      player.forfeitTimer = null;
      if (player.connected) return;
      const other = room.players.find((p) => p !== player && p.connected);
      if (other) {
        finishRound(room, other, 'forfeit');
        broadcastState(room);
        toastRoom(room, '对手掉线，本局判你获胜');
      } else {
        room.status = 'waiting';
        clearCountdown(room);
        broadcastState(room);
      }
    }, RECONNECT_GRACE_MS);
  }
}

function leaveRoom(conn) {
  const room = conn.room;
  const player = conn.player;
  conn.room = null;
  conn.player = null;
  if (!room || !player) return;

  if (player.forfeitTimer) {
    clearTimeout(player.forfeitTimer);
    player.forfeitTimer = null;
  }

  const others = room.players.filter((p) => p !== player && p.connected);
  if ((room.status === 'playing' || room.status === 'countdown') && others.length > 0) {
    finishRound(room, others[0], 'leave');
  }

  room.players = room.players.filter((p) => p !== player);
  if (room.players.length === 0) {
    rooms.delete(room.code);
    return;
  }
  if (room.hostToken === player.token) room.hostToken = room.players[0].token;
  if (room.status !== 'finished') {
    room.status = 'waiting';
    clearCountdown(room);
  }
  broadcastState(room);
  toastRoom(room, `${player.nick} 离开了房间`);
}

function bindPlayer(conn, room, player, ws) {
  if (conn.player && conn.player !== player) leaveRoom(conn);
  conn.room = room;
  conn.player = player;
  player.ws = ws;
  player.connected = true;
  player.disconnectAt = 0;
  if (player.forfeitTimer) {
    clearTimeout(player.forfeitTimer);
    player.forfeitTimer = null;
  }
  sendTo(ws, { t: 'joined', code: room.code, token: player.token, nick: player.nick });
  broadcastState(room);
}

/* ------------------------------------------------------------------ */
/* 连接处理（WebSocket 与 SSE 兼容通道共用）                            */
/* ------------------------------------------------------------------ */

const sseSockets = new Map();

class SseSocket extends require('events').EventEmitter {
  constructor(write) {
    super();
    this.readyState = 1;
    this._write = write;
  }
  send(str) {
    if (this.readyState !== 1) return;
    try {
      this._write(str);
    } catch {
      this.close();
    }
  }
  ping() {
    /* SSE 用注释行保活，这里无需额外动作 */
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close');
  }
  terminate() {
    this.close();
  }
}

function makeConn(ws) {
  return { ws, room: null, player: null, social: null, watch: new Set() };
}

function registerConn(ws) {
  const conn = makeConn(ws);
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  const fail = (msg) => sendTo(ws, { t: 'error', msg });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== 'string') return;

    /* 大厅社交：身份、在线状态、私聊、邀请 */
    if (social.handle(conn, msg)) return;

    /* 创建房间 */
    if (msg.t === 'create') {
      if (conn.player) return fail('你已经在房间里了');
      const { room, player } = createRoom(ws, msg.nick);
      bindPlayer(conn, room, player, ws);
      return;
    }

    /* 加入房间 */
    if (msg.t === 'join') {
      if (conn.player) return fail('你已经在房间里了');
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      const room = rooms.get(code);
      if (!room) return fail('房间不存在，检查一下房间号');

      const token = typeof msg.token === 'string' ? msg.token : '';
      const known = token ? room.players.find((p) => p.token === token) : null;
      if (known) {
        bindPlayer(conn, room, known, ws);
        return;
      }
      if (room.players.length >= 2) {
        const stale = room.players.find((p) => !p.connected);
        if (stale) {
          if (stale.forfeitTimer) clearTimeout(stale.forfeitTimer);
          room.players = room.players.filter((p) => p !== stale);
          if (room.hostToken === stale.token && room.players[0]) {
            room.hostToken = room.players[0].token;
          }
        } else {
          return fail('房间已满，换一个房间试试');
        }
      }
      if (room.status === 'playing' || room.status === 'countdown') {
        return fail('这局正在对战，等他们打完再来');
      }
      const player = attachPlayer(room, ws, msg.nick);
      bindPlayer(conn, room, player, ws);
      toastRoom(room, `${player.nick} 加入了房间`);
      return;
    }

    /* 断线重连 */
    if (msg.t === 'rejoin') {
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const room = rooms.get(code);
      if (!room) {
        sendTo(ws, { t: 'error', msg: '房间已关闭，重新创建一个吧', fatal: true });
        return;
      }
      const player = room.players.find((p) => p.token === msg.token);
      if (!player) {
        sendTo(ws, { t: 'error', msg: '席位已失效，请重新加入房间', fatal: true });
        return;
      }
      bindPlayer(conn, room, player, ws);
      return;
    }

    const room = conn.room;
    const player = conn.player;
    if (!room || !player) return fail('请先进入房间');

    /* 房主开始 */
    if (msg.t === 'start') {
      if (room.hostToken !== player.token) return fail('只有房主可以开始游戏');
      if (room.status === 'waiting') {
        if (room.players.filter((p) => p.connected).length < 2) {
          return fail('再等一位朋友加入吧');
        }
        if (!beginCountdown(room)) return fail('无法开始，房间人数不足');
      }
      return;
    }

    /* 提交猜测 */
    if (msg.t === 'guess') {
      if (room.status !== 'playing') return fail('现在还不能猜');
      if (player.solvedAt) return fail('你已经破解了本局');
      if (player.guesses.length >= MAX_GUESSES) return fail('本局猜测次数已达上限');
      const value = String(msg.value || '').trim();
      if (!isValidGuess(value)) return fail('请输入 4 位不重复的数字');

      const { a, b } = judge(room.secret, value);
      player.guesses.push({ guess: value, a, b, at: Date.now() });
      if (a === 4) {
        player.solvedAt = Date.now();
        player.durationMs = player.solvedAt - room.startAt;
        finishRound(room, player, 'solved');
      } else {
        broadcastState(room);
      }
      return;
    }

    /* 再来一局 */
    if (msg.t === 'rematch') {
      if (room.status !== 'finished') return;
      if (playersConnected(room) < 2) return fail('需要两名玩家在线才能开始下一局');
      if (!beginCountdown(room)) return fail('无法开始，房间人数不足');
      return;
    }

    /* 快捷表情 */
    if (msg.t === 'emote') {
      const text = String(msg.text || '').trim().slice(0, 24);
      if (!text) return;
      toastRoom(room, `${player.nick}：${text}`);
      return;
    }

    /* 退出房间 */
    if (msg.t === 'leave') {
      leaveRoom(conn);
      return;
    }
  });

  ws.on('close', () => {
    social.unregister(conn);
    detach(conn);
  });
  ws.on('error', () => {});
  return conn;
}

const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => registerConn(ws));

function playersConnected(room) {
  return room.players.filter((p) => p.connected).length;
}

/* 心跳 */
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      /* ignore */
    }
  });
}, 30000);

/* 回收空房间 */
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (playersConnected(room) === 0 && now - room.updatedAt > ROOM_IDLE_MS) {
      clearCountdown(room);
      rooms.delete(code);
    }
  }
}, 5 * 60 * 1000).unref?.();

server.listen(PORT, '0.0.0.0', () => {
  const nets = require('os').networkInterfaces();
  const lan = [];
  for (const list of Object.values(nets)) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) lan.push(net.address);
    }
  }
  console.log('');
  console.log('  🎯 猜数字 · 4位 1A2B');
  console.log(`  本机访问:  http://localhost:${PORT}`);
  lan.forEach((ip) => console.log(`  局域网访问: http://${ip}:${PORT}`));
  console.log('');
});
