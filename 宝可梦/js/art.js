/* ============================================================
   像素美术：宝可梦、角色、道具与头像
   ============================================================ */
window.PKM = window.PKM || {};

(function () {
  const PKM = window.PKM;
  const D = PKM.DATA;

  const TRAINER_PALETTES = {
    player: { skin: '#f0c9a2', hair: '#493326', hat: '#3e6b4b', shirt: '#6c9a5b', shirt2: '#4b7449', pants: '#33463d', shoe: '#252e29', accent: '#f2c14e', pack: '#b86a43' },
    mom:    { skin: '#efc79f', hair: '#7b4b35', hat: '#7b4b35', shirt: '#c97b70', shirt2: '#a95d59', pants: '#6f5a63', shoe: '#3a2d2d', accent: '#f4dfb4' },
    prof:   { skin: '#e8c09b', hair: '#d8d2bd', hat: '#5d7c49', shirt: '#d9cfae', shirt2: '#b7aa86', pants: '#58604d', shoe: '#35392f', accent: '#7aa05d' },
    clerk:  { skin: '#e8bd91', hair: '#4d392b', hat: '#6b4c36', shirt: '#d4a24e', shirt2: '#b18036', pants: '#4b3e32', shoe: '#30281f', accent: '#f4e0ae' },
    nurse:  { skin: '#f2cba6', hair: '#e4dfd2', hat: '#f1e7d2', shirt: '#e79aa5', shirt2: '#c57788', pants: '#eee4d0', shoe: '#7e5d5d', accent: '#f7f2e3' },
    kid:    { skin: '#f2c9a3', hair: '#5b3f2b', hat: '#5b3f2b', shirt: '#e2b85c', shirt2: '#bd9141', pants: '#5c6d7c', shoe: '#35414d', accent: '#f5d98c' },
    old:    { skin: '#dfb58c', hair: '#d8d2c2', hat: '#d8d2c2', shirt: '#8a9a7b', shirt2: '#68785c', pants: '#5c5a4c', shoe: '#3b382e', accent: '#c9bd9b' },
    rival:  { skin: '#eec39b', hair: '#2f2e33', hat: '#2f2e33', shirt: '#bf5147', shirt2: '#8d3733', pants: '#3a3d47', shoe: '#22242b', accent: '#f0cd72' },
    bug:    { skin: '#ecc49d', hair: '#5b4630', hat: '#6a8348', shirt: '#8fa75c', shirt2: '#6a8142', pants: '#4b5b3b', shoe: '#303c2b', accent: '#d1bd73' },
    sky:    { skin: '#f2c8a0', hair: '#6a4b32', hat: '#5078a8', shirt: '#5f8fbf', shirt2: '#46739f', pants: '#334d6a', shoe: '#253446', accent: '#e7dfb6' },
    grass:  { skin: '#efc69f', hair: '#4d5e35', hat: '#789650', shirt: '#7eaa67', shirt2: '#5d8750', pants: '#52633e', shoe: '#303a2a', accent: '#e9d98f' },
    forest: { skin: '#e6bd95', hair: '#3c3027', hat: '#4b5c39', shirt: '#5a7050', shirt2: '#40543b', pants: '#39432f', shoe: '#262d23', accent: '#c7b36e' },
    mushroom:{ skin: '#f1c7a1', hair: '#8d4b48', hat: '#a95d67', shirt: '#d9a0a4', shirt2: '#b47b80', pants: '#5c5360', shoe: '#38303a', accent: '#f3e5c8' },
    leader: { skin: '#ecc49e', hair: '#334a3a', hat: '#557c4f', shirt: '#658d58', shirt2: '#466a48', pants: '#708a5c', shoe: '#364532', accent: '#f0d48a', robe: '#b9cf92' },
    villain:{ skin: '#d7b39b', hair: '#2b2531', hat: '#2b2531', shirt: '#4a4258', shirt2: '#332d40', pants: '#2c2834', shoe: '#1b1920', accent: '#846aa0', cloak: '#41364f' },
    pink:   { skin: '#f3cba6', hair: '#8b5240', hat: '#c77d83', shirt: '#e5a5ac', shirt2: '#c17f88', pants: '#7b5b67', shoe: '#4a343d', accent: '#f7e6cf' },
    music:  { skin: '#e7bd92', hair: '#4e3d31', hat: '#815f3b', shirt: '#bc8650', shirt2: '#956637', pants: '#4e4438', shoe: '#332a21', accent: '#e8d18d' },
    fish:   { skin: '#e2b488', hair: '#5c5a50', hat: '#5c5a50', shirt: '#67878a', shirt2: '#4d696c', pants: '#3f5054', shoe: '#2b3538', accent: '#d7c47a' },
    guide:  { skin: '#f0c69e', hair: '#5a402c', hat: '#7f9a53', shirt: '#9bb56a', shirt2: '#788f4d', pants: '#515f3b', shoe: '#343d28', accent: '#f0e2a6' }
  };

  function ell(g, cx, cy, rx, ry, col) {
    g.fillStyle = col;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
      }
    }
  }
  function outlineEll(g, cx, cy, rx, ry, o, fill) {
    ell(g, cx, cy, rx + 1, ry + 1, o);
    ell(g, cx, cy, rx, ry, fill);
  }
  function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  function line(g, x1, y1, x2, y2, col, w = 1) {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(x1 + .5, y1 + .5); g.lineTo(x2 + .5, y2 + .5); g.stroke();
  }
  function tri(g, pts, col) {
    g.fillStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath(); g.fill();
  }
  function eye(g, x, y, p, blink) {
    if (blink) { rect(g, x, y + 2, 3, 1, p.o); return; }
    rect(g, x, y, 3, 4, p.e || '#fff8e6');
    rect(g, x + 1, y + 1, 2, 3, p.p || '#1b211b');
    rect(g, x + 1, y + 1, 1, 1, '#ffffff');
  }

  function drawDeer(g, p, t, evo) {
    const bob = Math.sin(t * 2.1) > .6 ? 1 : 0;
    // tail
    outlineEll(g, 7, 20, 2, 3, p.o, p.l);
    // legs
    rect(g, 11, 25, 3, 5, p.o); rect(g, 12, 25, 1, 5, p.d);
    rect(g, 18, 25, 3, 5, p.o); rect(g, 19, 25, 1, 5, p.d);
    // body
    outlineEll(g, 15, 21 - bob, 9, 6, p.o, p.m);
    ell(g, 14, 23 - bob, 6, 3, p.d);
    ell(g, 13, 20 - bob, 3, 2, p.l);
    // neck and head
    outlineEll(g, 21, 16 - bob, 3, 4, p.o, p.m);
    outlineEll(g, 22, 11 - bob, 5, 4, p.o, p.l);
    // muzzle
    outlineEll(g, 26, 12 - bob, 3, 2, p.o, p.l);
    rect(g, 27, 11 - bob, 1, 1, p.p);
    // ears
    tri(g, [[18, 9 - bob], [17, 5 - bob], [21, 8 - bob]], p.o);
    tri(g, [[18, 8 - bob], [18, 6 - bob], [20, 8 - bob]], p.a);
    tri(g, [[25, 8 - bob], [27, 5 - bob], [27, 9 - bob]], p.o);
    // antlers / leaf
    if (evo) {
      line(g, 22, 7 - bob, 20, 2 - bob, p.a, 1);
      line(g, 20, 4 - bob, 18, 3 - bob, p.a, 1);
      line(g, 22, 7 - bob, 25, 2 - bob, p.a, 1);
      line(g, 25, 4 - bob, 27, 3 - bob, p.a, 1);
      ell(g, 18, 2 - bob, 2, 2, '#f8c4d6'); rect(g, 18, 2 - bob, 1, 1, '#fff4e2');
      ell(g, 27, 3 - bob, 2, 2, '#f8c4d6'); rect(g, 27, 3 - bob, 1, 1, '#fff4e2');
      ell(g, 20, 20 - bob, 2, 1, p.a);
    } else {
      tri(g, [[21, 8 - bob], [20, 4 - bob], [24, 7 - bob]], p.o);
      tri(g, [[21, 7 - bob], [21, 5 - bob], [23, 7 - bob]], p.a);
    }
    eye(g, 22, 10 - bob, p, Math.sin(t * 1.7 + 1) > .96);
    // spots
    rect(g, 13, 18 - bob, 2, 1, p.a); rect(g, 17, 20 - bob, 2, 1, p.a);
    // hooves
    rect(g, 11, 29, 3, 1, p.a); rect(g, 18, 29, 3, 1, p.a);
  }

  function drawFox(g, p, t, evo) {
    const bob = Math.sin(t * 2.4) > .5 ? 1 : 0;
    // tail
    tri(g, [[12, 22], [4, 21], [7, 10], [12, 17]], p.o);
    tri(g, [[11, 21], [6, 20], [8, 12], [11, 17]], p.m);
    tri(g, [[8, 16], [8, 12], [10, 14]], p.l);
    ell(g, 7, 11 - bob, 2, 2, p.a);
    // legs
    rect(g, 12, 25, 3, 5, p.o); rect(g, 19, 25, 3, 5, p.o);
    rect(g, 13, 27, 1, 2, p.d); rect(g, 20, 27, 1, 2, p.d);
    // body
    outlineEll(g, 16, 21 - bob, 8, 6, p.o, p.m);
    ell(g, 16, 23 - bob, 5, 3, p.l);
    // head
    outlineEll(g, 22, 13 - bob, 6, 5, p.o, p.m);
    tri(g, [[18, 10 - bob], [17, 3 - bob], [22, 8 - bob]], p.o);
    tri(g, [[18, 8 - bob], [18, 5 - bob], [20, 8 - bob]], p.d);
    tri(g, [[24, 8 - bob], [26, 2 - bob], [27, 9 - bob]], p.o);
    tri(g, [[24, 8 - bob], [25, 5 - bob], [26, 8 - bob]], p.d);
    ell(g, 26, 14 - bob, 3, 2, p.l);
    rect(g, 28, 13 - bob, 1, 1, p.p);
    eye(g, 21, 12 - bob, p, Math.sin(t * 2 + 2) > .96);
    // cheek + chest
    rect(g, 23, 15 - bob, 2, 1, p.a);
    ell(g, 20, 19 - bob, 3, 2, p.l);
    if (evo) {
      // extra tails
      tri(g, [[10, 19], [2, 17], [5, 8], [9, 14]], p.o);
      tri(g, [[9, 19], [4, 17], [6, 10], [8, 15]], p.d);
      ell(g, 4, 8 - bob, 2, 2, p.l);
      rect(g, 17, 8 - bob, 1, 1, p.a);
      // forehead mark
      tri(g, [[22, 9], [23, 6], [24, 9]], p.a);
    }
  }

  function drawOtter(g, p, t, evo) {
    const bob = Math.sin(t * 2.2) > .55 ? 1 : 0;
    // tail
    tri(g, [[10, 24], [3, 27], [5, 22], [10, 20]], p.o);
    tri(g, [[9, 23], [5, 25], [6, 22], [9, 21]], p.d);
    // legs
    rect(g, 11, 26, 4, 4, p.o); rect(g, 17, 26, 4, 4, p.o);
    rect(g, 12, 27, 2, 1, p.l); rect(g, 18, 27, 2, 1, p.l);
    // body
    outlineEll(g, 16, 21 - bob, 8, 7, p.o, p.m);
    ell(g, 16, 23 - bob, 5, 4, p.l);
    // head
    outlineEll(g, 18, 12 - bob, 7, 6, p.o, p.m);
    ell(g, 18, 14 - bob, 5, 3, p.l);
    // ears
    ell(g, 12, 8 - bob, 2, 2, p.o); ell(g, 12, 8 - bob, 1, 1, p.d);
    ell(g, 23, 8 - bob, 2, 2, p.o); ell(g, 23, 8 - bob, 1, 1, p.d);
    // muzzle
    ell(g, 17, 15 - bob, 4, 2, p.l);
    rect(g, 17, 14 - bob, 1, 1, p.p);
    rect(g, 18, 16 - bob, 2, 1, p.p);
    eye(g, 14, 11 - bob, p, Math.sin(t * 1.6 + 3) > .96);
    eye(g, 21, 11 - bob, p, false);
    // whiskers
    line(g, 13, 15 - bob, 10, 14 - bob, p.o, 1);
    line(g, 13, 16 - bob, 10, 17 - bob, p.o, 1);
    // bubbles
    ell(g, 27, 9 - bob, 2, 2, '#bfeaf2'); rect(g, 27, 8 - bob, 1, 1, '#ffffff');
    ell(g, 28, 5 - bob, 1, 1, '#bfeaf2');
    if (evo) {
      ell(g, 24, 19 - bob, 3, 2, p.a);
      rect(g, 13, 20 - bob, 2, 1, p.l);
      line(g, 14, 9 - bob, 11, 6 - bob, p.a, 1);
      line(g, 23, 9 - bob, 26, 6 - bob, p.a, 1);
    }
  }

  function drawMossball(g, p, t, evo) {
    const bob = Math.sin(t * 2.6) > .6 ? 1 : 0;
    const r = evo ? 11 : 9;
    // little feet
    rect(g, 11, 26, 4, 3, p.o); rect(g, 18, 26, 4, 3, p.o);
    rect(g, 12, 26, 2, 1, p.l); rect(g, 19, 26, 2, 1, p.l);
    outlineEll(g, 16, 19 - bob, r, r - 1, p.o, p.m);
    ell(g, 13, 16 - bob, 5, 4, p.l);
    // moss tufts
    ell(g, 8, 13 - bob, 3, 3, p.d); ell(g, 24, 12 - bob, 4, 3, p.d);
    ell(g, 20, 7 - bob, 4, 3, p.d); ell(g, 11, 8 - bob, 3, 2, p.l);
    if (evo) {
      ell(g, 12, 22 - bob, 4, 3, p.a);
      ell(g, 21, 23 - bob, 3, 2, p.a);
      rect(g, 24, 8 - bob, 2, 2, p.a);
    }
    // face
    rect(g, 10, 18 - bob, 6, 3, p.d);
    eye(g, 11, 19 - bob, p, Math.sin(t * 1.9 + 1) > .96);
    eye(g, 18, 19 - bob, p, false);
    rect(g, 15, 23 - bob, 2, 1, p.o);
    // tiny leaf
    tri(g, [[16, 8 - bob], [14, 4 - bob], [18, 7 - bob]], p.o);
    tri(g, [[16, 7 - bob], [15, 5 - bob], [17, 7 - bob]], '#8fc46a');
  }

  function drawBug(g, p, t, evo) {
    const bob = Math.sin(t * 3) > .2 ? 1 : 0;
    // wings
    ell(g, 12, 14 - bob, 5, 7, 'rgba(221,246,236,.7)');
    ell(g, 21, 14 - bob, 5, 7, 'rgba(221,246,236,.7)');
    line(g, 17, 10, 17, 24, p.d, 1);
    // legs
    line(g, 12, 21, 8, 26, p.o, 1); line(g, 22, 21, 26, 26, p.o, 1);
    line(g, 13, 24, 10, 28, p.o, 1); line(g, 20, 24, 23, 28, p.o, 1);
    // body
    outlineEll(g, 17, 18 - bob, 6, 7, p.o, p.m);
    ell(g, 17, 20 - bob, 4, 4, p.l);
    // head
    outlineEll(g, 17, 10 - bob, 5, 4, p.o, p.d);
    eye(g, 14, 9 - bob, p, false); eye(g, 18, 9 - bob, p, false);
    // antennae
    line(g, 14, 7 - bob, 11, 3 - bob, p.o, 1);
    line(g, 20, 7 - bob, 23, 3 - bob, p.o, 1);
    ell(g, 10, 2 - bob, 1, 1, p.a); ell(g, 24, 2 - bob, 1, 1, p.a);
    // glow tail
    ell(g, 17, 26 - bob, 3, 3, 'rgba(255,241,168,.6)');
    ell(g, 17, 26 - bob, 2, 2, p.a);
    rect(g, 17, 25 - bob, 1, 1, '#ffffff');
    if (evo) {
      // long wings + pattern
      tri(g, [[11, 12], [2, 7], [6, 18]], 'rgba(255,242,196,.65)');
      tri(g, [[23, 12], [30, 6], [27, 18]], 'rgba(255,242,196,.65)');
      rect(g, 11, 15 - bob, 2, 2, p.a); rect(g, 21, 15 - bob, 2, 2, p.a);
    }
  }

  function drawMoth(g, p, t, evo) {
    const bob = Math.sin(t * 2.8) > 0 ? 1 : 0;
    // big wings
    tri(g, [[14, 14], [1, 6], [5, 21]], p.o);
    tri(g, [[14, 14], [2, 8], [6, 19]], p.l);
    tri(g, [[20, 14], [31, 5], [27, 21]], p.o);
    tri(g, [[20, 14], [29, 8], [26, 19]], p.l);
    ell(g, 7, 12 - bob, 2, 2, p.a); ell(g, 25, 11 - bob, 2, 2, p.a);
    // body
    outlineEll(g, 17, 19 - bob, 4, 7, p.o, p.d);
    ell(g, 17, 21 - bob, 2, 4, p.m);
    // head
    outlineEll(g, 17, 10 - bob, 4, 3, p.o, p.m);
    eye(g, 14, 9 - bob, p, false); eye(g, 19, 9 - bob, p, false);
    line(g, 14, 7 - bob, 9, 3 - bob, p.o, 1);
    line(g, 20, 7 - bob, 25, 3 - bob, p.o, 1);
    ell(g, 8, 2 - bob, 1, 1, p.a); ell(g, 26, 2 - bob, 1, 1, p.a);
    // glow
    ell(g, 17, 25 - bob, 3, 2, 'rgba(255,238,160,.5)');
    rect(g, 16, 25 - bob, 2, 1, p.a);
    ell(g, 7, 14 - bob, 1, 1, '#fff7c2');
    ell(g, 26, 13 - bob, 1, 1, '#fff7c2');
  }

  function drawBird(g, p, t, evo) {
    const bob = Math.sin(t * 2.7) > .5 ? 1 : 0;
    // tail
    tri(g, [[12, 23], [5, 26], [8, 20]], p.o);
    tri(g, [[12, 23], [7, 25], [9, 21]], p.a);
    // legs
    line(g, 14, 26, 13, 30, p.a, 1); line(g, 19, 26, 20, 30, p.a, 1);
    // body
    outlineEll(g, 16, 21 - bob, 8, 6, p.o, p.m);
    ell(g, 16, 22 - bob, 5, 4, p.l);
    // wing
    ell(g, 13, 20 - bob, 4, 5, p.d);
    ell(g, 13, 20 - bob, 3, 4, p.a);
    // head
    outlineEll(g, 20, 12 - bob, 6, 5, p.o, p.m);
    ell(g, 20, 14 - bob, 4, 2, p.l);
    // beak
    tri(g, [[25, 13 - bob], [30, 15 - bob], [25, 16 - bob]], p.o);
    tri(g, [[25, 14 - bob], [28, 15 - bob], [25, 15 - bob]], p.a);
    eye(g, 19, 11 - bob, p, Math.sin(t * 1.5) > .96);
    // crest
    tri(g, [[19, 8 - bob], [18, 4 - bob], [22, 7 - bob]], p.o);
    tri(g, [[19, 7 - bob], [19, 5 - bob], [21, 7 - bob]], p.a);
    if (evo) {
      tri(g, [[11, 23], [2, 27], [7, 18]], p.l);
      tri(g, [[21, 8 - bob], [25, 3 - bob], [26, 8 - bob]], p.l);
      rect(g, 11, 18 - bob, 2, 2, p.a);
    }
  }

  function drawBeetle(g, p, t, evo) {
    const bob = Math.sin(t * 2) > .7 ? 1 : 0;
    // legs
    line(g, 11, 20, 7, 24, p.o, 2); line(g, 23, 20, 27, 24, p.o, 2);
    line(g, 10, 24, 7, 28, p.o, 2); line(g, 24, 24, 27, 28, p.o, 2);
    // shell
    outlineEll(g, 17, 18 - bob, 10, 9, p.o, p.m);
    ell(g, 14, 16 - bob, 5, 4, p.l);
    line(g, 17, 10 - bob, 17, 26 - bob, p.o, 1);
    line(g, 10, 18 - bob, 24, 18 - bob, p.o, 1);
    // rocks
    ell(g, 11, 22 - bob, 3, 2, p.a); ell(g, 23, 15 - bob, 2, 2, p.a);
    // head/horn
    outlineEll(g, 17, 9 - bob, 5, 4, p.o, p.d);
    tri(g, [[17, 8 - bob], [13, 3 - bob], [19, 7 - bob]], p.o);
    tri(g, [[17, 7 - bob], [15, 4 - bob], [18, 7 - bob]], p.l);
    eye(g, 14, 8 - bob, p, false); eye(g, 18, 8 - bob, p, false);
    rect(g, 16, 11 - bob, 2, 1, p.a);
    if (evo) {
      tri(g, [[10, 15], [4, 10], [8, 20]], p.a);
      tri(g, [[24, 15], [30, 10], [26, 20]], p.a);
      ell(g, 17, 24 - bob, 5, 2, p.a);
    }
  }

  function drawFish(g, p, t, evo) {
    const bob = Math.sin(t * 2.2) > .3 ? 1 : 0;
    // tail
    tri(g, [[9, 18], [2, 12], [3, 24]], p.o);
    tri(g, [[9, 18], [4, 14], [5, 22]], p.m);
    // fins
    tri(g, [[16, 12], [20, 5], [22, 12]], p.o);
    tri(g, [[16, 13], [19, 8], [20, 13]], p.a);
    tri(g, [[15, 24], [19, 29], [21, 24]], p.o);
    // body
    outlineEll(g, 17, 18 - bob, 11, 7, p.o, p.m);
    ell(g, 17, 20 - bob, 8, 4, p.l);
    // scales
    for (let x = 12; x < 23; x += 4) { rect(g, x, 17 - bob, 2, 1, p.a); rect(g, x + 1, 20 - bob, 2, 1, p.a); }
    // eye
    eye(g, 23, 15 - bob, p, false);
    rect(g, 26, 18 - bob, 2, 1, p.o);
    // bubbles
    ell(g, 29, 10 - bob, 2, 2, 'rgba(194,238,245,.7)');
    ell(g, 28, 5 - bob, 1, 1, 'rgba(194,238,245,.7)');
    if (evo) {
      tri(g, [[13, 13], [8, 5], [18, 11]], p.a);
      ell(g, 15, 16 - bob, 3, 2, '#fff1c4');
      rect(g, 15, 16 - bob, 1, 1, '#ffffff');
    }
  }

  function drawBat(g, p, t, evo) {
    const bob = Math.sin(t * 2.5) > .4 ? 1 : 0;
    // wings
    tri(g, [[13, 15], [1, 8], [3, 22], [9, 19]], p.o);
    tri(g, [[14, 16], [3, 10], [5, 20], [10, 18]], p.d);
    tri(g, [[19, 15], [31, 8], [29, 22], [23, 19]], p.o);
    tri(g, [[18, 16], [29, 10], [27, 20], [22, 18]], p.d);
    line(g, 7, 11, 6, 18, p.l, 1); line(g, 25, 11, 26, 18, p.l, 1);
    // body
    outlineEll(g, 16, 19 - bob, 5, 7, p.o, p.m);
    ell(g, 16, 20 - bob, 3, 4, p.l);
    // ears
    tri(g, [[11, 12 - bob], [10, 4 - bob], [15, 9 - bob]], p.o);
    tri(g, [[21, 12 - bob], [22, 4 - bob], [17, 9 - bob]], p.o);
    tri(g, [[12, 11 - bob], [11, 6 - bob], [14, 9 - bob]], p.a);
    tri(g, [[20, 11 - bob], [21, 6 - bob], [18, 9 - bob]], p.a);
    // face
    outlineEll(g, 16, 12 - bob, 5, 4, p.o, p.d);
    eye(g, 12, 11 - bob, p, false);
    eye(g, 18, 11 - bob, p, false);
    rect(g, 15, 14 - bob, 2, 1, p.o);
    rect(g, 14, 15 - bob, 1, 1, p.e); rect(g, 17, 15 - bob, 1, 1, p.e);
    if (evo) {
      // moon wing tips
      ell(g, 3, 20 - bob, 2, 2, p.a); ell(g, 29, 20 - bob, 2, 2, p.a);
      tri(g, [[16, 6 - bob], [14, 2 - bob], [18, 2 - bob]], p.a);
    }
  }

  function drawMushroom(g, p, t, evo) {
    const bob = Math.sin(t * 2.3) > .6 ? 1 : 0;
    // feet
    rect(g, 11, 26, 4, 3, p.o); rect(g, 18, 26, 4, 3, p.o);
    // body
    outlineEll(g, 16, 21 - bob, 7, 7, p.o, p.a);
    ell(g, 16, 23 - bob, 5, 4, p.l);
    // cap
    outlineEll(g, 16, 12 - bob, evo ? 13 : 11, 7, p.o, p.m);
    ell(g, 13, 10 - bob, 6, 4, p.l);
    ell(g, 23, 13 - bob, 3, 2, p.d);
    // spots
    ell(g, 9, 10 - bob, 2, 2, p.a); ell(g, 18, 8 - bob, 2, 2, p.a);
    ell(g, 24, 12 - bob, 1, 1, p.a); ell(g, 13, 14 - bob, 1, 1, p.a);
    // face
    eye(g, 12, 20 - bob, p, Math.sin(t * 1.4 + 2) > .96);
    eye(g, 18, 20 - bob, p, false);
    rect(g, 15, 24 - bob, 2, 1, p.o);
    // tiny mushrooms at feet
    if (evo) {
      rect(g, 4, 25, 2, 4, p.a); ell(g, 5, 24, 3, 2, p.m);
      rect(g, 26, 24, 2, 5, p.a); ell(g, 27, 23, 3, 2, p.m);
    }
  }

  function drawMouse(g, p, t, evo) {
    const bob = Math.sin(t * 3) > .3 ? 1 : 0;
    // tail
    line(g, 10, 22, 4, 18, p.o, 1); line(g, 4, 18, 3, 13, p.o, 1);
    tri(g, [[3, 13], [1, 10], [6, 11]], p.a);
    // feet
    rect(g, 11, 26, 4, 3, p.o); rect(g, 18, 26, 4, 3, p.o);
    // body
    outlineEll(g, 16, 21 - bob, 8, 6, p.o, p.m);
    ell(g, 16, 23 - bob, 5, 3, p.l);
    // ears
    outlineEll(g, 10, 10 - bob, 3, 3, p.o, p.m);
    outlineEll(g, 22, 10 - bob, 3, 3, p.o, p.m);
    ell(g, 10, 10 - bob, 1, 1, p.a); ell(g, 22, 10 - bob, 1, 1, p.a);
    // head
    outlineEll(g, 16, 14 - bob, 7, 6, p.o, p.m);
    ell(g, 16, 16 - bob, 4, 3, p.l);
    // cheeks
    ell(g, 9, 17 - bob, 2, 2, p.a); ell(g, 23, 17 - bob, 2, 2, p.a);
    // eyes/nose
    eye(g, 12, 13 - bob, p, false); eye(g, 18, 13 - bob, p, false);
    rect(g, 16, 16 - bob, 1, 1, p.p);
    rect(g, 15, 18 - bob, 2, 1, p.p);
    // spark
    if (Math.sin(t * 4) > .5) { rect(g, 27, 12 - bob, 2, 1, '#fff3a8'); rect(g, 28, 11 - bob, 1, 3, '#fff3a8'); }
  }

  function drawPup(g, p, t, evo) {
    const bob = Math.sin(t * 2.6) > .5 ? 1 : 0;
    // tail flame
    tri(g, [[9, 23], [3, 19], [6, 13], [10, 18]], p.o);
    tri(g, [[9, 22], [5, 18], [7, 14], [9, 18]], p.a);
    ell(g, 6, 13 - bob, 2, 2, '#ffe07d');
    // legs
    rect(g, 12, 26, 4, 4, p.o); rect(g, 18, 26, 4, 4, p.o);
    // body
    outlineEll(g, 16, 21 - bob, 8, 6, p.o, p.m);
    ell(g, 16, 23 - bob, 5, 3, p.l);
    // head
    outlineEll(g, 21, 13 - bob, 6, 6, p.o, p.m);
    // ears
    tri(g, [[17, 10 - bob], [14, 4 - bob], [20, 9 - bob]], p.o);
    tri(g, [[17, 9 - bob], [16, 6 - bob], [19, 9 - bob]], p.d);
    tri(g, [[24, 9 - bob], [28, 4 - bob], [27, 12 - bob]], p.o);
    tri(g, [[24, 9 - bob], [27, 6 - bob], [26, 11 - bob]], p.d);
    // muzzle, eyes
    ell(g, 25, 16 - bob, 3, 2, p.l);
    rect(g, 27, 15 - bob, 1, 1, p.p);
    rect(g, 25, 17 - bob, 1, 1, p.p);
    eye(g, 20, 12 - bob, p, Math.sin(t * 2) > .96);
    rect(g, 23, 9 - bob, 2, 1, p.a);
  }

  function drawWisp(g, p, t, evo) {
    const bob = Math.sin(t * 2.1) > 0 ? 2 : 0;
    // floating orbs
    ell(g, 5, 10 - bob, 2, 2, 'rgba(244,230,164,.8)');
    ell(g, 28, 7 - bob, 2, 2, 'rgba(244,230,164,.8)');
    ell(g, 27, 22 - bob, 1, 1, 'rgba(244,230,164,.8)');
    // body
    outlineEll(g, 16, 18 - bob, 8, 9, p.o, p.m);
    ell(g, 14, 16 - bob, 5, 5, p.l);
    // leafy hood
    tri(g, [[16, 8 - bob], [8, 10 - bob], [11, 15 - bob]], p.o);
    tri(g, [[16, 8 - bob], [24, 10 - bob], [21, 15 - bob]], p.o);
    tri(g, [[16, 9 - bob], [10, 11 - bob], [12, 14 - bob]], p.d);
    tri(g, [[16, 9 - bob], [22, 11 - bob], [20, 14 - bob]], p.d);
    // wisps at bottom
    ell(g, 10, 26 - bob, 3, 2, p.d); ell(g, 16, 28 - bob, 3, 2, p.d); ell(g, 23, 26 - bob, 2, 2, p.d);
    // face
    eye(g, 12, 17 - bob, p, Math.sin(t * 1.3 + 4) > .94);
    eye(g, 19, 17 - bob, p, false);
    rect(g, 15, 21 - bob, 2, 1, p.p);
    // fairy sparkles
    const sp = Math.floor(t * 3) % 3;
    rect(g, 6 + sp * 2, 16, 1, 1, '#fff6bd'); rect(g, 25 - sp, 13 + sp, 1, 1, '#fff6bd');
  }

  function drawGhost(g, p, t, evo) {
    const bob = Math.sin(t * 1.8) > 0 ? 2 : 0;
    // aura
    ell(g, 16, 17 - bob, 13, 11, 'rgba(125,224,193,.10)');
    // body
    outlineEll(g, 16, 18 - bob, 9, 10, p.o, p.m);
    ell(g, 15, 16 - bob, 6, 6, p.d);
    // tendrils
    for (let i = 0; i < 4; i++) {
      const x = 8 + i * 5;
      const off = Math.sin(t * 2 + i) * 2;
      rect(g, x, 26 - bob, 3, 5, p.o);
      ell(g, x + 1, 31 - bob + off, 2, 2, p.d);
    }
    // moss antlers
    line(g, 13, 10 - bob, 9, 4 - bob, p.a, 2);
    line(g, 9, 5 - bob, 6, 3 - bob, p.a, 1);
    line(g, 20, 10 - bob, 24, 4 - bob, p.a, 2);
    line(g, 24, 5 - bob, 27, 3 - bob, p.a, 1);
    ell(g, 8, 3 - bob, 2, 2, p.a); ell(g, 25, 3 - bob, 2, 2, p.a);
    // face
    ell(g, 16, 17 - bob, 6, 4, '#1b3027');
    rect(g, 12, 16 - bob, 2, 2, '#9dffd4'); rect(g, 18, 16 - bob, 2, 2, '#9dffd4');
    rect(g, 15, 21 - bob, 2, 1, '#7de0c1');
    // moss patches
    ell(g, 10, 22 - bob, 2, 2, p.a); ell(g, 22, 21 - bob, 2, 2, p.a);
  }

  function drawGuardian(g, p, t, evo) {
    const bob = Math.sin(t * 1.4) > 0 ? 2 : 0;
    // halo
    ell(g, 16, 8 - bob, 13, 7, 'rgba(255,246,201,.18)');
    ell(g, 16, 8 - bob, 10, 5, 'rgba(255,246,201,.28)');
    // antlers of light
    line(g, 18, 9 - bob, 13, 2 - bob, '#f3c96b', 2);
    line(g, 13, 3 - bob, 9, 5 - bob, '#f3c96b', 1);
    line(g, 13, 3 - bob, 12, 0, '#ffe8a1', 1);
    line(g, 22, 9 - bob, 27, 2 - bob, '#f3c96b', 2);
    line(g, 27, 3 - bob, 31, 5 - bob, '#f3c96b', 1);
    line(g, 27, 3 - bob, 28, 0, '#ffe8a1', 1);
    // body deer but luminous
    outlineEll(g, 16, 23 - bob, 8, 5, p.o, p.m);
    ell(g, 16, 24 - bob, 6, 3, p.l);
    // legs
    rect(g, 11, 26, 3, 5, p.o); rect(g, 20, 26, 3, 5, p.o);
    // neck/head
    outlineEll(g, 16, 16 - bob, 4, 5, p.o, p.m);
    outlineEll(g, 17, 11 - bob, 5, 4, p.o, p.l);
    ell(g, 21, 13 - bob, 3, 2, p.l);
    rect(g, 23, 12 - bob, 1, 1, p.p);
    // ears
    tri(g, [[13, 9 - bob], [11, 5 - bob], [16, 8 - bob]], p.o);
    tri(g, [[21, 9 - bob], [24, 5 - bob], [24, 10 - bob]], p.o);
    // flower crown
    ell(g, 12, 8 - bob, 2, 2, '#f8c4d6'); ell(g, 22, 8 - bob, 2, 2, '#f8c4d6');
    ell(g, 17, 6 - bob, 2, 2, '#f8c4d6');
    rect(g, 12, 8 - bob, 1, 1, '#fff4e2'); rect(g, 17, 6 - bob, 1, 1, '#fff4e2');
    eye(g, 16, 10 - bob, p, true);
    // chest glow
    ell(g, 16, 21 - bob, 3, 3, 'rgba(255,246,201,.75)');
    rect(g, 16, 20 - bob, 1, 1, '#ffffff');
    // floating motes
    for (let i = 0; i < 5; i++) {
      const a = t * .7 + i * 1.4;
      rect(g, 16 + Math.cos(a) * 12, 16 + Math.sin(a) * 9, 1, 1, '#fff3b0');
    }
  }

  const MON_DRAW = {
    deer: drawDeer, fox: drawFox, otter: drawOtter, mossball: drawMossball,
    bug: drawBug, moth: drawMoth, bird: drawBird, beetle: drawBeetle,
    fish: drawFish, bat: drawBat, mushroom: drawMushroom, mouse: drawMouse,
    pup: drawPup, wisp: drawWisp, ghost: drawGhost, guardian: drawGuardian
  };

  function paintMonster(g, id, t) {
    const sp = D.SPECIES[id];
    if (!sp) return;
    const p = sp.palette;
    g.clearRect(0, 0, 32, 32);
    const evo = ['verdantle', 'blazequeen', 'riverotter', 'mosslord', 'lanternmoth', 'skyquill', 'boulderon', 'streamkoi', 'nightfang', 'sporecap', 'mistqueen', 'pineguard', 'webweaver'].includes(id);
    (MON_DRAW[sp.shape] || drawMossball)(g, p, t || 0, evo || sp.shape === 'guardian');
  }

  function drawMonster(ctx, id, cx, cy, size, t = 0, flip = false) {
    const g = document.createElement('canvas');
    g.width = 32; g.height = 32;
    const c = g.getContext('2d');
    c.imageSmoothingEnabled = false;
    paintMonster(c, id, t);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(cx, cy);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(g, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function drawMonsterCanvas(canvas, id, t = 0, flip = false) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const size = Math.min(canvas.width, canvas.height);
    drawMonster(ctx, id, canvas.width / 2, canvas.height / 2, size, t, flip);
  }

  /* ---------- 世界中的角色 ---------- */
  function drawTrainer(ctx, tx, ty, dir, frame, sprite, paletteName) {
    const p = TRAINER_PALETTES[paletteName] || TRAINER_PALETTES.player;
    const g = document.createElement('canvas');
    g.width = 16; g.height = 20;
    const c = g.getContext('2d');
    c.imageSmoothingEnabled = false;
    const walk = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    const bob = frame ? 1 : 0;

    // shadow handled in world render; feet
    // legs
    rect(c, 4, 15, 3, 4 - bob, p.o);
    rect(c, 9, 15, 3, 4 - bob, p.o);
    rect(c, 4, 18 - bob, 3, 1, p.shoe);
    rect(c, 9, 18 - bob, 3, 1, p.shoe);
    if (walk !== 0) {
      rect(c, 4 + walk, 18, 3, 1, p.shoe);
      rect(c, 9 - walk, 18, 3, 1, p.shoe);
    }
    // body
    rect(c, 3, 8, 10, 8, p.o);
    rect(c, 4, 8, 8, 7, p.shirt);
    rect(c, 4, 12, 8, 2, p.shirt2);
    rect(c, 7, 9, 2, 5, p.accent);
    // arms
    rect(c, 2, 9, 2, 5, p.shirt2); rect(c, 12, 9, 2, 5, p.shirt2);
    rect(c, 2, 13, 2, 2, p.skin); rect(c, 12, 13, 2, 2, p.skin);
    // head
    rect(c, 4, 2, 8, 7, p.o);
    rect(c, 5, 3, 6, 6, p.skin);
    // hair / hat
    if (sprite === 'elder') {
      rect(c, 4, 2, 8, 3, p.hair); rect(c, 3, 3, 10, 2, p.hair);
      rect(c, 4, 8, 2, 4, '#e8e2d2'); rect(c, 10, 8, 2, 4, '#e8e2d2'); rect(c, 6, 9, 4, 3, '#e8e2d2');
    } else if (sprite === 'nurse') {
      rect(c, 4, 2, 8, 2, p.hat); rect(c, 3, 3, 10, 1, p.hat);
      rect(c, 7, 0, 2, 2, '#f4f0e4'); rect(c, 6, 0, 4, 1, '#f4f0e4');
      rect(c, 4, 4, 3, 3, p.hair); rect(c, 9, 4, 3, 3, p.hair);
    } else if (sprite === 'leader') {
      rect(c, 4, 1, 8, 3, p.hat); rect(c, 3, 2, 10, 1, p.hat);
      tri(c, [[3, 2], [2, 0], [5, 1]], p.accent); tri(c, [[13, 2], [14, 0], [11, 1]], p.accent);
      rect(c, 4, 4, 2, 3, p.hair); rect(c, 10, 4, 2, 3, p.hair);
      rect(c, 2, 13, 12, 5, p.o); rect(c, 3, 13, 10, 4, p.robe); rect(c, 7, 13, 2, 4, p.shirt2);
    } else if (sprite === 'villain') {
      rect(c, 3, 1, 10, 5, p.cloak); rect(c, 2, 3, 12, 3, p.cloak);
      rect(c, 5, 3, 6, 4, '#2a2532');
      rect(c, 6, 5, 1, 1, '#c8a5e0'); rect(c, 9, 5, 1, 1, '#c8a5e0');
      rect(c, 1, 10, 14, 7, p.cloak);
    } else if (sprite === 'woman' || sprite === 'girl' || sprite === 'mom') {
      rect(c, 3, 2, 10, 4, p.hair); rect(c, 3, 5, 2, 6, p.hair); rect(c, 11, 5, 2, 5, p.hair);
      rect(c, 4, 3, 8, 2, p.hat);
      rect(c, 5, 5, 6, 3, p.skin);
    } else if (sprite === 'prof') {
      rect(c, 3, 1, 10, 3, p.hat); rect(c, 2, 2, 12, 1, p.hat);
      rect(c, 4, 4, 8, 2, p.hair); rect(c, 3, 6, 2, 3, p.hair); rect(c, 11, 6, 2, 3, p.hair);
      rect(c, 4, 9, 8, 3, '#e8e1cd');
    } else if (sprite === 'ranger') {
      rect(c, 2, 1, 12, 2, p.hat); rect(c, 4, 3, 8, 2, p.hat);
      rect(c, 4, 5, 8, 2, p.hair);
    } else {
      rect(c, 4, 2, 8, 2, p.hat); rect(c, 3, 3, 10, 1, p.hat);
      rect(c, 4, 4, 2, 2, p.hair); rect(c, 10, 4, 2, 2, p.hair);
    }
    // face
    if (dir !== 'up') {
      if (dir === 'left') {
        rect(c, 6, 5, 1, 1, p.o); rect(c, 4, 6, 1, 1, p.skin);
      } else if (dir === 'right') {
        rect(c, 10, 5, 1, 1, p.o); rect(c, 12, 6, 1, 1, p.skin);
      } else {
        rect(c, 6, 5, 1, 1, p.o); rect(c, 10, 5, 1, 1, p.o);
        rect(c, 8, 7, 1, 1, p.a || p.o);
      }
    }
    // backpack
    if (sprite === 'player' || sprite === 'rival') {
      if (dir === 'up') { rect(c, 4, 9, 8, 6, p.pack || '#a35f3d'); rect(c, 5, 10, 6, 1, p.accent); }
      else { rect(c, 2, 9, 2, 5, p.pack || '#a35f3d'); }
    }
    // outline feet baseline
    ctx.drawImage(g, tx, ty);
  }

  /* ---------- 头像 ---------- */
  function drawPortrait(canvas, kind) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const W = 32, H = 32;
    const g = document.createElement('canvas'); g.width = W; g.height = H;
    const c = g.getContext('2d');
    c.imageSmoothingEnabled = false;
    const skin = '#edc39b', skin2 = '#d6a67e';
    if (kind === 'prof') {
      rect(c, 0, 0, 32, 32, '#2f4a3a');
      ell(c, 16, 17, 12, 13, '#d9cfae');
      ell(c, 16, 20, 11, 10, skin);
      ell(c, 7, 18, 3, 4, skin2); ell(c, 25, 18, 3, 4, skin2);
      // hat
      ell(c, 16, 8, 13, 4, '#4e6d3f'); ell(c, 16, 5, 9, 4, '#5d7c49');
      rect(c, 13, 3, 6, 2, '#7aa05d');
      // eyes
      rect(c, 10, 16, 4, 2, '#3a3128'); rect(c, 18, 16, 4, 2, '#3a3128');
      rect(c, 11, 16, 1, 1, '#fff8e6'); rect(c, 19, 16, 1, 1, '#fff8e6');
      // glasses
      c.strokeStyle = '#6a5a3e'; c.lineWidth = 1;
      c.strokeRect(9.5, 15.5, 5, 4); c.strokeRect(17.5, 15.5, 5, 4); c.beginPath(); c.moveTo(14.5, 17.5); c.lineTo(17.5, 17.5); c.stroke();
      // beard
      ell(c, 16, 26, 8, 5, '#e8e2d2'); ell(c, 16, 24, 6, 3, '#f2ecdc');
      rect(c, 15, 22, 3, 2, skin2);
      // leaf pin
      ell(c, 24, 9, 2, 1, '#a4c46a');
    } else if (kind === 'rival') {
      rect(c, 0, 0, 32, 32, '#3d2f34');
      ell(c, 16, 18, 11, 12, '#bf5147');
      ell(c, 16, 19, 10, 10, skin);
      // hair
      ell(c, 16, 9, 12, 7, '#2f2e33');
      tri(c, [[4, 10], [10, 4], [10, 14]], '#2f2e33'); tri(c, [[28, 10], [22, 4], [22, 14]], '#2f2e33');
      // eyes
      rect(c, 10, 17, 3, 2, '#2b2b31'); rect(c, 19, 17, 3, 2, '#2b2b31');
      rect(c, 11, 17, 1, 1, '#fff6df'); rect(c, 20, 17, 1, 1, '#fff6df');
      rect(c, 14, 22, 4, 1, '#b66a5d');
      // collar
      rect(c, 8, 27, 16, 5, '#8d3733'); rect(c, 14, 27, 4, 5, '#f0cd72');
    } else if (kind === 'leader') {
      rect(c, 0, 0, 32, 32, '#2c4535');
      ell(c, 16, 19, 11, 12, '#b9cf92');
      ell(c, 16, 19, 10, 10, skin);
      ell(c, 16, 9, 12, 7, '#334a3a');
      ell(c, 16, 5, 10, 4, '#557c4f');
      ell(c, 8, 5, 2, 5, '#f0d48a'); ell(c, 24, 5, 2, 5, '#f0d48a');
      rect(c, 9, 17, 4, 2, '#334a3a'); rect(c, 19, 17, 4, 2, '#334a3a');
      rect(c, 10, 17, 1, 1, '#f4f0d9'); rect(c, 20, 17, 1, 1, '#f4f0d9');
      rect(c, 14, 23, 4, 1, '#b47568');
      ell(c, 15, 27, 2, 2, '#f8c4d6'); ell(c, 20, 26, 2, 2, '#f8c4d6');
    } else if (kind === 'gloam') {
      rect(c, 0, 0, 32, 32, '#16241f');
      ell(c, 16, 17, 12, 13, '#355448');
      ell(c, 16, 18, 9, 9, '#4f7361');
      rect(c, 10, 15, 4, 2, '#9dffd4'); rect(c, 19, 15, 4, 2, '#9dffd4');
      rect(c, 14, 23, 5, 1, '#7de0c1');
      line(c, 14, 7, 9, 2, '#7de0c1', 2); line(c, 19, 7, 24, 2, '#7de0c1', 2);
      ell(c, 8, 2, 2, 2, '#a5f3d8'); ell(c, 25, 2, 2, 2, '#a5f3d8');
    }
    ctx.drawImage(g, 0, 0, canvas.width, canvas.height);
  }

  /* ---------- 道具图标 ---------- */
  function drawItemIcon(canvas, item) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const g = document.createElement('canvas'); g.width = 24; g.height = 24;
    const c = g.getContext('2d'); c.imageSmoothingEnabled = false;
    const it = D.ITEMS[item] || { icon: 'ball' };
    const kind = it.icon;
    if (kind === 'ball' || kind === 'greatball' || kind === 'ultraball') {
      const main = kind === 'ball' ? '#d8574b' : kind === 'greatball' ? '#4d86c6' : '#3c344d';
      const band = kind === 'ultraball' ? '#e4c14c' : '#2b2b2f';
      ell(c, 12, 12, 9, 9, '#25252a');
      ell(c, 12, 12, 8, 8, main);
      rect(c, 4, 11, 16, 3, band);
      ell(c, 12, 12, 4, 4, '#25252a');
      ell(c, 12, 12, 3, 3, '#f4ead2');
      rect(c, 11, 9, 2, 2, '#ffffff');
      if (kind === 'greatball') { rect(c, 5, 6, 4, 2, '#e05a50'); rect(c, 15, 6, 4, 2, '#e05a50'); }
      if (kind === 'ultraball') { tri(c, [[8, 7], [12, 3], [16, 7]], '#e4c14c'); rect(c, 7, 7, 10, 2, '#e4c14c'); }
    } else if (kind === 'potion' || kind === 'superpotion' || kind === 'hyperpotion') {
      const col = kind === 'potion' ? '#e68b73' : kind === 'superpotion' ? '#dc6d72' : '#b85fc4';
      rect(c, 9, 2, 6, 3, '#6b4c36'); rect(c, 8, 4, 8, 3, '#9c7b58');
      rect(c, 6, 6, 12, 16, '#3b2b2a'); rect(c, 7, 8, 10, 13, '#f0e6cf');
      rect(c, 7, 12, 10, 9, col);
      rect(c, 9, 10, 2, 2, '#fff4dd');
      rect(c, 9, 15, 6, 1, 'rgba(255,255,255,.35)');
    } else if (kind === 'antidote') {
      rect(c, 8, 3, 8, 4, '#6b4c36'); rect(c, 6, 7, 12, 15, '#3b2b2a');
      rect(c, 7, 8, 10, 13, '#d7e7c8'); rect(c, 8, 13, 8, 7, '#88b77a');
      rect(c, 10, 10, 1, 6, '#4d7945'); rect(c, 8, 12, 5, 2, '#4d7945');
    } else if (kind === 'revive') {
      tri(c, [[12, 2], [20, 12], [14, 12], [17, 22], [5, 10], [11, 10]], '#3b2b2a');
      tri(c, [[12, 4], [18, 11], [13, 11], [15, 19], [7, 10], [12, 10]], '#f2d274');
      rect(c, 11, 8, 4, 3, '#fff5c9');
    } else if (kind === 'berry' || kind === 'lureberry') {
      const c1 = kind === 'berry' ? '#e4824b' : '#8fc9a0';
      const c2 = kind === 'berry' ? '#f2b15c' : '#d4f3bb';
      ell(c, 12, 14, 8, 7, '#3a2a22'); ell(c, 12, 14, 7, 6, c1);
      ell(c, 9, 12, 3, 2, c2); rect(c, 10, 10, 2, 1, '#fff4ce');
      rect(c, 12, 4, 2, 5, '#6b5638'); tri(c, [[14, 5], [20, 7], [15, 11]], '#6f9f4d');
      if (kind === 'lureberry') { rect(c, 5, 7, 1, 1, '#fff8bd'); rect(c, 19, 16, 1, 1, '#fff8bd'); }
    } else if (kind === 'hairpin') {
      rect(c, 5, 18, 14, 2, '#8f6a44');
      ell(c, 12, 13, 5, 4, '#f0d58a'); ell(c, 12, 13, 3, 2, '#f8ecd0');
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; ell(c, 12 + Math.cos(a) * 6, 12 + Math.sin(a) * 6, 2, 2, '#f3a8bd'); }
    } else if (kind === 'pearl') {
      ell(c, 12, 12, 9, 9, '#5b6c72'); ell(c, 12, 12, 8, 8, '#eef3e4');
      ell(c, 9, 9, 3, 2, '#ffffff'); ell(c, 16, 16, 2, 2, '#c8d8d2');
    } else if (kind === 'windbell') {
      rect(c, 11, 2, 2, 3, '#5c432b');
      tri(c, [[12, 4], [18, 17], [6, 17]], '#3a2b22');
      tri(c, [[12, 6], [16, 16], [8, 16]], '#d6b366');
      rect(c, 8, 16, 8, 2, '#3a2b22');
      rect(c, 9, 17, 6, 1, '#a77b3c');
      rect(c, 11, 19, 2, 3, '#efdfb5');
      ell(c, 12, 22, 2, 1, '#f2cf76');
      rect(c, 9, 8, 2, 2, '#f7e5ac');
    } else if (kind === 'rod') {
      line(c, 4, 21, 18, 4, '#6b4c36', 2); line(c, 18, 4, 20, 16, '#d8d2bd', 1);
      rect(c, 19, 16, 2, 2, '#c9b57a'); line(c, 4, 18, 7, 21, '#9c7b58', 2);
    } else if (kind === 'dex') {
      rect(c, 3, 4, 18, 16, '#3b2b2a'); rect(c, 4, 5, 16, 14, '#8d5a3c');
      rect(c, 6, 7, 12, 10, '#e8dfc5'); rect(c, 7, 8, 10, 4, '#6f9f4d');
      rect(c, 8, 14, 8, 1, '#8d7a5a'); rect(c, 8, 16, 5, 1, '#8d7a5a');
      rect(c, 19, 7, 2, 4, '#e4c14c');
    } else if (kind === 'badge') {
      ell(c, 12, 12, 9, 9, '#6b5a2a'); ell(c, 12, 12, 8, 8, '#e4c14c');
      ell(c, 12, 12, 5, 5, '#f8e6a8');
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ell(c, 12 + Math.cos(a) * 6, 12 + Math.sin(a) * 6, 2, 1, '#7aa05d'); }
      rect(c, 11, 11, 2, 2, '#ffffff');
    } else {
      ell(c, 12, 12, 8, 8, '#c9b57a');
    }
    ctx.drawImage(g, 0, 0, canvas.width, canvas.height);
  }

  PKM.ART = {
    drawMonster, drawMonsterCanvas, paintMonster, drawTrainer, drawPortrait, drawItemIcon,
    palettes: TRAINER_PALETTES, ell, rect, line, tri
  };
})();
