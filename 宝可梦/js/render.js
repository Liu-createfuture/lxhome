/* ============================================================
   世界渲染：地图、建筑、环境与战斗背景
   ============================================================ */
window.PKM = window.PKM || {};

(function () {
  const PKM = window.PKM;
  const D = PKM.DATA;
  const TILE = 16;
  const VW = 320, VH = 200;

  function hash(x, y, s = 0) {
    let n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rr(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function ell(ctx, cx, cy, rx, ry, c) {
    ctx.fillStyle = c;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) ctx.fillRect(x, y, 1, 1);
      }
  }
  function tri(ctx, pts, c) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
  }
  function line(ctx, x1, y1, x2, y2, c, w = 1) {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
    ctx.moveTo(x1 + .5, y1 + .5); ctx.lineTo(x2 + .5, y2 + .5); ctx.stroke();
  }

  const C = {
    grass: '#6f9a53', grass2: '#7aa75b', grass3: '#5e8847', grassD: '#4c723b',
    tall: '#4f7c3f', tallL: '#7da75a',
    path: '#c8ad78', path2: '#d6bd8a', pathD: '#aa8f60',
    water: '#3f7f86', water2: '#4e9598', waterL: '#8fd0c8', waterD: '#2d606b',
    tree: '#2f593d', treeM: '#4a7a4e', treeL: '#6c9d5f', trunk: '#674c34',
    stone: '#8d9080', stone2: '#a5a795', stoneD: '#64685b',
    wood: '#9b7047', wood2: '#b48759', woodD: '#684a32',
    ink: '#24352b', cream: '#ede0bd', roof: '#b8614a', roof2: '#d47c5c',
    glow: '#8ce0b5', pink: '#e8a2b4', yellow: '#f0ce75'
  };

  function drawGround(ctx, t, x, y, sx, sy) {
    rr(ctx, sx, sy, TILE, TILE, C.grass);
    const h = hash(x, y);
    if (h < .4) rr(ctx, sx + 2 + (h * 7 | 0), sy + 4 + (h * 8 | 0), 2, 1, C.grass2);
    if (h > .72) rr(ctx, sx + 11, sy + 10, 1, 2, C.grass3);
    if (h > .93) {
      rr(ctx, sx + 6, sy + 9, 1, 3, C.grass2);
      rr(ctx, sx + 5, sy + 10, 1, 1, C.grass2);
      rr(ctx, sx + 7, sy + 8, 1, 1, C.grass2);
    }
  }

  function drawCaveFloor(ctx, t, x, y, sx, sy) {
    rr(ctx, sx, sy, TILE, TILE, '#433a33');
    const h = hash(x, y);
    rr(ctx, sx + 2, sy + 3, 4, 1, '#4e443b');
    rr(ctx, sx + 10, sy + 9, 3, 1, '#39332d');
    if (h > .55) rr(ctx, sx + 5 + (h * 6 | 0), sy + 12, 2, 1, '#55483c');
    if (h > .82) {
      rr(ctx, sx + 4, sy + 5, 1, 1, '#6f8a5b');
      rr(ctx, sx + 3, sy + 6, 3, 1, '#5a744b');
    }
    if (h < .18) rr(ctx, sx + 12, sy + 3, 2, 2, '#5a5043');
  }

  function drawTallGrass(ctx, t, x, y, sx, sy) {
    rr(ctx, sx, sy, TILE, TILE, C.tall);
    const sway = Math.sin(t * 2 + x * .7 + y * .4) * 1;
    for (let i = 0; i < 7; i++) {
      const bx = sx + 1 + i * 2 + (hash(x, y, i) * 1 | 0);
      const h = 5 + (hash(x, y, i + 9) * 5 | 0);
      line(ctx, bx, sy + 15, bx + (i % 2 ? 1 : -1) + sway, sy + 15 - h, i % 2 ? C.tallL : '#3f6934', 1);
    }
    rr(ctx, sx + 2, sy + 3, 1, 1, '#90b96b');
    rr(ctx, sx + 11, sy + 6, 1, 2, '#90b96b');
  }

  function drawPath(ctx, t, x, y, sx, sy, map) {
    rr(ctx, sx, sy, TILE, TILE, C.path);
    const h = hash(x, y);
    rr(ctx, sx + (h * 12 | 0), sy + (hash(x, y, 2) * 12 | 0), 2, 1, C.pathD);
    if (h > .55) rr(ctx, sx + 10, sy + 4, 1, 1, C.path2);
    if (h < .2) { rr(ctx, sx + 4, sy + 11, 3, 1, C.pathD); rr(ctx, sx + 5, sy + 10, 1, 1, C.path2); }
    // soften edges next to grass
    if (y > 0 && map.tiles[y - 1][x] !== 'p') {
      for (let i = 0; i < 16; i += 3) rr(ctx, sx + i, sy, 2, 1, C.grass2);
    }
    if (y < map.h - 1 && map.tiles[y + 1][x] !== 'p') {
      for (let i = 1; i < 16; i += 4) rr(ctx, sx + i, sy + 15, 2, 1, C.grass3);
    }
  }

  function drawFlower(ctx, t, x, y, sx, sy) {
    drawGround(ctx, t, x, y, sx, sy);
    const h = hash(x, y, 5);
    const cols = ['#f2d37a', '#f0a9b9', '#dfe8e0', '#e8b45c'];
    for (let i = 0; i < 3; i++) {
      const fx = sx + 3 + (hash(x, y, i + 11) * 10 | 0);
      const fy = sy + 4 + (hash(x, y, i + 21) * 9 | 0);
      rr(ctx, fx, fy + 2, 1, 3, C.grassD);
      rr(ctx, fx - 1, fy, 3, 1, cols[(h * 4 | 0 + i) % 4]);
      rr(ctx, fx, fy - 1, 1, 3, cols[(h * 4 | 0 + i) % 4]);
      rr(ctx, fx, fy, 1, 1, '#f5e6a4');
    }
  }

  function drawWater(ctx, t, x, y, sx, sy, map) {
    rr(ctx, sx, sy, TILE, TILE, C.water);
    const w = Math.sin(t * 1.4 + x * .5 + y * .3);
    rr(ctx, sx + 2, sy + 5 + (w > 0 ? 1 : 0), 5, 1, C.water2);
    rr(ctx, sx + 9, sy + 11 - (w > 0 ? 1 : 0), 4, 1, C.water2);
    if (hash(x, y, 3) > .6) {
      const a = .35 + .35 * Math.sin(t * 2 + x + y);
      ctx.fillStyle = `rgba(190,235,220,${a})`;
      ctx.fillRect(sx + 5 + (hash(x, y, 4) * 7 | 0), sy + 3 + (hash(x, y, 5) * 8 | 0), 1, 1);
    }
    // shoreline
    if (y > 0 && map.tiles[y - 1][x] !== '~' && map.tiles[y - 1][x] !== '=') {
      rr(ctx, sx, sy, TILE, 1, '#7f9e5f'); rr(ctx, sx, sy + 1, TILE, 1, '#5b7b48');
    }
    if (y < map.h - 1 && map.tiles[y + 1][x] !== '~' && map.tiles[y + 1][x] !== '=') {
      rr(ctx, sx, sy + 15, TILE, 1, '#5b7b48');
    }
  }

  function drawBridge(ctx, t, x, y, sx, sy) {
    rr(ctx, sx, sy, TILE, TILE, C.wood);
    for (let i = 0; i < 16; i += 4) {
      rr(ctx, sx, sy + i, TILE, 1, C.woodD);
      rr(ctx, sx, sy + i + 1, TILE, 2, C.wood2);
      rr(ctx, sx + (i % 8 ? 3 : 11), sy + i + 1, 1, 1, '#d0a371');
    }
    rr(ctx, sx, sy, 1, TILE, '#5b3f2b'); rr(ctx, sx + 15, sy, 1, TILE, '#5b3f2b');
    rr(ctx, sx + 3, sy + 2, 1, 12, '#5b3f2b'); rr(ctx, sx + 12, sy + 2, 1, 12, '#5b3f2b');
  }

  function drawTree(ctx, t, x, y, sx, sy, big) {
    drawGround(ctx, t, x, y, sx, sy);
    rr(ctx, sx + 5, sy + 18, 6, 3, 'rgba(33,48,33,.25)');
    const sway = Math.sin(t * .8 + x * .5) * 1;
    if (big) {
      rr(ctx, sx + 6, sy + 4, 5, 12, '#4b3828');
      rr(ctx, sx + 7, sy + 4, 2, 12, '#6d5238');
      ell(ctx, sx + 8 + sway, sy + 2, 11, 8, '#284a33');
      ell(ctx, sx + 7 + sway, sy, 8, 7, C.tree);
      ell(ctx, sx + 10 + sway, sy - 3, 6, 5, C.treeM);
      ell(ctx, sx + 6 + sway, sy - 2, 4, 3, C.treeL);
      rr(ctx, sx + 3 + sway, sy + 1, 2, 1, '#85ac6b');
    } else {
      rr(ctx, sx + 6, sy + 8, 4, 8, C.trunk);
      rr(ctx, sx + 7, sy + 8, 1, 8, '#836344');
      ell(ctx, sx + 8 + sway, sy + 5, 8, 7, '#284a33');
      ell(ctx, sx + 8 + sway, sy + 3, 6, 6, C.treeM);
      ell(ctx, sx + 6 + sway, sy + 2, 3, 3, C.treeL);
      rr(ctx, sx + 2 + sway, sy + 6, 1, 1, '#8fb974');
    }
  }

  function drawRock(ctx, t, x, y, sx, sy) {
    drawGround(ctx, t, x, y, sx, sy);
    rr(ctx, sx + 3, sy + 8, 11, 6, '#4b5247');
    rr(ctx, sx + 4, sy + 7, 9, 5, C.stone);
    rr(ctx, sx + 5, sy + 6, 7, 5, '#b0b29f');
    rr(ctx, sx + 6, sy + 6, 4, 2, '#c6c7b4');
    rr(ctx, sx + 10, sy + 11, 2, 1, C.stoneD);
    rr(ctx, sx + 2, sy + 13, 3, 1, C.grassD);
  }

  function drawMushroom(ctx, t, x, y, sx, sy) {
    drawGround(ctx, t, x, y, sx, sy);
    const g = .45 + .25 * Math.sin(t * 1.6 + x + y);
    ctx.fillStyle = `rgba(125,224,193,${g})`;
    ctx.fillRect(sx + 5, sy + 7, 9, 7);
    rr(ctx, sx + 7, sy + 9, 3, 5, '#e8dcc0');
    ell(ctx, sx + 8, sy + 8, 5, 3, '#9d5d6d');
    rr(ctx, sx + 6, sy + 7, 2, 1, '#f0c6c6');
    rr(ctx, sx + 10, sy + 9, 1, 1, '#f0c6c6');
    rr(ctx, sx + 13, sy + 12, 1, 3, '#e8dcc0');
  }

  function drawGlowMoss(ctx, t, x, y, sx, sy) {
    drawGround(ctx, t, x, y, sx, sy);
    const a = .4 + .3 * Math.sin(t * 2 + x * .8 + y);
    ctx.fillStyle = `rgba(85,170,130,${a * .65})`;
    ctx.beginPath(); ctx.ellipse(sx + 8, sy + 12, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const bx = sx + 3 + i * 2 + (hash(x, y, i) * 2 | 0);
      const h = 3 + (hash(x, y, i + 4) * 4 | 0);
      line(ctx, bx, sy + 13, bx + Math.sin(t + i) * 1, sy + 13 - h, i % 2 ? '#6aa885' : '#8cc9a3', 1);
    }
    const mote = `rgba(160,255,215,${a})`;
    rr(ctx, sx + 6, sy + 9, 1, 1, mote);
    rr(ctx, sx + 10, sy + 11, 1, 1, mote);
    rr(ctx, sx + 8, sy + 7, 1, 1, mote);
    if (a > .55) rr(ctx, sx + 9, sy + 9, 1, 1, '#e8fff5');
  }

  function drawStone(ctx, t, x, y, sx, sy, wall) {
    rr(ctx, sx, sy, TILE, TILE, wall ? '#4e5a50' : '#777d6f');
    const off = (y % 2) * 8;
    for (let yy = 0; yy < 16; yy += 8) {
      rr(ctx, sx, sy + yy, 16, 1, '#3f4a41');
      for (let xx = -off; xx < 16; xx += 16) {
        rr(ctx, sx + xx, sy + yy, 1, 8, '#3f4a41');
        rr(ctx, sx + xx + 1, sy + yy + 1, 14, 1, wall ? '#606c61' : '#858b7c');
      }
    }
    if (hash(x, y, 7) > .72) rr(ctx, sx + 3, sy + 4, 3, 1, '#748a64');
    if (!wall && hash(x, y, 8) > .6) rr(ctx, sx + 9, sy + 11, 2, 1, '#676e60');
  }

  function drawWoodFloor(ctx, t, x, y, sx, sy) {
    rr(ctx, sx, sy, TILE, TILE, '#8c6543');
    for (let i = 0; i < 16; i += 4) {
      rr(ctx, sx, sy + i, 16, 1, '#5f432c');
      rr(ctx, sx, sy + i + 1, 16, 2, '#a37a50');
    }
    rr(ctx, sx + (x % 2 ? 3 : 10), sy, 1, 16, '#6e4e34');
  }

  function drawDais(ctx, t, x, y, sx, sy) {
    rr(ctx, sx, sy, TILE, TILE, '#7c8d67');
    rr(ctx, sx + 1, sy + 1, 14, 14, '#9aaa7f');
    rr(ctx, sx + 4, sy + 4, 8, 8, '#b9c795');
    const a = .25 + .2 * Math.sin(t * 1.5 + x);
    ctx.fillStyle = `rgba(255,246,201,${a})`;
    ctx.fillRect(sx + 2, sy + 2, 12, 12);
    rr(ctx, sx + 7, sy + 7, 2, 2, '#f5e6a4');
  }

  function drawTile(ctx, map, tile, x, y, sx, sy, t) {
    switch (tile) {
      case '.': drawGround(ctx, t, x, y, sx, sy); break;
      case ',': drawTallGrass(ctx, t, x, y, sx, sy); break;
      case 'p': drawPath(ctx, t, x, y, sx, sy, map); break;
      case 'f': drawFlower(ctx, t, x, y, sx, sy); break;
      case '~': drawWater(ctx, t, x, y, sx, sy, map); break;
      case '=': drawBridge(ctx, t, x, y, sx, sy); break;
      case '#': drawTree(ctx, t, x, y, sx, sy, false); break;
      case 'T': drawTree(ctx, t, x, y, sx, sy, true); break;
      case 'r': drawRock(ctx, t, x, y, sx, sy); break;
      case 'm': drawMushroom(ctx, t, x, y, sx, sy); break;
      case 'g': drawGlowMoss(ctx, t, x, y, sx, sy); break;
      case 's': drawStone(ctx, t, x, y, sx, sy, false); break;
      case 'W': drawStone(ctx, t, x, y, sx, sy, true); break;
      case 'o': drawWoodFloor(ctx, t, x, y, sx, sy); break;
      case '*': drawDais(ctx, t, x, y, sx, sy); break;
      case 'x': drawCaveFloor(ctx, t, x, y, sx, sy); break;
      default: drawGround(ctx, t, x, y, sx, sy);
    }
  }

  /* ---------- 建筑 ---------- */
  function drawWindow(ctx, x, y, w, h, lit) {
    rr(ctx, x - 1, y - 1, w + 2, h + 2, '#4a3a2e');
    rr(ctx, x, y, w, h, lit ? '#f5d98a' : '#8db2b0');
    if (lit) {
      rr(ctx, x + 1, y + 1, w - 2, h - 2, '#f8e6a8');
      rr(ctx, x + 2, y + 2, 3, 3, '#fff6c9');
    } else {
      rr(ctx, x + 1, y + 1, w - 2, 2, '#b7d8ce');
      rr(ctx, x + 2, y + 3, 2, 1, '#cfe6da');
    }
    rr(ctx, x + (w >> 1), y, 1, h, '#4a3a2e');
    rr(ctx, x, y + (h >> 1), w, 1, '#4a3a2e');
  }

  function drawDoor(ctx, bx, by, bw, bh, door, lit) {
    const dx = door.x * 16;
    const dy = door.y * 16;
    rr(ctx, dx + 2, dy - 2, 12, 18, '#3a2b22');
    rr(ctx, dx + 3, dy - 1, 10, 17, '#7a5338');
    rr(ctx, dx + 4, dy, 8, 16, '#946940');
    rr(ctx, dx + 5, dy + 2, 6, 5, lit ? '#f0cf84' : '#5f4937');
    rr(ctx, dx + 10, dy + 10, 1, 2, '#e3c878');
    rr(ctx, dx + 1, dy + 15, 14, 2, '#4a3a2e');
    rr(ctx, dx + 1, dy + 17, 14, 1, 'rgba(30,40,30,.3)');
  }

  function drawBuilding(ctx, b, map, t, night) {
    const bx = b.x * 16, by = b.y * 16, bw = b.w * 16, bh = b.h * 16;
    if (b.type === 'gate') return drawGate(ctx, bx, by, bw, bh, t);
    if (b.type === 'shelter') return drawShelter(ctx, bx, by, bw, bh, t);
    if (b.type === 'shrine') return drawShrine(ctx, bx, by, bw, bh, t, night);
    const lit = night;
    // shadow
    ctx.fillStyle = 'rgba(25,40,30,.22)';
    ctx.fillRect(bx + 4, by + bh - 2, bw, 4);
    // wall
    const wallTop = by + 16;
    rr(ctx, bx, wallTop, bw, bh - 16, '#5a4534');
    rr(ctx, bx + 2, wallTop + 2, bw - 4, bh - 20, '#e3d3ac');
    rr(ctx, bx + 2, wallTop + 2, bw - 4, 3, '#f0e2bf');
    // beams
    const beam = b.type === 'lab' ? '#5f7750' : b.type === 'shop' ? '#8b6238' : '#7a5a3d';
    rr(ctx, bx + 2, wallTop + 2, 3, bh - 20, beam);
    rr(ctx, bx + bw - 5, wallTop + 2, 3, bh - 20, beam);
    rr(ctx, bx + 2, by + bh - 6, bw - 4, 2, beam);
    // roof
    let roofA = '#a85844', roofB = '#c87355', roofC = '#824336';
    if (b.type === 'lab') { roofA = '#4e6d4a'; roofB = '#668652'; roofC = '#3d553b'; }
    if (b.type === 'shop') { roofA = '#9a6b3c'; roofB = '#bd8850'; roofC = '#75502d'; }
    if (b.type === 'heal') { roofA = '#b56872'; roofB = '#d38b8e'; roofC = '#8f4f59'; }
    if (b.type === 'gym') { roofA = '#496947'; roofB = '#62845a'; roofC = '#354f37'; }
    tri(ctx, [[bx - 4, wallTop + 4], [bx + 4, wallTop - 14], [bx + bw - 4, wallTop - 14], [bx + bw + 4, wallTop + 4]], '#4a392d');
    tri(ctx, [[bx - 2, wallTop + 2], [bx + 6, wallTop - 12], [bx + bw - 6, wallTop - 12], [bx + bw + 2, wallTop + 2]], roofA);
    for (let yy = wallTop - 10; yy < wallTop + 1; yy += 5) {
      rr(ctx, bx + 4 + (wallTop - yy) / 2, yy, bw - 8 - (wallTop - yy), 1, roofC);
    }
    rr(ctx, bx + 8, wallTop - 14, bw - 16, 2, roofB);
    rr(ctx, bx + 10, wallTop - 12, bw - 20, 1, roofC);
    // chimney
    if (b.type === 'home' || b.type === 'heal') {
      rr(ctx, bx + bw - 24, wallTop - 26, 8, 16, '#4a392d');
      rr(ctx, bx + bw - 23, wallTop - 25, 6, 14, '#9b6b54');
      rr(ctx, bx + bw - 24, wallTop - 27, 8, 2, '#5d4537');
      if (night) {
        for (let i = 0; i < 3; i++) {
          const a = .12 + .08 * Math.sin(t + i);
          ctx.fillStyle = `rgba(230,220,210,${a})`;
          ctx.fillRect(bx + bw - 22 + Math.sin(t + i) * 3, wallTop - 32 - i * 4, 4, 3);
        }
      }
    }
    // windows
    const winY = wallTop + 12;
    drawWindow(ctx, bx + 10, winY, 16, 12, lit);
    if (bw > 72) drawWindow(ctx, bx + bw - 30, winY, 16, 12, lit);
    // sign
    const signText = b.type === 'lab' ? '苔语研究所' : b.type === 'shop' ? '杂货铺' : b.type === 'heal' ? '驿站' : b.type === 'gym' ? '森语道馆' : '';
    if (signText) {
      const sw = signText.length * 6 + 8;
      const sx = bx + bw / 2 - sw / 2;
      rr(ctx, sx, wallTop - 2, sw, 9, '#4a392d');
      rr(ctx, sx + 1, wallTop - 1, sw - 2, 7, '#e8d7ae');
      // tiny glyph blocks (avoid canvas text pixel blur)
      for (let i = 0; i < signText.length; i++) {
        rr(ctx, sx + 4 + i * 6, wallTop + 1, 4, 1, '#6d5538');
        rr(ctx, sx + 5 + i * 6, wallTop + 2, 2, 2, '#6d5538');
      }
    }
    // door
    drawDoor(ctx, bx, by, bw, bh, b.door, lit);
    // props by type
    if (b.type === 'lab') {
      rr(ctx, bx + 6, by + bh - 10, 8, 8, '#7a5a3d');
      rr(ctx, bx + 7, by + bh - 9, 6, 6, '#8db27a');
      rr(ctx, bx + 9, by + bh - 12, 2, 6, '#5c7d4d');
      ell(ctx, bx + 10, by + bh - 13, 3, 2, '#7aa05d');
    }
    if (b.type === 'shop') {
      // awning
      for (let i = 0; i < bw / 10; i++) {
        rr(ctx, bx + 2 + i * 10, wallTop + 2, 10, 6, i % 2 ? '#e8cf91' : '#b45f4a');
        rr(ctx, bx + 2 + i * 10, wallTop + 7, 10, 1, '#7c4c39');
      }
      rr(ctx, bx + 4, by + bh - 10, 9, 8, '#8c6543');
      rr(ctx, bx + 5, by + bh - 9, 7, 6, '#b98a56');
    }
    if (b.type === 'heal') {
      ell(ctx, bx + bw - 12, by + bh - 12, 4, 4, '#f0e8d2');
      rr(ctx, bx + bw - 14, by + bh - 13, 4, 1, '#c67a7f');
      rr(ctx, bx + bw - 13, by + bh - 14, 1, 4, '#c67a7f');
    }
    if (b.type === 'gym') {
      // banners
      rr(ctx, bx + 5, wallTop + 8, 3, 22, '#d9c790');
      rr(ctx, bx + bw - 8, wallTop + 8, 3, 22, '#d9c790');
      ell(ctx, bx + 6, wallTop + 30, 3, 2, '#d9c790');
      ell(ctx, bx + bw - 7, wallTop + 30, 3, 2, '#d9c790');
      // emblem above door
      ell(ctx, bx + bw / 2, wallTop - 3, 6, 5, '#f2d37a');
      ell(ctx, bx + bw / 2, wallTop - 3, 4, 3, '#62845a');
      rr(ctx, bx + bw / 2 - 1, wallTop - 6, 2, 6, '#e8e1c0');
    }
  }

  function drawGate(ctx, bx, by, bw, bh, t) {
    // open wooden arch
    rr(ctx, bx + 2, by + bh - 4, bw - 4, 4, 'rgba(30,45,32,.25)');
    rr(ctx, bx + 3, by + 4, 6, bh - 4, '#5b412d');
    rr(ctx, bx + bw - 9, by + 4, 6, bh - 4, '#5b412d');
    rr(ctx, bx + 4, by + 6, 3, bh - 8, '#8a6340');
    rr(ctx, bx + bw - 8, by + 6, 3, bh - 8, '#8a6340');
    rr(ctx, bx + 2, by + 2, bw - 4, 5, '#5b412d');
    rr(ctx, bx + 3, by + 3, bw - 6, 3, '#8a6340');
    for (let i = 0; i < bw; i += 9) rr(ctx, bx + 5 + i, by + 3, 1, 3, '#6b4c31');
    // hanging moss
    for (let i = 0; i < 5; i++) {
      const x = bx + 12 + i * 12;
      line(ctx, x, by + 6, x + Math.sin(t + i) * 1, by + 10 + (i % 2) * 3, '#719365', 1);
    }
    // lanterns
    ell(ctx, bx + 16, by + 12, 3, 3, 'rgba(255,229,143,.35)');
    ell(ctx, bx + 16, by + 12, 2, 2, '#f0ce75');
    ell(ctx, bx + bw - 16, by + 12, 3, 3, 'rgba(255,229,143,.35)');
    ell(ctx, bx + bw - 16, by + 12, 2, 2, '#f0ce75');
  }

  function drawShelter(ctx, bx, by, bw, bh, t) {
    rr(ctx, bx + 5, by + bh - 3, bw - 10, 3, 'rgba(30,45,32,.2)');
    rr(ctx, bx + 2, by + 8, 3, bh - 10, '#5b412d');
    rr(ctx, bx + bw - 5, by + 8, 3, bh - 10, '#5b412d');
    tri(ctx, [[bx, by + 10], [bx + bw / 2, by], [bx + bw, by + 10]], '#4a392d');
    tri(ctx, [[bx + 2, by + 9], [bx + bw / 2, by + 2], [bx + bw - 2, by + 9]], '#8a6340');
    for (let i = 0; i < bw; i += 8) rr(ctx, bx + 2 + i, by + 7, 4, 1, '#a78052');
    // bench
    rr(ctx, bx + 10, by + bh - 6, bw - 20, 2, '#7a5338');
    rr(ctx, bx + 12, by + bh - 4, 2, 3, '#5b412d');
    rr(ctx, bx + bw - 14, by + bh - 4, 2, 3, '#5b412d');
  }

  function drawShrine(ctx, bx, by, bw, bh, t, night) {
    const pulse = .45 + .25 * Math.sin(t * 1.3);
    const ix = bx + 10, iw = bw - 20;
    // aura
    ctx.fillStyle = `rgba(140,224,181,${pulse * .24})`;
    ctx.fillRect(bx - 7, by - 9, bw + 14, bh + 15);
    // stepped stone base
    rr(ctx, bx + 2, by + bh - 5, bw - 4, 5, '#39483a');
    rr(ctx, bx + 5, by + bh - 8, bw - 10, 3, '#58664f');
    rr(ctx, ix - 3, by + bh - 19, iw + 6, 11, '#465441');
    rr(ctx, ix, by + bh - 17, iw, 9, '#8b9a7a');
    rr(ctx, ix + 3, by + bh - 16, iw - 6, 7, '#aeb995');
    // stone blocks
    for (let i = 0; i < 6; i++) {
      rr(ctx, ix + 3 + i * 11, by + bh - 15, 1, 6, 'rgba(62,78,56,.3)');
    }
    // pillars
    for (const px of [bx + 7, bx + bw - 15]) {
      rr(ctx, px, by + 4, 8, 28, '#403a2e');
      rr(ctx, px + 1, by + 5, 6, 26, '#b8ad88');
      rr(ctx, px + 2, by + 6, 2, 24, '#d3c9a3');
      rr(ctx, px - 1, by + 30, 10, 3, '#6d5a43');
      // moss on pillar
      for (let j = 0; j < 4; j++) rr(ctx, px + (j % 2 ? 4 : 0), by + 9 + j * 5, 2, 1, '#6f8f5f');
    }
    // roof
    tri(ctx, [[bx - 5, by + 8], [bx + bw / 2, by - 13], [bx + bw + 5, by + 8]], '#2f3f2c');
    tri(ctx, [[bx - 2, by + 6], [bx + bw / 2, by - 10], [bx + bw + 2, by + 6]], '#5b7150');
    rr(ctx, bx + 5, by + 5, bw - 10, 3, '#43563d');
    // hanging vines
    for (let i = 0; i < 6; i++) {
      const x = bx + 10 + i * 14;
      const sway = Math.sin(t * .9 + i) * 1;
      line(ctx, x, by + 5, x + sway, by + 12 + (i % 3) * 4, i % 2 ? '#6f8f5f' : '#557a4e', 1);
      if (i % 2 === 0) rr(ctx, x + sway, by + 15 + (i % 3) * 2, 1, 2, '#8eb07a');
    }
    // rune above altar
    ctx.fillStyle = `rgba(255,246,201,${.18 + .12 * Math.sin(t * 1.7)})`;
    ctx.beginPath(); ctx.arc(bx + bw / 2, by + 18, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,239,169,.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(bx + bw / 2, by + 18, 7, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + t * .15;
      rr(ctx, bx + bw / 2 + Math.cos(a) * 5, by + 18 + Math.sin(a) * 5, 1, 1, '#fff8d9');
    }
    // glowing moss
    for (let i = 0; i < 9; i++) {
      const x = bx + 9 + i * 10, y = by + 13 + (i % 3) * 5;
      ctx.fillStyle = `rgba(125,224,193,${.38 + .32 * Math.sin(t * 2 + i)})`;
      ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1);
    }
    // altar
    rr(ctx, bx + bw / 2 - 10, by + bh - 26, 20, 11, '#3d3226');
    rr(ctx, bx + bw / 2 - 9, by + bh - 25, 18, 9, '#c2b68f');
    rr(ctx, bx + bw / 2 - 7, by + bh - 24, 14, 7, '#d5c9a3');
    ell(ctx, bx + bw / 2, by + bh - 28, 7, 4, 'rgba(255,246,201,.28)');
    ell(ctx, bx + bw / 2, by + bh - 28, 4, 3, '#f5e7a9');
    rr(ctx, bx + bw / 2 - 1, by + bh - 32, 2, 5, '#fff8d9');
    // door / inner glow
    const dg = ctx.createLinearGradient(0, by + bh - 20, 0, by + bh - 6);
    dg.addColorStop(0, `rgba(125,224,193,${.22 + .1 * Math.sin(t * 1.6)})`);
    dg.addColorStop(1, 'rgba(125,224,193,.02)');
    ctx.fillStyle = dg;
    ctx.fillRect(bx + bw / 2 - 12, by + bh - 21, 24, 15);
    // tiny lanterns
    for (const lx of [bx + 14, bx + bw - 14]) {
      ell(ctx, lx, by + 13, 2, 2, 'rgba(240,206,117,.65)');
      rr(ctx, lx - 1, by + 15, 2, 2, '#5d4537');
    }
  }

  /* ---------- 道具拾取 ---------- */
  const iconCache = new Map();
  function getItemIcon(item) {
    if (!iconCache.has(item)) {
      const c = document.createElement('canvas'); c.width = 24; c.height = 24;
      PKM.ART.drawItemIcon(c, item);
      iconCache.set(item, c);
    }
    return iconCache.get(item);
  }

  function drawItem(ctx, it, sx, sy, t) {
    const bob = Math.sin(t * 2.6 + it.x) * 1.5;
    const a = .2 + .15 * Math.sin(t * 3 + it.y);
    ctx.fillStyle = `rgba(255,240,170,${a})`;
    ctx.beginPath(); ctx.arc(sx + 8, sy + 8 + bob, 7, 0, Math.PI * 2); ctx.fill();
    const icon = getItemIcon(it.item);
    ctx.drawImage(icon, sx, sy - 2 + bob, 16, 16);
    rr(ctx, sx + 7, sy + 14, 2, 1, 'rgba(40,50,40,.28)');
    if (Math.sin(t * 4 + it.x + it.y) > .3) {
      rr(ctx, sx + 12, sy - 1 + bob, 1, 3, '#fff4bf');
      rr(ctx, sx + 11, sy + bob, 3, 1, '#fff4bf');
    }
  }

  function drawWaypoint(ctx, p, state, t) {
    const sx = p.x * 16, sy = p.y * 16;
    const on = !!(state.waypoints && state.waypoints[p.id]);
    ctx.fillStyle = 'rgba(20, 36, 25, .22)';
    ctx.beginPath(); ctx.ellipse(sx + 8, sy + 14, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
    if (on) {
      const a = .24 + .12 * Math.sin(t * 2.2 + p.x);
      ctx.fillStyle = `rgba(240, 205, 116, ${a})`;
      ctx.beginPath(); ctx.ellipse(sx + 8, sy + 12, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    rr(ctx, sx + 3, sy + 11, 10, 3, on ? '#8e875e' : '#5f6354');
    rr(ctx, sx + 4, sy + 12, 8, 2, on ? '#c6b37a' : '#777b69');
    rr(ctx, sx + 6, sy + 6, 4, 7, '#4a3a2e');
    rr(ctx, sx + 7, sy + 6, 2, 7, on ? '#d9c58d' : '#8f866c');
    rr(ctx, sx + 4, sy + 4, 8, 3, '#4a3a2e');
    rr(ctx, sx + 5, sy + 4, 6, 2, on ? '#f0cf84' : '#8d846b');
    if (on) {
      const pulse = .55 + .3 * Math.sin(t * 3 + p.y);
      ell(ctx, sx + 8, sy + 5, 3, 2, `rgba(255,231,150,${pulse * .5})`);
      rr(ctx, sx + 7, sy + 3, 2, 2, '#fff3b0');
      rr(ctx, sx + 5, sy - 1, 1, 2, 'rgba(220,255,220,.7)');
    }
    // little signpost ribbon
    rr(ctx, sx + 12, sy + 9, 3, 1, on ? '#7ac8ad' : '#7b7d70');
  }

  function drawGuidePath(ctx, guide, t) {
    if (!guide || !guide.enabled || !guide.path || guide.path.length < 2) return;
    const pts = guide.path.map(p => ({ x: p.x * 16 + 8, y: p.y * 16 + 13 }));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255, 246, 200, .12)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(242, 209, 120, .62)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = -(t * 14) % 8;
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 1; i < pts.length; i += 2) {
      const p = pts[i];
      ctx.fillStyle = 'rgba(255, 240, 170, .55)';
      ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
    }
    const spark = pts[Math.floor(t * 3.4) % pts.length];
    if (spark) {
      ctx.fillStyle = 'rgba(255, 251, 214, .18)';
      ctx.fillRect(Math.round(spark.x) - 3, Math.round(spark.y) - 3, 6, 6);
      ctx.fillStyle = '#fff4bd';
      ctx.fillRect(Math.round(spark.x) - 1, Math.round(spark.y) - 1, 2, 2);
    }
    ctx.restore();
  }

  function drawGuideMarker(ctx, guide, t) {
    if (!guide || !guide.enabled || !guide.localTarget) return;
    const x = guide.localTarget.x * 16 + 8;
    const y = guide.localTarget.y * 16 + 8;
    const bob = Math.sin(t * 2.6) * 2;
    ctx.save();
    // soft beam
    const grad = ctx.createLinearGradient(x, y - 24, x, y + 5);
    grad.addColorStop(0, 'rgba(255, 231, 150, 0)');
    grad.addColorStop(.55, 'rgba(255, 224, 126, .16)');
    grad.addColorStop(1, 'rgba(255, 214, 112, .34)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 5, y - 30, 10, 35);
    // ground ring
    ctx.strokeStyle = 'rgba(255, 235, 160, .55)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y + 6, 6 + Math.sin(t * 3) * 1, 2.5, 0, 0, Math.PI * 2); ctx.stroke();
    // floating diamond
    const cy = y - 17 + bob;
    ctx.translate(x, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(255, 242, 180, .22)';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = '#f5d67f';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.fillStyle = '#fff8d8';
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    if (guide.transfer) {
      ctx.save();
      ctx.fillStyle = 'rgba(20, 34, 25, .7)';
      ctx.fillRect(x - 8, y - 38 + bob, 16, 9);
      ctx.fillStyle = '#f4e3b2';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('→', x, y - 31 + bob);
      ctx.restore();
    }
  }

  function drawSign(ctx, p, sx, sy) {
    rr(ctx, sx + 7, sy + 9, 2, 6, '#5b412d');
    rr(ctx, sx + 2, sy + 3, 12, 8, '#4a392d');
    rr(ctx, sx + 3, sy + 4, 10, 6, '#c2a36e');
    rr(ctx, sx + 5, sy + 6, 6, 1, '#6d5538');
    rr(ctx, sx + 5, sy + 8, 4, 1, '#6d5538');
  }

  function drawRune(ctx, p, sx, sy, lit, t) {
    const pulse = lit ? .65 + .3 * Math.sin(t * 3 + p.x) : .22 + .12 * Math.sin(t + p.x);
    // dark slate base so the rune reads on the moss floor
    ctx.fillStyle = 'rgba(19, 38, 29, .55)';
    ctx.beginPath(); ctx.arc(sx + 8, sy + 9, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(125,224,193,${pulse})`;
    ctx.beginPath(); ctx.arc(sx + 8, sy + 9, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = lit ? '#e8fff2' : '#a4c3a8';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx + 8, sy + 9, 5, 0, Math.PI * 2); ctx.stroke();
    // leaf glyph
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + (lit ? t * .3 : 0);
      ctx.fillStyle = lit ? '#ffffff' : '#cfe0ce';
      ctx.fillRect(sx + 8 + Math.cos(a) * 4, sy + 9 + Math.sin(a) * 4, 2, 2);
    }
    if (lit) {
      rr(ctx, sx + 7, sy + 8, 2, 2, '#ffffff');
      rr(ctx, sx + 4, sy + 2, 1, 2, 'rgba(200,255,228,.8)');
      rr(ctx, sx + 12, sy + 1, 1, 2, 'rgba(200,255,228,.6)');
    }
  }

  function drawGymGate(ctx, p, sx, sy, t) {
    const x = p.x * 16 - sx, y = p.y * 16 - sy;
    const w = p.w * 16;
    const pulse = .3 + .15 * Math.sin(t * 2);
    ctx.fillStyle = `rgba(125,224,193,${pulse})`;
    ctx.fillRect(x, y + 2, w, 12);
    for (let i = 0; i < w; i += 8) {
      const h = 8 + Math.sin(t * 2 + i * .3) * 3;
      rr(ctx, x + i + 2, y + 16 - h, 2, h, 'rgba(180,255,220,.4)');
      rr(ctx, x + i + 2, y + 16 - h, 1, 2, '#eafff2');
    }
    for (let i = 0; i < w; i += 32) {
      rr(ctx, x + i + 10, y + 4, 2, 10, 'rgba(220,255,236,.5)');
      rr(ctx, x + i + 5, y + 8, 12, 2, 'rgba(220,255,236,.35)');
    }
  }

  /* ---------- 环境粒子 ---------- */
  const particles = [];
  function initParticles() {
    if (particles.length) return;
    for (let i = 0; i < 40; i++) {
      particles.push({ x: Math.random() * VW, y: Math.random() * VH, s: Math.random() * .7 + .3, p: Math.random() * 10, k: Math.random() });
    }
  }
  function drawAmbient(ctx, kind, t, night) {
    initParticles();
    if (kind === 'firefly') {
      for (const p of particles.slice(0, 26)) {
        const x = (p.x + Math.sin(t * .35 + p.p) * 14 + t * 4 * p.s) % (VW + 20) - 10;
        const y = p.y + Math.cos(t * .5 + p.p) * 8;
        const a = .25 + .65 * (0.5 + 0.5 * Math.sin(t * 2 + p.p));
        ctx.fillStyle = `rgba(200,255,196,${a})`;
        ctx.fillRect(x, y, 1, 1);
        if (p.k > .6) {
          ctx.fillStyle = `rgba(160,255,190,${a * .25})`;
          ctx.fillRect(x - 1, y - 1, 3, 3);
        }
      }
    } else if (kind === 'petal') {
      for (const p of particles.slice(0, 16)) {
        const x = (p.x + Math.sin(t * .6 + p.p) * 12 + t * 7 * p.s) % (VW + 20) - 10;
        const y = (p.y + t * 5 * p.s + Math.sin(t + p.p) * 6) % (VH + 10);
        ctx.fillStyle = p.k > .5 ? 'rgba(245,205,200,.55)' : 'rgba(235,225,160,.45)';
        ctx.fillRect(x, y, 1, 1);
      }
    } else if (kind === 'wind') {
      for (const p of particles.slice(0, 18)) {
        const x = (p.x + t * 14 * p.s) % (VW + 20) - 10;
        const y = p.y + Math.sin(t * .9 + p.p) * 5;
        ctx.fillStyle = 'rgba(225,238,190,.32)';
        ctx.fillRect(x, y, 2, 1);
      }
    } else if (kind === 'water') {
      for (const p of particles.slice(0, 12)) {
        const a = .2 + .3 * (0.5 + 0.5 * Math.sin(t * 2 + p.p));
        ctx.fillStyle = `rgba(220,245,235,${a})`;
        ctx.fillRect((p.x + t * 4) % VW, p.y, 1, 1);
      }
    }
    if (night && kind !== 'firefly') {
      for (let i = 0; i < 8; i++) {
        const x = (i * 47 + t * 6) % VW, y = (i * 31 + Math.sin(t + i) * 5) % VH;
        ctx.fillStyle = 'rgba(240,255,220,.35)';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  function mapTimeTint(hour) {
    if (hour >= 7 && hour < 16.5) return { c: '#f7e6b0', a: 0 };
    if (hour >= 16.5 && hour < 18.5) return { c: '#e58a5c', a: .10 };
    if (hour >= 18.5 && hour < 20) return { c: '#5b4e82', a: .20 };
    if (hour >= 20 || hour < 5) return { c: '#081e38', a: .48 };
    return { c: '#5e6f9d', a: .18 };
  }

  /* ---------- 实时小地图 ---------- */
  function drawMiniMap(ctx, map, state, guide, t) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#152c21';
    ctx.fillRect(0, 0, W, H);
    const scale = Math.max(2, Math.min(6, Math.floor(Math.min((W - 10) / map.w, (H - 10) / map.h))));
    const ox = Math.floor((W - map.w * scale) / 2);
    const oy = Math.floor((H - map.h * scale) / 2);
    const colors = {
      '.': '#6f9a53', ',': '#4f7c3f', 'p': '#c8ad78', 'f': '#7aa75b', '~': '#3f7f86', '=': '#a57b4e',
      '#': '#2c5139', 'T': '#284a33', 'r': '#8b8d7d', 'm': '#9d5d6d', 'g': '#6fbba0', 's': '#8d9080',
      'W': '#59665a', 'o': '#9b7047', '*': '#b9c795', 'x': '#4e4238'
    };
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        ctx.fillStyle = colors[map.tiles[y][x]] || '#6f9a53';
        ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
    }
    for (const b of map.buildings || []) {
      ctx.fillStyle = b.type === 'gym' ? '#6d8b62' : b.type === 'shrine' ? '#96a37f' : '#b9634d';
      ctx.fillRect(ox + b.x * scale + 1, oy + b.y * scale + 1, b.w * scale - 2, Math.max(2, b.h * scale - 2));
    }
    if (guide && guide.enabled && guide.path && guide.path.length > 1) {
      ctx.strokeStyle = 'rgba(244, 211, 123, .85)';
      ctx.lineWidth = 1;
      ctx.setLineDash([1, 2]);
      ctx.beginPath();
      guide.path.forEach((p, i) => {
        const px = ox + p.x * scale + scale / 2, py = oy + p.y * scale + scale / 2;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const wp of D.WAYPOINTS || []) {
      if (wp.map !== map.id) continue;
      const on = state.waypoints && state.waypoints[wp.id];
      const px = ox + wp.x * scale + scale / 2, py = oy + wp.y * scale + scale / 2;
      ctx.fillStyle = on ? '#6fe0b7' : '#8e8b78';
      ctx.fillRect(px - 2, py - 2, 4, 4);
      if (on) { ctx.fillStyle = '#efffe8'; ctx.fillRect(px - 1, py - 1, 2, 2); }
    }
    for (const n of D.NPCS.filter(n => n.map === map.id && !(n.hideFlag && state.flags[n.hideFlag]))) {
      const px = ox + n.x * scale + scale / 2, py = oy + n.y * scale + scale / 2;
      ctx.fillStyle = n.trainer ? '#d9775e' : '#f0e7ca';
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }
    for (const it of map.items || []) {
      if (state.flags['item_' + map.id + '_' + it.id]) continue;
      const px = ox + it.x * scale + scale / 2, py = oy + it.y * scale + scale / 2;
      ctx.fillStyle = '#fff1a8'; ctx.fillRect(px, py, 1, 1);
    }
    if (guide && guide.enabled && guide.localTarget) {
      const px = ox + guide.localTarget.x * scale + scale / 2, py = oy + guide.localTarget.y * scale + scale / 2;
      const bob = Math.sin(t * 2.4) * 1;
      ctx.save(); ctx.translate(px, py - 5 + bob); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#c96051'; ctx.fillRect(-3, -3, 6, 6);
      ctx.fillStyle = '#fff4d8'; ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    const px = ox + state.player.x * scale + scale / 2;
    const py = oy + state.player.y * scale + scale / 2;
    ctx.fillStyle = 'rgba(241, 206, 119, .24)';
    ctx.beginPath(); ctx.arc(px, py, 5 + Math.sin(t * 3) * 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0ce75'; ctx.fillRect(px - 2, py - 2, 4, 4);
    ctx.fillStyle = '#fffbe8'; ctx.fillRect(px - 1, py - 1, 2, 2);
    ctx.strokeStyle = '#7e8f6b'; ctx.lineWidth = 1; ctx.strokeRect(.5, .5, W - 1, H - 1);
  }

  /* ---------- 主世界 ---------- */
  function drawWorld(ctx, map, state, t) {
    const ts = 16;
    const mapW = map.w * ts, mapH = map.h * ts;
    let camX = state.visual.x - VW / 2;
    let camY = state.visual.y - VH / 2;
    if (mapW <= VW) camX = (mapW - VW) / 2;
    else camX = clamp(camX, 0, mapW - VW);
    if (mapH <= VH) camY = (mapH - VH) / 2;
    else camY = clamp(camY, 0, mapH - VH);
    camX = Math.round(camX); camY = Math.round(camY);
    if (PKM.RENDER) PKM.RENDER.lastCamera = { camX, camY };

    ctx.fillStyle = '#16241e';
    ctx.fillRect(0, 0, VW, VH);
    ctx.save();
    ctx.translate(-camX, -camY);

    const x0 = Math.max(0, Math.floor(camX / 16)), x1 = Math.min(map.w - 1, Math.ceil((camX + VW) / 16));
    const y0 = Math.max(0, Math.floor(camY / 16)), y1 = Math.min(map.h - 1, Math.ceil((camY + VH) / 16));
    for (let y = y0; y <= y1; y++) {
      const row = map.tiles[y];
      for (let x = x0; x <= x1; x++) {
        drawTile(ctx, map, row[x], x, y, x * 16, y * 16, t);
      }
    }

    // buildings
    (map.buildings || []).forEach(b => drawBuilding(ctx, b, map, t, state.night));

    // ground props (runes etc.)
    (map.props || []).forEach(p => {
      if (p.type === 'rune') drawRune(ctx, p, p.x * 16, p.y * 16, !!(state.flags && state.flags.gymGateOpen) || !!(state.runes && state.runes[p.id]), t);
      if (p.type === 'waypoint') drawWaypoint(ctx, p, state, t);
    });

    // items
    (map.items || []).forEach(it => {
      if (state.flags['item_' + map.id + '_' + it.id]) return;
      drawItem(ctx, it, it.x * 16, it.y * 16, t);
    });

    drawGuidePath(ctx, PKM.GUIDE && PKM.GUIDE.current, t);

    // entities sorted by y
    const ents = [];
    const npcs = D.NPCS.filter(n => n.map === map.id && !(n.hideFlag && state.flags[n.hideFlag]));
    npcs.forEach(n => {
      ents.push({
        y: n.y * 16 + 16, kind: 'npc', npc: n,
        draw: () => {
          const sx = n.x * 16, sy = n.y * 16 - 4;
          ctx.fillStyle = 'rgba(20,35,25,.28)';
          ctx.beginPath(); ctx.ellipse(sx + 8, n.y * 16 + 14, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
          PKM.ART.drawTrainer(ctx, sx, sy, n.dir, 0, n.sprite, n.palette);
          const defeated = n.trainer && state.flags[D.TRAINERS[n.trainer].flag];
          if (n.trainer && !defeated && Math.abs(state.player.x - n.x) + Math.abs(state.player.y - n.y) <= 4) {
            const bob = Math.sin(t * 3) * 1;
            rr(ctx, sx + 5, sy - 12 + bob, 7, 8, '#f8f1d9');
            rr(ctx, sx + 9, sy - 13 + bob, 2, 2, '#c25447');
            rr(ctx, sx + 9, sy - 9 + bob, 1, 3, '#c25447');
            rr(ctx, sx + 8, sy - 4 + bob, 4, 1, '#f8f1d9');
          }
        }
      });
    });
    // player
    const px = state.player.x * 16, py = state.player.y * 16 - 4;
    ents.push({
      y: state.player.y * 16 + 16, kind: 'player',
      draw: () => {
        ctx.fillStyle = 'rgba(20,35,25,.28)';
        ctx.beginPath(); ctx.ellipse(px + 8, state.player.y * 16 + 14, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
        PKM.ART.drawTrainer(ctx, px, py, state.player.dir, state.player.frame, 'player', 'player');
        if (state.player.running) {
          ctx.fillStyle = 'rgba(220,230,200,.22)';
          const trail = state.player.dir === 'left' ? 12 : state.player.dir === 'right' ? -12 : 0;
          ctx.fillRect(px + 2 + trail, py + 15, 3, 1);
        }
      }
    });
    ents.sort((a, b) => a.y - b.y);
    ents.forEach(e => e.draw());

    drawGuideMarker(ctx, PKM.GUIDE && PKM.GUIDE.current, t);

    const clickFx = PKM.GAME && PKM.GAME.clickFx;
    if (clickFx) {
      const cx = clickFx.x * 16 + 8, cy = clickFx.y * 16 + 8;
      const p = Math.max(0, Math.min(1, clickFx.t / .55));
      ctx.strokeStyle = `rgba(255, 239, 177, ${.7 * p})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy + 5, 4 + (1 - p) * 8, 2 + (1 - p) * 4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255, 246, 200, ${.7 * p})`;
      ctx.fillRect(cx - 1, cy - 1, 2, 2);
    }

    // signs and gate drawn above entities that are behind? signs always
    (map.props || []).forEach(p => {
      if (p.type === 'sign') drawSign(ctx, p, p.x * 16, p.y * 16);
      if (p.type === 'gate' && !state.flags.gymGateOpen) drawGymGate(ctx, p, 0, 0, t);
    });
    (map.buildings || []).forEach(b => {
      if (b.type === 'gate' || b.type === 'shelter') return;
    });

    if (state.night) {
      (map.buildings || []).forEach(b => {
        if (b.type === 'gate' || b.type === 'shelter' || b.type === 'shrine') return;
        const gx = (b.x + b.w / 2) * 16;
        const gy = (b.y + b.h - .4) * 16;
        const grad = ctx.createRadialGradient(gx, gy, 5, gx, gy, 55);
        grad.addColorStop(0, 'rgba(255, 205, 120, .18)');
        grad.addColorStop(.55, 'rgba(255, 190, 100, .06)');
        grad.addColorStop(1, 'rgba(255, 180, 90, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(gx - 56, gy - 56, 112, 112);
      });
    }

    if (map.id === 'forest') {
      ctx.fillStyle = 'rgba(8, 42, 34, .06)';
      ctx.fillRect(0, 0, VW, VH);
    }

    ctx.restore();

    // cut-away dark edge vignette
    const vg = ctx.createRadialGradient(VW / 2, VH / 2, 70, VW / 2, VH / 2, 210);
    vg.addColorStop(0, 'rgba(10,20,14,0)');
    vg.addColorStop(1, 'rgba(10,20,14,.28)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);

    // time tint + player lantern
    const tint = mapTimeTint(state.hour);
    if (tint.a > 0) {
      ctx.fillStyle = tint.c; ctx.globalAlpha = tint.a;
      ctx.fillRect(0, 0, VW, VH);
      ctx.globalAlpha = 1;
      if (state.hour >= 18.5 || state.hour < 5.5) {
        const lx = state.player.x * 16 + 8 - camX;
        const ly = state.player.y * 16 + 8 - camY;
        const g = ctx.createRadialGradient(lx, ly, 12, lx, ly, 74);
        g.addColorStop(0, 'rgba(255,225,150,.16)');
        g.addColorStop(.6, 'rgba(255,210,130,.06)');
        g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
      }
    }

    drawAmbient(ctx, map.ambient || 'wind', t, state.night);
    return { camX, camY };
  }

  /* ---------- 标题场景 ---------- */
  function drawTitleScene(ctx, t) {
    const W = 320, H = 200;
    // sky bands
    const sky = ['#0c2026', '#102c30', '#16383a', '#224b46'];
    for (let i = 0; i < 4; i++) { ctx.fillStyle = sky[i]; ctx.fillRect(0, i * 40, W, 41); }
    // stars
    for (let i = 0; i < 46; i++) {
      const x = (i * 53 + 11) % W, y = (i * 37 + 7) % 95;
      const a = .25 + .55 * (0.5 + 0.5 * Math.sin(t * 1.4 + i));
      ctx.fillStyle = `rgba(230,240,205,${a})`;
      ctx.fillRect(x, y, i % 7 ? 1 : 2, 1);
    }
    // moon
    ell(ctx, 252, 44, 24, 24, 'rgba(245,235,190,.10)');
    ell(ctx, 252, 44, 18, 18, '#f2e7bc');
    ell(ctx, 246, 39, 4, 3, '#fff8dc');
    ell(ctx, 259, 50, 3, 2, '#e2d6a8');
    ell(ctx, 257, 36, 2, 2, '#e2d6a8');
    // clouds
    for (let i = 0; i < 4; i++) {
      const x = ((i * 95 + t * 3) % (W + 80)) - 40;
      const y = 52 + i * 9;
      ctx.fillStyle = 'rgba(180,205,195,.10)';
      ell(ctx, x, y, 22, 5, 'rgba(180,205,195,.10)');
      ell(ctx, x + 14, y - 3, 14, 4, 'rgba(180,205,195,.08)');
    }
    // far mountains
    tri(ctx, [[0, 124], [48, 74], [96, 124]], '#173b39');
    tri(ctx, [[64, 124], [122, 62], [178, 124]], '#1a4440');
    tri(ctx, [[150, 124], [210, 82], [268, 124]], '#153632');
    tri(ctx, [[224, 124], [286, 70], [340, 124]], '#12312e');
    // mist
    for (let i = 0; i < 8; i++) {
      const x = ((i * 52 + t * 5) % (W + 60)) - 30;
      ctx.fillStyle = 'rgba(150,190,170,.06)';
      ell(ctx, x, 114 + (i % 3) * 6, 34, 4, 'rgba(150,190,170,.06)');
    }
    // tree layers
    for (let layer = 0; layer < 2; layer++) {
      const base = 132 + layer * 18;
      const col = layer === 0 ? '#0d2927' : '#081c1b';
      for (let i = 0; i < 18; i++) {
        const x = i * 20 + (layer ? 8 : 0);
        const h = 24 + (i * 13 % 20) + layer * 8;
        tri(ctx, [[x - 10, base], [x, base - h], [x + 10, base]], col);
        tri(ctx, [[x - 7, base + 8], [x, base - h * .5], [x + 7, base + 8]], col);
      }
    }
    // ground
    rr(ctx, 0, 136, W, 64, '#0a1e1b');
    for (let i = 0; i < 50; i++) {
      const x = (i * 41) % W, y = 140 + (i * 23) % 58;
      rr(ctx, x, y, 1, 2, 'rgba(90,130,90,.25)');
    }
    // pond / path of light
    const grad = ctx.createLinearGradient(0, 154, 0, 200);
    grad.addColorStop(0, 'rgba(107,170,160,.30)');
    grad.addColorStop(1, 'rgba(38,83,80,.10)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(118, 180, 86, 26, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const y = 160 + i * 5;
      const w = 12 + i * 7 + Math.sin(t + i) * 4;
      rr(ctx, 118 - w / 2, y, w, 1, `rgba(245,235,190,${.16 - i * .012})`);
    }
    // foreground grass
    for (let i = 0; i < 70; i++) {
      const x = (i * 61) % W, y = 174 + (i * 19) % 26;
      line(ctx, x, y + 5, x + (i % 3 - 1), y, i % 2 ? '#1a3d2f' : '#214a36', 1);
    }
    // starters resting on a quiet hill at the edge of the woods
    ctx.fillStyle = 'rgba(19, 48, 35, .75)';
    ctx.beginPath(); ctx.ellipse(262, 168, 46, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.globalAlpha = .92;
    PKM.ART.drawMonster(ctx, 'sproutle', 237, 157, 42, t, false);
    PKM.ART.drawMonster(ctx, 'emberfox', 265, 154, 38, t + 1, false);
    PKM.ART.drawMonster(ctx, 'bubblotter', 290, 160, 36, t + 2, false);
    ctx.restore();
    for (let i = 0; i < 7; i++) {
      const x = 226 + i * 11 + Math.sin(t * .8 + i) * 6;
      const y = 140 + (i * 13 % 23) + Math.cos(t + i) * 4;
      const a = .25 + .45 * (0.5 + 0.5 * Math.sin(t * 2.4 + i));
      ctx.fillStyle = `rgba(230,255,200,${a})`;
      ctx.fillRect(x, y, 1, 1);
    }
    // fireflies
    for (let i = 0; i < 24; i++) {
      const x = (i * 47 + Math.sin(t * .5 + i) * 18 + t * 2) % W;
      const y = 115 + (i * 29) % 76 + Math.cos(t * .4 + i) * 6;
      const a = .3 + .6 * (0.5 + 0.5 * Math.sin(t * 2 + i));
      ctx.fillStyle = `rgba(210,255,190,${a})`;
      ctx.fillRect(x, y, 1, 1);
      if (i % 3 === 0) {
        ctx.fillStyle = `rgba(180,255,190,${a * .18})`;
        ctx.fillRect(x - 1, y - 1, 3, 3);
      }
    }
  }

  /* ---------- 战斗背景 ---------- */
  function drawBattleBackdrop(ctx, mood, t) {
    const W = 320, H = 200;
    if (mood === 'forest') {
      for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#102b28', '#16342e', '#1c3e34', '#244a3a'][i]; ctx.fillRect(0, i * 34, W, 35); }
      for (let i = 0; i < 11; i++) {
        const x = i * 32, h = 70 + (i * 17 % 40);
        tri(ctx, [[x - 26, 132], [x, 132 - h], [x + 26, 132]], i % 2 ? '#0c2320' : '#102a24');
        tri(ctx, [[x - 18, 140], [x, 140 - h * .7], [x + 18, 140]], i % 2 ? '#0a1f1c' : '#0e2621');
      }
      rr(ctx, 0, 130, W, 70, '#264a37');
      for (let i = 0; i < 24; i++) rr(ctx, i * 14, 134 + (i * 7 % 40), 10, 3, 'rgba(80,120,70,.25)');
      for (let i = 0; i < 8; i++) {
        const x = 20 + i * 38, y = 158 + (i % 3) * 14;
        ell(ctx, x, y, 4, 3, 'rgba(125,224,193,.14)');
        ctx.fillStyle = 'rgba(125,224,193,.5)'; ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    } else if (mood === 'gym') {
      rr(ctx, 0, 0, W, 132, '#5b6658');
      for (let y = 0; y < 132; y += 16) {
        rr(ctx, 0, y, W, 1, '#475247');
        for (let x = (y / 16 % 2) * 16; x < W; x += 32) rr(ctx, x, y, 1, 16, '#475247');
      }
      // banners
      for (const x of [45, 275]) {
        rr(ctx, x, 0, 16, 70, '#476445');
        rr(ctx, x + 2, 2, 12, 64, '#719063');
        ell(ctx, x + 8, 32, 6, 6, '#e4cd82');
        ell(ctx, x + 8, 32, 4, 4, '#557a4c');
        for (let i = 0; i < 3; i++) rr(ctx, x + 3 + i * 4, 54, 2, 8, '#d7c78d');
      }
      // floor
      rr(ctx, 0, 130, W, 70, '#6e5b42');
      for (let i = 0; i < 16; i++) rr(ctx, 0, 132 + i * 4, W, 1, '#584833');
      for (let i = 0; i < 6; i++) {
        const y = 146 + i * 9;
        rr(ctx, 0, y, W, 1, 'rgba(40,55,40,.25)');
      }
      // corner plants
      for (const x of [8, 296]) {
        ell(ctx, x, 140, 12, 8, '#2f4f3a');
        ell(ctx, x + 6, 134, 7, 5, '#3f6548');
      }
    } else {
      // outdoor sky
      const sky = mood === 'night' ? ['#1c2a45', '#263b5b', '#38566b', '#4d716e'] : ['#8cc7b6', '#a4d6bd', '#c5e3c2', '#e5edc1'];
      for (let i = 0; i < 4; i++) { ctx.fillStyle = sky[i]; ctx.fillRect(0, i * 30, W, 31); }
      // sun
      if (mood !== 'night') {
        ell(ctx, 260, 38, 18, 18, 'rgba(255,245,200,.25)');
        ell(ctx, 260, 38, 12, 12, '#fff2bd');
      }
      // clouds
      for (let i = 0; i < 3; i++) {
        const x = (i * 130 + t * 2) % (W + 40) - 20;
        ell(ctx, x, 40 + i * 16, 26, 6, 'rgba(255,255,240,.24)');
        ell(ctx, x + 14, 36 + i * 16, 16, 5, 'rgba(255,255,240,.2)');
      }
      // distant hills
      ell(ctx, 40, 132, 90, 34, '#6f9a70');
      ell(ctx, 160, 136, 100, 30, '#7da477');
      ell(ctx, 290, 132, 90, 36, '#6b9670');
      // tree line
      for (let i = 0; i < 14; i++) {
        const x = i * 24;
        tri(ctx, [[x - 13, 134], [x, 102 + (i * 11 % 20)], [x + 13, 134]], '#3f6a4d');
        tri(ctx, [[x - 8, 136], [x, 116 + (i * 7 % 14)], [x + 8, 136]], '#4f7a57');
      }
      rr(ctx, 0, 130, W, 70, '#6f9a53');
      for (let i = 0; i < 34; i++) {
        const x = (i * 37) % W, y = 136 + (i * 19) % 56;
        rr(ctx, x, y, 2, 1, '#81aa5f');
        if (i % 4 === 0) rr(ctx, x + 3, y + 2, 1, 2, '#5b8246');
      }
      // path patch
      ell(ctx, 160, 190, 130, 30, '#c8ad78');
      ell(ctx, 160, 195, 120, 22, '#d2b984');
    }
    // battle platforms
    const enemyOnForest = mood === 'forest' || mood === 'gym';
    ell(ctx, 226, 120, 40, 12, enemyOnForest ? 'rgba(24,48,36,.45)' : 'rgba(90,120,70,.3)');
    ell(ctx, 226, 116, 32, 9, enemyOnForest ? '#3d6048' : '#7fa45e');
    ell(ctx, 82, 174, 48, 14, enemyOnForest ? 'rgba(24,48,36,.42)' : 'rgba(90,120,70,.28)');
    ell(ctx, 82, 170, 38, 11, enemyOnForest ? '#41664c' : '#86a964');
    // vignette
    const vg = ctx.createRadialGradient(160, 100, 70, 160, 100, 210);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(6,14,10,.35)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  PKM.RENDER = {
    drawWorld, drawMiniMap, drawTitleScene, drawBattleBackdrop, drawTile, drawBuilding,
    drawMonster: PKM.ART.drawMonster, VW, VH, TILE, mapTimeTint, lastCamera: { camX: 0, camY: 0 }
  };
})();
