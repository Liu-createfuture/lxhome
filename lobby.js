/* =========================================================
   游戏大厅 · 前端逻辑
   身份 / 好友 / 聊天 / 邀请，全部走同一个联机服务
   ========================================================= */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  /* ---------------- 配置 ---------------- */

  const CFG = window.GN_CONFIG || {};
  const SERVER = String(CFG.server || '').trim().replace(/\/+$/, '');
  const SHARE = String(CFG.sharecode || '').trim();
  const SHARE_QS = SHARE ? `?sharecode=${encodeURIComponent(SHARE)}` : '';
  const STATS_URL = SERVER ? `${SERVER}/api/stats${SHARE_QS}` : 'api/stats';

  function wsEndpoint() {
    if (SERVER) return `${SERVER.replace(/^http/i, 'ws')}/${SHARE_QS}`;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/`;
  }

  /* 游戏清单：以后加新游戏，往这里加一条即可 */
  const GAMES = [
    {
      id: 'guess',
      name: '猜数字',
      emoji: '🎯',
      desc: '4 位 1A2B · 单人练习 / 和好友抢答',
      href: '猜数字/',
      tag: '可联机',
      ready: true
    },
    { id: 'soon1', name: '敬请期待', emoji: '🎲', desc: '下一款游戏正在筹备中', ready: false },
    { id: 'soon2', name: '敬请期待', emoji: '🕹️', desc: '想玩什么告诉我，加进来', ready: false }
  ];

  const SITE_LINKS = [
    { name: '医院导航', emoji: '🌐', href: '医院导航/' },
    { name: '宝可梦', emoji: '🐲', href: '宝可梦/' },
    { name: '输入', emoji: '⌨️', href: '输入/' },
    { name: 'Qwen VL', emoji: '🤖', href: 'qwen-vl/' }
  ];

  /* ---------------- 本地存储 ---------------- */

  const ls = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch {
        /* ignore */
      }
    }
  };

  const ME_KEY = 'hub.me.v1';
  const FRIENDS_KEY = 'hub.friends.v1';
  const CHAT_PREFIX = 'hub.chat.v1.';
  const UNREAD_PREFIX = 'hub.unread.v1.';
  const SOUND_KEY = 'hub.sound.v1';

  function genId() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(8);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  }

  function loadMe() {
    let me = ls.get(ME_KEY, null);
    if (!me || !me.id) {
      me = { id: genId(), nick: `玩家${Math.floor(Math.random() * 90 + 10)}` };
      ls.set(ME_KEY, me);
    }
    return me;
  }

  const me = loadMe();
  let friends = ls.get(FRIENDS_KEY, []);
  if (!Array.isArray(friends)) friends = [];

  const presence = new Map(); // id -> { online, nick, typing }
  let activeId = null;
  let pendingInvite = null;

  /* ---------------- 音效 ---------------- */

  let audioCtx = null;
  let soundOn = ls.get(SOUND_KEY, true);

  function beep(kind) {
    if (!soundOn) return;
    try {
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const gain = audioCtx.createGain();
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = kind === 'invite' ? 880 : 620;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'invite' ? 0.45 : 0.16));
      osc.start(t);
      osc.stop(t + 0.5);
    } catch {
      /* ignore */
    }
  }

  function syncSoundBtn() {
    $('#btnSound').textContent = soundOn ? '🔔' : '🔕';
    $('#btnSound').classList.toggle('is-off', !soundOn);
  }
  syncSoundBtn();

  /* ---------------- 渲染 ---------------- */

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function renderMe() {
    $('#meNick').value = me.nick;
    $('#meId').textContent = me.id;
    $('#emptyId').textContent = me.id;
    $('#meAvatar').textContent = (me.nick || '玩').slice(0, 1);
  }

  function renderGames() {
    $('#gameGrid').innerHTML = GAMES.map((g) => {
      if (!g.ready) {
        return `<div class="game-card is-soon">
          <span class="game-emoji">${g.emoji}</span>
          <div class="game-body">
            <h3>${esc(g.name)}</h3>
            <p>${esc(g.desc)}</p>
          </div>
          <span class="game-play">即将上线</span>
        </div>`;
      }
      return `<a class="game-card" href="${g.href}">
        <span class="game-emoji">${g.emoji}</span>
        <div class="game-body">
          <h3>${esc(g.name)}${g.tag ? `<span class="badge">${esc(g.tag)}</span>` : ''}</h3>
          <p>${esc(g.desc)}</p>
        </div>
        <span class="game-play">进入 →</span>
      </a>`;
    }).join('');
  }

  function renderLinks() {
    $('#miniLinks').innerHTML = SITE_LINKS.map(
      (l) => `<a class="mini-link" href="${l.href}"><span>${l.emoji}</span>${esc(l.name)}</a>`
    ).join('');
  }

  function lastMessage(id) {
    const arr = ls.get(CHAT_PREFIX + id, []);
    return arr.length ? arr[arr.length - 1] : null;
  }

  function friendLabel(f) {
    return f.nick || presence.get(f.id)?.nick || `好友${f.id.slice(0, 2)}`;
  }

  function sortedFriends() {
    return friends.slice().sort((a, b) => {
      const oa = presence.get(a.id)?.online ? 1 : 0;
      const ob = presence.get(b.id)?.online ? 1 : 0;
      if (oa !== ob) return ob - oa;
      const ta = lastMessage(a.id)?.at || a.at || 0;
      const tb = lastMessage(b.id)?.at || b.at || 0;
      return tb - ta;
    });
  }

  function renderFriends() {
    const list = sortedFriends();
    $('#friendCount').textContent = friends.length;
    $('#friendEmpty').classList.toggle('hidden', friends.length > 0);

    $('#friendList').innerHTML = list
      .map((f) => {
        const p = presence.get(f.id) || {};
        const last = lastMessage(f.id);
        const unread = ls.get(UNREAD_PREFIX + f.id, 0);
        const preview = last
          ? `${last.dir === 'me' ? '我：' : ''}${last.text}`
          : p.online
          ? '在线'
          : '点这里发消息';
        return `<div class="friend ${activeId === f.id ? 'active' : ''}" data-id="${esc(f.id)}">
          <div class="f-avatar">${esc(friendLabel(f).slice(0, 1))}<i class="${p.online ? 'on' : ''}"></i></div>
          <div class="f-main">
            <div class="f-top"><b>${esc(friendLabel(f))}</b></div>
            <div class="f-sub">${esc(preview)}</div>
          </div>
          ${unread ? `<span class="f-unread">${unread > 99 ? '99+' : unread}</span>` : ''}
        </div>`;
      })
      .join('');

    updateTitle();
  }

  function updateTitle() {
    const total = friends.reduce((sum, f) => sum + ls.get(UNREAD_PREFIX + f.id, 0), 0);
    document.title = total ? `(${total}) 游戏大厅` : '游戏大厅';
  }

  function fmtClock(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function renderChat() {
    if (!activeId) return;
    const f = friends.find((x) => x.id === activeId);
    const p = presence.get(activeId) || {};
    $('#chatName').textContent = f ? friendLabel(f) : '好友';
    const stateEl = $('#chatState');
    stateEl.textContent = p.typing ? '正在输入…' : p.online ? '在线' : '离线';
    stateEl.classList.toggle('on', Boolean(p.online) && !p.typing);
    $('#btnInvite').disabled = !p.online;

    const msgs = ls.get(CHAT_PREFIX + activeId, []);
    const body = $('#chatBody');
    if (!msgs.length) {
      body.innerHTML = `<div class="chat-empty">还没有聊天记录<br />打个招呼，或者点右上角「一起玩」邀请 TA</div>`;
      return;
    }
    body.innerHTML = msgs
      .map((m) => {
        if (m.dir === 'sys') {
          return `<div class="msg sys"><div class="bubble">${esc(m.text)}</div></div>`;
        }
        const ok = m.dir === 'me' ? (m.ok ? ' · 已送达' : ' · 待送达') : '';
        return `<div class="msg ${m.dir === 'me' ? 'mine' : 'them'}">
          <div class="bubble">${esc(m.text)}</div>
          <div class="meta">${fmtClock(m.at)}${ok}</div>
        </div>`;
      })
      .join('');
    body.scrollTop = body.scrollHeight;
  }

  /* ---------------- 网络 ---------------- */

  let socket = null;
  let connected = false;
  let retry = 0;
  let retryTimer = null;
  const queue = [];

  function send(obj) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(obj));
    } else {
      queue.push(obj);
      if (queue.length > 20) queue.shift();
      connect();
    }
  }

  function connect() {
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) return;
    let ws;
    try {
      ws = new WebSocket(wsEndpoint());
    } catch {
      return;
    }
    socket = ws;

    ws.addEventListener('open', () => {
      connected = true;
      retry = 0;
      updateConnState();
      ws.send(JSON.stringify({ t: 'hello', id: me.id, nick: me.nick }));
      syncWatch();
      const pending = queue.splice(0);
      pending.forEach((m) => {
        try {
          ws.send(JSON.stringify(m));
        } catch {
          /* ignore */
        }
      });
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      handle(msg);
    });

    ws.addEventListener('close', () => {
      connected = false;
      socket = null;
      updateConnState();
      scheduleReconnect();
    });

    ws.addEventListener('error', () => {});
  }

  function scheduleReconnect() {
    if (retryTimer) return;
    retry = Math.min(retry + 1, 6);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, Math.min(1000 * retry, 6000));
  }

  function updateConnState() {
    const pill = $('#onlinePill');
    pill.style.opacity = connected ? '1' : '0.45';
    pill.title = connected ? '已连接联机服务' : '正在连接联机服务…';
  }

  function syncWatch() {
    send({ t: 'watch', ids: friends.map((f) => f.id) });
  }

  function saveFriends() {
    ls.set(FRIENDS_KEY, friends);
  }

  function upsertFriend(id, nick) {
    let f = friends.find((x) => x.id === id);
    if (!f) {
      f = { id, nick: nick || '', at: Date.now() };
      friends.push(f);
      saveFriends();
      return true;
    }
    if (nick && f.nick !== nick) {
      f.nick = nick;
      saveFriends();
    }
    return false;
  }

  /* ---------------- 消息处理 ---------------- */

  function handle(msg) {
    switch (msg.t) {
      case 'hello-ok': {
        refreshStats();
        break;
      }
      case 'presence-list': {
        (msg.list || []).forEach((item) => {
          presence.set(item.id, { online: item.online, nick: item.nick || '' });
          if (item.nick) upsertFriend(item.id, item.nick);
        });
        renderFriends();
        if (activeId) renderChat();
        break;
      }
      case 'presence': {
        const prev = presence.get(msg.id) || {};
        presence.set(msg.id, { online: msg.online, nick: msg.nick || prev.nick || '' });
        if (msg.nick) upsertFriend(msg.id, msg.nick);
        renderFriends();
        if (activeId === msg.id) renderChat();
        break;
      }
      case 'dm': {
        const from = msg.from || {};
        const added = upsertFriend(from.id, from.nick);
        pushMessage(from.id, {
          dir: 'them',
          text: msg.text,
          at: msg.at || Date.now()
        });
        if (activeId === from.id) {
          renderChat();
          clearUnread(from.id);
        } else {
          bumpUnread(from.id);
        }
        if (added) toast(`${from.nick || '好友'} 把你加为了好友`);
        beep('msg');
        renderFriends();
        break;
      }
      case 'dm-ack': {
        if (!activeId) break;
        const msgs = ls.get(CHAT_PREFIX + activeId, []);
        const hit = msgs.find((m) => m.cid && m.cid === msg.cid);
        if (hit) {
          hit.ok = Boolean(msg.delivered);
          ls.set(CHAT_PREFIX + activeId, msgs);
          renderChat();
        }
        break;
      }
      case 'typing': {
        const from = msg.from || {};
        const p = presence.get(from.id) || {};
        presence.set(from.id, { ...p, typing: true });
        if (activeId === from.id) renderChat();
        setTimeout(() => {
          const cur = presence.get(from.id) || {};
          presence.set(from.id, { ...cur, typing: false });
          if (activeId === from.id) renderChat();
        }, 2500);
        break;
      }
      case 'invite': {
        showInvite(msg);
        break;
      }
      case 'invite-sent': {
        toast('邀请已发出，等好友进来');
        pushSystem(activeId, '已发出游戏邀请');
        break;
      }
      case 'invite-fail': {
        toast('对方不在线，没能发出邀请', 'error');
        break;
      }
      case 'invite-reply': {
        const nick = msg.from?.nick || '好友';
        toast(msg.accept ? `${nick} 接受了邀请` : `${nick} 暂时没空`);
        break;
      }
      case 'error': {
        if (msg.msg) toast(msg.msg, 'error');
        break;
      }
      default:
        break;
    }
  }

  function pushMessage(id, m) {
    const arr = ls.get(CHAT_PREFIX + id, []);
    arr.push(m);
    if (arr.length > 200) arr.splice(0, arr.length - 200);
    ls.set(CHAT_PREFIX + id, arr);
  }

  function pushSystem(id, text) {
    if (!id) return;
    pushMessage(id, { dir: 'sys', text, at: Date.now() });
    if (activeId === id) renderChat();
  }

  function bumpUnread(id) {
    const n = ls.get(UNREAD_PREFIX + id, 0) + 1;
    ls.set(UNREAD_PREFIX + id, n);
    updateTitle();
  }

  function clearUnread(id) {
    ls.set(UNREAD_PREFIX + id, 0);
    updateTitle();
  }

  /* ---------------- 聊天抽屉 ---------------- */

  function openChat(id) {
    activeId = id;
    $('#chatDrawer').classList.add('show');
    $('#chatDrawer').setAttribute('aria-hidden', 'false');
    clearUnread(id);
    renderChat();
    renderFriends();
    setTimeout(() => $('#chatInput').focus(), 260);
  }

  function closeChat() {
    activeId = null;
    $('#chatDrawer').classList.remove('show');
    $('#chatDrawer').setAttribute('aria-hidden', 'true');
    renderFriends();
  }

  function sendDm(text) {
    if (!activeId || !text) return;
    const cid = `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    pushMessage(activeId, { dir: 'me', text, at: Date.now(), ok: false, cid });
    renderChat();
    send({ t: 'dm', to: activeId, text, cid });
  }

  /* ---------------- 邀请 ---------------- */

  function showInvite(msg) {
    pendingInvite = msg;
    $('#ibFrom').textContent = msg.from?.nick || '好友';
    $('#ibAvatar').textContent = (msg.from?.nick || '友').slice(0, 1);
    $('#ibGame').textContent = msg.gameName || '猜数字';
    $('#ibCode').textContent = msg.code;
    $('#inviteBanner').classList.add('show');
    beep('invite');
    toast(`${msg.from?.nick || '好友'} 邀请你一起玩`);
  }

  function hideInvite() {
    $('#inviteBanner').classList.remove('show');
    pendingInvite = null;
  }

  function inviteFriend(id) {
    const p = presence.get(id);
    if (!p || !p.online) {
      toast('对方不在线，等 TA 上线再邀请吧', 'error');
      return;
    }
    location.href = `猜数字/?invite=${encodeURIComponent(id)}`;
  }

  /* ---------------- UI 事件 ---------------- */

  function toast(msg, type) {
    const stack = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast ${type === 'error' ? 'error' : ''}`;
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 240);
    }, 2200);
    while (stack.children.length > 3) stack.firstChild.remove();
  }

  function copyText(text) {
    const done = () => toast('号码已复制，发给朋友吧');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else {
      fallback();
    }
    function fallback() {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch {
        toast('复制失败：' + text, 'error');
      }
    }
  }

  function addFriend() {
    const input = $('#friendCode');
    const id = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z0-9]{4,16}$/.test(id)) {
      toast('号码是 4-16 位字母数字', 'error');
      return;
    }
    if (id === me.id) {
      toast('这是你自己的号码', 'error');
      return;
    }
    if (friends.some((f) => f.id === id)) {
      toast('已经在好友列表里了');
      return;
    }
    upsertFriend(id, '');
    syncWatch();
    renderFriends();
    input.value = '';
    toast('已添加，点开就能聊天');
  }

  /* ---------------- 统计 ---------------- */

  function refreshStats() {
    fetch(STATS_URL, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const n = typeof d.onlineUsers === 'number' ? d.onlineUsers : d.online || 0;
        $('#onlineCount').textContent = n;
      })
      .catch(() => {});
  }

  /* ---------------- 初始化 ---------------- */

  function bindEvents() {
    $('#meNick').addEventListener('change', () => {
      const nick = $('#meNick').value.trim().slice(0, 12) || '玩家';
      me.nick = nick;
      ls.set(ME_KEY, me);
      $('#meAvatar').textContent = nick.slice(0, 1);
      send({ t: 'profile', nick });
      renderFriends();
      toast('昵称已更新');
    });

    $('#copyId').addEventListener('click', () => copyText(me.id));

    $('#btnAddFriend').addEventListener('click', addFriend);
    $('#friendCode').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addFriend();
      }
    });

    $('#friendList').addEventListener('click', (e) => {
      const row = e.target.closest('.friend');
      if (row) openChat(row.dataset.id);
    });

    $('#btnChatBack').addEventListener('click', closeChat);

    $('#btnInvite').addEventListener('click', () => {
      if (activeId) inviteFriend(activeId);
    });

    $('#chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#chatInput');
      const text = input.value.trim();
      if (!text) return;
      sendDm(text);
      input.value = '';
    });

    $('#chatInput').addEventListener('input', () => {
      if (!activeId) return;
      send({ t: 'typing', to: activeId });
    });

    $('#ibAccept').addEventListener('click', () => {
      if (!pendingInvite) return;
      const { code } = pendingInvite;
      const from = pendingInvite.from?.id;
      if (from) send({ t: 'invite-reply', to: from, accept: true, code });
      hideInvite();
      location.href = `猜数字/?room=${encodeURIComponent(code)}`;
    });
    $('#ibIgnore').addEventListener('click', () => {
      if (pendingInvite?.from?.id) {
        send({ t: 'invite-reply', to: pendingInvite.from.id, accept: false, code: pendingInvite.code });
      }
      hideInvite();
    });

    $('#btnSound').addEventListener('click', () => {
      soundOn = !soundOn;
      ls.set(SOUND_KEY, soundOn);
      syncSoundBtn();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeId) closeChat();
    });

    window.addEventListener('beforeunload', () => {
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
    });
  }

  function init() {
    renderMe();
    renderGames();
    renderLinks();
    renderFriends();
    bindEvents();
    connect();
    refreshStats();
    setInterval(refreshStats, 20000);
  }

  init();
})();
