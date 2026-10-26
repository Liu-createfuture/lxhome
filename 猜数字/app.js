/* =========================================================
   猜数字 · 4位 1A2B  —  客户端逻辑
   ========================================================= */

(function () {
  'use strict';

  /* ---------------------------------------------------------
     基础工具
     --------------------------------------------------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const pad2 = (n) => String(n).padStart(2, '0');

  function fmtTime(ms) {
    if (!ms || ms < 0) return '00:00';
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* ignore */
      }
    },
    del(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  };

  /* 房间席位用 sessionStorage：同一浏览器开两个标签页 = 两个玩家，刷新仍能找回席位 */
  const seat = {
    get(key) {
      try {
        return sessionStorage.getItem(key) || '';
      } catch {
        return '';
      }
    },
    set(key, value) {
      try {
        sessionStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    del(key) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  };

  const RECORDS_KEY = 'gn.records.v1';
  const NICK_KEY = 'gn.nick';
  const SOUND_KEY = 'gn.sound';

  /* ---------------------------------------------------------
     联机服务地址
     本机/局域网直接访问 node server.js → 同源；
     页面部署在静态站时 → 用 config.js 里配置的公网服务地址。
     --------------------------------------------------------- */
  const IS_LOCAL_HOST =
    location.protocol === 'file:' ||
    /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(location.hostname) ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);

  const REMOTE_BASE = String((window.GN_CONFIG && window.GN_CONFIG.server) || '')
    .trim()
    .replace(/\/+$/, '');

  const SHARE_CODE = String((window.GN_CONFIG && window.GN_CONFIG.sharecode) || '').trim();
  const SHARE_QS = SHARE_CODE ? `?sharecode=${encodeURIComponent(SHARE_CODE)}` : '';

  const SERVER_BASE = IS_LOCAL_HOST ? '' : REMOTE_BASE;
  const STATS_URL = SERVER_BASE ? `${SERVER_BASE}/api/stats${SHARE_QS}` : '/api/stats';

  function wsEndpoint() {
    if (SERVER_BASE) return `${SERVER_BASE.replace(/^http/i, 'ws')}/${SHARE_QS}`;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/`;
  }

  /* 生成当前页面的链接，保留访问码，可附加查询参数 */
  function withQuery(params) {
    const url = new URL(location.href);
    url.pathname = url.pathname.replace(/index\.html$/i, '');
    url.search = '';
    const sc = new URLSearchParams(location.search).get('sharecode') || SHARE_CODE;
    if (sc) url.searchParams.set('sharecode', sc);
    Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    return url.toString();
  }

  /* 当前页面的分享地址（去重 query / index.html） */
  function pageUrl() {
    return withQuery({});
  }

  /* ---------------------------------------------------------
     音效
     --------------------------------------------------------- */
  let audioCtx = null;
  let soundOn = store.get(SOUND_KEY, true);
  const soundBtn = $('#btnSound');

  function syncSoundBtn() {
    soundBtn.textContent = soundOn ? '🔔' : '🔕';
    soundBtn.classList.toggle('is-off', !soundOn);
  }
  syncSoundBtn();

  function tone(freq, start, dur, type, gain) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const t0 = audioCtx.currentTime + start;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain == null ? 0.14 : gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function playSound(kind) {
    if (!soundOn) return;
    try {
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      if (kind === 'click') tone(660, 0, 0.08, 'triangle', 0.08);
      else if (kind === 'error') {
        tone(180, 0, 0.12, 'sawtooth', 0.07);
        tone(140, 0.1, 0.14, 'sawtooth', 0.06);
      } else if (kind === 'guess') {
        tone(520, 0, 0.07, 'sine', 0.09);
        tone(780, 0.05, 0.08, 'sine', 0.05);
      } else if (kind === 'win') {
        [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.28, 'sine', 0.12));
      } else if (kind === 'lose') {
        [392, 330, 262].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.1));
      } else if (kind === 'tick') {
        tone(880, 0, 0.06, 'sine', 0.05);
      }
    } catch {
      /* ignore */
    }
  }

  /* ---------------------------------------------------------
     候选数计算（用于「剩余可能」）
     --------------------------------------------------------- */
  let ALL_CODES = null;
  function allCodes() {
    if (ALL_CODES) return ALL_CODES;
    const out = [];
    for (let a = 0; a < 10; a += 1) {
      for (let b = 0; b < 10; b += 1) {
        if (b === a) continue;
        for (let c = 0; c < 10; c += 1) {
          if (c === a || c === b) continue;
          for (let d = 0; d < 10; d += 1) {
            if (d === a || d === b || d === c) continue;
            out.push(`${a}${b}${c}${d}`);
          }
        }
      }
    }
    ALL_CODES = out;
    return out;
  }

  function judgeLocal(secret, guess) {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 4; i += 1) if (secret[i] === guess[i]) a += 1;
    for (const ch of guess) if (secret.includes(ch)) b += 1;
    return { a, b: b - a };
  }

  function countCandidates(guesses) {
    if (!guesses.length) return allCodes().length;
    const codes = allCodes();
    let count = 0;
    for (const code of codes) {
      let ok = true;
      for (const g of guesses) {
        const r = judgeLocal(code, g.guess);
        if (r.a !== g.a || r.b !== g.b) {
          ok = false;
          break;
        }
      }
      if (ok) count += 1;
    }
    return count;
  }

  /* ---------------------------------------------------------
     数字输入组件
     --------------------------------------------------------- */
  function createDigitInput(root, onSubmit) {
    const inputs = $$('.digit', root);

    function getValue() {
      return inputs.map((i) => i.value || '').join('');
    }
    function setValue(v) {
      inputs.forEach((inp, i) => {
        inp.value = (v[i] || '').slice(0, 1);
        inp.classList.toggle('filled', Boolean(inp.value));
      });
    }
    function clear() {
      setValue('');
    }
    function focus() {
      if (!inputs[0].disabled) inputs[0].focus();
    }
    function setDisabled(flag) {
      inputs.forEach((i) => {
        i.disabled = flag;
      });
      root.classList.toggle('disabled', flag);
    }
    function shake() {
      root.classList.remove('shake');
      void root.offsetWidth;
      root.classList.add('shake');
      setTimeout(() => root.classList.remove('shake'), 420);
    }

    inputs.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        const digitsOnly = inp.value.replace(/\D/g, '');
        inp.value = digitsOnly.slice(-1);
        inp.classList.toggle('filled', Boolean(inp.value));
        if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
      });

      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSubmit();
          return;
        }
        if (e.key === 'Backspace' && !inp.value && i > 0) {
          e.preventDefault();
          const prev = inputs[i - 1];
          prev.value = '';
          prev.classList.remove('filled');
          prev.focus();
          return;
        }
        if (e.key === 'ArrowLeft' && i > 0) {
          e.preventDefault();
          inputs[i - 1].focus();
        }
        if (e.key === 'ArrowRight' && i < inputs.length - 1) {
          e.preventDefault();
          inputs[i + 1].focus();
        }
      });

      inp.addEventListener('paste', (e) => {
        const text = ((e.clipboardData && e.clipboardData.getData('text')) || '').replace(/\D/g, '').slice(0, 4);
        if (!text) return;
        e.preventDefault();
        setValue(text);
        if (text.length === 4) onSubmit();
      });

      inp.addEventListener('focus', () => inp.select());
    });

    return { getValue, setValue, clear, focus, setDisabled, shake, inputs };
  }

  /* ---------------------------------------------------------
     记录与统计
     --------------------------------------------------------- */
  function getRecords() {
    const list = store.get(RECORDS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function addRecord(rec) {
    const list = getRecords();
    list.unshift(rec);
    store.set(RECORDS_KEY, list.slice(0, 80));
    renderRecords();
  }

  function renderRecords() {
    const list = getRecords();
    const box = $('#records');
    $('#recordCount').textContent = list.length;
    $('#recordsEmpty').classList.toggle('hidden', list.length > 0);

    box.innerHTML = list
      .map((r) => {
        const guesses = (r.guesses || [])
          .map(
            (g) =>
              `<span class="guess-pill ${g.a === 4 ? 'win' : ''}">${esc(g.guess)} · ${g.a}A${g.b}B</span>`
          )
          .join('');
        const tag = r.mode === 'online' ? '<span class="record-mode online">联机</span>' : '<span class="record-mode">单人</span>';
        const score = `${r.attempts} 次`;
        return `<div class="record" data-id="${esc(r.id)}">
          <div class="record-top">
            ${tag}
            <span>${r.win === false ? '未破解' : '已破解'}</span>
            <span class="record-score">${score}</span>
          </div>
          <div class="record-sub">
            <span>${fmtDate(r.at)}</span>
            <span>${r.duration > 0 ? fmtTime(r.duration) : '—'} · 答案 ${esc(r.secret || '??')}</span>
          </div>
          <div class="record-guesses">${guesses || '<span class="guess-pill">无记录</span>'}</div>
        </div>`;
      })
      .join('');
  }

  function renderStats() {
    const list = getRecords().filter((r) => r.win !== false);
    $('#statTotal').textContent = getRecords().length;
    if (!list.length) {
      $('#statBest').textContent = '—';
      $('#statAvg').textContent = '—';
      $('#statTime').textContent = '—';
      return;
    }
    const attempts = list.map((r) => r.attempts);
    const best = Math.min(...attempts);
    const avg = attempts.reduce((s, n) => s + n, 0) / attempts.length;
    const durations = list.map((r) => r.duration).filter((d) => d > 0);
    const bestTime = durations.length ? Math.min(...durations) : 0;
    $('#statBest').textContent = best;
    $('#statAvg').textContent = avg.toFixed(1);
    $('#statTime').textContent = bestTime ? fmtTime(bestTime) : '—';
  }

  /* ---------------------------------------------------------
     棋盘渲染
     --------------------------------------------------------- */
  function tileRow(guess, a) {
    return guess
      .split('')
      .map((ch) => `<span class="tile">${esc(ch)}</span>`)
      .join('');
  }

  function feedbackHtml(g) {
    if (g.a === 4) return '<span class="fb-perfect">4A 破解</span>';
    return `<span class="fb-a"><b>${g.a}</b>A</span><span class="fb-b"><b>${g.b}</b>B</span>`;
  }

  function renderBoard(container, guesses, emptyHtml) {
    if (!guesses || !guesses.length) {
      container.innerHTML = emptyHtml;
      return;
    }
    const total = guesses.length;
    const rows = guesses
      .slice()
      .reverse()
      .map((g, i) => {
        const idx = total - i;
        return `<div class="row ${g.a === 4 ? 'win' : ''}">
          <span class="row-idx">${pad2(idx)}</span>
          <div class="row-digits">${tileRow(g.guess, g.a)}</div>
          <div class="row-fb">${feedbackHtml(g)}</div>
        </div>`;
      })
      .join('');
    container.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">${rows}</div>`;
  }

  const SOLO_EMPTY = `<div class="empty">
      <div class="empty-icon">🎯</div>
      <p>还没有猜测记录</p>
      <span>每一位数字互不相同，首位可以是 0</span>
    </div>`;

  const ONLINE_EMPTY = `<div class="empty">
      <div class="empty-icon">⚡</div>
      <p>抢答开始</p>
      <span>和对手使用同一个答案，先破解者获胜</span>
    </div>`;

  function flashError(root, hintEl, msg) {
    if (root && root.shake) root.shake();
    if (hintEl) {
      hintEl.textContent = msg;
      hintEl.classList.add('error');
      clearTimeout(hintEl._t);
      hintEl._t = setTimeout(() => {
        hintEl.classList.remove('error');
        hintEl.textContent = hintEl.dataset.default || '';
      }, 2200);
    }
    playSound('error');
  }

  /* ---------------------------------------------------------
     单人模式
     --------------------------------------------------------- */
  const solo = { secret: '', guesses: [], startAt: 0, endAt: 0, finished: false };

  const soloDigits = createDigitInput($('#soloDigits'), () => submitSolo());
  const soloHint = $('#soloHint');
  soloHint.dataset.default = soloHint.textContent;

  function newSolo() {
    solo.secret = randomSecretClient();
    solo.guesses = [];
    solo.startAt = 0; // 第一次猜测时开始计时
    solo.endAt = 0;
    solo.finished = false;
    soloDigits.clear();
    soloDigits.setDisabled(false);
    $('#soloSubmit').disabled = false;
    renderBoard($('#soloBoard'), [], SOLO_EMPTY);
    updateSoloMeters();
    soloHint.textContent = soloHint.dataset.default;
    soloHint.classList.remove('error');
    if (state.mode === 'solo') soloDigits.focus();
  }

  function randomSecretClient() {
    const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 4).join('');
  }

  function updateSoloMeters() {
    $('#soloAttempts').textContent = solo.guesses.length;
    $('#soloCandidates').textContent = solo.guesses.length ? countCandidates(solo.guesses) : allCodes().length;
    const elapsed = solo.startAt ? (solo.finished ? solo.endAt : Date.now()) - solo.startAt : 0;
    $('#soloTimer').textContent = fmtTime(elapsed);
  }

  function submitSolo() {
    if (solo.finished) return;
    const value = soloDigits.getValue();
    if (!/^\d{4}$/.test(value)) {
      flashError(soloDigits, soloHint, '请填满 4 位数字');
      return;
    }
    if (new Set(value).size !== 4) {
      flashError(soloDigits, soloHint, '4 位数字不能重复哦');
      return;
    }

    const { a, b } = judgeLocal(solo.secret, value);
    if (!solo.startAt) solo.startAt = Date.now();
    solo.guesses.push({ guess: value, a, b });
    soloDigits.clear();
    renderBoard($('#soloBoard'), solo.guesses, SOLO_EMPTY);
    updateSoloMeters();

    if (a === 4) {
      solo.finished = true;
      solo.endAt = Date.now();
      soloDigits.setDisabled(true);
      $('#soloSubmit').disabled = true;
      updateSoloMeters();
      playSound('win');
      fireConfetti();

      addRecord({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        mode: 'solo',
        secret: solo.secret,
        attempts: solo.guesses.length,
        duration: solo.endAt - solo.startAt,
        at: solo.endAt,
        win: true,
        guesses: solo.guesses.slice()
      });
      renderStats();

      showResult({
        title: '破解成功 🎉',
        secret: solo.secret,
        line: `你用 <span class="hl">${solo.guesses.length}</span> 次、${fmtTime(
          solo.endAt - solo.startAt
        )} 破解了答案`,
        details: [
          { label: '猜测次数', value: `${solo.guesses.length} 次` },
          { label: '用时', value: fmtTime(solo.endAt - solo.startAt) },
          { label: '剩余可能', value: '1' }
        ],
        againLabel: '再来一局',
        onAgain: () => newSolo()
      });
    } else {
      playSound('guess');
      soloHint.textContent = a > 0 ? `有 ${a} 位数字位置也对了，继续！` : '位置都不对，但 B 说明数字出现了';
      setTimeout(() => {
        if (!solo.finished) soloHint.textContent = soloHint.dataset.default;
      }, 2600);
      soloDigits.focus();
    }
  }

  /* ---------------------------------------------------------
     状态
     --------------------------------------------------------- */
  const state = { mode: 'solo' };

  /* ---------------------------------------------------------
     联机
     --------------------------------------------------------- */
  const net = {
    ws: null,
    connected: false,
    room: null,
    code: null,
    token: null,
    nick: store.get(NICK_KEY, ''),
    pending: [],
    retry: 0,
    retryTimer: null,
    roundStartLocal: 0,
    countdownDeadline: 0,
    lastCountdownSec: null,
    lastStatus: '',
    roundStartAt: 0
  };

  const nickInput = $('#nickInput');
  const codeInput = $('#codeInput');
  nickInput.value = net.nick || '';

  function send(obj) {
    if (net.ws && net.ws.readyState === WebSocket.OPEN) {
      net.ws.send(JSON.stringify(obj));
    } else {
      net.pending.push(obj);
      connect();
    }
  }

  function connect() {
    if (net.ws && (net.ws.readyState === WebSocket.CONNECTING || net.ws.readyState === WebSocket.OPEN)) return;

    let ws;
    try {
      ws = new WebSocket(wsEndpoint());
    } catch {
      return;
    }
    net.ws = ws;

    ws.addEventListener('open', () => {
      net.connected = true;
      net.retry = 0;
      const queued = net.pending.splice(0);
      queued.forEach((m) => {
        try {
          ws.send(JSON.stringify(m));
        } catch {
          /* ignore */
        }
      });
      if (!queued.length && net.code && net.token) {
        try {
          ws.send(JSON.stringify({ t: 'rejoin', code: net.code, token: net.token }));
        } catch {
          /* ignore */
        }
      }
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      handleMessage(msg);
    });

    ws.addEventListener('close', () => {
      net.connected = false;
      net.ws = null;
      if (net.code) scheduleReconnect();
    });

    ws.addEventListener('error', () => {});
  }

  function scheduleReconnect() {
    if (net.retryTimer) return;
    net.retry = Math.min(net.retry + 1, 6);
    const delay = Math.min(1000 * net.retry, 6000);
    net.retryTimer = setTimeout(() => {
      net.retryTimer = null;
      if (!net.connected && net.code) connect();
    }, delay);
  }

  function handleMessage(msg) {
    if (msg.t === 'joined') {
      net.code = msg.code;
      net.token = msg.token;
      if (msg.nick) net.nick = msg.nick;
      const key = `gn.mp.${msg.code}`;
      if (seat.get(key) !== msg.token) seat.set(key, msg.token);
      if (location.search.indexOf('room=') === -1) {
        history.replaceState(null, '', withQuery({ room: msg.code }));
      }
      return;
    }

    if (msg.t === 'state') {
      const room = msg.state;
      const prevStatus = net.lastStatus;
      net.room = room;
      net.code = room.code;
      if (msg.token) {
        net.token = msg.token;
        seat.set(`gn.mp.${room.code}`, msg.token);
      }
      if (room.status === 'countdown') {
        if (prevStatus !== 'countdown' && !net.countdownDeadline) {
          const remain = Math.max(0, room.startAt - Date.now());
          net.countdownDeadline = performance.now() + remain;
        }
      } else {
        net.countdownDeadline = 0;
        net.lastCountdownSec = null;
      }
      if (room.status === 'playing' && prevStatus !== 'playing') {
        const remain = Math.max(0, room.startAt - Date.now());
        net.roundStartLocal = performance.now() - remain;
        net.roundStartAt = room.startAt;
      }
      if (room.status === 'waiting') net.roundStartLocal = 0;

      net.lastStatus = room.status;
      renderOnline();
      maybeShowRoundResult(room, prevStatus);
      return;
    }

    if (msg.t === 'toast') {
      toast(msg.msg);
      return;
    }

    if (msg.t === 'error') {
      if (msg.fatal) {
        clearRoomState();
        renderOnline();
      }
      toast(msg.msg, 'error');
    }
  }

  /* ------------------ 渲染：房间 ------------------ */

  function renderOnline() {
    const room = net.room;
    $('#lobbyView').classList.toggle('hidden', Boolean(room));
    $('#roomView').classList.toggle('hidden', !room);
    if (!room) return;

    $('#roomCode').textContent = room.code;
    renderPlayers(room);
    renderControls(room);

    const showRace = room.status === 'playing' || room.status === 'countdown' || room.status === 'finished';
    $('#raceArea').classList.toggle('hidden', !showRace);
    if (!showRace) return;

    const me = room.players[room.you];
    const myGuesses = room.myGuesses || [];
    $('#raceAttempts').textContent = myGuesses.length;
    renderBoard($('#onlineBoard'), myGuesses, ONLINE_EMPTY);

    const oppIdx = room.you === 0 ? 1 : 0;
    const opp = room.players[oppIdx];
    const opText = $('#raceOpText');
    const opLabel = $('#raceOp .label');
    if (opLabel) opLabel.textContent = opp ? opp.nick : '对手';
    if (!opp) opText.textContent = '等待加入';
    else if (opp.solved) opText.textContent = '已破解！';
    else opText.textContent = `已猜 ${opp.attempts} 次`;

    const playing = room.status === 'playing';
    onlineInput.setDisabled(!playing || Boolean(me && me.solved));
    $('#onlineSubmit').disabled = !playing || Boolean(me && me.solved);
    if (playing && !net.lastFocusRound) {
      net.lastFocusRound = true;
      if (state.mode === 'online' && document.activeElement === document.body) onlineInput.focus();
    }
    if (!playing) net.lastFocusRound = false;

    $('#onlineHint').textContent =
      room.status === 'countdown'
        ? '准备好了，倒计时结束后开始抢答'
        : room.status === 'finished'
        ? '本局已结束'
        : me && me.solved
        ? '你已破解，等待对手…'
        : '输入 4 位互不相同的数字，按 Enter 提交';

    if (room.status === 'finished' && room.secret) {
      const el = $('#raceTimer');
      const d = room.durations && room.durations[room.you];
      el.textContent = d ? fmtTime(d) : fmtTime((room.endAt || Date.now()) - (room.startAt || Date.now()));
    }
  }

  function renderPlayers(room) {
    const box = $('#roomPlayers');
    const cards = [];
    for (let i = 0; i < 2; i += 1) {
      const p = room.players[i];
      if (!p) {
        cards.push(`<div class="player-card is-empty">
            <div>
              <div style="font-size:20px;margin-bottom:6px">＋</div>
              等待好友加入…
            </div>
          </div>`);
        continue;
      }
      const isYou = i === room.you;
      const isHost = i === room.hostIdx;
      const dotClass = !p.connected ? 'off' : p.solved ? '' : 'wait';
      const meta = !p.connected
        ? '掉线重连中…'
        : room.status === 'waiting'
        ? '已就位'
        : p.solved
        ? '已破解 ✓'
        : `已猜 ${p.attempts} 次`;
      cards.push(`<div class="player-card ${isYou ? 'is-you' : ''} ${p.connected ? '' : 'is-out'}">
          <div class="player-top">
            <div class="avatar">${esc(p.nick.slice(0, 1).toUpperCase())}</div>
            <div class="player-name">${esc(p.nick)}${isHost ? '<em>房主</em>' : ''}${isYou ? '<em>你</em>' : ''}</div>
          </div>
          <div class="player-meta"><span class="status-dot ${dotClass}"></span>${meta}</div>
        </div>`);
    }
    box.innerHTML = cards.join('');
  }

  function renderControls(room) {
    const box = $('#roomControls');
    const isHost = room.you === room.hostIdx;
    const activeCount = room.players.filter((p) => p.connected).length;
    const parts = [];

    if (room.status === 'waiting') {
      if (activeCount < 2) {
        parts.push(`<div class="notice"><span class="spinner"></span>等待好友加入，把房间号或链接发给 TA</div>`);
      } else if (isHost) {
        parts.push(`<button class="btn primary" id="btnStart">开始游戏</button>`);
        parts.push(`<span class="notice">双方就位，点击开始</span>`);
      } else {
        parts.push(`<div class="notice"><span class="spinner"></span>等待房主开始…</div>`);
      }
    } else if (room.status === 'countdown') {
      parts.push(`<div class="notice"><span class="spinner"></span>3 秒后开始，准备抢答</div>`);
    } else if (room.status === 'playing') {
      parts.push(`<div class="notice"><span class="spinner"></span>抢答中，先破解者获胜</div>`);
    } else if (room.status === 'finished') {
      parts.push(`<button class="btn primary" id="btnAgain">再来一局</button>`);
      parts.push(`<span class="notice">${activeCount < 2 ? '对手已离开，等待新玩家加入' : '点击开始新的一局'}</span>`);
    }

    box.innerHTML = parts.join('');

    const startBtn = $('#btnStart');
    if (startBtn) startBtn.addEventListener('click', () => send({ t: 'start' }));
    const againBtn = $('#btnAgain');
    if (againBtn) againBtn.addEventListener('click', () => send({ t: 'rematch' }));
  }

  /* ------------------ 结果弹窗 ------------------ */

  function maybeShowRoundResult(room, prevStatus) {
    if (room.status !== 'finished' || prevStatus === 'finished') return;
    const me = room.players[room.you];
    const oppIdx = room.you === 0 ? 1 : 0;
    const opp = room.players[oppIdx];
    const winnerIdx = room.winnerIdx;
    const win = winnerIdx === room.you;
    const myGuesses = room.myGuesses || [];
    const myDuration = (room.durations && room.durations[room.you]) || 0;
    const resultKey = `${room.code}:${room.endAt}:${room.you}`;
    const alreadyRecorded = net.lastResultKey === resultKey;
    net.lastResultKey = resultKey;

    if (win) {
      playSound('win');
      fireConfetti();
    } else {
      playSound('lose');
    }

    const details = [
      {
        label: `你（${esc(me ? me.nick : '你')}）`,
        value: `${myGuesses.length} 次${myDuration ? ` · ${fmtTime(myDuration)}` : ''}`,
        win
      },
      {
        label: opp ? `对手 · ${esc(opp.nick)}` : '对手',
        value: opp ? `${opp.attempts} 次${opp.solved ? ' · 已破解' : ' · 未破解'}` : '—',
        win: !win && winnerIdx === oppIdx
      }
    ];

    let line;
    if (win) {
      line =
        room.reason === 'forfeit' || room.reason === 'leave'
          ? '对手离开了本局，你获胜'
          : `你用 <span class="hl">${myGuesses.length}</span> 次先一步破解了答案`;
    } else if (room.reason === 'forfeit' || room.reason === 'leave') {
      line = '你离开了本局';
    } else {
      line = '对手抢先一步，下次一定';
    }

    showResult({
      title: win ? '你赢了 🏆' : '惜败',
      secret: room.secret || '',
      line,
      details,
      againLabel: '再来一局',
      onAgain: () => send({ t: 'rematch' })
    });

    if (!alreadyRecorded) {
      addRecord({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        mode: 'online',
        secret: room.secret || '????',
        attempts: myGuesses.length,
        duration: myDuration,
        at: Date.now(),
        win,
        guesses: myGuesses.slice(),
        opponent: opp ? opp.nick : ''
      });
      renderStats();
    }
  }
  let resultAction = null;
  function showResult(opts) {
    $('#resultTitle').textContent = opts.title || '本局结束';
    const secretBox = $('#resultSecret');
    secretBox.innerHTML = (opts.secret || '????')
      .split('')
      .map((ch, i) => `<span class="tile" style="animation-delay:${i * 70}ms">${esc(ch)}</span>`)
      .join('');
    $('#resultLine').innerHTML = opts.line || '';

    const detailBox = $('#resultDetail');
    detailBox.innerHTML = (opts.details || [])
      .map(
        (d) =>
          `<div class="detail-row ${d.win ? 'win' : ''}"><span>${d.label}</span><b>${esc(d.value)}</b></div>`
      )
      .join('');

    const again = $('#btnResultAgain');
    again.textContent = opts.againLabel || '再来一局';
    resultAction = opts.onAgain || null;
    openModal('resultModal');
  }

  $('#btnResultAgain').addEventListener('click', () => {
    closeModal('resultModal');
    if (typeof resultAction === 'function') resultAction();
  });

  /* ------------------ 大厅动作 ------------------ */

  function readNick() {
    const v = nickInput.value.trim().slice(0, 12);
    const nick = v || '玩家';
    net.nick = nick;
    store.set(NICK_KEY, nick);
    return nick;
  }

  $('#btnCreate').addEventListener('click', () => {
    playSound('click');
    const nick = readNick();
    net.room = null;
    send({ t: 'create', nick });
  });

  $('#btnJoin').addEventListener('click', () => {
    const code = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (code.length !== 4) {
      toast('请输入 4 位房间号', 'error');
      codeInput.focus();
      return;
    }
    playSound('click');
    const nick = readNick();
    const token = seat.get(`gn.mp.${code}`);
    net.room = null;
    send({ t: 'join', code, nick, token });
  });

  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  });
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btnJoin').click();
  });

  nickInput.addEventListener('change', readNick);

  $('#btnCopyCode').addEventListener('click', () => {
    const code = net.room ? net.room.code : '';
    copyText(code, '房间号已复制');
  });

  $('#btnCopyLink').addEventListener('click', () => {
    const code = net.room ? net.room.code : '';
    copyText(withQuery({ room: code }), '邀请链接已复制');
  });

  $('#btnLeave').addEventListener('click', () => {
    if (net.room) send({ t: 'leave' });
    clearRoomState();
    renderOnline();
    toast('已离开房间');
  });

  function clearRoomState() {
    if (net.code) seat.del(`gn.mp.${net.code}`);
    net.room = null;
    net.code = null;
    net.token = null;
    net.lastStatus = '';
    net.roundStartLocal = 0;
    net.countdownDeadline = 0;
    net.lastResultKey = '';
    net.pending = [];
    if (net.retryTimer) {
      clearTimeout(net.retryTimer);
      net.retryTimer = null;
    }
    history.replaceState(null, '', withQuery({}));
  }

  function copyText(text, okMsg) {
    if (!text) return;
    const done = () => toast(okMsg);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
    function fallbackCopy() {
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
        toast('复制失败，手动复制：' + text, 'error');
      }
    }
  }

  const onlineDigits = createDigitInput($('#onlineDigits'), () => submitOnline());
  const onlineInput = onlineDigits;
  const onlineHint = $('#onlineHint');
  onlineHint.dataset.default = onlineHint.textContent;

  function submitOnline() {
    const room = net.room;
    if (!room) return;
    if (room.status !== 'playing') return;
    const value = onlineDigits.getValue();
    if (!/^\d{4}$/.test(value)) {
      flashError(onlineDigits, onlineHint, '请填满 4 位数字');
      return;
    }
    if (new Set(value).size !== 4) {
      flashError(onlineDigits, onlineHint, '4 位数字不能重复哦');
      return;
    }
    send({ t: 'guess', value });
    onlineDigits.clear();
    playSound('guess');
    onlineDigits.focus();
  }

  $('#onlineSubmit').addEventListener('click', () => submitOnline());

  $$('.chip[data-emote]').forEach((chip) => {
    chip.addEventListener('click', () => {
      if (!net.room) return;
      send({ t: 'emote', text: chip.dataset.emote });
      playSound('click');
    });
  });

  /* ---------------------------------------------------------
     模式切换
     --------------------------------------------------------- */
  function setMode(mode) {
    state.mode = mode;
    $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.mode === mode));
    $('#soloPanel').classList.toggle('hidden', mode !== 'solo');
    $('#onlinePanel').classList.toggle('hidden', mode !== 'online');
    if (mode === 'solo') {
      soloDigits.focus();
    } else {
      connect();
      if (net.room) renderOnline();
      else if (!nickInput.value) setTimeout(() => nickInput.focus(), 120);
    }
  }

  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      playSound('click');
      setMode(tab.dataset.mode);
    });
  });

  /* ---------------------------------------------------------
     弹窗 / 提示 / 彩带
     --------------------------------------------------------- */
  function openModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.add('show');
      m.setAttribute('aria-hidden', 'false');
    }
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.remove('show');
      m.setAttribute('aria-hidden', 'true');
    }
  }

  $$('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  $$('.modal').forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target === m) closeModal(m.id);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.modal.show').forEach((m) => closeModal(m.id));
    }
  });

  $('#btnRules').addEventListener('click', () => openModal('rulesModal'));

  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    store.set(SOUND_KEY, soundOn);
    syncSoundBtn();
    if (soundOn) playSound('click');
  });

  function toast(msg, type) {
    const stack = $('#toastStack');
    const el = document.createElement('div');
    el.className = `toast ${type === 'error' ? 'error' : ''}`;
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 260);
    }, 2200);
    while (stack.children.length > 4) stack.firstChild.remove();
  }

  const canvas = $('#confetti');
  const ctx = canvas.getContext('2d');
  let confettiParticles = [];
  let confettiRaf = 0;

  function fireConfetti() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.display = 'block';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = ['#4f46e5', '#7c3aed', '#0ea472', '#f59e0b', '#0ea5e9', '#f472b6'];
    confettiParticles = Array.from({ length: 110 }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 260,
      y: window.innerHeight * 0.42 + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 11 - 3,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1
    }));

    const start = performance.now();
    function frame(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      confettiParticles.forEach((p) => {
        p.vy += 0.26;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life = Math.max(0, 1 - elapsed / 2400);
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
      if (elapsed < 2400) {
        confettiRaf = requestAnimationFrame(frame);
      } else {
        canvas.style.display = 'none';
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    }
    cancelAnimationFrame(confettiRaf);
    confettiRaf = requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------
     主循环（计时 / 倒计时）
     --------------------------------------------------------- */
  setInterval(() => {
    // 单人计时
    if (state.mode === 'solo' && solo.startAt && !solo.finished) {
      $('#soloTimer').textContent = fmtTime(Date.now() - solo.startAt);
    }

    const room = net.room;
    if (!room) return;

    if (room.status === 'countdown' && net.countdownDeadline) {
      const remain = Math.max(0, net.countdownDeadline - performance.now());
      const sec = Math.ceil(remain / 1000);
      const overlay = $('#raceOverlay');
      overlay.classList.remove('hidden');
      if (sec !== net.lastCountdownSec) {
        net.lastCountdownSec = sec;
        $('#raceOverlayText').textContent = sec > 0 ? String(sec) : 'GO';
        if (sec <= 3 && sec > 0) playSound('tick');
      }
    } else {
      $('#raceOverlay').classList.add('hidden');
    }

    if (room.status === 'playing' && net.roundStartLocal) {
      $('#raceTimer').textContent = fmtTime(performance.now() - net.roundStartLocal);
    }
  }, 200);

  /* ---------------------------------------------------------
     在线人数
     --------------------------------------------------------- */
  function refreshOnlineCount() {
    fetch(STATS_URL)
      .then((r) => r.json())
      .then((d) => {
        $('#onlineCount').textContent = d.online || 0;
      })
      .catch(() => {});
  }

  /* ---------------------------------------------------------
     记录交互
     --------------------------------------------------------- */
  $('#records').addEventListener('click', (e) => {
    const rec = e.target.closest('.record');
    if (rec) rec.classList.toggle('open');
  });

  $('#btnClearRecords').addEventListener('click', () => {
    if (!getRecords().length) return;
    if (window.confirm('确定清空全部对局记录吗？')) {
      store.del(RECORDS_KEY);
      renderRecords();
      renderStats();
      toast('记录已清空');
    }
  });

  $('#soloNew').addEventListener('click', () => {
    playSound('click');
    newSolo();
    toast('新的一局开始了');
  });

  $('#soloSubmit').addEventListener('click', () => submitSolo());

  /* ---------------------------------------------------------
     初始化
     --------------------------------------------------------- */
  function init() {
    renderRecords();
    renderStats();
    refreshOnlineCount();
    setInterval(refreshOnlineCount, 20000);

    newSolo();

    const params = new URLSearchParams(location.search);
    const roomParam = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

    if (roomParam) {
      setMode('online');
      codeInput.value = roomParam;
      const token = seat.get(`gn.mp.${roomParam}`);
      if (token) {
        net.code = roomParam;
        net.token = token;
        send({ t: 'rejoin', code: roomParam, token });
        toast('正在回到房间 ' + roomParam);
      } else {
        setTimeout(() => {
          nickInput.focus();
        }, 200);
      }
    }

    window.addEventListener('resize', () => {
      if (canvas.style.display === 'block') {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    });
  }

  init();
})();
