'use strict';

/**
 * 大厅的社交层：身份、在线状态、私聊、游戏邀请。
 *
 * 设计取舍：好友关系与聊天记录都存在浏览器本地，服务端只做「在线路由」，
 * 因此服务重启 / 换沙箱都不会丢好友和消息（只有离线暂存队列会丢）。
 */

const ID_RE = /^[A-Z0-9]{4,16}$/;
const MAX_TEXT = 500;
const QUEUE_MAX = 40;

function sanitizeNick(nick) {
  const raw = typeof nick === 'string' ? nick : '';
  const clean = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 12);
  return clean || '玩家';
}

function createSocial(send) {
  /** id -> { id, nick, conns:Set<conn>, queue:[] } */
  const users = new Map();
  /** 已完成 hello 的连接 */
  const conns = new Set();

  function statusOf(id) {
    const u = users.get(id);
    return { id, nick: u ? u.nick : '', online: Boolean(u && u.conns.size) };
  }

  function broadcastPresence(u) {
    const online = u.conns.size > 0;
    conns.forEach((c) => {
      if (c === undefined) return;
      if (c.watch && c.watch.has(u.id) && !u.conns.has(c)) {
        send(c.ws, { t: 'presence', id: u.id, nick: u.nick, online });
      }
    });
  }

  function deliverToUser(u, payload) {
    let delivered = false;
    u.conns.forEach((c) => {
      send(c.ws, payload);
      delivered = true;
    });
    return delivered;
  }

  function ensureUser(id, nick) {
    let u = users.get(id);
    if (!u) {
      u = { id, nick: nick || '', conns: new Set(), queue: [] };
      users.set(id, u);
    }
    return u;
  }

  function flushQueue(u) {
    if (!u.queue.length) return;
    const pending = u.queue.splice(0, u.queue.length);
    pending.forEach((payload) => deliverToUser(u, payload));
  }

  /* ---------------- 各类消息 ---------------- */

  function onHello(conn, msg) {
    const id = String(msg.id || '').toUpperCase().trim();
    if (!ID_RE.test(id)) {
      send(conn.ws, { t: 'error', msg: '身份标识无效' });
      return;
    }
    const nick = sanitizeNick(msg.nick);
    const u = ensureUser(id, nick);
    u.nick = nick;

    if (conn.social && conn.social !== u) {
      // 同一连接切换身份：先退出旧身份
      conn.social.conns.delete(conn);
    }
    u.conns.add(conn);
    conn.social = u;
    conns.add(conn);

    send(conn.ws, { t: 'hello-ok', you: { id, nick } });
    if (conn.watch && conn.watch.size) {
      send(conn.ws, {
        t: 'presence-list',
        list: Array.from(conn.watch).map(statusOf)
      });
    }
    broadcastPresence(u);
    flushQueue(u);
  }

  function onProfile(conn, msg) {
    const u = conn.social;
    if (!u) return;
    u.nick = sanitizeNick(msg.nick);
    send(conn.ws, { t: 'hello-ok', you: { id: u.id, nick: u.nick } });
    broadcastPresence(u);
  }

  function onWatch(conn, msg) {
    const ids = Array.isArray(msg.ids) ? msg.ids : [];
    conn.watch = new Set(
      ids
        .map((v) => String(v || '').toUpperCase().trim())
        .filter((v) => ID_RE.test(v))
        .slice(0, 200)
    );
    send(conn.ws, {
      t: 'presence-list',
      list: Array.from(conn.watch).map(statusOf)
    });
  }

  function onDm(conn, msg) {
    const u = conn.social;
    if (!u) return;
    const to = String(msg.to || '').toUpperCase().trim();
    const text = String(msg.text || '').trim().slice(0, MAX_TEXT);
    const cid = String(msg.cid || '').slice(0, 40);
    if (!ID_RE.test(to) || !text || to === u.id) return;

    const payload = { t: 'dm', from: { id: u.id, nick: u.nick }, text, at: Date.now(), cid };
    const target = users.get(to);

    if (target && target.conns.size) {
      deliverToUser(target, payload);
      send(conn.ws, { t: 'dm-ack', cid, delivered: true });
    } else {
      const box = ensureUser(to, '');
      box.queue.push({ ...payload, queued: true });
      if (box.queue.length > QUEUE_MAX) box.queue.shift();
      send(conn.ws, { t: 'dm-ack', cid, delivered: false });
    }
  }

  function onTyping(conn, msg) {
    const u = conn.social;
    if (!u) return;
    const to = String(msg.to || '').toUpperCase().trim();
    const target = users.get(to);
    if (target && target.conns.size) {
      deliverToUser(target, { t: 'typing', from: { id: u.id, nick: u.nick } });
    }
  }

  function onInvite(conn, msg) {
    const u = conn.social;
    if (!u) return;
    const to = String(msg.to || '').toUpperCase().trim();
    const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (!ID_RE.test(to) || !code) return;

    const target = users.get(to);
    if (!target || !target.conns.size) {
      send(conn.ws, { t: 'invite-fail', to });
      return;
    }
    deliverToUser(target, {
      t: 'invite',
      from: { id: u.id, nick: u.nick },
      game: String(msg.game || 'guess').slice(0, 24),
      gameName: String(msg.gameName || '猜数字').slice(0, 24),
      code,
      at: Date.now()
    });
    send(conn.ws, { t: 'invite-sent', to });
  }

  function onInviteReply(conn, msg) {
    const u = conn.social;
    if (!u) return;
    const to = String(msg.to || '').toUpperCase().trim();
    const target = users.get(to);
    if (!target || !target.conns.size) return;
    deliverToUser(target, {
      t: 'invite-reply',
      from: { id: u.id, nick: u.nick },
      accept: Boolean(msg.accept),
      code: String(msg.code || '').toUpperCase().slice(0, 8)
    });
  }

  const HANDLERS = {
    hello: onHello,
    profile: onProfile,
    watch: onWatch,
    dm: onDm,
    typing: onTyping,
    invite: onInvite,
    'invite-reply': onInviteReply
  };

  function handle(conn, msg) {
    const fn = HANDLERS[msg.t];
    if (!fn) return false;
    try {
      fn(conn, msg);
    } catch {
      /* 单个消息出错不影响连接 */
    }
    return true;
  }

  function unregister(conn) {
    conns.delete(conn);
    const u = conn.social;
    conn.watch = new Set();
    conn.social = null;
    if (!u) return;
    u.conns.delete(conn);
    if (!u.conns.size) broadcastPresence(u);
  }

  function stats() {
    let online = 0;
    users.forEach((u) => {
      if (u.conns.size) online += 1;
    });
    return { users: users.size, onlineUsers: online };
  }

  return { handle, unregister, stats };
}

module.exports = { createSocial, sanitizeNick };
