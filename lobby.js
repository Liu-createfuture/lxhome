/* =========================================================
   游戏大厅 · 逻辑
   好友收进「好友」按钮 → 侧滑面板（列表 / 聊天）
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

  /* 游戏清单：加新游戏照抄一条即可 */
  const GAMES = [
    {
      id: 'guess',
      name: '猜数字',
      emoji: '🎯',
      desc: '4 位 1A2B · 单人练习 / 和好友抢答',
      href: '猜数字/',
      tag: '可联机',
      online: true,
      c1: '#6366f1',
      c2: '#8b5cf6',
      ready: true
    },
    {
      id: 'link',
      name: '连连看',
      emoji: '🧩',
      desc: '相同图案连线消除 · 3 分钟挑战',
      href: '连连看/',
      tag: '单人',
      c1: '#0f9b8e',
      c2: '#34c759',
      ready: true
    },
    {
      id: '2048',
      name: '2048',
      emoji: '🔢',
      desc: '滑动合并相同数字 · 冲击 2048',
      href: '2048/',
      tag: '单人',
      c1: '#f0a91b',
      c2: '#f65e3b',
      ready: true
    },
    {
      id: 'jump',
      name: '跳一跳',
      emoji: '🐤',
      desc: '按住蓄力，松手起跳 · 可联机竞速',
      href: '跳一跳/',
      tag: '可联机',
      online: true,
      c1: '#38bdf8',
      c2: '#6366f1',
      ready: true
    },
    { id: 'soon1', name: '敬请期待', emoji: '🎲', desc: '下一款游戏正在筹备中', ready: false },
    { id: 'more', name: '更多游戏', emoji: '＋', desc: '往大厅里加新游戏很简单', ready: false }
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

  const presence = new Map();
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
      const t = audioCtx.currentTime;
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'invite' ? 0.45 : 0.16));
      osc.connect(gain).connect(audioCtx.destination);
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

  /* ---------------- 通用 ---------------- */

  function esc(str) {
    return String(str == null ? '' : str).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

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

  /* ---------------- 渲染 ---------------- */

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
          <div class="gc-cover"><span class="gc-emoji">${g.emoji}</span></div>
          <div class="gc-body">
            <h3>${esc(g.name)}</h3>
            <p>${esc(g.desc)}</p>
            <span class="gc-play">即将上线</span>
          </div>
        </div>`;
      }
      return `<a class="game-card" href="${g.href}" style="--c1:${g.c1};--c2:${g.c2}">
        <div class="gc-cover">
          <span class="gc-emoji">${g.emoji}</span>
          ${g.tag ? `<span class="gc-tag">${esc(g.tag)}</span>` : ''}
        </div>
        <div class="gc-body">
          <h3>${esc(g.name)}</h3>
          <p>${esc(g.desc)}</p>
          <span class="gc-play">开始游戏</span>
        </div>
      </a>`;
    }).join('');

    $('#gameCount').textContent = `${GAMES.filter((g) => g.ready).length} 款`;
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
    return f.nick || (presence.get(f.id) || {}).nick || `好友${f.id.slice(0, 2)}`;
  }

  /* 好友现在处于什么状态：离线 / 在线 / 正在玩某款游戏 */
  function stateOf(id) {
    const p = presence.get(id) || {};
    if (!p.online) return { text: '离线', cls: 'off', online: false, act: null };
    if (p.act && p.act.name) return { text: `在玩 ${p.act.name}`, cls: 'busy', online: true, act: p.act };
    return { text: '在线', cls: 'on', online: true, act: null };
  }

  function onlineFriends() {
    return friends
      .map((f) => ({ f, st: stateOf(f.id) }))
      .filter((x) => x.st.online)
      .sort((a, b) => Number(Boolean(a.st.act)) - Number(Boolean(b.st.act)));
  }

  /* 页面上的「在线好友」条：不进聊天也能看到状态、直接邀请 */
  function renderOnlineStrip() {
    const list = onlineFriends();
    const strip = $('#onlineStrip');
    $('#onlineFriendsCount').textContent = String(list.length);
    strip.classList.toggle('hidden', list.length === 0);
    $('#onlineFriends').innerHTML = list
      .map(({ f, st }) => `<div class="of-chip" data-id="${esc(f.id)}" role="button" tabindex="0">
        <span class="of-avatar">${esc(friendLabel(f).slice(0, 1))}<i class="${st.act ? 'busy' : 'on'}"></i></span>
        <span class="of-main">
          <b>${esc(friendLabel(f))}</b>
          <em class="${st.cls}">${esc(st.text)}</em>
        </span>
        <button class="of-invite" data-invite="${esc(f.id)}" title="邀请一起玩">＋</button>
      </div>`)
      .join('');
  }

  function sortedFriends() {
    return friends.slice().sort((a, b) => {
      const oa = (presence.get(a.id) || {}).online ? 1 : 0;
      const ob = (presence.get(b.id) || {}).online ? 1 : 0;
      if (oa !== ob) return ob - oa;
      const ta = (lastMessage(a.id) || {}).at || a.at || 0;
      const tb = (lastMessage(b.id) || {}).at || b.at || 0;
      return tb - ta;
    });
  }

  function totalUnread() {
    return friends.reduce((sum, f) => sum + (ls.get(UNREAD_PREFIX + f.id, 0) || 0), 0);
  }

  function renderFriends() {
    const list = sortedFriends();
    $('#friendCount').textContent = friends.length;
    $('#friendEmpty').classList.toggle('hidden', friends.length > 0);

    $('#friendList').innerHTML = list
      .map((f) => {
        const p = presence.get(f.id) || {};
        const st = stateOf(f.id);
        const last = lastMessage(f.id);
        const unread = ls.get(UNREAD_PREFIX + f.id, 0);
        const preview = last
          ? `${last.dir === 'me' ? '我：' : ''}${last.text}`
          : st.online
          ? '点这里发消息'
          : '离线 · 消息会暂存';
        return `<div class="friend" data-id="${esc(f.id)}">
          <div class="f-avatar">${esc(friendLabel(f).slice(0, 1))}<i class="${p.online ? (st.act ? 'busy' : 'on') : ''}"></i></div>
          <div class="f-main">
            <div class="f-top"><b>${esc(friendLabel(f))}</b><span class="f-state ${st.cls}">${esc(st.text)}</span></div>
            <div class="f-sub">${esc(preview)}</div>
          </div>
          ${unread ? `<span class="f-unread">${unread > 99 ? '99+' : unread}</span>` : ''}
        </div>`;
      })
      .join('');

    renderOnlineStrip();
    renderBadge();
  }

  function renderBadge() {
    const n = totalUnread();
    const badge = $('#friendBadge');
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.classList.toggle('hidden', n === 0);
    document.title = n ? `(${n}) 游戏大厅` : '游戏大厅';
  }

  function fmtClock(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /* 只由表情组成的消息，渲染成大表情 */
  const EMOJI_ONLY = /^(?:[\p{Extended_Pictographic}\u200d\ufe0f\u{1f3fb}-\u{1f3ff}\s]){1,10}$/u;

  function isBigEmoji(text) {
    const t = String(text || '').trim();
    if (!t || t.length > 12) return false;
    return EMOJI_ONLY.test(t) && /\p{Extended_Pictographic}/u.test(t);
  }

  function renderChat() {
    if (!activeId) return;
    const f = friends.find((x) => x.id === activeId);
    const p = presence.get(activeId) || {};
    const st = stateOf(activeId);
    $('#chatName').textContent = f ? friendLabel(f) : '好友';
    const stateEl = $('#chatState');
    if (p.typing) {
      stateEl.textContent = '正在输入…';
    } else if (st.act) {
      stateEl.textContent = `在玩 ${st.act.name}`;
    } else {
      stateEl.textContent = st.online ? '在线' : '离线';
    }
    stateEl.classList.toggle('on', Boolean(p.online) && !p.typing && !st.act);
    stateEl.classList.toggle('busy', Boolean(st.act));
    $('#btnInvite').disabled = !p.online;
    $('#btnInvite').textContent = p.online ? '一起玩' : '离线';

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
        const big = isBigEmoji(m.text);
        let state = '';
        if (m.dir === 'me') {
          if (m.read) state = `<span class="acked">已读</span>`;
          else if (m.ok) state = '已送达';
          else state = '待送达';
        }
        return `<div class="msg ${m.dir === 'me' ? 'mine' : 'them'}">
          <div class="bubble${big ? ' big' : ''}">${esc(m.text)}</div>
          <div class="meta">${fmtClock(m.at)}${state ? ' · ' + state : ''}</div>
        </div>`;
      })
      .join('');
    body.scrollTop = body.scrollHeight;
  }

  /* ---------------- 已读回执 ---------------- */

  /* 把「我读到的对方消息」回执发出去，每条只发一次 */
  function markConversationRead(id) {
    if (!id) return;
    const arr = ls.get(CHAT_PREFIX + id, []);
    const ids = [];
    arr.forEach((m) => {
      if (m.dir === 'them' && m.cid && !m.readSent) {
        m.readSent = true;
        ids.push(m.cid);
      }
    });
    if (!ids.length) return;
    ls.set(CHAT_PREFIX + id, arr);
    send({ t: 'read', to: id, ids });
  }

  /* 对方读了我的消息 */
  function applyReadReceipt(fromId, ids) {
    const set = new Set(ids || []);
    if (!set.size) return;
    const arr = ls.get(CHAT_PREFIX + fromId, []);
    let changed = false;
    arr.forEach((m) => {
      if (m.dir === 'me' && m.cid && set.has(m.cid) && !m.read) {
        m.read = true;
        changed = true;
      }
    });
    if (!changed) return;
    ls.set(CHAT_PREFIX + fromId, arr);
    if (activeId === fromId) renderChat();
  }

  /* ---------------- 表情 ---------------- */

  const EMOJIS = [
    '😀', '😄', '😁', '😆', '😂', '🤣', '😊', '😇',
    '🙂', '😉', '😍', '🥰', '😘', '😜', '🤪', '🤗',
    '🤔', '🤨', '😐', '😴', '😪', '😭', '😤', '😡',
    '🥳', '😎', '🤓', '🥺', '😱', '😳', '🤯', '😅',
    '😬', '🙃', '😋', '🤒', '👻', '💀', '🤖', '💩',
    '👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '✌️',
    '👌', '🤙', '👋', '🫡', '❤️', '💔', '💯', '🔥',
    '✨', '🎉', '🎊', '🎁', '🏆', '⚡', '💡', '⭐',
    '🌈', '☀️', '🌙', '🍉', '🍎', '🍕', '🍔', '🍰',
    '☕', '🍺', '🎮', '🎯', '🎲', '🧩', '🐤', '🐶',
    '🐱', '🦄', '🐼', '🚀', '😏', '🥱', '🤡', '🫠'
  ];

  function renderEmojiPanel() {
    $('#emojiPanel').innerHTML = EMOJIS.map(
      (e) => `<button type="button" class="emoji-cell" data-emoji="${e}">${e}</button>`
    ).join('');
  }

  function toggleEmoji(force) {
    const panel = $('#emojiPanel');
    const show = force == null ? !panel.classList.contains('show') : force;
    panel.classList.toggle('show', show);
    panel.setAttribute('aria-hidden', show ? 'false' : 'true');
    $('#btnEmoji').classList.toggle('is-on', show);
  }

  function insertEmoji(ch) {
    const input = $('#chatInput');
    const start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : input.value.length;
    input.value = input.value.slice(0, start) + ch + input.value.slice(end);
    const pos = start + ch.length;
    try {
      input.setSelectionRange(pos, pos);
    } catch {
      /* ignore */
    }
    input.focus();
  }

  /* ---------------- 好友面板 ---------------- */

  function setSheetMode(mode) {
    const sheet = $('#friendSheet');
    sheet.classList.toggle('mode-list', mode === 'list');
    sheet.classList.toggle('mode-chat', mode === 'chat');
  }

  function openFriends(mode) {
    const sheet = $('#friendSheet');
    setSheetMode(mode || 'list');
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sheet-open');
    renderFriends();
  }

  function closeFriends() {
    const sheet = $('#friendSheet');
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sheet-open');
    activeId = null;
    toggleEmoji(false);
    setSheetMode('list');
    renderFriends();
  }

  function openChat(id) {
    activeId = id;
    clearUnread(id);
    openFriends('chat');
    renderChat();
    markConversationRead(id);
    renderFriends();
    setTimeout(() => {
      if (window.matchMedia('(min-width: 641px)').matches) $('#chatInput').focus();
    }, 300);
  }

  function backToList() {
    activeId = null;
    toggleEmoji(false);
    setSheetMode('list');
    renderFriends();
  }

  function sendDm(text) {
    if (!activeId || !text) return;
    const cid = `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    pushMessage(activeId, { dir: 'me', text, at: Date.now(), ok: false, cid });
    renderChat();
    send({ t: 'dm', to: activeId, text, cid });
  }

  /* ---------------- 网络 ---------------- */

  let socket = null;
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
    if (socket && (socket.readyState === 0 || socket.readyState === 1)) return;
    let ws;
    try {
      ws = window.openSocket ? window.openSocket(wsEndpoint()) : new WebSocket(wsEndpoint());
    } catch {
      return;
    }
    socket = ws;

    ws.addEventListener('open', () => {
      retry = 0;
      if (ws.transport === 'sse' && !window.__hubCompatWarned) {
        window.__hubCompatWarned = true;
        toast('当前浏览器限制直连，已切换兼容连接');
      }
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
      socket = null;
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

  /* ---------------- 消息 ---------------- */

  function handle(msg) {
    switch (msg.t) {
      case 'hello-ok': {
        refreshStats();
        break;
      }
      case 'presence-list': {
        (msg.list || []).forEach((item) => {
          presence.set(item.id, {
            online: Boolean(item.online),
            nick: item.nick || '',
            act: item.online ? item.act || null : null
          });
          if (item.nick) upsertFriend(item.id, item.nick);
        });
        renderFriends();
        if (activeId) renderChat();
        break;
      }
      case 'presence': {
        const prev = presence.get(msg.id) || {};
        presence.set(msg.id, {
          online: Boolean(msg.online),
          nick: msg.nick || prev.nick || '',
          act: msg.online ? msg.act || null : null,
          typing: Boolean(msg.online) && prev.typing
        });
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
          at: msg.at || Date.now(),
          cid: msg.cid || ''
        });
        if (activeId === from.id) {
          renderChat();
          clearUnread(from.id);
          markConversationRead(from.id);
        } else {
          bumpUnread(from.id);
        }
        if (added) toast(`${from.nick || '好友'} 把你加为了好友`);
        beep('msg');
        renderFriends();
        break;
      }
      case 'read': {
        applyReadReceipt((msg.from || {}).id, msg.ids);
        break;
      }
      case 'dm-ack': {
        const cid = msg.cid;
        if (!cid) break;
        friends.forEach((f) => {
          const arr = ls.get(CHAT_PREFIX + f.id, []);
          const hit = arr.find((m) => m.cid === cid && m.dir === 'me');
          if (!hit) return;
          hit.ok = Boolean(msg.delivered);
          ls.set(CHAT_PREFIX + f.id, arr);
          if (activeId === f.id) renderChat();
        });
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
        const nick = (msg.from && msg.from.nick) || '好友';
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
    ls.set(UNREAD_PREFIX + id, (ls.get(UNREAD_PREFIX + id, 0) || 0) + 1);
    renderBadge();
  }

  function clearUnread(id) {
    ls.set(UNREAD_PREFIX + id, 0);
    renderBadge();
  }

  /* ---------------- 邀请 ---------------- */

  function showInvite(msg) {
    pendingInvite = msg;
    $('#ibFrom').textContent = (msg.from && msg.from.nick) || '好友';
    $('#ibAvatar').textContent = ((msg.from && msg.from.nick) || '友').slice(0, 1);
    $('#ibGame').textContent = msg.gameName || '猜数字';
    $('#ibCode').textContent = msg.code;
    $('#inviteBanner').classList.add('show');
    beep('invite');
    toast(`${(msg.from && msg.from.nick) || '好友'} 邀请你一起玩`);
  }

  function hideInvite() {
    $('#inviteBanner').classList.remove('show');
    pendingInvite = null;
  }

  let inviteFor = null;

  function gameUrlFor(g, params) {
    const url = new URL(g.href, location.href);
    const sc = new URLSearchParams(location.search).get('sharecode') || SHARE;
    if (sc) url.searchParams.set('sharecode', sc);
    Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    return url.toString();
  }

  /* 选游戏：可联机的游戏才会出现在这里，加新游戏只要在 GAMES 里补 online: true */
  function openGamePicker(id) {
    const f = friends.find((x) => x.id === id);
    if (!f) return;
    inviteFor = id;
    const st = stateOf(id);
    const who = friendLabel(f);
    $('#gpSub').innerHTML = st.online
      ? `<b>${esc(who)}</b> · ${st.act ? `正在玩「${esc(st.act.name)}」，可能没空` : '在线，马上能来'}`
      : `<b>${esc(who)}</b> · <span class="gp-off">离线，等 TA 上线再邀请</span>`;

    const list = GAMES.filter((g) => g.ready && g.online);
    $('#gpList').innerHTML = list.length
      ? list
          .map(
            (g) => `<button class="gp-item" data-game="${esc(g.id)}" style="--c1:${g.c1};--c2:${g.c2}"${
              st.online ? '' : ' disabled'
            }>
            <span class="gp-emoji">${g.emoji}</span>
            <span class="gp-body"><b>${esc(g.name)}</b><em>${esc(g.desc)}</em></span>
            <span class="gp-go">邀请 →</span>
          </button>`
          )
          .join('')
      : '<p class="gp-none">还没有支持联机的游戏</p>';

    $('#gamePicker').classList.add('show');
    $('#gamePicker').setAttribute('aria-hidden', 'false');
  }

  function closeGamePicker() {
    $('#gamePicker').classList.remove('show');
    $('#gamePicker').setAttribute('aria-hidden', 'true');
    inviteFor = null;
  }

  function inviteToGame(gameId) {
    const g = GAMES.find((x) => x.id === gameId);
    if (!g || !inviteFor) return;
    const id = inviteFor;
    const st = stateOf(id);
    if (!st.online) {
      toast('对方不在线，等 TA 上线再邀请吧', 'error');
      return;
    }
    closeGamePicker();
    location.href = gameUrlFor(g, { invite: id });
  }

  /* ---------------- 加好友 ---------------- */

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

  /* ---------------- 事件 ---------------- */

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

    $('#btnFriends').addEventListener('click', () => openFriends('list'));
    $('#btnCloseFriends').addEventListener('click', closeFriends);
    $('#sheetBackdrop').addEventListener('click', closeFriends);
    $('#btnChatBack').addEventListener('click', backToList);

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

    /* 在线好友条：点头像进聊天，点「＋」直接邀请 */
    $('#onlineFriends').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-invite]');
      if (btn) {
        e.stopPropagation();
        openGamePicker(btn.dataset.invite);
        return;
      }
      const chip = e.target.closest('.of-chip');
      if (chip) openChat(chip.dataset.id);
    });

    $('#btnInvite').addEventListener('click', () => {
      if (activeId) openGamePicker(activeId);
    });

    $('#gamePicker').addEventListener('click', (e) => {
      if (e.target.closest('[data-gpclose]')) {
        closeGamePicker();
        return;
      }
      const item = e.target.closest('.gp-item');
      if (item && !item.disabled) inviteToGame(item.dataset.game);
    });

    $('#btnEmoji').addEventListener('click', () => toggleEmoji());
    $('#emojiPanel').addEventListener('click', (e) => {
      const cell = e.target.closest('[data-emoji]');
      if (cell) insertEmoji(cell.dataset.emoji);
    });

    $('#chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#chatInput');
      const text = input.value.trim();
      if (!text) return;
      sendDm(text);
      input.value = '';
      toggleEmoji(false);
    });

    $('#chatInput').addEventListener('input', () => {
      if (!activeId) return;
      send({ t: 'typing', to: activeId });
    });

    $('#ibAccept').addEventListener('click', () => {
      if (!pendingInvite) return;
      const invite = pendingInvite;
      const from = invite.from && invite.from.id;
      if (from) send({ t: 'invite-reply', to: from, accept: true, code: invite.code });
      hideInvite();
      const g = GAMES.find((x) => x.id === invite.game) || GAMES.find((x) => x.id === 'guess');
      location.href = gameUrlFor(g, { room: invite.code });
    });
    $('#ibIgnore').addEventListener('click', () => {
      const from = pendingInvite && pendingInvite.from && pendingInvite.from.id;
      if (from) {
        send({ t: 'invite-reply', to: from, accept: false, code: pendingInvite.code });
      }
      hideInvite();
    });

    $('#btnSound').addEventListener('click', () => {
      soundOn = !soundOn;
      ls.set(SOUND_KEY, soundOn);
      syncSoundBtn();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if ($('#gamePicker').classList.contains('show')) {
        closeGamePicker();
        return;
      }
      if ($('#emojiPanel').classList.contains('show')) {
        toggleEmoji(false);
        return;
      }
      const sheet = $('#friendSheet');
      if (!sheet.classList.contains('open')) return;
      if (sheet.classList.contains('mode-chat')) backToList();
      else closeFriends();
    });
  }

  function init() {
    renderMe();
    renderGames();
    renderLinks();
    renderEmojiPanel();
    renderFriends();
    syncSoundBtn();
    setSheetMode('list');
    bindEvents();
    connect();
    refreshStats();
    setInterval(refreshStats, 20000);
  }

  init();
})();
