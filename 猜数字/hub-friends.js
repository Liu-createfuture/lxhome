/* =========================================================
   游戏页共用：好友面板 + 在线状态 + 邀请（不依赖大厅页面）
   - 身份与好友列表与大厅共用 localStorage
   - 服务端负责在线状态 / 正在玩什么 / 邀请路由
   用法：
     HubFriends.mount({ send, room, createRoom, joinRoom, game: { id, name } });
     HubFriends.onConnect();            // socket open 后调用（内部会发 hello / watch）
     HubFriends.handle(msg);            // 返回 true 表示这条消息已被处理
   ========================================================= */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const ID_RE = /^[A-Z0-9]{4,16}$/;
  const GAME_DIRS = { guess: '猜数字', jump: '跳一跳' };

  const esc = (str) =>
    String(str == null ? '' : str).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );

  let cfg = {
    send: null,
    room: () => null,
    createRoom: () => {},
    joinRoom: () => {},
    game: { id: 'guess', name: '猜数字' }
  };

  let me = null;
  let friends = [];
  const presence = new Map();
  let open = false;
  let synced = false;
  let pendingInvite = null;
  let mounted = false;

  /* ---------------- 数据 ---------------- */

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function load() {
    const m = read('hub.me.v1', null);
    if (m && ID_RE.test(String(m.id || ''))) me = { id: String(m.id), nick: String(m.nick || '玩家') };
    const list = read('hub.friends.v1', []);
    if (Array.isArray(list)) {
      friends = list.filter((f) => f && ID_RE.test(String(f.id || '')));
    }
  }

  function label(f) {
    return f.nick || (presence.get(f.id) || {}).nick || `好友${f.id.slice(0, 2)}`;
  }

  function stateOf(id) {
    const p = presence.get(id) || {};
    if (!synced && !presence.has(id)) return { text: '同步中…', cls: 'off', online: false, act: null };
    if (!p.online) return { text: '离线', cls: 'off', online: false, act: null };
    if (p.act && p.act.name) return { text: `在玩 ${p.act.name}`, cls: 'busy', online: true, act: p.act };
    return { text: '在线', cls: 'on', online: true, act: null };
  }

  /* ---------------- 样式与 DOM ---------------- */

  const CSS = `
.hf-btn{position:fixed;right:14px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:60;display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(20,22,31,.1);background:rgba(255,255,255,.92);backdrop-filter:blur(10px);box-shadow:0 14px 30px -18px rgba(20,22,31,.9);font:600 12.5px/1 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#333;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}
.hf-btn:hover{transform:translateY(-1px);box-shadow:0 18px 32px -18px rgba(20,22,31,.9)}
.hf-btn b{position:absolute;top:-4px;right:-4px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:#e0483c;color:#fff;font:700 10px/17px ui-monospace,monospace;text-align:center}
.hf-btn b.hidden{display:none}
.hf-btn.is-inline{position:relative;right:auto;bottom:auto;height:32px;padding:0 10px;gap:5px;border-radius:9px;background:#fff;box-shadow:none;font-size:12px;backdrop-filter:none}
.hf-btn.is-inline:hover{transform:none;box-shadow:0 6px 14px -10px rgba(20,22,31,.9)}
.hf-btn.is-inline b{position:static;min-width:15px;height:15px;padding:0 4px;font-size:9px;line-height:15px;transform:none}
@media (max-width:640px){.hf-btn.is-inline{padding:0 8px;font-size:11.5px}.hf-btn.is-inline span:first-child{display:none}}
.hf-sheet{position:fixed;inset:0;z-index:80;display:none}
.hf-sheet.open{display:block}
.hf-backdrop{position:absolute;inset:0;background:rgba(16,18,28,.36);backdrop-filter:blur(3px);animation:hfFade .18s ease}
@keyframes hfFade{from{opacity:0}}
.hf-panel{position:absolute;top:0;right:0;bottom:0;width:344px;max-width:92vw;background:#fff;display:flex;flex-direction:column;box-shadow:-30px 0 60px -40px rgba(16,18,28,.7);animation:hfSlide .26s cubic-bezier(.22,1,.36,1)}
@keyframes hfSlide{from{transform:translateX(100%)}}
.hf-head{display:flex;align-items:center;gap:8px;padding:16px 16px 10px}
.hf-head b{font:700 16px/1 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#14161f}
.hf-head span{font:600 11px/18px ui-monospace,monospace;padding:0 7px;border-radius:9px;background:#eef1f8;color:#4a5064}
.hf-head button{margin-left:auto;width:30px;height:30px;border:0;border-radius:9px;background:#f6f7fb;color:#4a5064;font-size:14px;cursor:pointer}
.hf-note{padding:0 16px 10px;font-size:11px;color:#8b91a5}
.hf-list{flex:1;overflow-y:auto;padding:0 10px 16px}
.hf-row{display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:13px}
.hf-row:hover{background:#f6f7fb}
.hf-a{position:relative;width:36px;height:36px;flex:0 0 36px;border-radius:12px;display:grid;place-items:center;color:#fff;font:700 14px/1 -apple-system,sans-serif;background:linear-gradient(135deg,#6366f1,#a855f7)}
.hf-a i{position:absolute;right:-2px;bottom:-2px;width:10px;height:10px;border-radius:50%;background:#c7ccda;border:2px solid #fff}
.hf-a i.on{background:#0ea472}
.hf-a i.busy{background:#f0a91b}
.hf-m{min-width:0;flex:1}
.hf-m b{display:block;font:600 13px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#14161f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hf-m em{font-style:normal;font-size:10.5px;color:#8b91a5}
.hf-m em.on{color:#0b7a55}
.hf-m em.busy{color:#b06f00}
.hf-inv{flex:0 0 auto;height:28px;padding:0 11px;border-radius:9px;border:1px solid rgba(79,70,229,.25);background:rgba(79,70,229,.08);color:#4f46e5;font:600 11.5px/1 -apple-system,sans-serif;cursor:pointer}
.hf-inv:disabled{opacity:.42;cursor:not-allowed}
.hf-inv:not(:disabled):hover{background:#4f46e5;color:#fff}
.hf-empty{padding:24px 18px;text-align:center;font-size:12px;color:#8b91a5;line-height:1.8}
.hf-empty.hidden{display:none}
.hf-foot{padding:10px 16px calc(14px + env(safe-area-inset-bottom,0px));border-top:1px solid rgba(20,22,31,.08)}
.hf-foot a{display:block;text-align:center;font:600 12px/1 -apple-system,sans-serif;color:#4f46e5;text-decoration:none;padding:10px;border-radius:10px;background:rgba(79,70,229,.07)}
.hf-banner{position:fixed;top:12px;left:50%;transform:translate(-50%,-140%);z-index:85;display:flex;align-items:center;gap:10px;width:min(440px,calc(100vw - 24px));padding:10px 12px;border-radius:16px;background:#fff;border:1px solid rgba(20,22,31,.08);box-shadow:0 24px 48px -26px rgba(20,22,31,.85);transition:transform .28s cubic-bezier(.22,1,.36,1)}
.hf-banner.show{transform:translate(-50%,0)}
.hf-avatar{width:34px;height:34px;flex:0 0 34px;border-radius:11px;display:grid;place-items:center;color:#fff;font:700 14px/1 sans-serif;background:linear-gradient(135deg,#6366f1,#a855f7)}
.hf-text{flex:1;min-width:0;font:400 12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#4a5064}
.hf-text b{color:#14161f}
.hf-text small{display:block;font-size:10.5px;color:#8b91a5}
.hf-actions{display:flex;gap:6px;flex:0 0 auto}
.hf-actions button{height:30px;padding:0 11px;border-radius:9px;border:0;font:600 11.5px/1 -apple-system,sans-serif;cursor:pointer}
.hf-actions [data-hfaccept]{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff}
.hf-actions [data-hfignore]{background:#f6f7fb;color:#4a5064}
.hf-toasts{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:95;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none}
.hf-toast{padding:8px 14px;border-radius:11px;background:rgba(20,22,31,.9);color:#fff;font:500 12px/1.4 -apple-system,sans-serif;animation:hfToast .2s ease}
@keyframes hfToast{from{opacity:0;transform:translateY(-6px)}}
@media (max-width:640px){
  .hf-panel{width:100%;max-width:none}
  .hf-banner{flex-wrap:wrap}
  .hf-actions{width:100%}
  .hf-actions button{flex:1;height:34px}
}
`;

  function inject() {
    if ($('#hfBtn')) return;
    const style = document.createElement('style');
    style.id = 'hfStyle';
    style.textContent = CSS;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button class="hf-btn" id="hfBtn" type="button"><span>👥</span><span>好友</span><b class="hidden" id="hfBadge">0</b></button>
      <div class="hf-sheet" id="hfSheet" aria-hidden="true">
        <div class="hf-backdrop" data-hfclose></div>
        <aside class="hf-panel" role="dialog" aria-label="好友">
          <div class="hf-head"><b>好友</b><span id="hfCount">0</span><button type="button" data-hfclose aria-label="关闭">✕</button></div>
          <div class="hf-note">在线状态实时同步 · 点「邀请」直接开房</div>
          <div class="hf-list" id="hfList"></div>
          <div class="hf-empty" id="hfEmpty">还没有好友<br />去大厅加一个，就能邀请一起玩</div>
          <div class="hf-foot"><a href="../">← 回大厅加好友</a></div>
        </aside>
      </div>
      <div class="hf-banner" id="hfBanner">
        <div class="hf-avatar" id="hfFromAvatar">友</div>
        <div class="hf-text"><b id="hfFrom">好友</b> 邀请你一起玩「<span id="hfGame">猜数字</span>」<small>房间号 <span id="hfCode">----</span></small></div>
        <div class="hf-actions"><button type="button" data-hfaccept>进入房间</button><button type="button" data-hfignore>忽略</button></div>
      </div>
      <div class="hf-toasts" id="hfToasts"></div>
    `;
    const anchor = cfg.anchor ? document.querySelector(cfg.anchor) : null;
    const btn = wrap.querySelector('#hfBtn');
    if (btn && anchor) {
      btn.classList.add('is-inline');
      anchor.insertBefore(btn, anchor.firstChild);
    }
    while (wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
  }

  function toast(msg) {
    const stack = $('#hfToasts');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'hf-toast';
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 2400);
    while (stack.children.length > 3) stack.firstChild.remove();
  }

  /* ---------------- 渲染 ---------------- */

  function sorted() {
    return friends
      .slice()
      .sort((a, b) => {
        const oa = stateOf(a.id).online ? 1 : 0;
        const ob = stateOf(b.id).online ? 1 : 0;
        if (oa !== ob) return ob - oa;
        return String(label(a)).localeCompare(String(label(b)));
      });
  }

  function render() {
    if (!mounted) return;
    const list = sorted();
    $('#hfCount').textContent = String(friends.length);
    $('#hfEmpty').classList.toggle('hidden', friends.length > 0);
    $('#hfList').innerHTML = list
      .map((f) => {
        const st = stateOf(f.id);
        return `<div class="hf-row">
          <div class="hf-a">${esc(label(f).slice(0, 1))}<i class="${st.online ? (st.act ? 'busy' : 'on') : ''}"></i></div>
          <div class="hf-m"><b>${esc(label(f))}</b><em class="${st.cls}">${esc(st.text)}</em></div>
          <button class="hf-inv" type="button" data-inv="${esc(f.id)}"${st.online ? '' : ' disabled'}>${
          st.online ? '邀请' : '离线'
        }</button>
        </div>`;
      })
      .join('');
    const badge = $('#hfBadge');
    const onlineN = friends.filter((f) => stateOf(f.id).online).length;
    badge.textContent = String(onlineN);
    badge.classList.toggle('hidden', onlineN === 0);
  }

  /* ---------------- 事件 ---------------- */

  function bind() {
    $('#hfBtn').addEventListener('click', () => toggle(true));
    $('#hfSheet').addEventListener('click', (e) => {
      if (e.target.closest('[data-hfclose]')) {
        toggle(false);
        return;
      }
      const inv = e.target.closest('[data-inv]');
      if (inv && !inv.disabled) invite(inv.dataset.inv);
    });
    window.addEventListener('resize', placeBanner, { passive: true });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) toggle(false);
    });
    $('#hfBanner').addEventListener('click', (e) => {
      if (e.target.closest('[data-hfignore]')) {
        replyInvite(false);
        return;
      }
      if (e.target.closest('[data-hfaccept]')) replyInvite(true);
    });
  }

  function toggle(next) {
    open = next;
    $('#hfSheet').classList.toggle('open', next);
    $('#hfSheet').setAttribute('aria-hidden', next ? 'false' : 'true');
    if (next) render();
  }

  /* ---------------- 邀请 ---------------- */

  function invite(id) {
    const st = stateOf(id);
    if (!st.online) return toast('对方不在线');
    const room = cfg.room();
    if (room && room.code) {
      cfg.send({
        t: 'invite',
        to: id,
        code: room.code,
        game: cfg.game.id,
        gameName: cfg.game.name
      });
      toast(`已邀请 ${label(friends.find((f) => f.id === id) || { id })}`);
    } else {
      /* 还没开房：先创建房间，进房后由页面自动把房号发出去 */
      toast('正在开房间，稍后自动邀请…');
      cfg.createRoom(id);
    }
    toggle(false);
  }

  /* 横幅放在页头下方，避免压住标题与返回按钮 */
  function placeBanner() {
    const banner = $('#hfBanner');
    if (!banner) return;
    const head = document.querySelector('header');
    const top = head ? Math.max(10, Math.round(head.getBoundingClientRect().bottom) + 8) : 12;
    banner.style.top = top + 'px';
  }

  function showInvite(msg) {
    pendingInvite = msg;
    placeBanner();
    const nick = (msg.from && msg.from.nick) || '好友';
    $('#hfFrom').textContent = nick;
    $('#hfFromAvatar').textContent = nick.slice(0, 1);
    $('#hfGame').textContent = msg.gameName || '游戏';
    $('#hfCode').textContent = msg.code || '----';
    $('#hfBanner').classList.add('show');
    clearTimeout(showInvite._t);
    showInvite._t = setTimeout(() => $('#hfBanner').classList.remove('show'), 30000);
  }

  function replyInvite(accept) {
    const inv = pendingInvite;
    if (!inv) return;
    const from = inv.from && inv.from.id;
    if (from) cfg.send({ t: 'invite-reply', to: from, accept, code: inv.code });
    $('#hfBanner').classList.remove('show');
    pendingInvite = null;
    if (!accept) return;
    if (!inv.game || inv.game === cfg.game.id) {
      cfg.joinRoom(inv.code);
      return;
    }
    /* 邀请的是另一款游戏：跳到对应页面并带上房号 */
    const dir = GAME_DIRS[inv.game];
    if (!dir) {
      cfg.joinRoom(inv.code);
      return;
    }
    const url = new URL(`../${dir}/`, location.href);
    const sc = new URLSearchParams(location.search).get('sharecode');
    if (sc) url.searchParams.set('sharecode', sc);
    url.searchParams.set('room', inv.code || '');
    location.href = url.toString();
  }

  /* ---------------- 网络 ---------------- */

  function onConnect() {
    if (!me || !cfg.send) return;
    cfg.send({ t: 'hello', id: me.id, nick: me.nick });
    cfg.send({ t: 'watch', ids: friends.map((f) => f.id) });
  }

  function handle(msg) {
    if (!msg || !msg.t) return false;
    if (msg.t === 'hello-ok') {
      synced = true;
      render();
      return true;
    }
    if (msg.t === 'presence-list') {
      synced = true;
      (msg.list || []).forEach((item) => {
        presence.set(item.id, { online: Boolean(item.online), nick: item.nick || '', act: item.act || null });
      });
      render();
      return true;
    }
    if (msg.t === 'presence') {
      const prev = presence.get(msg.id) || {};
      presence.set(msg.id, {
        online: Boolean(msg.online),
        nick: msg.nick || prev.nick || '',
        act: msg.online ? msg.act || null : null
      });
      render();
      return true;
    }
    if (msg.t === 'invite') {
      showInvite(msg);
      return true;
    }
    if (msg.t === 'invite-reply') {
      const nick = (msg.from && msg.from.nick) || '好友';
      toast(msg.accept ? `${nick} 接受了邀请` : `${nick} 暂时没空`);
      return true;
    }
    if (msg.t === 'invite-sent') {
      toast('邀请已发出，等好友进来');
      return true;
    }
    if (msg.t === 'invite-fail') {
      toast('对方不在线，没能发出邀请');
      return true;
    }
    return false;
  }

  function mount(options) {
    if (mounted) return;
    cfg = Object.assign(cfg, options || {});
    if (options && options.game) cfg.game = options.game;
    mounted = true;
    load();
    inject();
    bind();
    render();
  }

  function refresh() {
    load();
    render();
  }

  window.HubFriends = { mount, onConnect, handle, refresh, stateOf };
})();
