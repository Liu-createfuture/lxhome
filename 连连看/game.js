'use strict';

/* =========================================================
   连连看
   规则：两个相同图案，连线拐弯不超过 2 次即可消除；
        连线可以绕到棋盘外圈。
   ========================================================= */

(function () {
  const COLS = 8;
  const ROWS = 6;
  const PAD = 1; // 外圈用于绕行
  const RING = 0.28; // 外圈宽度（相对一格的比例，与样式里的 0.28fr 对应）
  /* 用几何图形代替水果表情：纸墨风格里更干净，也更好认 */
  const EMOJIS = ['●', '■', '▲', '◆', '▼', '◀', '▶', '✚', '✦', '▣', '◐', '⬢'];
  const TOTAL_TIME = 180;
  const HINT_MAX = 3;
  const SHUFFLE_MAX = 2;

  const $ = (s) => document.querySelector(s);

  const state = {
    grid: [],
    sel: null,
    pairsLeft: 0,
    score: 0,
    hintLeft: HINT_MAX,
    shuffleLeft: SHUFFLE_MAX,
    timeLeft: TOTAL_TIME,
    running: false,
    timer: null,
    locked: false
  };

  const tiles = new Map(); // "r-c" -> element

  /* ---------------- 音效 ---------------- */

  let audioCtx = null;
  function beep(freq, dur) {
    try {
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = audioCtx.currentTime;
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch {
      /* ignore */
    }
  }

  function toast(msg) {
    const stack = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 1900);
    while (stack.children.length > 2) stack.firstChild.remove();
  }

  /* ---------------- 棋盘数据 ---------------- */

  function makeGrid() {
    const values = [];
    for (let i = 0; i < (COLS * ROWS) / 2; i += 1) {
      const v = EMOJIS[i % EMOJIS.length];
      values.push(v, v);
    }
    shuffleArray(values);

    const grid = [];
    for (let r = 0; r < ROWS + PAD * 2; r += 1) {
      const row = [];
      for (let c = 0; c < COLS + PAD * 2; c += 1) {
        const inner = r >= PAD && r < ROWS + PAD && c >= PAD && c < COLS + PAD;
        row.push(inner ? values[(r - PAD) * COLS + (c - PAD)] : null);
      }
      grid.push(row);
    }
    return grid;
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function isFree(r, c) {
    if (r < 0 || c < 0 || r >= ROWS + PAD * 2 || c >= COLS + PAD * 2) return false;
    return state.grid[r][c] === null;
  }

  function hClear(r, c1, c2) {
    const from = Math.min(c1, c2) + 1;
    const to = Math.max(c1, c2);
    for (let c = from; c < to; c += 1) if (!isFree(r, c)) return false;
    return true;
  }

  function vClear(c, r1, r2) {
    const from = Math.min(r1, r2) + 1;
    const to = Math.max(r1, r2);
    for (let r = from; r < to; r += 1) if (!isFree(r, c)) return false;
    return true;
  }

  /* 返回连线经过的坐标点数组，找不到返回 null */
  function findPath(a, b) {
    if (a.r === b.r && hClear(a.r, a.c, b.c)) return [a, b];
    if (a.c === b.c && vClear(a.c, a.r, b.r)) return [a, b];

    // 一个拐点
    if (isFree(a.r, b.c) && hClear(a.r, a.c, b.c) && vClear(b.c, a.r, b.r)) {
      return [a, { r: a.r, c: b.c }, b];
    }
    if (isFree(b.r, a.c) && vClear(a.c, a.r, b.r) && hClear(b.r, a.c, b.c)) {
      return [a, { r: b.r, c: a.c }, b];
    }

    // 两个拐点：先横后竖
    for (let r = 0; r < ROWS + PAD * 2; r += 1) {
      if (r === a.r || r === b.r) continue;
      if (!isFree(r, a.c) || !isFree(r, b.c)) continue;
      if (vClear(a.c, a.r, r) && hClear(r, a.c, b.c) && vClear(b.c, r, b.r)) {
        return [a, { r, c: a.c }, { r, c: b.c }, b];
      }
    }
    // 两个拐点：先竖后横
    for (let c = 0; c < COLS + PAD * 2; c += 1) {
      if (c === a.c || c === b.c) continue;
      if (!isFree(a.r, c) || !isFree(b.r, c)) continue;
      if (hClear(a.r, a.c, c) && vClear(c, a.r, b.r) && hClear(b.r, c, b.c)) {
        return [a, { r: a.r, c }, { r: b.r, c }, b];
      }
    }
    return null;
  }

  function allPairs() {
    const byValue = new Map();
    for (let r = 0; r < ROWS + PAD * 2; r += 1) {
      for (let c = 0; c < COLS + PAD * 2; c += 1) {
        const v = state.grid[r][c];
        if (!v) continue;
        if (!byValue.has(v)) byValue.set(v, []);
        byValue.get(v).push({ r, c });
      }
    }
    return Array.from(byValue.values());
  }

  function findAnyMatch() {
    const groups = allPairs();
    for (const list of groups) {
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const path = findPath(list[i], list[j]);
          if (path) return { a: list[i], b: list[j], path };
        }
      }
    }
    return null;
  }

  /* ---------------- 渲染 ---------------- */

  function render() {
    const board = $('#board');
    board.innerHTML = '';
    tiles.clear();

    for (let r = 0; r < ROWS + PAD * 2; r += 1) {
      for (let c = 0; c < COLS + PAD * 2; c += 1) {
        const v = state.grid[r][c];
        const cell = document.createElement('div');
        cell.className = 'cell';

        if (v) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'tile';
          btn.textContent = v;
          btn.setAttribute('aria-label', '图案 ' + v);
          if (state.sel && state.sel.r === r && state.sel.c === c) btn.classList.add('sel');
          btn.addEventListener('click', () => onTileClick(r, c));
          cell.appendChild(btn);
          tiles.set(`${r}-${c}`, btn);
        } else {
          cell.classList.add('void');
        }
        board.appendChild(cell);
      }
    }
  }

  function markSelection() {
    tiles.forEach((el) => el.classList.remove('sel'));
    if (!state.sel) return;
    const el = tiles.get(`${state.sel.r}-${state.sel.c}`);
    if (el) el.classList.add('sel');
  }

  function drawPath(points) {
    const svg = $('#paths');
    svg.innerHTML = '';
    if (!points || points.length < 2) return;

    const cx = (c) => (c === 0 ? RING / 2 : c === COLS + 1 ? RING + COLS + RING / 2 : RING + c - 1 + 0.5);
    const cy = (r) => (r === 0 ? RING / 2 : r === ROWS + 1 ? RING + ROWS + RING / 2 : RING + r - 1 + 0.5);

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', points.map((p) => `${cx(p.c).toFixed(2)},${cy(p.r).toFixed(2)}`).join(' '));
    svg.appendChild(poly);

    const len = poly.getTotalLength ? poly.getTotalLength() : 0;
    if (len) {
      poly.style.strokeDasharray = String(len);
      poly.style.strokeDashoffset = String(len);
      poly.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
        duration: 160,
        easing: 'ease-out',
        fill: 'forwards'
      });
    }

    setTimeout(() => {
      if (poly.parentNode === svg) svg.innerHTML = '';
    }, 320);
  }

  /* ---------------- 交互 ---------------- */

  function onTileClick(r, c) {
    if (!state.running || state.locked) return;
    if (!state.grid[r][c]) return;

    if (!state.sel) {
      state.sel = { r, c };
      markSelection();
      beep(520, 0.06);
      return;
    }

    if (state.sel.r === r && state.sel.c === c) {
      state.sel = null;
      markSelection();
      return;
    }

    if (state.grid[state.sel.r][state.sel.c] !== state.grid[r][c]) {
      state.sel = { r, c };
      markSelection();
      beep(520, 0.06);
      return;
    }

    const path = findPath(state.sel, { r, c });
    if (!path) {
      beep(200, 0.12);
      const a = tiles.get(`${state.sel.r}-${state.sel.c}`);
      const b = tiles.get(`${r}-${c}`);
      [a, b].forEach((el) => {
        if (!el) return;
        el.animate(
          [
            { transform: 'translateX(-2px)' },
            { transform: 'translateX(2px)' },
            { transform: 'translateX(0)' }
          ],
          { duration: 180 }
        );
      });
      state.sel = { r, c };
      markSelection();
      return;
    }

    removePair(state.sel, { r, c }, path);
  }

  function removePair(a, b, path) {
    state.locked = true;
    const elA = tiles.get(`${a.r}-${a.c}`);
    const elB = tiles.get(`${b.r}-${b.c}`);
    [elA, elB].forEach((el) => el && el.classList.add('gone'));
    drawPath(path);
    beep(680, 0.1);

    setTimeout(() => {
      state.grid[a.r][a.c] = null;
      state.grid[b.r][b.c] = null;
      state.sel = null;
      state.pairsLeft -= 1;
      state.score += 10;
      updateHud();
      render();
      state.locked = false;

      if (state.pairsLeft === 0) {
        win();
        return;
      }
      if (!findAnyMatch()) {
        toast('没有可连的了，自动重排');
        doShuffle(false);
      }
    }, 180);
  }

  /* ---------------- 换位 / 提示 ---------------- */

  function doShuffle(manual) {
    if (manual) {
      if (state.shuffleLeft <= 0) return;
      state.shuffleLeft -= 1;
    }
    const spots = [];
    const values = [];
    for (let r = 0; r < ROWS + PAD * 2; r += 1) {
      for (let c = 0; c < COLS + PAD * 2; c += 1) {
        if (state.grid[r][c]) {
          spots.push({ r, c });
          values.push(state.grid[r][c]);
        }
      }
    }

    let tries = 0;
    do {
      shuffleArray(values);
      spots.forEach((p, i) => {
        state.grid[p.r][p.c] = values[i];
      });
      tries += 1;
    } while (!findAnyMatch() && tries < 40);

    state.sel = null;
    updateHud();
    render();
    if (manual) toast('已重排');
  }

  function useHint() {
    if (!state.running || state.hintLeft <= 0) return;
    const hit = findAnyMatch();
    if (!hit) {
      toast('暂时没有可连的');
      return;
    }
    state.hintLeft -= 1;
    state.score = Math.max(0, state.score - 5);
    updateHud();
    [hit.a, hit.b].forEach((p) => {
      const el = tiles.get(`${p.r}-${p.c}`);
      if (!el) return;
      el.classList.add('hint');
      setTimeout(() => el.classList.remove('hint'), 1900);
    });
  }

  /* ---------------- 计时与结算 ---------------- */

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateHud() {
    $('#pairsLeft').textContent = String(state.pairsLeft);
    $('#score').textContent = String(state.score);
    $('#timer').textContent = fmt(state.timeLeft);
    $('#hintLeft').textContent = String(state.hintLeft);
    $('#shuffleLeft').textContent = String(state.shuffleLeft);
    $('#timer').parentNode.classList.toggle('warn', state.timeLeft <= 20);
    $('#btnHint').disabled = state.hintLeft <= 0 || !state.running;
    $('#btnShuffle').disabled = state.shuffleLeft <= 0 || !state.running;
  }

  function startTimer() {
    clearInterval(state.timer);
    state.timer = setInterval(() => {
      if (!state.running) return;
      state.timeLeft -= 1;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        updateHud();
        lose();
        return;
      }
      updateHud();
    }, 1000);
  }

  function stopTimer() {
    clearInterval(state.timer);
    state.timer = null;
  }

  function win() {
    state.running = false;
    stopTimer();
    const bonus = state.timeLeft * 2;
    state.score += bonus;
    updateHud();
    beep(880, 0.25);
    showModal('🎉', '全部消除', `用时 ${fmt(TOTAL_TIME - state.timeLeft)} · 得分 ${state.score}（含时间奖励 ${bonus}）`);
  }

  function lose() {
    state.running = false;
    stopTimer();
    beep(180, 0.35);
    showModal('⏰', '时间到', `还剩 ${state.pairsLeft} 对没消 · 得分 ${state.score}`);
  }

  function showModal(emoji, title, text) {
    $('#modalEmoji').textContent = emoji;
    $('#modalTitle').textContent = title;
    $('#modalText').textContent = text;
    $('#modal').classList.add('show');
    $('#modal').setAttribute('aria-hidden', 'false');
  }

  function hideModal() {
    $('#modal').classList.remove('show');
    $('#modal').setAttribute('aria-hidden', 'true');
  }

  /* ---------------- 开局 ---------------- */

  function newGame() {
    hideModal();
    stopTimer();
    state.grid = makeGrid();
    state.sel = null;
    state.pairsLeft = (COLS * ROWS) / 2;
    state.score = 0;
    state.hintLeft = HINT_MAX;
    state.shuffleLeft = SHUFFLE_MAX;
    state.timeLeft = TOTAL_TIME;
    state.running = true;
    state.locked = false;

    // 保证开局至少有一组可连
    let tries = 0;
    while (!findAnyMatch() && tries < 40) {
      state.grid = makeGrid();
      tries += 1;
    }

    render();
    updateHud();
    startTimer();
  }

  /* ---------------- 绑定 ---------------- */

  $('#btnHint').addEventListener('click', useHint);
  $('#btnShuffle').addEventListener('click', () => doShuffle(true));
  $('#btnRestart').addEventListener('click', newGame);
  $('#btnAgain').addEventListener('click', newGame);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideModal();
    if (e.key === 'h' || e.key === 'H') useHint();
    if (e.key === 'r' || e.key === 'R') doShuffle(true);
  });

  newGame();
})();
