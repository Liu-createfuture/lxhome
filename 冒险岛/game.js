/* =========================================================
   冒险岛 · 横版跳跃
   Canvas 渲染，纯前端，无依赖
   ========================================================= */

(function () {
  'use strict';

  const W = 960;
  const H = 540;
  const GY = 470; // 地面顶部
  const GRAV = 2300;
  const MOVE = 300;
  const ACC = 2200;
  const FRICTION = 2600;
  const JUMP = 760;
  const MAX_FALL = 1250;
  const SAVE_KEY = 'adventure.v1';

  const $ = (sel) => document.querySelector(sel);
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');

  /* ---------------- 关卡 ---------------- */

  const LEVELS = [
    {
      name: '青草坡',
      width: 2600,
      sky: ['#bfe9ff', '#e9f8ff'],
      hill: '#8ec9a8',
      hill2: '#6fb894',
      ground: [
        [0, 760],
        [880, 1500],
        [1620, 2600]
      ],
      platforms: [
        [300, 380, 150],
        [520, 315, 120],
        [1040, 380, 150],
        [1280, 325, 110],
        [1700, 372, 140],
        [1960, 318, 120],
        [2220, 380, 150]
      ],
      spikes: [[1180, 100]],
      enemies: [
        { x: 620, from: 580, to: 740 },
        { x: 1900, from: 1720, to: 2050 }
      ],
      coins: [
        [340, 330],
        [385, 330],
        [560, 262],
        [1080, 330],
        [1125, 330],
        [1318, 272],
        [1745, 320],
        [2000, 264],
        [2258, 330],
        [2303, 330]
      ],
      checkpoints: [1620],
      goal: 2480
    },
    {
      name: '风车谷',
      width: 3000,
      sky: ['#cfe8ff', '#f2fbff'],
      hill: '#9ecbe0',
      hill2: '#7fb6d0',
      ground: [
        [0, 620],
        [740, 1180],
        [1300, 1900],
        [2020, 3000]
      ],
      platforms: [
        [220, 382, 120],
        [420, 318, 100],
        [820, 362, 140],
        [1060, 300, 120],
        [1360, 372, 130],
        [1560, 300, 110],
        [1760, 238, 100],
        [2100, 372, 140],
        [2330, 310, 130],
        [2570, 362, 120]
      ],
      spikes: [
        [1640, 90],
        [2400, 110]
      ],
      enemies: [
        { x: 480, from: 300, to: 600 },
        { x: 1500, from: 1340, to: 1860 },
        { x: 2200, from: 2060, to: 2360 }
      ],
      coins: [
        [262, 330],
        [458, 266],
        [860, 310],
        [1098, 248],
        [1400, 320],
        [1600, 248],
        [1800, 186],
        [2140, 320],
        [2370, 258],
        [2610, 310],
        [2050, 420],
        [2700, 420]
      ],
      checkpoints: [1300, 2020],
      goal: 2870
    },
    {
      name: '落日海岸',
      width: 3400,
      sky: ['#ffd9b0', '#ffeede'],
      hill: '#e8b98f',
      hill2: '#cf9a72',
      ground: [
        [0, 560],
        [680, 1000],
        [1120, 1620],
        [1740, 2300],
        [2420, 3400]
      ],
      platforms: [
        [180, 378, 140],
        [400, 312, 110],
        [740, 360, 130],
        [980, 296, 120],
        [1180, 372, 120],
        [1380, 306, 120],
        [1560, 246, 110],
        [1800, 372, 140],
        [2020, 306, 120],
        [2240, 360, 130],
        [2480, 300, 130],
        [2700, 366, 120],
        [2940, 306, 120]
      ],
      spikes: [
        [1250, 100],
        [2060, 100],
        [2860, 110]
      ],
      enemies: [
        { x: 420, from: 240, to: 540 },
        { x: 900, from: 720, to: 980 },
        { x: 1480, from: 1200, to: 1600 },
        { x: 1980, from: 1760, to: 2280 },
        { x: 2620, from: 2440, to: 2760 }
      ],
      coins: [
        [222, 326],
        [440, 260],
        [782, 308],
        [1020, 244],
        [1220, 320],
        [1420, 254],
        [1600, 194],
        [1844, 320],
        [2064, 254],
        [2284, 308],
        [2524, 248],
        [2744, 314],
        [2984, 254],
        [3300, 420]
      ],
      checkpoints: [1120, 1740, 2420],
      goal: 3280
    }
  ];

  /* ---------------- 状态 ---------------- */

  const state = {
    stage: 0,
    lives: 3,
    coins: 0,
    level: null,
    solids: [],
    spikes: [],
    coinsList: [],
    enemies: [],
    checkpoints: [],
    particles: [],
    cam: 0,
    phase: 'play', // play | win | over
    time: 0,
    spawn: { x: 60, y: 300 },
    checkpoint: { x: 60, y: 300 }
  };

  const P = {
    x: 60,
    y: 300,
    w: 28,
    h: 36,
    vx: 0,
    vy: 0,
    onGround: false,
    face: 1,
    coyote: 0,
    buffer: 0,
    invuln: 0,
    squash: 0,
    runT: 0
  };

  const input = { left: false, right: false, jumpHeld: false };

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
      const map = {
        jump: [520, 0.12, 'sine'],
        coin: [880, 0.1, 'triangle'],
        stomp: [260, 0.12, 'square'],
        hurt: [160, 0.3, 'sawtooth'],
        win: [740, 0.45, 'triangle']
      };
      const [freq, dur, type] = map[kind] || map.coin;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (kind === 'win') osc.frequency.exponentialRampToValueAtTime(1180, t + dur * 0.8);
      if (kind === 'hurt') osc.frequency.exponentialRampToValueAtTime(80, t + dur);
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      /* ignore */
    }
  }

  /* ---------------- 存档 ---------------- */

  function loadSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (d && Number.isFinite(d.stage)) {
        return { stage: Math.max(0, Math.min(LEVELS.length - 1, d.stage)) };
      }
    } catch {
      /* ignore */
    }
    return { stage: 0 };
  }

  const save = loadSave();

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ stage: state.stage }));
    } catch {
      /* ignore */
    }
  }

  /* ---------------- 关卡装载 ---------------- */

  function loadStage(idx) {
    state.stage = Math.max(0, Math.min(LEVELS.length - 1, idx));
    const lv = LEVELS[state.stage];
    state.level = lv;
    state.solids = [];
    state.spikes = [];
    state.coinsList = [];
    state.enemies = [];
    state.particles = [];
    state.cam = 0;
    state.coins = 0;
    state.lives = 3;
    state.phase = 'play';

    lv.ground.forEach(([a, b]) => {
      state.solids.push({ x: a, y: GY, w: b - a, h: H - GY + 60 });
    });
    lv.platforms.forEach(([x, y, w]) => {
      state.solids.push({ x, y, w, h: 18 });
    });
    lv.spikes.forEach(([x, w]) => {
      state.spikes.push({ x, y: GY - 14, w, h: 14 });
    });
    lv.coins.forEach(([x, y]) => {
      state.coinsList.push({ x, y, taken: false, t: Math.random() * 6 });
    });
    lv.enemies.forEach((e) => {
      state.enemies.push({
        x: e.x,
        y: GY - 30,
        w: 34,
        h: 30,
        from: e.from,
        to: e.to,
        dir: 1,
        alive: true,
        squash: 0,
        t: Math.random() * 6
      });
    });
    state.checkpoints = lv.checkpoints.map((x) => ({ x, taken: false }));

    state.spawn = { x: 60, y: GY - P.h - 4 };
    state.checkpoint = { ...state.spawn };
    respawn(true);

    $('#stageName').textContent = `第 ${state.stage + 1} 关`;
    $('#stageValue').textContent = lv.name;
    updateHud();
    hideModal();
    persist();
  }

  function respawn(silent) {
    P.x = state.checkpoint.x;
    P.y = state.checkpoint.y;
    P.vx = 0;
    P.vy = 0;
    P.onGround = false;
    P.invuln = silent ? 0 : 1.6;
    state.cam = Math.max(0, Math.min(state.level.width - W, P.x - W * 0.38));
    if (!silent) flash();
  }

  function updateHud() {
    $('#coins').textContent = String(state.coins);
    $('#lives').textContent = state.lives > 0 ? '❤'.repeat(state.lives) : '—';
  }

  function flash() {
    const el = $('#flash');
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
  }

  /* ---------------- 物理 ---------------- */

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function moveX(dx) {
    P.x += dx;
    for (const s of state.solids) {
      if (!overlaps(P, s)) continue;
      if (dx > 0) P.x = s.x - P.w;
      else if (dx < 0) P.x = s.x + s.w;
      P.vx = 0;
    }
  }

  function moveY(dy) {
    P.y += dy;
    P.onGround = false;
    for (const s of state.solids) {
      if (!overlaps(P, s)) continue;
      if (dy > 0) {
        P.y = s.y - P.h;
        if (P.vy > 420) P.squash = 1;
        P.vy = 0;
        P.onGround = true;
      } else if (dy < 0) {
        P.y = s.y + s.h;
        P.vy = 0;
      }
    }
  }

  function jump() {
    P.vy = -JUMP;
    P.onGround = false;
    P.coyote = 0;
    P.squash = -1;
    beep('jump');
    burst(P.x + P.w / 2, P.y + P.h, 6, '#ffffff', 1.2);
  }

  function updatePlayer(dt) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      P.vx += dir * ACC * dt;
      P.vx = Math.max(-MOVE, Math.min(MOVE, P.vx));
      P.face = dir;
      P.runT += dt * 10;
    } else {
      const f = FRICTION * dt;
      if (Math.abs(P.vx) <= f) P.vx = 0;
      else P.vx -= Math.sign(P.vx) * f;
    }

    P.vy = Math.min(MAX_FALL, P.vy + GRAV * dt);

    P.coyote = P.onGround ? 0.1 : Math.max(0, P.coyote - dt);
    P.buffer = Math.max(0, P.buffer - dt);
    if (P.buffer > 0 && (P.onGround || P.coyote > 0)) {
      P.buffer = 0;
      jump();
    }

    moveX(P.vx * dt);
    moveY(P.vy * dt);

    if (P.x < 0) P.x = 0;
    if (P.x + P.w > state.level.width) P.x = state.level.width - P.w;

    P.squash *= Math.max(0, 1 - dt * 8);
    P.invuln = Math.max(0, P.invuln - dt);

    /* 掉出画面 / 踩到尖刺 */
    if (P.y > H + 80) hurt(true);
    else if (P.onGround) checkSpikes();
  }

  function updateEnemies(dt) {
    state.enemies.forEach((e) => {
      if (!e.alive) {
        e.squash = Math.max(0, e.squash - dt * 3);
        return;
      }
      e.t += dt;
      e.x += e.dir * 58 * dt;
      if (e.x < e.from) {
        e.x = e.from;
        e.dir = 1;
      }
      if (e.x + e.w > e.to) {
        e.x = e.to - e.w;
        e.dir = -1;
      }

      if (P.invuln > 0 || state.phase !== 'play') return;
      if (!overlaps(P, e)) return;

      const stomping = P.vy > 60 && P.y + P.h - e.y < 22;
      if (stomping) {
        e.alive = false;
        e.squash = 1;
        P.vy = -560;
        P.buffer = 0;
        beep('stomp');
        burst(e.x + e.w / 2, e.y + 6, 8, '#9dffb0', 2);
      } else {
        hurt(false);
      }
    });
  }

  function checkSpikes() {
    const feet = { x: P.x + 3, y: P.y + P.h - 8, w: P.w - 6, h: 8 };
    for (const s of state.spikes) {
      if (overlaps(feet, s)) {
        hurt(true);
        return;
      }
    }
  }

  function hurt(fell) {
    if (state.phase !== 'play' || P.invuln > 0) return;
    if (!fell) {
      beep('hurt');
      P.invuln = 1.6;
      P.vx = -P.face * 220;
      P.vy = -320;
      flash();
    } else {
      beep('hurt');
      flash();
    }
    state.lives -= 1;
    updateHud();
    if (state.lives <= 0) {
      gameOver();
      return;
    }
    if (fell) respawn(false);
  }

  function collectCoins(dt) {
    state.coinsList.forEach((c) => {
      if (c.taken) return;
      c.t += dt;
      const box = { x: c.x - 12, y: c.y - 12, w: 24, h: 24 };
      if (!overlaps(P, box)) return;
      c.taken = true;
      state.coins += 1;
      updateHud();
      beep('coin');
      burst(c.x, c.y, 7, '#ffd76a', 1.6);
    });
  }

  function checkProgress() {
    state.checkpoints.forEach((cp) => {
      if (cp.taken) return;
      if (P.x > cp.x) {
        cp.taken = true;
        state.checkpoint = { x: cp.x, y: GY - P.h - 4 };
      }
    });
    if (P.x + P.w > state.level.goal) win();
  }

  /* ---------------- 粒子 ---------------- */

  function burst(x, y, n, color, power) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random()) * 160 * (power || 1);
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: 0.5 + Math.random() * 0.4,
        max: 0.9,
        size: 2 + Math.random() * 3,
        color
      });
    }
  }

  function updateParticles(dt) {
    state.particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 900 * dt;
    });
    state.particles = state.particles.filter((p) => p.life > 0);
  }

  /* ---------------- 结算 ---------------- */

  function win() {
    if (state.phase !== 'play') return;
    state.phase = 'win';
    beep('win');
    const last = state.stage === LEVELS.length - 1;
    $('#moEmoji').textContent = last ? '🏆' : '🏁';
    $('#moTitle').textContent = last ? '全部通关！' : '过关！';
    $('#moText').innerHTML = `${state.level.name} · 收集 <b>${state.coins}</b> 枚金币${
      last ? '<br />三座岛都走完了，厉害' : ''
    }`;
    $('#moMain').textContent = last ? '回到第一关' : '下一关';
    $('#moAlt').textContent = '重玩本关';
    showModal();
    save.stage = last ? 0 : state.stage + 1;
    persist();
  }

  function gameOver() {
    state.phase = 'over';
    $('#moEmoji').textContent = '💀';
    $('#moTitle').textContent = '生命用完了';
    $('#moText').innerHTML = `本关收集了 <b>${state.coins}</b> 枚金币，再来一次吧`;
    $('#moMain').textContent = '重玩本关';
    $('#moAlt').textContent = '回大厅';
    showModal();
  }

  function showModal() {
    $('#modal').classList.add('show');
    $('#modal').setAttribute('aria-hidden', 'false');
  }

  function hideModal() {
    $('#modal').classList.remove('show');
    $('#modal').setAttribute('aria-hidden', 'true');
  }

  /* ---------------- 渲染 ---------------- */

  function rr(x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function drawSky() {
    const lv = state.level;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, lv.sky[0]);
    g.addColorStop(1, lv.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* 太阳 */
    const sunX = W * 0.78;
    const sunY = 96;
    const sg = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 90);
    sg.addColorStop(0, 'rgba(255,246,214,0.95)');
    sg.addColorStop(0.35, 'rgba(255,235,170,0.55)');
    sg.addColorStop(1, 'rgba(255,235,170,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,252,235,0.95)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 30, 0, Math.PI * 2);
    ctx.fill();

    /* 云 */
    const t = state.time;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    const clouds = [
      [0.1, 0.18, 1.0],
      [0.45, 0.1, 0.72],
      [0.72, 0.24, 0.86],
      [0.9, 0.14, 0.6]
    ];
    clouds.forEach(([cx, cy, s], i) => {
      const drift = ((t * (8 + i * 4) + cx * 900) % (W + 400)) - 200;
      const x = (cx * W + drift * 0.25) % (W + 300) - 150;
      const y = cy * H;
      ctx.beginPath();
      ctx.arc(x, y, 34 * s, 0, Math.PI * 2);
      ctx.arc(x + 38 * s, y + 8 * s, 26 * s, 0, Math.PI * 2);
      ctx.arc(x - 36 * s, y + 10 * s, 24 * s, 0, Math.PI * 2);
      ctx.arc(x + 8 * s, y - 18 * s, 26 * s, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawHills() {
    const lv = state.level;
    const cam = state.cam;
    const bands = [
      { p: 0.22, y: 300, amp: 60, color: lv.hill, step: 320 },
      { p: 0.4, y: 350, amp: 74, color: lv.hill2, step: 260 }
    ];
    bands.forEach((b) => {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(0, H);
      const off = -cam * b.p;
      const start = Math.floor(-off / b.step) * b.step;
      for (let x = start - b.step; x < start + W + b.step * 2; x += b.step) {
        const sx = x + off;
        ctx.quadraticCurveTo(sx + b.step / 2, b.y - b.amp, sx + b.step, b.y + 40);
        ctx.lineTo(sx + b.step, H);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    });

    /* 树影 */
    ctx.fillStyle = 'rgba(60,120,96,0.28)';
    const off = -cam * 0.55;
    for (let i = 0; i < 16; i += 1) {
      const bx = ((i * 190 + off) % (W + 300)) - 150;
      const hh = 60 + ((i * 37) % 42);
      ctx.beginPath();
      ctx.moveTo(bx, GY - 10);
      ctx.lineTo(bx + 26, GY - 10 - hh);
      ctx.lineTo(bx + 52, GY - 10);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawGround() {
    const lv = state.level;
    lv.ground.forEach(([a, b]) => {
      const x = a - state.cam;
      if (x > W || x + (b - a) < 0) return;
      const w = b - a;
      /* 土 */
      const g = ctx.createLinearGradient(0, GY, 0, H);
      g.addColorStop(0, '#a9743f');
      g.addColorStop(1, '#7d5129');
      ctx.fillStyle = g;
      rr(x, GY, w, H - GY + 40, 10);
      ctx.fill();
      /* 草皮 */
      const gg = ctx.createLinearGradient(0, GY - 8, 0, GY + 14);
      gg.addColorStop(0, '#8ad98a');
      gg.addColorStop(1, '#4fae62');
      ctx.fillStyle = gg;
      rr(x, GY - 8, w, 22, 9);
      ctx.fill();
      /* 草簇 */
      for (let i = 10; i < w - 10; i += 34) {
        const hx = x + i + ((i * 7) % 13);
        ctx.strokeStyle = 'rgba(60,140,80,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hx, GY - 6);
        ctx.quadraticCurveTo(hx - 3, GY - 12, hx - 4, GY - 16);
        ctx.moveTo(hx + 2, GY - 6);
        ctx.quadraticCurveTo(hx + 5, GY - 12, hx + 6, GY - 15);
        ctx.stroke();
        if ((i / 34) % 5 === 2) {
          ctx.fillStyle = '#ffe27a';
          ctx.beginPath();
          ctx.arc(hx + 2, GY - 15, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    /* 浮空平台 */
    lv.platforms.forEach(([px, py, pw]) => {
      const x = px - state.cam;
      if (x > W || x + pw < 0) return;
      ctx.fillStyle = 'rgba(70,45,25,0.18)';
      rr(x + 3, py + 6, pw, 18, 8);
      ctx.fill();
      ctx.fillStyle = '#9c6b3d';
      rr(x, py, pw, 18, 8);
      ctx.fill();
      const g = ctx.createLinearGradient(0, py - 8, 0, py + 8);
      g.addColorStop(0, '#8ad98a');
      g.addColorStop(1, '#4fae62');
      ctx.fillStyle = g;
      rr(x, py - 6, pw, 12, 6);
      ctx.fill();
    });
  }

  function drawSpikes() {
    state.spikes.forEach((s) => {
      const x = s.x - state.cam;
      if (x > W || x + s.w < 0) return;
      /* 底座 */
      ctx.fillStyle = '#5b6675';
      rr(x, s.y + s.h - 5, s.w, 6, 3);
      ctx.fill();
      const n = Math.max(2, Math.floor(s.w / 18));
      const step = s.w / n;
      for (let i = 0; i < n; i += 1) {
        const bx = x + i * step;
        const g = ctx.createLinearGradient(bx, s.y - 6, bx + step, s.y + s.h);
        g.addColorStop(0, '#dfe8f2');
        g.addColorStop(0.5, '#93a5ba');
        g.addColorStop(1, '#525f70');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(bx + 1, s.y + s.h - 4);
        ctx.lineTo(bx + step / 2, s.y - 6);
        ctx.lineTo(bx + step - 1, s.y + s.h - 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + step / 2, s.y - 5);
        ctx.lineTo(bx + step / 2 - 2, s.y + s.h - 6);
        ctx.stroke();
      }
    });
  }

  function drawCoins() {
    state.coinsList.forEach((c) => {
      if (c.taken) return;
      const x = c.x - state.cam;
      if (x < -30 || x > W + 30) return;
      const y = c.y + Math.sin(c.t * 3) * 3;
      const spin = Math.abs(Math.cos(c.t * 3.4));
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(0.35 + spin * 0.65, 1);
      const g = ctx.createRadialGradient(-3, -4, 1, 0, 0, 12);
      g.addColorStop(0, '#fff3b0');
      g.addColorStop(0.6, '#ffcf4d');
      g.addColorStop(1, '#e59b13');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,110,10,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawEnemies() {
    state.enemies.forEach((e) => {
      const x = e.x - state.cam;
      if (x < -60 || x > W + 60) return;
      if (!e.alive) {
        const k = 1 - e.squash;
        ctx.globalAlpha = Math.max(0, e.squash);
        ctx.fillStyle = '#7ddb8f';
        rr(x, e.y + e.h - 10, e.w, 10, 5);
        ctx.fill();
        ctx.globalAlpha = 1;
        return;
      }
      const bob = Math.sin(e.t * 6) * 2;
      ctx.fillStyle = 'rgba(20,50,30,0.14)';
      ctx.beginPath();
      ctx.ellipse(x + e.w / 2, e.y + e.h + 2, e.w * 0.45, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      const g = ctx.createLinearGradient(0, e.y, 0, e.y + e.h);
      g.addColorStop(0, '#9be8a8');
      g.addColorStop(1, '#4fae62');
      ctx.fillStyle = g;
      rr(x, e.y + bob, e.w, e.h - bob, 12);
      ctx.fill();

      /* 眼睛 */
      const look = e.dir > 0 ? 3 : -3;
      ctx.fillStyle = '#12351f';
      ctx.beginPath();
      ctx.arc(x + e.w * 0.36 + look, e.y + 12 + bob, 3.4, 0, Math.PI * 2);
      ctx.arc(x + e.w * 0.64 + look, e.y + 12 + bob, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(x + e.w * 0.36 + look + 1, e.y + 11 + bob, 1.2, 0, Math.PI * 2);
      ctx.arc(x + e.w * 0.64 + look + 1, e.y + 11 + bob, 1.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawGoal() {
    const gx = state.level.goal - state.cam;
    if (gx < -80 || gx > W + 80) return;
    const poleTop = GY - 150;
    ctx.fillStyle = '#8b6b4a';
    ctx.fillRect(gx, poleTop, 7, 150);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(gx + 3.5, poleTop - 4, 7, 0, Math.PI * 2);
    ctx.fill();

    const wave = Math.sin(state.time * 4) * 6;
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(gx + 7, poleTop + 8);
    ctx.quadraticCurveTo(gx + 40, poleTop + 2 + wave, gx + 72, poleTop + 16 + wave);
    ctx.lineTo(gx + 72, poleTop + 44 + wave);
    ctx.quadraticCurveTo(gx + 40, poleTop + 30 + wave, gx + 7, poleTop + 38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 15px -apple-system, sans-serif';
    ctx.fillText('终', gx + 26, poleTop + 32 + wave);

    /* 终点光晕 */
    const rg = ctx.createRadialGradient(gx + 4, GY - 70, 8, gx + 4, GY - 70, 90);
    rg.addColorStop(0, 'rgba(255,224,120,0.35)');
    rg.addColorStop(1, 'rgba(255,224,120,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(gx + 4, GY - 70, 90, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCheckpoints() {
    state.checkpoints.forEach((cp) => {
      const x = cp.x - state.cam;
      if (x < -40 || x > W + 40) return;
      ctx.fillStyle = '#9aa7b4';
      ctx.fillRect(x, GY - 56, 4, 56);
      ctx.fillStyle = cp.taken ? '#4fd18b' : 'rgba(160,175,190,0.75)';
      ctx.beginPath();
      ctx.moveTo(x + 4, GY - 56);
      ctx.lineTo(x + 30, GY - 46);
      ctx.lineTo(x + 4, GY - 36);
      ctx.closePath();
      ctx.fill();
    });
  }

  function drawPlayer() {
    const x = P.x - state.cam;
    const y = P.y;
    const blink = P.invuln > 0 && Math.floor(P.invuln * 12) % 2 === 0;
    if (blink) return;

    const running = P.onGround && Math.abs(P.vx) > 30;
    const squash = P.squash;
    const sx = 1 + squash * 0.18;
    const sy = 1 - squash * 0.18;

    ctx.save();
    ctx.translate(x + P.w / 2, y + P.h);
    ctx.scale(sx, sy);

    /* 影子 */
    if (P.onGround) {
      ctx.fillStyle = 'rgba(20,40,25,0.16)';
      ctx.beginPath();
      ctx.ellipse(0, 2, P.w * 0.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    /* 腿 */
    const legPhase = running ? Math.sin(P.runT) * 5 : 0;
    ctx.fillStyle = '#b03a2e';
    ctx.fillRect(-9, -10, 7, 10 + legPhase * 0.4);
    ctx.fillRect(2, -10, 7, 10 - legPhase * 0.4);

    /* 身体 */
    const g = ctx.createLinearGradient(0, -P.h, 0, 0);
    g.addColorStop(0, '#ff8f6b');
    g.addColorStop(1, '#e0503c');
    ctx.fillStyle = g;
    rr(-P.w / 2, -P.h, P.w, P.h - 8, 9);
    ctx.fill();

    /* 背包 */
    ctx.fillStyle = '#c9a227';
    rr(-P.w / 2 - 4, -P.h + 14, 8, 12, 3);
    ctx.fill();

    /* 眼睛 */
    const eyeDir = P.face;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-4 + eyeDir * 2, -P.h + 13, 4.2, 0, Math.PI * 2);
    ctx.arc(6 + eyeDir * 2, -P.h + 13, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1b1b';
    ctx.beginPath();
    ctx.arc(-3.4 + eyeDir * 3.2, -P.h + 13, 2.1, 0, Math.PI * 2);
    ctx.arc(6.6 + eyeDir * 3.2, -P.h + 13, 2.1, 0, Math.PI * 2);
    ctx.fill();

    /* 头巾 */
    ctx.fillStyle = '#2f7fd1';
    rr(-P.w / 2, -P.h, P.w, 7, 4);
    ctx.fill();

    ctx.restore();
  }

  function drawParticles() {
    state.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - state.cam, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawHills();
    ctx.save();
    drawGround();
    drawCheckpoints();
    drawSpikes();
    drawCoins();
    drawGoal();
    drawEnemies();
    drawPlayer();
    drawParticles();
    ctx.restore();
  }

  /* ---------------- 循环 ---------------- */

  let last = 0;

  function frame(now) {
    if (!last) last = now;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    state.time += dt;

    if (state.phase === 'play') {
      updatePlayer(dt);
      updateEnemies(dt);
      collectCoins(dt);
      checkProgress();
      updateParticles(dt);

      const target = Math.max(0, Math.min(state.level.width - W, P.x - W * 0.38));
      state.cam += (target - state.cam) * Math.min(1, dt * 8);
    } else {
      updateParticles(dt);
    }

    render();
    requestAnimationFrame(frame);
  }

  /* ---------------- 尺寸 ---------------- */

  function resize() {
    const wrap = $('#canvasWrap');
    const availW = Math.min($('.stage').clientWidth, 1040);
    const availH = Math.max(240, window.innerHeight - 200);
    const scale = Math.min(availW / W, availH / H);
    const cssW = Math.floor(W * scale);
    const cssH = Math.floor(H * scale);
    wrap.style.width = `${cssW}px`;
    wrap.style.height = `${cssH}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform((cssW * dpr) / W, 0, 0, (cssH * dpr) / H, 0, 0);
  }

  /* ---------------- 输入 ---------------- */

  function bind() {
    const down = (e) => {
      if (e.repeat) return;
      const k = e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar'].includes(k)) {
        e.preventDefault();
      }
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = true;
      if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = true;
      if (k === ' ' || k === 'Spacebar' || k === 'ArrowUp' || k === 'w' || k === 'W') pressJump();
    };
    const up = (e) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = false;
      if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = false;
      if (k === ' ' || k === 'Spacebar' || k === 'ArrowUp' || k === 'w' || k === 'W') releaseJump();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    const touch = $('#touch');
    const setDir = (key, val) => {
      if (key === 'left') input.left = val;
      if (key === 'right') input.right = val;
    };
    touch.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('[data-key]');
      if (!btn) return;
      e.preventDefault();
      btn.classList.add('hold');
      const k = btn.dataset.key;
      if (k === 'jump') pressJump();
      else setDir(k, true);
    });
    const end = (e) => {
      const btn = e.target.closest('[data-key]');
      if (!btn) return;
      btn.classList.remove('hold');
      const k = btn.dataset.key;
      if (k === 'jump') releaseJump();
      else setDir(k, false);
    };
    touch.addEventListener('pointerup', end);
    touch.addEventListener('pointercancel', end);
    touch.addEventListener('pointerleave', end);

    window.addEventListener('resize', resize);
    window.addEventListener('blur', () => {
      input.left = false;
      input.right = false;
      input.jumpHeld = false;
    });

    /* 弹窗按钮 */
    $('#moMain').addEventListener('click', () => {
      hideModal();
      if (state.phase === 'over') {
        loadStage(state.stage);
      } else {
        loadStage(state.stage === LEVELS.length - 1 ? 0 : state.stage + 1);
      }
    });
    $('#moAlt').addEventListener('click', () => {
      if (state.phase === 'over') {
        location.href = '../';
        return;
      }
      hideModal();
      loadStage(state.stage);
    });
  }

  function pressJump() {
    P.buffer = 0.12;
    input.jumpHeld = true;
  }

  function releaseJump() {
    input.jumpHeld = false;
    if (P.vy < -240) P.vy = -240;
  }

  /* ---------------- 启动 ---------------- */

  function init() {
    bind();
    resize();
    loadStage(save.stage || 0);
    requestAnimationFrame(frame);
  }

  init();

  /* 仅调试模式暴露内部状态，便于自动化检查 */
  if (new URLSearchParams(location.search).has('debug')) {
    window.__advDebug = { state, P, input, loadStage, resize };
  }
})();
