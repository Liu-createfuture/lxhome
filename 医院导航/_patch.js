const fs = require('fs');
let s = fs.readFileSync('src/scene.js', 'utf8');

const startTag = '  function buildFloorModel(floor) {';
const endTag = '  /* ======================================================================\n   * 院区';

const i1 = s.indexOf(startTag);
const i2 = s.indexOf(endTag);
if (i1 < 0 || i2 < 0) { console.error('marker not found', i1, i2); process.exit(1); }

const block = `  /* 把一堆盒子合并成一个 BufferGeometry，显著减少 draw call */
  function mergeBoxes(items) {
    if (!items.length) return null;
    const parts = [];
    let vCount = 0, iCount = 0;
    items.forEach(function (it) {
      const g = new THREE.BoxGeometry(it.w, it.h, it.d);
      g.translate(it.x, it.y, it.z);
      parts.push(g);
      vCount += g.attributes.position.count;
      iCount += g.index.count;
    });
    const pos = new Float32Array(vCount * 3);
    const nor = new Float32Array(vCount * 3);
    const uv = new Float32Array(vCount * 2);
    const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
    let vo = 0, io = 0;
    parts.forEach(function (g) {
      pos.set(g.attributes.position.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      uv.set(g.attributes.uv.array, vo * 2);
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
      vo += g.attributes.position.count;
      io += gi.length;
      g.dispose();
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    return out;
  }

  function buildFloorModel(floor) {
    const node = { group: new THREE.Group(), mats: [], alpha: 1, target: 1 };
    const g = node.group;
    g.position.set(floor.ox, floor.y, floor.oz);

    const H = CFG.H, W = CFG.W, D = CFG.D;

    /* 楼板 */
    const slabMat = tagMat(node, new THREE.MeshStandardMaterial({
      color: 0xfdfefe, roughness: 0.9, metalness: 0.02, transparent: true, opacity: 1
    }), 1);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.34, D), slabMat);
    slab.position.y = -0.19;
    g.add(slab);

    const edgeMat = tagMat(node, new THREE.LineBasicMaterial({
      color: 0x9fb6d2, transparent: true, opacity: 0.85
    }), 0.85);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 0.34, D)), edgeMat);
    edges.position.y = -0.19;
    g.add(edges);

    /* 走廊地面 */
    const corrMat = tagMat(node, new THREE.MeshBasicMaterial({ color: 0xc6d7e9, transparent: true, opacity: 1 }), 1);
    const corrH = new THREE.Mesh(new THREE.PlaneGeometry(W - 2, CFG.CORR * 2), corrMat);
    corrH.rotation.x = -Math.PI / 2; corrH.position.y = 0.012; g.add(corrH);
    const corrV = new THREE.Mesh(new THREE.PlaneGeometry(CFG.CORR * 2, D), corrMat);
    corrV.rotation.x = -Math.PI / 2; corrV.position.y = 0.013; g.add(corrV);

    /* 走廊引导虚线（合并为一个 mesh） */
    const dashMat = tagMat(node, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }), 0.75);
    const dashItems = [];
    for (let x = -27; x < 28; x += 3.2) dashItems.push({ w: 1.5, h: 0.02, d: 0.13, x: x, y: 0.022, z: 0 });
    const dashGeo = mergeBoxes(dashItems);
    if (dashGeo) g.add(new THREE.Mesh(dashGeo, dashMat));

    /* 墙 / 踢脚 / 压顶 收集器 */
    const wallMat = tagMat(node, new THREE.MeshStandardMaterial({
      color: 0x9fb6d2, roughness: 0.55, metalness: 0.02,
      transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide
    }), 0.42);
    const skirtMat = tagMat(node, new THREE.MeshStandardMaterial({
      color: 0xb6c9de, roughness: 0.9, transparent: true, opacity: 1
    }), 1);
    const capMat = tagMat(node, new THREE.MeshStandardMaterial({
      color: 0x66809f, roughness: 0.7, transparent: true, opacity: 1
    }), 1);

    const col = { wall: [], skirt: [], cap: [] };

    /* 房间地面按类型合并 */
    const plateCol = {};
    function plateOfType(type) {
      if (!plateCol[type]) plateCol[type] = { mat: tagMat(node, new THREE.MeshBasicMaterial({
        color: new THREE.Color(Data.typeOf(type).color), transparent: true, opacity: 1
      }), 1), items: [] };
      return plateCol[type];
    }

    floor.rooms.forEach(function (r) {
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;

      /* 地面色块（平铺，参与拾取） */
      plateOfType(r.type).items.push({ w: w - 0.12, h: 0.02, d: d - 0.12, x: cx, y: 0.019, z: cz });

      /* 房间名地贴 */
      const lab = labelTexture(r.name, '#31445e', '700', 44);
      const lh = Math.min(1.5, (w - 1.3) / lab.aspect);
      const labelMat = tagMat(node, new THREE.MeshBasicMaterial({
        map: lab.tex, transparent: true, opacity: 0.95, depthWrite: false
      }), 0.95);
      const lp = new THREE.Mesh(new THREE.PlaneGeometry(lh * lab.aspect, lh), labelMat);
      lp.rotation.x = -Math.PI / 2;
      lp.position.set(cx, 0.045, cz + Math.min(1.2, d * 0.17));
      g.add(lp);

      if (r.open) return;

      const gapZ0 = (r.z0 === CFG.CORR) ? { c: r.doorX, w: CFG.DOOR } : null;
      const gapZ1 = (r.z1 === -CFG.CORR) ? { c: r.doorX, w: CFG.DOOR } : null;
      addWallRun(col, r.x0, r.z0, r.x1, r.z0, 'x', gapZ0);
      addWallRun(col, r.x0, r.z1, r.x1, r.z1, 'x', gapZ1);
      addWallRun(col, r.x0, r.z0, r.x0, r.z1, 'z', null);
      addWallRun(col, r.x1, r.z0, r.x1, r.z1, 'z', null);
    });

    /* 走廊四端外墙（留门洞，便于连廊衔接） */
    addWallRun(col, -H / 2, -CFG.CORR, -H / 2, CFG.CORR, 'z', { c: 0, w: 2.8 });
    addWallRun(col, H / 2, -CFG.CORR, H / 2, CFG.CORR, 'z', { c: 0, w: 2.8 });
    addWallRun(col, -CFG.CORR, -D / 2, CFG.CORR, -D / 2, 'x', { c: 0, w: 3.2 });
    addWallRun(col, -CFG.CORR, D / 2, CFG.CORR, D / 2, 'x', { c: 0, w: 3.2 });

    /* 合并落地 */
    const wallGeo = mergeBoxes(col.wall);
    if (wallGeo) g.add(new THREE.Mesh(wallGeo, wallMat));
    const skirtGeo = mergeBoxes(col.skirt);
    if (skirtGeo) g.add(new THREE.Mesh(skirtGeo, skirtMat));
    const capGeo = mergeBoxes(col.cap);
    if (capGeo) g.add(new THREE.Mesh(capGeo, capMat));

    Object.keys(plateCol).forEach(function (type) {
      const pc = plateCol[type];
      const geo = mergeBoxes(pc.items);
      if (!geo) return;
      const mesh = new THREE.Mesh(geo, pc.mat);
      mesh.userData.floorId = floor.id;
      mesh.userData.isPlate = true;
      g.add(mesh);
      plateMeshes.push(mesh);
    });

    return node;
  }

  /* 把墙段拆成盒子塞进合并收集器 */
  function addWallRun(col, x1, z1, x2, z2, axis, gap) {
    const horiz = axis === 'x';
    const len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    if (len < 0.01) return;

    const start = horiz ? Math.min(x1, x2) : Math.min(z1, z2);
    const end = horiz ? Math.max(x1, x2) : Math.max(z1, z2);
    const pieces = [];
    if (gap) {
      const gs = gap.c - gap.w / 2, ge = gap.c + gap.w / 2;
      if (gs > start + 0.02) pieces.push([start, Math.min(gs, end)]);
      if (ge < end - 0.02) pieces.push([Math.max(ge, start), end]);
    } else {
      pieces.push([start, end]);
    }

    pieces.forEach(function (p) {
      const l = p[1] - p[0];
      if (l <= 0.02) return;
      const midX = horiz ? (p[0] + p[1]) / 2 : x1;
      const midZ = horiz ? z1 : (p[0] + p[1]) / 2;
      col.wall.push({
        w: horiz ? l : CFG.WALL_T, h: CFG.WALL_H, d: horiz ? CFG.WALL_T : l,
        x: midX, y: CFG.WALL_H / 2, z: midZ
      });
      col.skirt.push({
        w: horiz ? l : CFG.WALL_T + 0.06, h: 0.2, d: horiz ? CFG.WALL_T + 0.06 : l,
        x: midX, y: 0.1, z: midZ
      });
      col.cap.push({
        w: horiz ? l : CFG.WALL_T + 0.05, h: 0.09, d: horiz ? CFG.WALL_T + 0.05 : l,
        x: midX, y: CFG.WALL_H + 0.045, z: midZ
      });
    });
  }

`;

