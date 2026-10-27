'use strict';

/* =========================================================
   2048
   ========================================================= */

(function () {
  const SIZE = 4;
  const BEST_KEY = 'gn2048.best.v1';
  const STATE_KEY = 'gn2048.state.v1';

  const $ = (s) => document.querySelector(s);
  const boardEl = $('#board');
  const tilesEl = $('#tiles');
  const overlay = $('#overlay');

  let grid = [];
  let seq = 0;
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  let history = null;
  let animating = false;
  let won = false;
  let over = false;
  let gap = 12;
  let cell = 0;

  /* ---------------- 基础 ---------------- */

  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));
  }

  function makeTile(value, r, c) {
    seq += 1;
    return { id: seq, value, r, c, merged: false };
  }

  function tiles() {
    const list = [];
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (grid[r][c]) list.push(grid[r][c]);
      }
    }
    return list;
  }

  function emptyCells() {
    const list = [];
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (!grid[r][c]) list.push({ r, c });
      }
    }
    return list;
  }

  function valueClass(v) {
    if (v > 2048) return 'vsuper';
    return 'v' + v;
  }

  function fontSize(v, size) {
    const digits = String(v).length;
    const factor = digits <= 2 ? 0.44 : digits === 3 ? 0.36 : digits === 4 ? 0.29 : digits === 5 ? 0.24 : 0.2;
    return Math.round(size * factor);
  }

  /* ---------------- DOM ---------------- */

  function createEl(tile) {
    const el = document.createElement('div');
    el.className = 'tile appear';
    el.dataset.id = String(tile.id);
    const face = document.createElement('span');
    face.className = 'face';
    el.appendChild(face);
    el._tile = tile;
    tile.el = el;
    tilesEl.appendChild(el);
    paint(tile);
    place(tile);
    setTimeout(() => el.classList.remove('appear'), 200);
  }

  function paint(tile) {
    const face = tile.el.querySelector('.face');
    face.textContent = String(tile.value);
    face.className = 'face ' + valueClass(tile.value);
    face.style.fontSize = fontSize(tile.value, cell) + 'px';
  }

  function place(tile) {
    const x = gap + tile.c * (cell + gap);
    const y = gap + tile.r * (cell + gap);
    tile.el.style.width = cell + 'px';
    tile.el.style.height = cell + 'px';
    tile.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function layout() {
    const w = boardEl.clientWidth;
    if (!w) return;
    gap = Math.max(7, Math.round(w * 0.024));
    cell = (w - gap * (SIZE + 1)) / SIZE;
    boardEl.style.setProperty('--gap', gap + 'px');
    Array.from(tilesEl.children).forEach((el) => {
      const t = el._tile;
      if (!t) return;
      paint(t);
      place(t);
    });
  }

  function renderAll() {
    tilesEl.innerHTML = '';
    tiles().forEach((t) => {
      createEl(t);
    });
    layout();
  }

  /* ---------------- 状态 ---------------- */

  function snapshot() {
    return {
      grid: grid.map((row) => row.map((t) => (t ? t.value : 0))),
      score,
      won
    };
  }

  function restore(snap) {
    grid = emptyGrid();
    seq = 0;
    snap.grid.forEach((row, r) => {
      row.forEach((v, c) => {
        if (v) grid[r][c] = makeTile(v, r, c);
      });
    });
    score = snap.score;
    won = Boolean(snap.won);
    over = false;
    history = null;
    renderAll();
    updateHud();
    hideOverlay();
    save();
  }

  function save() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(snapshot()));
      localStorage.setItem(BEST_KEY, String(best));
    } catch {
      /* ignore */
    }
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      if (!snap || !Array.isArray(snap.grid)) return null;
      return snap;
    } catch {
      return null;
    }
  }

  /* ---------------- 生成 / 结算 ---------------- */

  function spawn() {
    const cells = emptyCells();
    if (!cells.length) return null;
    const spot = cells[Math.floor(Math.random() * cells.length)];
    const tile = makeTile(Math.random() < 0.9 ? 2 : 4, spot.r, spot.c);
    grid[spot.r][spot.c] = tile;
    createEl(tile);
    return tile;
  }

  function canMove() {
    if (emptyCells().length) return true;
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const v = grid[r][c].value;
        if (c + 1 < SIZE && grid[r][c + 1].value === v) return true;
        if (r + 1 < SIZE && grid[r + 1][c].value === v) return true;
      }
    }
    return false;
  }

  function updateHud() {
    $('#score').textContent = String(score);
    if (score > best) best = score;
    $('#best').textContent = String(best);
    $('#btnUndo').disabled = !history;
  }

  function showOverlay(emoji, title, text, mainText) {
    $('#ovEmoji').textContent = emoji;
    $('#ovTitle').textContent = title;
    $('#ovText').textContent = text;
    $('#ovMain').textContent = mainText;
    overlay.classList.add('show');
  }

  function hideOverlay() {
    overlay.classList.remove('show');
  }

  /* ---------------- 移动 ---------------- */

  function linesFor(dir) {
    const lines = [];
    if (dir === 'left' || dir === 'right') {
      for (let r = 0; r < SIZE; r += 1) {
        const row = [];
        for (let i = 0; i < SIZE; i += 1) {
          const c = dir === 'left' ? i : SIZE - 1 - i;
          row.push({ r, c });
        }
        lines.push(row);
      }
    } else {
      for (let c = 0; c < SIZE; c += 1) {
        const col = [];
        for (let i = 0; i < SIZE; i += 1) {
          const r = dir === 'up' ? i : SIZE - 1 - i;
          col.push({ r, c });
        }
        lines.push(col);
      }
    }
    return lines;
  }

  function move(dir) {
    if (animating || over) return;
    tiles().forEach((t) => {
      t.merged = false;
      t.dead = false;
    });

    const before = snapshot();
    let moved = false;
    let gained = 0;
    const dead = [];

    linesFor(dir).forEach((line) => {
      const list = line.map((p) => grid[p.r][p.c]).filter(Boolean);
      const out = [];
      for (let i = 0; i < list.length; i += 1) {
        const a = list[i];
        const b = list[i + 1];
        if (b && a.value === b.value && !a.merged) {
          a.value *= 2;
          a.merged = true;
          gained += a.value;
          b.dead = true;
          dead.push({ tile: b, into: a });
          out.push(a);
          i += 1;
        } else {
          out.push(a);
        }
      }
      line.forEach((p, i) => {
        const t = out[i] || null;
        grid[p.r][p.c] = t;
        if (t) {
          if (t.r !== p.r || t.c !== p.c) moved = true;
          t.r = p.r;
          t.c = p.c;
        }
      });
    });

    if (!moved && !gained) return;

    animating = true;
    history = before;
    score += gained;
    updateHud();

    // 先让所有方块滑到新位置（被吃掉的那块也滑过去）
    tiles().forEach(place);
    dead.forEach(({ tile, into }) => {
      tile.r = into.r;
      tile.c = into.c;
      place(tile);
    });

    setTimeout(() => {
      dead.forEach(({ tile }) => {
        if (tile.el && tile.el.parentNode) tile.el.parentNode.removeChild(tile.el);
      });
      tiles().forEach((t) => {
        if (t.merged) {
          paint(t);
          t.el.classList.add('pulse');
          setTimeout(() => t.el.classList.remove('pulse'), 200);
        }
      });

      const added = spawn();
      if (added) added.el.style.zIndex = '2';
      setTimeout(() => {
        if (added) added.el.style.zIndex = '';
      }, 200);

      animating = false;

      if (!won && tiles().some((t) => t.value >= 2048)) {
        won = true;
        save();
        showOverlay('🎉', '达成 2048', '继续挑战 4096 吧', '继续玩');
        return;
      }
      if (!canMove()) {
        over = true;
        save();
        showOverlay('😵', '没有可移动的了', `本局得分 ${score}`, '再来一局');
        return;
      }
      save();
    }, 110);
  }

  /* ---------------- 新局 / 撤销 ---------------- */

  function newGame() {
    grid = emptyGrid();
    seq = 0;
    score = 0;
    history = null;
    won = false;
    over = false;
    animating = false;
    tilesEl.innerHTML = '';
    hideOverlay();
    spawn();
    spawn();
    layout();
    updateHud();
    save();
  }

  function undo() {
    if (!history || animating) return;
    const snap = history;
    history = null;
    restore(snap);
    toast('已撤销一步');
  }

  /* ---------------- toast ---------------- */

  function toast(msg) {
    const stack = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 1600);
    while (stack.children.length > 2) stack.firstChild.remove();
  }

  /* ---------------- 输入 ---------------- */

  const KEY_MAP = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'up',
    s: 'down',
    a: 'left',
    d: 'right',
    W: 'up',
    S: 'down',
    A: 'left',
    D: 'right'
  };

  document.addEventListener('keydown', (e) => {
    const dir = KEY_MAP[e.key];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  });

  let touch = null;
  boardEl.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    { passive: true }
  );
  boardEl.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length === 1 && touch) e.preventDefault();
    },
    { passive: false }
  );
  boardEl.addEventListener(
    'touchend',
    (e) => {
      if (!touch) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touch.x;
      const dy = t.clientY - touch.y;
      touch = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
      else move(dy > 0 ? 'down' : 'up');
    },
    { passive: true }
  );

  $('#btnNew').addEventListener('click', newGame);
  $('#ovNew').addEventListener('click', newGame);
  $('#btnUndo').addEventListener('click', undo);
  $('#ovMain').addEventListener('click', () => {
    if (over) newGame();
    else hideOverlay();
  });

  window.addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(boardEl);

  /* ---------------- 初始化 ---------------- */

  (function init() {
    // 背景格
    const bg = $('#gridBg');
    for (let i = 0; i < SIZE * SIZE; i += 1) {
      const d = document.createElement('div');
      d.className = 'cell-bg';
      bg.appendChild(d);
    }

    const saved = loadSaved();
    if (saved && saved.grid.some((row) => row.some((v) => v))) {
      grid = emptyGrid();
      saved.grid.forEach((row, r) => {
        row.forEach((v, c) => {
          if (v) grid[r][c] = makeTile(v, r, c);
        });
      });
      score = saved.score || 0;
      won = Boolean(saved.won);
      over = !canMove();
      renderAll();
      updateHud();
      if (over) showOverlay('😵', '没有可移动的了', `本局得分 ${score}`, '再来一局');
    } else {
      newGame();
    }
  })();
})();
