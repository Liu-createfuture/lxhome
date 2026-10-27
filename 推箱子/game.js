/* =========================================================
   推箱子 · 逻辑
   规则：把所有箱子推到目标点上，箱子只能推不能拉
   ========================================================= */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const LEVELS = window.SOKOBAN_LEVELS || [];
  const SAVE_KEY = 'sokoban.v1';

  /* ---------------- 存档 ---------------- */

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { level: 0, best: {}, done: {} };
      const d = JSON.parse(raw);
      return {
        level: Number.isFinite(d.level) ? Math.max(0, Math.min(LEVELS.length - 1, d.level)) : 0,
        best: d.best && typeof d.best === 'object' ? d.best : {},
        done: d.done && typeof d.done === 'object' ? d.done : {}
      };
    } catch {
      return { level: 0, best: {}, done: {} };
    }
  }

  const save = loadSave();

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      /* ignore */
    }
  }

  /* ---------------- 状态 ---------------- */

  const S = {
    idx: 0,
    cols: 0,
    rows: 0,
    cell: 56,
    walls: new Set(),
    goals: new Set(),
    boxes: [],
    player: { x: 0, y: 0 },
    moves: 0,
    history: [],
    solved: false
  };

  const key = (x, y) => `${x},${y}`;

  /* ---------------- 音效 ---------------- */

  let audio = null;

  function beep(kind) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audio) audio = new Ctx();
      if (audio.state === 'suspended') audio.resume();
      const t = audio.currentTime;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = kind === 'win' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(kind === 'win' ? 660 : 220, t);
      if (kind === 'win') osc.frequency.exponentialRampToValueAtTime(990, t + 0.18);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'win' ? 0.4 : 0.1));
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + (kind === 'win' ? 0.45 : 0.12));
    } catch {
      /* ignore */
    }
  }

  /* ---------------- 关卡 ---------------- */

  function parseLevel(level) {
    const map = level.map;
    S.rows = map.length;
    S.cols = Math.max(...map.map((r) => r.length));
    S.walls = new Set();
    S.goals = new Set();
    S.boxes = [];
    S.player = { x: 1, y: 1 };

    for (let y = 0; y < S.rows; y += 1) {
      for (let x = 0; x < S.cols; x += 1) {
        const ch = (map[y] || '')[x] || ' ';
        const k = key(x, y);
        if (ch === '#') {
          S.walls.add(k);
          continue;
        }
        if (ch === '.' || ch === '*' || ch === '+') S.goals.add(k);
        if (ch === '$' || ch === '*') S.boxes.push({ x, y });
        if (ch === '@' || ch === '+') S.player = { x, y };
      }
    }
  }

  function loadLevel(idx) {
    if (!LEVELS.length) return;
    S.idx = Math.max(0, Math.min(LEVELS.length - 1, idx));
    parseLevel(LEVELS[S.idx]);
    S.moves = 0;
    S.history = [];
    S.solved = false;
    save.level = S.idx;
    persist();

    buildCells();
    buildSprites();
    layout();
    updateHud();
    renderLevels();
    hideWin();
    $('#lvLabel').textContent = `${S.idx + 1} / ${LEVELS.length}`;
  }

  function buildCells() {
    const board = $('#board');
    board.style.setProperty('--cols', String(S.cols));
    board.style.setProperty('--rows', String(S.rows));

    const frag = [];
    for (let y = 0; y < S.rows; y += 1) {
      for (let x = 0; x < S.cols; x += 1) {
        const k = key(x, y);
        const cls = S.walls.has(k) ? 'wall' : 'floor';
        const goal = S.goals.has(k) ? ' goal' : '';
        frag.push(`<div class="cell ${cls}${goal}"></div>`);
      }
    }
    $('#cells').innerHTML = frag.join('');
  }

  function buildSprites() {
    const boxes = S.boxes.map(() => '<div class="sprite box"><i></i></div>').join('');
    $('#sprites').innerHTML = `${boxes}<div class="sprite player"><i></i></div>`;
  }

  function layout() {
    const host = document.querySelector('.stage');
    const pad = window.matchMedia('(max-width: 640px)').matches ? 16 : 28;
    const availW = Math.max(200, (host ? host.clientWidth : window.innerWidth) - pad);
    const availH = Math.max(220, Math.min(window.innerHeight * 0.56, 540));
    const cell = Math.max(22, Math.floor(Math.min(availW / S.cols, availH / S.rows)));
    S.cell = cell;
    $('#board').style.setProperty('--cell', `${cell}px`);
    placeSprites();
  }

  function placeSprites() {
    const boxes = document.querySelectorAll('#sprites .box');
    S.boxes.forEach((b, i) => {
      const el = boxes[i];
      if (!el) return;
      el.style.transform = `translate3d(${b.x * S.cell}px, ${b.y * S.cell}px, 0)`;
      el.classList.toggle('on', S.goals.has(key(b.x, b.y)));
    });
    const p = document.querySelector('#sprites .player');
    if (p) p.style.transform = `translate3d(${S.player.x * S.cell}px, ${S.player.y * S.cell}px, 0)`;
  }

  /* ---------------- 移动 ---------------- */

  function boxAt(x, y) {
    return S.boxes.find((b) => b.x === x && b.y === y) || null;
  }

  function isWall(x, y) {
    return S.walls.has(key(x, y));
  }

  function snapshot() {
    S.history.push({
      player: { ...S.player },
      boxes: S.boxes.map((b) => ({ ...b }))
    });
    if (S.history.length > 300) S.history.shift();
  }

  function move(dx, dy) {
    if (S.solved) return;
    const nx = S.player.x + dx;
    const ny = S.player.y + dy;
    if (isWall(nx, ny)) return shake();

    const box = boxAt(nx, ny);
    if (box) {
      const bx = nx + dx;
      const by = ny + dy;
      if (isWall(bx, by) || boxAt(bx, by)) return shake();
      snapshot();
      box.x = bx;
      box.y = by;
      S.player = { x: nx, y: ny };
      S.moves += 1;
      placeSprites();
      beep('push');
      checkWin();
      updateHud();
      return;
    }

    snapshot();
    S.player = { x: nx, y: ny };
    S.moves += 1;
    placeSprites();
    updateHud();
  }

  function shake() {
    const board = $('#board');
    board.classList.remove('shake');
    void board.offsetWidth;
    board.classList.add('shake');
    setTimeout(() => board.classList.remove('shake'), 180);
  }

  function undo() {
    if (S.solved || !S.history.length) return;
    const prev = S.history.pop();
    S.player = prev.player;
    S.boxes = prev.boxes;
    S.moves = Math.max(0, S.moves - 1);
    placeSprites();
    updateHud();
  }

  function reset() {
    if (!LEVELS.length) return;
    parseLevel(LEVELS[S.idx]);
    S.moves = 0;
    S.history = [];
    S.solved = false;
    buildSprites();
    placeSprites();
    updateHud();
    hideWin();
  }

  function checkWin() {
    const done = S.boxes.every((b) => S.goals.has(key(b.x, b.y)));
    if (!done) return;
    S.solved = true;
    const id = String(S.idx);
    save.done[id] = true;
    const best = save.best[id];
    if (!best || S.moves < best) save.best[id] = S.moves;
    persist();
    updateHud();
    renderLevels();
    beep('win');
    setTimeout(showWin, 320);
  }

  /* ---------------- 界面 ---------------- */

  function updateHud() {
    $('#moves').textContent = String(S.moves);
    const best = save.best[String(S.idx)];
    $('#best').textContent = best ? String(best) : '—';
    $('#btnUndo').disabled = S.history.length === 0;
    $('#btnPrev').disabled = S.idx === 0;
    $('#btnNext').disabled = S.idx === LEVELS.length - 1;
  }

  function renderLevels() {
    $('#levels').innerHTML = LEVELS.map(
      (lv, i) =>
        `<button class="lv-chip${i === S.idx ? ' is-cur' : ''}${save.done[String(i)] ? ' done' : ''}" data-lv="${i}" title="${lv.name}">${i + 1}</button>`
    ).join('');
  }

  function showWin() {
    const isLast = S.idx === LEVELS.length - 1;
    const best = save.best[String(S.idx)];
    $('#winEmoji').textContent = isLast ? '🏆' : '🎉';
    $('#winTitle').textContent = isLast ? '全部通关！' : '过关！';
    $('#winText').innerHTML = `用了 <b>${S.moves}</b> 步${best ? ` · 最佳 ${best} 步` : ''}${
      isLast ? '<br />十关都推完了，厉害' : ''
    }`;
    $('#btnWinNext').textContent = isLast ? '回到第一关' : '下一关';
    $('#winModal').classList.add('show');
    $('#winModal').setAttribute('aria-hidden', 'false');
  }

  function hideWin() {
    $('#winModal').classList.remove('show');
    $('#winModal').setAttribute('aria-hidden', 'true');
  }

  function toast(msg) {
    const stack = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 2000);
    while (stack.children.length > 3) stack.firstChild.remove();
  }

  /* ---------------- 事件 ---------------- */

  function bind() {
    const dirs = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0]
    };

    window.addEventListener('keydown', (e) => {
      const k = e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
      if (k === 'ArrowUp' || k === 'w' || k === 'W') return move(0, -1);
      if (k === 'ArrowDown' || k === 's' || k === 'S') return move(0, 1);
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') return move(-1, 0);
      if (k === 'ArrowRight' || k === 'd' || k === 'D') return move(1, 0);
      if (k === 'z' || k === 'Z') {
        if (e.metaKey || e.ctrlKey) return;
        return undo();
      }
      if (k === 'r' || k === 'R') return reset();
      return undefined;
    });

    $('#dpad').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-dir]');
      if (!btn) return;
      const d = dirs[btn.dataset.dir];
      if (d) move(d[0], d[1]);
    });

    $('#btnUndo').addEventListener('click', undo);
    $('#btnReset').addEventListener('click', reset);
    $('#btnPrev').addEventListener('click', () => {
      if (S.idx > 0) loadLevel(S.idx - 1);
    });
    $('#btnNext').addEventListener('click', () => {
      if (S.idx < LEVELS.length - 1) loadLevel(S.idx + 1);
    });

    $('#levels').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-lv]');
      if (chip) loadLevel(Number(chip.dataset.lv));
    });

    $('#btnWinNext').addEventListener('click', () => {
      hideWin();
      loadLevel(S.idx === LEVELS.length - 1 ? 0 : S.idx + 1);
      if (S.idx === 0) toast('回到第一关，再来一轮');
    });
    $('#btnWinReplay').addEventListener('click', () => {
      hideWin();
      reset();
    });
    $('#btnWinClose').addEventListener('click', hideWin);

    $('#winModal').addEventListener('click', (e) => {
      if (e.target === $('#winModal')) hideWin();
    });

    /* 滑动 */
    let start = null;
    const board = $('#board');
    board.addEventListener('pointerdown', (e) => {
      start = { x: e.clientX, y: e.clientY };
    });
    board.addEventListener('pointerup', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
      else move(0, dy > 0 ? 1 : -1);
    });
    board.addEventListener('pointercancel', () => {
      start = null;
    });

    window.addEventListener('resize', layout);
  }

  function init() {
    if (!LEVELS.length) {
      toast('关卡加载失败');
      return;
    }
    bind();
    loadLevel(save.level || 0);
  }

  init();
})();
