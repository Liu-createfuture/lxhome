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
      desc: '4 位 1A2B，单人练手，也可和好友同时抢答',
      href: '猜数字/',
      tag: '可联机',
      online: true,
      ready: true
    },
    {
      id: 'link',
      name: '连连看',
      desc: '两张相同图案连线消除，最多拐两个弯',
      href: '连连看/',
      tag: '单人',
      ready: true
    },
    {
      id: '2048',
      name: '2048',
      desc: '滑动合并相同的数字，一路推到 2048',
      href: '2048/',
      tag: '单人',
      ready: true
    },
    {
      id: 'jump',
      name: '跳一跳',
      desc: '按住蓄力松手起跳，可与好友比一比分数',
      href: '跳一跳/',
      tag: '可联机',
      online: true,
      ready: true
    },
    {
      id: 'sokoban',
      name: '推箱子',
      desc: '把所有箱子推到标记点上，共十关',
      href: '推箱子/',
      tag: '单人',
      ready: true
    },
    {
      id: 'adventure',
      name: '冒险岛',
      desc: '横版跳跃，踩扁怪物、收齐金币走到终点',
      href: '冒险岛/',
      tag: '单人',
      ready: true
    },
    { id: 'soon1', name: '下一款', desc: '正在筹备，先把上面几款玩一遍', tag: '筹备中', ready: false }
  ];

  const SITE_LINKS = [
    { name: '医院导航', href: '医院导航/' },
    { name: '宝可梦', href: '宝可梦/' },
    { name: '输入', href: '输入/' },
    { name: 'Qwen VL', href: 'qwen-vl/' }
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
    $('#btnSound').textContent = soundOn ? '音效 开' : '音效 关';
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
    $('#selfId').textContent = me.id;
    $('#meAvatar').textContent = (me.nick || '玩').slice(0, 1);
  }

  function renderGames() {
    $('#gameGrid').innerHTML = GAMES.map((g) => {
      const tag = g.tag ? `<span class="g-tag${g.online ? ' live' : ''}">${esc(g.tag)}</span>` : '';
      if (!g.ready) {
        return `<div class="g-row is-soon">
          <span class="g-name">${esc(g.name)}</span>
          <span class="g-desc">${esc(g.desc)}</span>
          ${tag}
          <span class="g-go">待定</span>
        </div>`;
      }
      return `<a class="g-row" href="${g.href}">
        <span class="g-name">${esc(g.name)}</span>
        <span class="g-desc">${esc(g.desc)}</span>
        ${tag}
        <span class="g-go">开始 →</span>
      </a>`;
    }).join('');

    $('#gameCount').textContent = `${GAMES.filter((g) => g.ready).length} 款`;
  }

  function renderLinks() {
    $('#miniLinks').innerHTML = SITE_LINKS.map(
      (l) => `<a class="mini-link" href="${l.href}">${esc(l.name)}</a>`
    ).join('');
  }

  function lastMessage(id) {
    const arr = ls.get(CHAT_PREFIX + id, []);
    return arr.length ? arr[arr.length - 1] : null;
  }

  function friendLabel(f) {
    if (f && f.remark) return f.remark;
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

  let searchText = '';

  function fmtRowTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return fmtClock(ts);
    const y = new Date(now.getTime() - 86400000);
    if (d.toDateString() === y.toDateString()) return '昨天';
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function friendRow(f) {
    const st = stateOf(f.id);
    const last = lastMessage(f.id);
    const unread = ls.get(UNREAD_PREFIX + f.id, 0) || 0;
    const preview = last
      ? `${last.dir === 'me' ? '我：' : ''}${last.text}`
      : st.text;
    const dot = st.online ? (st.act ? 'busy' : 'on') : '';
    return `<div class="friend" data-id="${esc(f.id)}">
      <span class="f-avatar">${esc(friendLabel(f).slice(0, 1))}<i class="${dot}"></i></span>
      <div class="f-main">
        <b class="f-name">${esc(friendLabel(f))}</b>
        <span class="f-sub${st.act ? ' busy' : ''}">${esc(preview)}</span>
      </div>
      <div class="f-meta">
        <span class="f-time">${fmtRowTime((last && last.at) || f.at)}</span>
        ${unread ? `<span class="f-unread">${unread > 99 ? '99+' : unread}</span>` : ''}
      </div>
      <button class="f-more" type="button" data-more="${esc(f.id)}" aria-label="好友资料">⋯</button>
    </div>`;
  }

  function renderFriends() {
    $('#friendCount').textContent = friends.length;
    $('#selfId').textContent = me.id;
    $('#searchRow').classList.toggle('hidden', friends.length < 5);
    $('#friendEmpty').classList.toggle('hidden', friends.length > 0);

    const q = searchText.trim().toLowerCase();
    const hit = (f) => !q || friendLabel(f).toLowerCase().includes(q) || f.id.toLowerCase().includes(q);
    const list = sortedFriends().filter(hit);
    const online = list.filter((f) => stateOf(f.id).online);
    const offline = list.filter((f) => !stateOf(f.id).online);

    let html = '';
    if (online.length) {
      html += `<div class="f-group">在线 ${online.length}</div>` + online.map(friendRow).join('');
    }
    if (offline.length) {
      html += `<div class="f-group">离线 ${offline.length}</div>` + offline.map(friendRow).join('');
    }
    if (!html && friends.length) html = '<p class="friend-none">没有匹配的好友</p>';
    $('#friendList').innerHTML = html;

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

  /* 只更新聊天头部状态（在线 / 正在输入 / 在玩什么）
     输入、在线状态变化时用它，避免整段消息重新渲染造成闪烁 */
  function renderChatHead() {
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
    $('#btnInvite').textContent = '一起玩';
  }

  /* 上一次渲染到的位置：只有新增的消息才播放入场动画 */
  const rendered = { id: null, count: 0 };

  /* 条数没变时只更新气泡下方的时间/已读文案，不动 DOM 结构 */
  function refreshMeta(msgs) {
    const nodes = $('#chatBody').querySelectorAll('.msg');
    msgs.forEach((m, i) => {
      if (m.dir === 'sys') return;
      const node = nodes[i];
      if (!node) return;
      const meta = node.querySelector('.meta');
      if (!meta) return;
      let state = '';
      if (m.dir === 'me') {
        state = m.read ? '<span class="acked">已读</span>' : m.ok ? '已送达' : '待送达';
      }
      const html = `${fmtClock(m.at)}${state ? ' · ' + state : ''}`;
      if (meta.innerHTML !== html) meta.innerHTML = html;
    });
  }

  function chatNameOf() {
    const f = friends.find((x) => x.id === activeId);
    return f ? friendLabel(f) : '好友';
  }

  function dayLabel(ts) {
    const d = new Date(ts);
    const now = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const gap = Math.round((day(now) - day(d)) / 86400000);
    if (gap <= 0) return '今天';
    if (gap === 1) return '昨天';
    if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
    return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  }

  function updateToBottom() {
    const body = $('#chatBody');
    const far = body.scrollHeight - body.scrollTop - body.clientHeight > 120;
    $('#btnToBottom').classList.toggle('hidden', !far);
  }

  function renderChat(force) {
    if (!activeId) return;
    renderChatHead();

    const msgs = ls.get(CHAT_PREFIX + activeId, []);
    const body = $('#chatBody');
    if (!msgs.length) {
      body.innerHTML = `<div class="chat-empty">
        <p>和 ${esc(chatNameOf())} 还没说过话</p>
        <div class="quick">
          <button type="button" data-quick="在吗？">在吗？</button>
          <button type="button" data-quick="来一局？">来一局？</button>
          <button type="button" data-quick="等我一下">等我一下</button>
        </div>
      </div>`;
      rendered.id = activeId;
      rendered.count = 0;
      $('#btnToBottom').classList.add('hidden');
      return;
    }

    /* 同一个会话、消息条数没变：只刷新状态文字，避免整段重绘 */
    if (!force && rendered.id === activeId && msgs.length === rendered.count) {
      refreshMeta(msgs);
      return;
    }

    const start = rendered.id === activeId ? rendered.count : msgs.length;
    const added = msgs.length > start;
    const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 90;

    let html = '';
    let lastDay = '';
    msgs.forEach((m, i) => {
      const fresh = i >= start ? ' is-new' : '';
      const day = dayLabel(m.at);
      if (day !== lastDay) {
        html += `<div class="chat-day">${day}</div>`;
        lastDay = day;
      }
      if (m.dir === 'sys') {
        html += `<div class="msg sys${fresh}"><div class="bubble">${esc(m.text)}</div></div>`;
        return;
      }
      const next = msgs[i + 1];
      const endOfRun = !next || next.dir !== m.dir || next.at - m.at > 5 * 60 * 1000;
      let state = '';
      if (m.dir === 'me' && endOfRun) {
        state = m.read ? '<span class="acked">已读</span>' : m.ok ? '已送达' : '待送达';
      }
      const big = isBigEmoji(m.text);
      html += `<div class="msg ${m.dir === 'me' ? 'mine' : 'them'}${fresh}">
        <div class="bubble${big ? ' big' : ''}">${esc(m.text)}</div>
        ${endOfRun ? `<div class="meta">${fmtClock(m.at)}${state ? ' · ' + state : ''}</div>` : ''}
      </div>`;
    });

    body.innerHTML = html;
    rendered.id = activeId;
    rendered.count = msgs.length;
    if (nearBottom || added) body.scrollTop = body.scrollHeight;
    updateToBottom();
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

  let infoId = null;
  let armed = null;
  let armTimer = null;

  function setSheetMode(mode) {
    const sheet = $('#friendSheet');
    sheet.classList.toggle('mode-list', mode === 'list');
    sheet.classList.toggle('mode-chat', mode === 'chat');
    sheet.classList.toggle('mode-info', mode === 'info');
  }

  function toggleChatMenu(force) {
    const menu = $('#chatMenu');
    const show = force == null ? menu.hidden : Boolean(force);
    menu.hidden = !show;
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
    infoId = null;
    searchText = '';
    $('#friendSearch').value = '';
    toggleEmoji(false);
    toggleChatMenu(false);
    setSheetMode('list');
    renderFriends();
  }

  function openChat(id) {
    activeId = id;
    infoId = null;
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
    infoId = null;
    toggleEmoji(false);
    toggleChatMenu(false);
    setSheetMode('list');
    renderFriends();
  }

  /* 好友资料：备注、邀请、清空、删除 */
  function openInfo(id) {
    infoId = id || activeId;
    if (!infoId) return;
    toggleEmoji(false);
    toggleChatMenu(false);
    renderInfo();
    setSheetMode('info');
  }

  function renderInfo() {
    const f = friends.find((x) => x.id === infoId);
    if (!f) {
      backToList();
      return;
    }
    armed = null;
    const st = stateOf(f.id);
    $('#infoBody').innerHTML = `<div class="info-card">
        <span class="info-avatar">${esc(friendLabel(f).slice(0, 1))}</span>
        <div>
          <b>${esc(friendLabel(f))}</b>
          <em class="${st.act ? 'busy' : ''}">${esc(st.text)}</em>
        </div>
      </div>
      <label class="info-field">
        <span>备注</span>
        <input id="infoRemark" maxlength="12" value="${esc(f.remark || '')}" placeholder="只在本机显示" autocomplete="off" />
      </label>
      <p class="info-meta">号码 ${esc(f.id)}</p>
      <div class="info-actions">
        <button class="btn primary" type="button" data-act="invite"${st.online ? '' : ' disabled'}>邀请一起玩</button>
        <button class="btn" type="button" data-act="clear">清空聊天</button>
        <button class="btn danger" type="button" data-act="remove">删除好友</button>
      </div>
      <p class="info-note">聊天记录只保存在这台设备上，删掉好友会一并清掉你们之间的记录。</p>`;
  }

  function removeFriend(id) {
    const idx = friends.findIndex((x) => x.id === id);
    if (idx < 0) return;
    friends.splice(idx, 1);
    saveFriends();
    ls.set(CHAT_PREFIX + id, []);
    ls.set(UNREAD_PREFIX + id, 0);
    syncWatch();
    activeId = null;
    infoId = null;
    setSheetMode('list');
    renderFriends();
    toast('已删除好友');
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
        if (activeId) renderChatHead();
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
        if (activeId === msg.id) renderChatHead();
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
        if (activeId === from.id) renderChatHead();
        setTimeout(() => {
          const cur = presence.get(from.id) || {};
          presence.set(from.id, { ...cur, typing: false });
          if (activeId === from.id) renderChatHead();
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
            (g) => `<button class="gp-item" data-game="${esc(g.id)}" ${
              st.online ? '' : ' disabled'
            }>
            <span class="gp-body"><b>${esc(g.name)}</b><em>${esc(g.desc)}</em></span>
            <span class="gp-go">邀请 →</span>
          </button>`
          )
          .join('')
      : '<p class="gp-none">还没有支持联机的游戏</p>';

    $('#gamePicker').classList.add('show');
    $('#gamePicker').setAttribute('aria-hidden', 'false');
    document.body.classList.add('picking');
  }

  function closeGamePicker() {
    $('#gamePicker').classList.remove('show');
    $('#gamePicker').setAttribute('aria-hidden', 'true');
    document.body.classList.remove('picking');
    inviteFor = null;
  }

  function inviteToGame(gameId) {
    const g = GAMES.find((x) => x.id === gameId);
    if (!g || !inviteFor) {
      closeGamePicker();
      return;
    }
    const id = inviteFor;
    const st = stateOf(id);
    if (!st.online) {
      toast('对方不在线，等 TA 上线再邀请吧', 'error');
      closeGamePicker();
      return;
    }
    closeGamePicker();
    location.href = gameUrlFor(g, { invite: id });
  }

  /* ---------------- 加好友 ---------------- */

  function addNote(text, isError) {
    const el = $('#addNote');
    el.textContent = text;
    el.classList.toggle('is-error', Boolean(isError));
  }

  function addFriend() {
    const input = $('#friendCode');
    const id = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z0-9]{4,16}$/.test(id)) {
      addNote('号码是 4-16 位的字母或数字', true);
      input.focus();
      return;
    }
    if (id === me.id) {
      addNote('这是你自己的号码', true);
      return;
    }
    if (friends.some((f) => f.id === id)) {
      addNote('已经在好友列表里了', true);
      return;
    }
    upsertFriend(id, '');
    syncWatch();
    renderFriends();
    input.value = '';
    addNote('已添加。等对方也加你，就能互相说话了', false);
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

    $('#selfCopy').addEventListener('click', () => copyText(me.id));

    $('#friendList').addEventListener('click', (e) => {
      const more = e.target.closest('[data-more]');
      if (more) {
        e.stopPropagation();
        openInfo(more.dataset.more);
        return;
      }
      const row = e.target.closest('.friend');
      if (row) openChat(row.dataset.id);
    });

    $('#friendSearch').addEventListener('input', () => {
      searchText = $('#friendSearch').value;
      renderFriends();
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

    $('#btnChatMore').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleChatMenu();
    });

    $('#chatMenu').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cmd]');
      if (!btn) return;
      toggleChatMenu(false);
      if (btn.dataset.cmd === 'info') openInfo(activeId);
      else if (btn.dataset.cmd === 'clear') {
        if (!activeId) return;
        ls.set(CHAT_PREFIX + activeId, []);
        rendered.id = null;
        renderChat(true);
        renderFriends();
        toast('聊天记录已清空');
      }
    });

    $('#chatBody').addEventListener('click', (e) => {
      const q = e.target.closest('[data-quick]');
      if (!q) return;
      sendDm(q.dataset.quick);
      $('#chatInput').value = '';
    });

    $('#chatBody').addEventListener('scroll', updateToBottom, { passive: true });

    $('#btnToBottom').addEventListener('click', () => {
      const body = $('#chatBody');
      body.scrollTop = body.scrollHeight;
      updateToBottom();
    });

    $('#btnInfoBack').addEventListener('click', () => {
      if (activeId) {
        setSheetMode('chat');
        renderChat();
      } else {
        backToList();
      }
    });
    $('#btnInfoClose').addEventListener('click', closeFriends);

    $('#infoBody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn || btn.disabled || !infoId) return;
      const act = btn.dataset.act;
      if (act === 'invite') {
        openGamePicker(infoId);
        return;
      }
      if (armed !== act) {
        armed = act;
        btn.classList.add('is-armed');
        btn.textContent = act === 'clear' ? '再点一次清空' : '再点一次删除';
        clearTimeout(armTimer);
        armTimer = setTimeout(() => {
          if (infoId) renderInfo();
        }, 4000);
        return;
      }
      clearTimeout(armTimer);
      if (act === 'clear') {
        ls.set(CHAT_PREFIX + infoId, []);
        rendered.id = null;
        toast('聊天记录已清空');
        renderInfo();
        renderFriends();
      } else {
        removeFriend(infoId);
      }
    });

    $('#infoBody').addEventListener('change', (e) => {
      if (!e.target.id || e.target.id !== 'infoRemark' || !infoId) return;
      const f = friends.find((x) => x.id === infoId);
      if (!f) return;
      const val = e.target.value.trim().slice(0, 12);
      if (val === (f.remark || '')) return;
      if (val) f.remark = val;
      else delete f.remark;
      saveFriends();
      renderFriends();
      if (activeId === f.id) renderChatHead();
      toast('备注已保存');
    });

    /* 点别处收起聊天菜单 */
    document.addEventListener(
      'click',
      (e) => {
        if ($('#chatMenu').hidden) return;
        if (e.target.closest('#chatMenu') || e.target.closest('#btnChatMore')) return;
        toggleChatMenu(false);
      },
      true
    );

    $('#gamePicker').addEventListener('click', (e) => {
      if (e.target.closest('[data-gpclose]')) {
        closeGamePicker();
        return;
      }
      const item = e.target.closest('.gp-item');
      if (item && !item.disabled) {
        inviteToGame(item.dataset.game);
        return;
      }
      if (!e.target.closest('.gp-card')) closeGamePicker();
    });

    /* 兜底：弹层打开时，在卡片外按下任何地方都直接关掉，避免卡住关不掉 */
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!$('#gamePicker').classList.contains('show')) return;
        if (!e.target.closest('.gp-card')) closeGamePicker();
      },
      true
    );

    /* 从其它页面后退回来时（bfcache）清掉可能残留的浮层 */
    window.addEventListener('pageshow', () => {
      closeGamePicker();
      toggleEmoji(false);
    });
    window.addEventListener('pagehide', () => {
      $('#gamePicker').classList.remove('show');
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
      if (!$('#chatMenu').hidden) {
        toggleChatMenu(false);
        return;
      }
      if ($('#emojiPanel').classList.contains('show')) {
        toggleEmoji(false);
        return;
      }
      const sheet = $('#friendSheet');
      if (!sheet.classList.contains('open')) return;
      if (sheet.classList.contains('mode-chat') || sheet.classList.contains('mode-info')) backToList();
      else closeFriends();
    });
  }

  /* 用 file:// 直接打开时，浏览器不会把「猜数字/」解析成页面，只会列目录。
     这里明确告诉人怎么启动，并且不让点进列表页。 */
  function guardFileProtocol() {
    if (location.protocol !== 'file:') return;
    $('#fileWarn').classList.remove('hidden');
    document.addEventListener(
      'click',
      (e) => {
        const row = e.target.closest('.g-row');
        if (!row || row.classList.contains('is-soon')) return;
        e.preventDefault();
        toast('请先双击「启动游戏厅.bat」，再从 127.0.0.1:8787 打开', 'error');
        $('#fileWarn').scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
      true
    );
  }

  function init() {
    guardFileProtocol();
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