s = s.slice(0, i1) + block + s.slice(i2);

/* 声明 plateMeshes，并替换拾取逻辑 */
s = s.replace("  let roomPickers = [];", "  let plateMeshes = [];");
s = s.replace(`    function doPick(x, y) {
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        -((y - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(roomPickers, false);
      if (hits.length) {
        const poiId = hits[0].object.userData.poiId;
        if (poiId && cb.onPoiClick) cb.onPoiClick(poiId);
      } else if (cb.onBlankClick) cb.onBlankClick();
    }`, `    function doPick(x, y) {
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        -((y - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(plateMeshes, false);
      if (hits.length) {
        const f = Data.getFloor(hits[0].object.userData.floorId);
        const px = hits[0].point.x - f.ox;
        const pz = hits[0].point.z - f.oz;
        let found = null;
        f.rooms.forEach(function (r) {
          if (px >= r.x0 && px <= r.x1 && pz >= r.z0 && pz <= r.z1) found = r;
        });
        if (found && !found.noPoi && cb.onPoiClick) { cb.onPoiClick('P_' + found.id); return; }
      }
      if (cb.onBlankClick) cb.onBlankClick();
    }`);

fs.writeFileSync('src/scene.js', s);
console.log('rewritten, plateMeshes:', s.indexOf('let plateMeshes') > 0);
