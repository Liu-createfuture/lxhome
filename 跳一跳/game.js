'use strict';

/* =========================================================
   跳一跳（单机 + 联机竞速）
   ========================================================= */

(function () {
  const $ = (s) => document.querySelector(s);
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');

  const CFG = {
    charSize: 34,
    platFront: 24,
    minDist: 50,
    maxDist: 300,
    chargeMs: 1100,
    target: 20
  };

  let W = 0;
  let H = 0;
  let GROUND = 0;
  let DPR = 1;

  const S = {
    phase: 'idle', // idle | charging | jumping | falling | over
    mode: 'solo',
    score: 0,
    best: 0,
    combo: 0,
    power: 0,
    chargeAt: 0,
    cam: 0,
    camT: 0,
    plats: [],
    player: { x: 0, y: 0, rot: 0, sq: 1, sqV: 0 },
    jump: null,
    fall: null,
    fx: [],
    pops: [],
    shake: 0,
    rng: Math.random,
    stars: [],
    started: false,
    room: null,
    roomCode: '',
    oppScore: 0,
    myDone: false,
    myNick: '玩家'
  };

  /* ---------------- 工具 ---------------- */

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function toast(msg) {
    const stack = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 1800);
    while (stack.children.length > 3) stack.firstChild.remove();
  }

  /* ---------------- 初始化 ---------------- */

  function resize() {
    const rect = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    GROUND = Math.round(H * 0.64);
    S.player.y = GROUND;
    makeStars();
  }

  function makeStars() {
    S.stars = [];
    const r = mulberry32(7);
    for (let i = 0; i < 40; i += 1) {
      S.stars.push({
        x: r() * (W + 400),
        y: r() * GROUND * 0.85,
        r: 0.8 + r() * 1.8,
        a: 0.15 + r() * 0.4,
        p: 0.03 + r() * 0.08,
        tw: r() * Math.PI * 2
      });
    }
  }

  /* ---------------- 关卡 ---------------- */

  function makeWorld(seed) {
    S.rng = mulberry32(seed || Math.floor(Math.random() * 1e9));
    S.plats = [{ x: -70, w: 150 }];
    S.score = 0;
    S.combo = 0;
    S.player.x = S.plats[0].x + S.plats[0].w / 2;
    S.player.rot = 0;
    S.player.sq = 1;
    S.jump = null;
    S.fall = null;
    S.fx = [];
    S.pops = [];
    S.shake = 0;
    S.phase = 'idle';
    S.cam = S.player.x - W * 0.33;
    S.camT = S.cam;
    for (let i = 0; i < 3; i += 1) addPlatform();
    updateHud();
  }

  function addPlatform() {
    const cur = S.plats[S.plats.length - 1];
    const r = S.rng;
    const w = 62 + r() * 86;
    let dist = 132 + r() * 116;
    let gap = dist - cur.w / 2 - w / 2;
    if (gap < 44) {
      gap = 44;
      dist = cur.w / 2 + gap + w / 2;
    }
    S.plats.push({ x: cur.x + cur.w + gap, w });
  }

  function currentPlatform() {
    for (let i = S.plats.length - 1; i >= 0; i -= 1) {
      const p = S.plats[i];
      if (S.player.x >= p.x - 1 && S.player.x <= p.x + p.w + 1) return p;
    }
    return S.plats[0];
  }

  function ensurePlatforms() {
    const cur = currentPlatform();
    while (S.plats[S.plats.length - 1].x < cur.x + W * 1.4) addPlatform();
    while (S.plats.length > 2 && S.plats[0].x + S.plats[0].w < S.cam - 200) S.plats.shift();
  }

  /* ---------------- 操作 ---------------- */

  function startCharge() {
    if (S.phase !== 'idle') return;
    S.phase = 'charging';
    S.chargeAt = performance.now();
    S.power = 0;
  }

  function release() {
    if (S.phase !== 'charging') return;
    const dist = CFG.minDist + S.power * (CFG.maxDist - CFG.minDist);
    const x0 = S.player.x;
    const x1 = x0 + dist;
    S.jump = {
      x0,
      x1,
      t: 0,
      dur: 0.34 + dist / 1100,
      h: 58 + dist * 0.42,
      spin: Math.PI * 2 * (dist > 190 ? 2 : 1)
    };
    S.phase = 'jumping';
    S.player.sq = 1.18;
    spawnDust(S.player.x, GROUND, 8, '#c9c4e4');
    S.power = 0;
    $('#tip').classList.add('hide');
  }

  function land(x) {
    const hit = S.plats.find((p) => x >= p.x && x <= p.x + p.w);
    S.player.x = x;
    S.player.y = GROUND;
    S.player.rot = 0;

    if (!hit) {
      S.phase = 'falling';
      S.fall = { vy: -80, rot: 0 };
      S.shake = 6;
      spawnDust(x, GROUND, 10, '#d8d4ee');
      return;
    }

    S.phase = 'idle';
    S.player.sq = 0.72;
    const mid = hit.x + hit.w / 2;
    const perfect = Math.abs(x - mid) <= 7;
    S.combo = perfect ? S.combo + 1 : 0;
    const gain = perfect ? 2 : 1;
    S.score += gain;

    spawnDust(x, GROUND, perfect ? 14 : 8, perfect ? '#f0b429' : '#cfcae8');
    S.shake = perfect ? 5 : 3;
    addPop(x, GROUND - 46, perfect ? '完美 +2' : '+1', perfect ? '#e8a300' : '#4f46e5');
    if (perfect && S.combo >= 2) addPop(x, GROUND - 78, `${S.combo} 连完美`, '#e8a300');

    ensurePlatforms();
    updateHud();
    sendProgress(true);
  }

  function gameOver() {
    if (S.phase === 'over') return;
    S.phase = 'over';
    if (S.mode === 'solo' && S.score > S.best) {
      S.best = S.score;
      localStorage.setItem('gnjump.best.v1', String(S.best));
      $('#best').textContent = String(S.best);
    }
    sendProgress(false);
    if (S.mode === 'online') {
      showModal('😵', '你出局了', `你跳到 ${S.score} 层 · ${roomText()}`);
      return;
    }
    showModal('😵', '掉下去了', `本局 ${S.score} 层${S.score >= S.best && S.score > 0 ? ' · 新纪录！' : ''}`);
  }

  function roomText() {
    if (!S.room) return '';
    const other = opponentOf(S.room);
    return other ? `${other.nick} 目前 ${other.score || 0} 层` : '';
  }

  /* ---------------- 特效 ---------------- */

  function spawnDust(x, y, n, color) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI - Math.PI;
      const sp = 40 + Math.random() * 130;
      S.fx.push({
        x,
        y: y - 4,
        vx: Math.cos(a) * sp,
        vy: -Math.abs(Math.sin(a)) * sp * 0.7,
        life: 0.5 + Math.random() * 0.3,
        max: 0.8,
        size: 2 + Math.random() * 3.5,
        color,
        g: 420
      });
    }
  }

  function spawnStars(x, y) {
    for (let i = 0; i < 10; i += 1) {
      const a = (Math.PI * 2 * i) / 10;
      S.fx.push({
        x,
        y,
        vx: Math.cos(a) * 140,
        vy: Math.sin(a) * 140 - 60,
        life: 0.6,
        max: 0.6,
        size: 2.5,
        color: '#f0b429',
        g: 260
      });
    }
  }

  function addPop(x, y, text, color) {
    S.pops.push({ x, y, text, color, life: 1, max: 1 });
    if (text === '完美 +2') spawnStars(x, y);
  }

  /* ---------------- 更新 ---------------- */

  function update(dt) {
    if (S.phase === 'charging') {
      const p = Math.min(1, (performance.now() - S.chargeAt) / CFG.chargeMs);
      S.power = p;
      S.player.sq = 1 - 0.3 * p;
    } else if (S.player.sq < 1) {
      S.player.sq = Math.min(1, S.player.sq + dt * 4.2);
    } else if (S.player.sq > 1) {
      S.player.sq = Math.max(1, S.player.sq - dt * 4.2);
    }

    if (S.phase === 'jumping' && S.jump) {
      const j = S.jump;
      j.t = Math.min(1, j.t + dt / j.dur);
      S.player.x = lerp(j.x0, j.x1, j.t);
      S.player.y = GROUND - 4 * j.h * j.t * (1 - j.t);
      S.player.rot = j.spin * j.t;
      if (j.t >= 1) land(j.x1);
    } else if (S.phase === 'falling' && S.fall) {
      S.fall.vy += 1900 * dt;
      S.player.y += S.fall.vy * dt;
      S.fall.rot += dt * 7;
      S.player.rot = S.fall.rot;
      if (S.player.y > H + 90) gameOver();
    }

    // 相机
    S.camT = S.player.x - W * 0.33;
    S.cam += (S.camT - S.cam) * Math.min(1, dt * 7.5);

    // 特效
    for (let i = S.fx.length - 1; i >= 0; i -= 1) {
      const f = S.fx[i];
      f.life -= dt;
      if (f.life <= 0) {
        S.fx.splice(i, 1);
        continue;
      }
      f.vy += f.g * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    }
    for (let i = S.pops.length - 1; i >= 0; i -= 1) {
      const p = S.pops[i];
      p.life -= dt;
      p.y -= dt * 46;
      if (p.life <= 0) S.pops.splice(i, 1);
    }
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 28);

    ensurePlatforms();
  }

  /* ---------------- 绘制 ---------------- */

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (S.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
    }

    drawSky();
    drawHills();
    drawGround();
    drawPlatforms();
    drawTargetGlow();
    drawPlayer();
    drawFx();
    drawPops();

    ctx.restore();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#e9ecff');
    g.addColorStop(0.45, '#e4e7fb');
    g.addColorStop(0.75, '#f2eefc');
    g.addColorStop(1, '#fbf3fb');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 光斑
    const blobs = [
      { x: W * 0.18, y: H * 0.16, r: H * 0.3, c: 'rgba(139,92,246,0.16)' },
      { x: W * 0.78, y: H * 0.1, r: H * 0.24, c: 'rgba(56,189,248,0.14)' },
      { x: W * 0.55, y: H * 0.55, r: H * 0.34, c: 'rgba(244,114,182,0.1)' }
    ];
    blobs.forEach((b) => {
      const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      rg.addColorStop(0, b.c);
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    drawClouds();

    // 星点
    const t = performance.now() / 1000;
    S.stars.forEach((s) => {
      const x = (s.x - S.cam * s.p) % (W + 400);
      const px = x < 0 ? x + W + 400 : x;
      const a = s.a * (0.6 + 0.4 * Math.sin(t * 1.6 + s.tw));
      ctx.fillStyle = `rgba(99,102,241,${a})`;
      ctx.beginPath();
      ctx.arc(px, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawHills() {
    // 远山
    ctx.fillStyle = 'rgba(129,140,248,0.16)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    const off1 = -(S.cam * 0.08) % 300;
    for (let i = -1; i < 6; i += 1) {
      const bx = off1 + i * 300;
      ctx.quadraticCurveTo(bx + 75, GROUND - 150, bx + 150, GROUND - 30);
      ctx.quadraticCurveTo(bx + 225, GROUND - 130, bx + 300, GROUND - 20);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // 近山
    ctx.fillStyle = 'rgba(99,102,241,0.13)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    const off2 = -(S.cam * 0.16) % 240;
    for (let i = -1; i < 7; i += 1) {
      const bx = off2 + i * 240;
      ctx.quadraticCurveTo(bx + 60, GROUND - 88, bx + 120, GROUND - 6);
      ctx.quadraticCurveTo(bx + 180, GROUND - 70, bx + 240, GROUND);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // 地平线
    const lg = ctx.createLinearGradient(0, GROUND - 10, 0, GROUND + 8);
    lg.addColorStop(0, 'rgba(255,255,255,0.85)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, GROUND - 10, W, 18);
  }

  function drawClouds() {
    const t = performance.now() / 1000;
    const list = [
      { x: 0.16, y: 0.16, s: 1.0, p: 0.05 },
      { x: 0.55, y: 0.1, s: 0.72, p: 0.08 },
      { x: 0.82, y: 0.22, s: 0.9, p: 0.06 }
    ];
    list.forEach((c, i) => {
      const drift = ((t * (6 + i * 3)) % 400) - 120;
      const cx = W * c.x + drift * c.p - S.cam * c.p * 0.35;
      const cy = H * c.y;
      const r = 42 * c.s;
      const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.1);
      g2.addColorStop(0, 'rgba(255,255,255,0.85)');
      g2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 2.1, r, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawGround() {
    const top = GROUND + 16;
    const g2 = ctx.createLinearGradient(0, top, 0, H);
    g2.addColorStop(0, 'rgba(214,208,240,0.55)');
    g2.addColorStop(0.35, 'rgba(203,196,234,0.85)');
    g2.addColorStop(1, 'rgba(186,178,224,0.95)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, top, W, H - top);

    // 横向虚线，制造前进感
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    const step = 46;
    const off = (-S.cam * 0.6) % step;
    for (let i = 0; i < 4; i += 1) {
      const y = top + 26 + i * 34;
      ctx.beginPath();
      ctx.setLineDash([10, 12]);
      ctx.lineDashOffset = off;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 顶部亮边
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(0, top - 2, W, 3);
  }

  function drawPlatforms() {
    const cur = currentPlatform();
    S.plats.forEach((p) => {
      const x = p.x - S.cam;
      if (x > W + 120 || x + p.w < -120) return;

      // 影子
      ctx.fillStyle = 'rgba(70,64,120,0.1)';
      ctx.beginPath();
      ctx.ellipse(x + p.w / 2, GROUND + 34, p.w * 0.52, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // 主体
      const g = ctx.createLinearGradient(0, GROUND, 0, GROUND + CFG.platFront + 16);
      const isCur = p === cur;
      g.addColorStop(0, isCur ? '#ddd8f6' : '#d2cdec');
      g.addColorStop(1, '#b0a9d6');
      ctx.fillStyle = g;
      roundRect(x, GROUND, p.w, CFG.platFront + 14, 9);
      ctx.fill();

      // 顶面
      const tg = ctx.createLinearGradient(0, GROUND - 9, 0, GROUND + 8);
      tg.addColorStop(0, '#ffffff');
      tg.addColorStop(1, '#eceafb');
      ctx.fillStyle = tg;
      roundRect(x - 2, GROUND - 9, p.w + 4, 13, 6);
      ctx.fill();

      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      roundRect(x + 6, GROUND - 7, Math.max(10, p.w * 0.35), 3, 2);
      ctx.fill();

      // 当前平台光晕
      if (isCur && (S.phase === 'idle' || S.phase === 'charging')) {
        ctx.strokeStyle = 'rgba(79,70,229,0.35)';
        ctx.lineWidth = 1.5;
        roundRect(x - 2, GROUND - 9, p.w + 4, 13, 6);
        ctx.stroke();
      }
    });
  }

  function drawTargetGlow() {
    if (S.phase !== 'idle' && S.phase !== 'charging') return;
    const target = S.plats.find((p) => p.x > S.player.x + 4);
    if (!target) return;
    const x = target.x - S.cam;
    const cx = x + target.w / 2;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
    const rg = ctx.createRadialGradient(cx, GROUND - 2, 0, cx, GROUND - 2, target.w * 0.95);
    rg.addColorStop(0, 'rgba(99,102,241,' + (0.16 + pulse * 0.1).toFixed(3) + ')');
    rg.addColorStop(1, 'rgba(99,102,241,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(cx, GROUND - 2, target.w * 0.95, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer() {
    const p = S.player;
    const px = p.x - S.cam;
    const size = CFG.charSize;
    const bottom = p.y;
    const lift = Math.max(0, GROUND - bottom);

    // 影子
    if (S.phase !== 'falling') {
      const k = Math.max(0.25, 1 - lift / 220);
      ctx.fillStyle = `rgba(70,64,120,${0.16 * k})`;
      ctx.beginPath();
      ctx.ellipse(px, GROUND + 2, size * 0.52 * k, size * 0.2 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    const bob = S.phase === 'idle' ? Math.sin(performance.now() / 420) * 1.6 : 0;
    ctx.translate(px, bottom - size / 2 + bob);
    ctx.rotate(p.rot);
    const sy = p.sq;
    const sx = 1 + (1 - sy) * 0.8;
    ctx.scale(sx, sy);

    // 身体
    const bg = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
    bg.addColorStop(0, '#6366f1');
    bg.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = bg;
    roundRect(-size / 2, -size / 2, size, size, 9);
    ctx.fill();

    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(-size / 2 + 4, -size / 2 + 4, size - 8, size * 0.32, 7);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-size * 0.16, -size * 0.06, size * 0.14, 0, Math.PI * 2);
    ctx.arc(size * 0.16, -size * 0.06, size * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2545';
    ctx.beginPath();
    ctx.arc(-size * 0.13, -size * 0.04, size * 0.07, 0, Math.PI * 2);
    ctx.arc(size * 0.19, -size * 0.04, size * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 蓄力环
    if (S.phase === 'charging') {
      const r = size * 0.95;
      ctx.beginPath();
      ctx.arc(px, bottom - size / 2, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(79,70,229,0.15)';
      ctx.lineWidth = 4;
      ctx.stroke();

      const grad = ctx.createLinearGradient(px - r, 0, px + r, 0);
      grad.addColorStop(0, '#6366f1');
      grad.addColorStop(1, '#f472b6');
      ctx.beginPath();
      ctx.arc(px, bottom - size / 2, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * S.power);
      ctx.strokeStyle = grad;
      ctx.lineCap = 'round';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }

  function drawFx() {
    S.fx.forEach((f) => {
      const a = Math.max(0, f.life / f.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x - S.cam, f.y, f.size * (0.4 + a * 0.8), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawPops() {
    S.pops.forEach((p) => {
      const a = Math.max(0, Math.min(1, p.life * 1.6));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.font = '700 15px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x - S.cam, p.y);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  /* ---------------- 循环 ---------------- */

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  /* ---------------- HUD / 弹窗 ---------------- */

  function updateHud() {
    $('#score').textContent = String(S.score);
    $('#best').textContent = String(S.best);
    if (S.mode === 'online' && S.room) {
      $('#oppMe').textContent = String(S.score);
      const other = opponentOf(S.room);
      $('#oppScore').textContent = String(other ? other.score || 0 : 0);
      const pct = Math.min(100, (S.score / CFG.target) * 100);
      $('#oppBar').style.width = pct + '%';
    }
  }

  function showModal(emoji, title, text) {
    $('#moEmoji').textContent = emoji;
    $('#moTitle').textContent = title;
    $('#moText').textContent = text;
    $('#modal').classList.add('show');
  }

  function hideModal() {
    $('#modal').classList.remove('show');
  }

  /* ---------------- 联机 ---------------- */

  let socket = null;
  let queue = [];

  function wsUrl() {
    const cfg = window.GN_CONFIG || {};
    const server = String(cfg.server || '').trim().replace(/\/+$/, '');
    const share = String(cfg.sharecode || '').trim();
    const qs = share ? `?sharecode=${encodeURIComponent(share)}` : '';
    if (server) return `${server.replace(/^http/i, 'ws')}/${qs}`;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/`;
  }

  function send(obj) {
    if (socket && socket.readyState === 1) socket.send(JSON.stringify(obj));
    else {
      queue.push(obj);
      connect();
    }
  }

  function connect() {
    if (socket && (socket.readyState === 0 || socket.readyState === 1)) return;
    const ws = window.openSocket ? window.openSocket(wsUrl()) : new WebSocket(wsUrl());
    socket = ws;

    ws.addEventListener('open', () => {
      if (window.HubFriends) HubFriends.onConnect();
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
      setTimeout(() => connect(), 1500);
    });
    ws.addEventListener('error', () => {});
  }

  let lastSend = 0;

  function sendProgress(alive) {
    if (S.mode !== 'online' || !S.room) return;
    const now = Date.now();
    if (alive && now - lastSend < 200) return;
    lastSend = now;
    send({ t: 'jump', score: S.score, alive });
    if (!alive) S.myDone = true;
  }

  function opponentOf(state) {
    if (!state || !state.players) return null;
    return state.players[state.you === 0 ? 1 : 0] || null;
  }

  function handle(msg) {
    if (window.HubFriends && HubFriends.handle(msg)) return;

    if (msg.t === 'joined') {
      S.roomCode = msg.code;
      $('#netCodeLabel').textContent = msg.code;
      $('#netEntry').classList.add('hidden');
      $('#netRoom').classList.remove('hidden');
      if (S.inviteTo) {
        const to = S.inviteTo;
        S.inviteTo = null;
        send({ t: 'invite', to, code: msg.code, game: 'jump', gameName: '跳一跳' });
      }
      return;
    }
    if (msg.t === 'toast') {
      toast(msg.msg);
      return;
    }
    if (msg.t === 'error') {
      toast(msg.msg);
      return;
    }
    if (msg.t !== 'state' || !msg.state) return;

    const st = msg.state;
    if (st.game !== 'jump') return;
    S.room = st;
    S.mode = 'online';

    renderRoom(st);

    if (st.status === 'countdown') {
      $('#opp').classList.remove('hidden');
      $('#oppName').textContent = (opponentOf(st) || {}).nick || '对手';
      $('#tip').classList.remove('hide');
      $('#tip').textContent = '准备好了吗…';
    }

    if (st.status === 'playing' && !S.started) {
      S.started = true;
      $('#netModal').classList.remove('show');
      $('#tip').textContent = '按住蓄力，松手起跳';
      makeWorld(st.seed || 1);
      S.oppScore = 0;
      S.myDone = false;
      updateHud();
    }

    if (st.status === 'playing' && S.started) {
      const other = opponentOf(st);
      if (other) {
        $('#oppScore').textContent = String(other.score || 0);
        S.oppScore = other.score || 0;
      }
    }

    if (st.status === 'finished' && S.started) {
      finishRace(st);
    }
  }

  function finishRace(st) {
    if (S.phase === 'over' && $('#modal').classList.contains('show')) {
      // 已经弹过出局窗，替换成结果
    }
    const winner = st.winnerIdx;
    const meWin = winner === st.you;
    const draw = winner === -1;
    const other = opponentOf(st) || { score: 0, nick: '对手' };
    const myScore = (st.players[st.you] || {}).score || S.score;
    $('#oppScore').textContent = String(other.score || 0);
    showModal(
      draw ? '🤝' : meWin ? '🏆' : '😤',
      draw ? '平局' : meWin ? '你赢了！' : '差一点',
      `你 ${myScore} 层 · ${other.nick} ${other.score || 0} 层`
    );
    $('#moAgain').textContent = '再来一局';
    S.phase = 'over';
  }

  function renderRoom(st) {
    const box = $('#netPlayers');
    const players = st.players || [];
    box.innerHTML = [0, 1]
      .map((i) => {
        const p = players[i];
        if (!p) return '<div class="net-player empty">等待加入…</div>';
        return `<div class="net-player"><b>${escapeHtml(p.nick)}${i === st.you ? '（你）' : ''}</b>${
          i === st.hostIdx ? '房主' : '玩家'
        }</div>`;
      })
      .join('');
    const isHost = st.you === st.hostIdx;
    const twoReady = players.filter((p) => p.connected).length >= 2;
    $('#btnStartRace').disabled = !isHost || !twoReady;
    $('#netHint').textContent = !isHost
      ? '等房主开始…'
      : twoReady
      ? '可以开始了'
      : '等好友进来…';
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function roomLink(code) {
    const url = new URL(location.href);
    url.search = '';
    const share = new URLSearchParams(location.search).get('sharecode');
    if (share) url.searchParams.set('sharecode', share);
    url.searchParams.set('room', code);
    return url.toString();
  }

  /* ---------------- 事件绑定 ---------------- */

  function bindInput() {
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      startCharge();
    });
    const up = (e) => {
      if (e) e.preventDefault();
      release();
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', up);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) startCharge();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        release();
      }
    });
  }

  function bindUi() {
    $('#btnNet').addEventListener('click', () => {
      $('#netModal').classList.add('show');
      if (S.roomCode) {
        $('#netEntry').classList.add('hidden');
        $('#netRoom').classList.remove('hidden');
        $('#netCodeLabel').textContent = S.roomCode;
      }
    });
    $('#btnCloseNet').addEventListener('click', () => {
      $('#netModal').classList.remove('show');
    });
    $('#btnCreateRoom').addEventListener('click', () => {
      connect();
      send({ t: 'create', nick: S.myNick, game: 'jump' });
    });
    $('#btnJoinRoom').addEventListener('click', () => {
      const code = ($('#roomCode').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      if (code.length !== 4) {
        toast('房号是 4 位');
        return;
      }
      connect();
      send({ t: 'join', code, nick: S.myNick });
    });
    $('#btnCopyInvite').addEventListener('click', () => {
      if (!S.roomCode) return;
      const link = roomLink(S.roomCode);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(() => toast('邀请链接已复制')).catch(() => toast(link));
      } else {
        toast(link);
      }
    });
    $('#btnStartRace').addEventListener('click', () => send({ t: 'start' }));
    $('#moAgain').addEventListener('click', () => {
      hideModal();
      if (S.mode === 'online' && S.room) {
        if (S.room.status === 'finished') {
          send({ t: 'rematch' });
          S.started = false;
        }
        return;
      }
      makeWorld();
    });
  }

  /* ---------------- 启动 ---------------- */

  function boot() {
    try {
      const me = JSON.parse(localStorage.getItem('hub.me.v1') || 'null');
      if (me && me.nick) S.myNick = String(me.nick).slice(0, 12);
    } catch {
      /* ignore */
    }
    S.best = Number(localStorage.getItem('gnjump.best.v1') || 0) || 0;

    resize();
    bindInput();
    bindUi();
    makeWorld();
    requestAnimationFrame(loop);
    window.addEventListener('resize', resize);

    /* 好友面板：在线状态实时同步，可直接邀请一起玩 */
    if (window.HubFriends) {
      HubFriends.mount({
        send: (o) => send(o),
        game: { id: 'jump', name: '跳一跳' },
        room: () => (S.roomCode ? { code: S.roomCode, game: 'jump', name: '跳一跳' } : null),
        createRoom: (fid) => {
          S.inviteTo = fid;
          connect();
          send({ t: 'create', nick: S.myNick, game: 'jump' });
        },
        joinRoom: (code) => {
          location.href = roomLink(code);
        }
      });
      /* 单机时也连上，好友在线状态与邀请才收得到 */
      connect();
    }

    const params = new URLSearchParams(location.search);
    const room = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    const inviteTo = (params.get('invite') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

    if (inviteTo) {
      /* 从大厅点「一起玩」过来：先开房，进房后自动把房号推给好友 */
      S.inviteTo = inviteTo;
      connect();
      send({ t: 'create', nick: S.myNick, game: 'jump' });
      $('#netModal').classList.add('show');
      toast('正在开房间，准备邀请好友…');
    } else if (room) {
      connect();
      send({ t: 'join', code: room, nick: S.myNick });
      $('#netModal').classList.add('show');
    }
  }

  boot();

  /* 调试钩子：仅 ?debug=1 时暴露，方便自动化测试 */
  if (new URLSearchParams(location.search).has('debug')) {
    window.__jumpDebug = { S, CFG, makeWorld, sendProgress, release, startCharge };
  }
})();
