/* ============================================================================
 * scene.js  —  院区 3D 场景层（Three.js）
 * 能力：多楼栋 / 多层堆叠 / 楼层聚焦 / 连廊 / 路径缎带 / 小人行走 / 演示跟随
 *
 * 说明：Demo 用程序化白模替代真实 GBL 模型。真机接入时，把 buildFloorModel()
 *      里的几何生成换成 GLTFLoader 加载 floor.glb_url 即可，其余逻辑不变。
 * ========================================================================== */
const Scene3D = (function () {
  'use strict';

  const CFG = {
    W: 60, D: 40, WALL_H: 2.9, WALL_T: 0.22, DOOR: 1.9, CORR: 3,
    FLOOR_H: 3.7
  };

  let renderer, scene, camera, clock, raycaster;
  let campusGroup = null, pathGroup = null, markerGroup = null, bridgeGroup = null;
  let labelLayer = null;
  let walker = null, walkState = null;

  const floorNodes = {};      // floorId -> { group, mats:[{m, base}], alpha, target }
  const pinEls = [];          // { el, poi, world }
  let currentFloorId = null;
  let currentPois = [];
  let currentMode = 'campus'; // campus | floor
  let plateMeshes = [];
  let lastPath = null;

  const cam = { theta: 0.42, phi: 0.92, radius: 210, tx: 38, ty: 4, tz: 30 };
  const goal = { theta: 0.42, phi: 0.92, radius: 210, tx: 38, ty: 4, tz: 30 };
  const TARGET = new THREE.Vector3();
  const cb = {};

  /* ======================================================================
   * 初始化
   * ==================================================================== */
  function init(container, callbacks) {
    Object.assign(cb, callbacks || {});
    labelLayer = document.getElementById('labels');

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearAlpha(0);
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.5, 2000);

    /* 灯光：暖主光 + 冷补光，营造干净的"白模"质感 */
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfdcea, 0.85));
    const key = new THREE.DirectionalLight(0xfff4e6, 0.85);
    key.position.set(80, 140, 90);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd6e8ff, 0.42);
    fill.position.set(-90, 80, -70);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0xffffff, 0.34));

    raycaster = new THREE.Raycaster();
    clock = new THREE.Clock();

    campusGroup = new THREE.Group();
    scene.add(campusGroup);

    buildGround();
    buildCampus();
    buildBridges();
    buildWalker();

    (function scanNaN(){
      scene.traverse(function(o){
        const g=o.geometry; if(!g||!g.attributes||!g.attributes.position) return;
        const a=g.attributes.position.array;
        for(let i=0;i<a.length;i++){ if(!isFinite(a[i])){ console.error('GEO NaN: type='+g.type+' mat='+(o.material&&o.material.type)+' pos='+(o.position?[o.position.x,o.position.y,o.position.z].join(','):'')+' len='+a.length); break; } }
      });
    })();
    bindControls(container);
    window.addEventListener('resize', resize);
    if (!window.__NO_LOOP__) animate();
  }

  function resize() {
    const el = renderer.domElement.parentElement;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ======================================================================
   * 地面 / 场地
   * ==================================================================== */
  function buildGround() {
    const gridTex = (function () {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#e2ecf8';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#cfdfef';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 254, 254);
      ctx.strokeStyle = '#d8e5f2';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(128, 0); ctx.lineTo(128, 256);
      ctx.moveTo(0, 128); ctx.lineTo(256, 128);
      ctx.stroke();
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(90, 90);
      t.anisotropy = 4;
      return t;
    })();

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshBasicMaterial({ map: gridTex })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(38, -0.55, 30);
    scene.add(ground);

    /* 楼栋之间的广场铺装 */
    const plaza = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 130),
      new THREE.MeshBasicMaterial({ color: 0xf6fafe, transparent: true, opacity: 0.92 })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(38, -0.5, 30);
    scene.add(plaza);

    /* 楼栋基座投影（柔和接地阴影） */
    Data.BUILDINGS.forEach(function (b) {
      const sh = new THREE.Mesh(
        new THREE.PlaneGeometry(CFG.W + 22, CFG.D + 22),
        new THREE.MeshBasicMaterial({ color: 0xb9cbe0, transparent: true, opacity: 0.32, depthWrite: false })
      );
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(b.pos.x, -0.48, b.pos.z + 4);
      scene.add(sh);
    });
  }

  /* ======================================================================
   * 材质工具
   * ==================================================================== */
  function tagMat(node, mat, base) {
    if (base === undefined) base = mat.opacity;
    node.mats.push({ m: mat, base: base, solid: base >= 0.99 });
    return mat;
  }

  function labelTexture(text, color, weight, fs) {
    fs = fs || 46;
    const pad = 18;
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = (weight || '600') + ' ' + fs + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    const w = Math.min(1024, Math.ceil(probe.measureText(text).width) + pad * 2);
    const h = Math.round(fs * 1.65);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.font = (weight || '600') + ' ' + fs + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = color || '#334760';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.anisotropy = 4;
    return { tex: tex, aspect: w / h };
  }

  /* ======================================================================
   * 一层的模型
   * ==================================================================== */
  /* 把一堆盒子合并成一个 BufferGeometry，显著减少 draw call */
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
    for (let k = 0; k < pos.length; k++) {
      if (!isFinite(pos[k])) { console.error('NaN in mergeBoxes', k, JSON.stringify(items[0]), items.length); break; }
    }
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
      color: 0x7f9ab8, roughness: 0.5, metalness: 0.02,
      transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide
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

  /* ======================================================================
   * 院区
   * ==================================================================== */
  function buildCampus() {
    Data.BUILDINGS.forEach(function (b) {
      b.floors.forEach(function (f) {
        const node = buildFloorModel(f);
        campusGroup.add(node.group);
        floorNodes[f.id] = node;
      });
    });
  }

  /* ---------------- 连廊 ---------------- */
  function buildBridges() {
    bridgeGroup = new THREE.Group();
    scene.add(bridgeGroup);

    Data.BRIDGES.forEach(function (br) {
      const gm = Data.bridgeGeom(br);
      if (!gm) return;

      const dx = gm.x2 - gm.x1, dz = gm.z2 - gm.z1;
      const len = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz);

      const grp = new THREE.Group();
      grp.position.set((gm.x1 + gm.x2) / 2, gm.y, (gm.z1 + gm.z2) / 2);
      grp.rotation.y = angle;

      const plateMat = new THREE.MeshStandardMaterial({ color: 0xeef4fb, roughness: 0.85 });
      const plate = new THREE.Mesh(new THREE.BoxGeometry(gm.width, 0.45, len), plateMat);
      plate.position.y = -0.24;
      grp.add(plate);

      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x9fc2e8, roughness: 0.15, metalness: 0.1,
        transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide
      });
      [-1, 1].forEach(function (s) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, len), glassMat);
        wall.position.set(s * gm.width / 2, 1.3, 0);
        grp.add(wall);
      });

      const roofMat = new THREE.MeshStandardMaterial({
        color: 0xdfeaf7, roughness: 0.5, transparent: true, opacity: 0.55, depthWrite: false
      });
      const roof = new THREE.Mesh(new THREE.BoxGeometry(gm.width + 0.5, 0.16, len), roofMat);
      roof.position.y = 2.68;
      grp.add(roof);

      const ribMat = new THREE.MeshStandardMaterial({ color: 0xa9bfd6, roughness: 0.7 });
      for (let i = 0; i <= 4; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(gm.width + 0.3, 0.09, 0.16), ribMat);
        rib.position.set(0, -0.02, -len / 2 + (len / 4) * i);
        grp.add(rib);
      }

      /* 连廊指示牌 */
      const lab = labelTexture(gm.name, '#2f7cf6', '700', 40);
      const signMat = new THREE.MeshBasicMaterial({ map: lab.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4 / lab.aspect), signMat);
      sign.position.set(0, 3.15, 0);
      sign.rotation.y = angle + Math.PI / 2;
      grp.add(sign);

      bridgeGroup.add(grp);
    });
  }

  /* ======================================================================
   * 小人
   * ==================================================================== */
  function buildWalker() {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xf3d0b5, roughness: 0.85 });
    const coat = new THREE.MeshStandardMaterial({ color: 0x2f7cf6, roughness: 0.55, metalness: 0.05 });
    const coat2 = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2c3d55, roughness: 0.8 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.9 });

    /* 头 */
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), skin);
    head.position.y = 1.63;
    g.add(head);
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.175, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairCap.position.y = 1.64;
    g.add(hairCap);

    /* 身体 */
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.19, 0.58, 14), coat2);
    body.position.y = 1.2;
    g.add(body);
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.06), coat);
    vest.position.set(0, 1.26, 0.17);
    g.add(vest);

    /* 手臂（肩部枢轴） */
    function limb(mat, w, h, d, x, y) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.y = -h / 2;
      pivot.add(mesh);
      g.add(pivot);
      return pivot;
    }
    const armL = limb(coat, 0.085, 0.44, 0.085, -0.215, 1.44);
    const armR = limb(coat, 0.085, 0.44, 0.085, 0.215, 1.44);
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
    handL.position.set(-0.215, 0.98, 0);
    g.add(handL);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
    handR.position.set(0.215, 0.98, 0);
    g.add(handR);

    /* 腿（髋部枢轴） */
    const legL = limb(pants, 0.11, 0.62, 0.11, -0.085, 0.86);
    const legR = limb(pants, 0.11, 0.62, 0.11, 0.085, 0.86);

    /* 脚下光圈 */
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x2f7cf6, transparent: true, opacity: 0.65, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(ring);

    g.visible = false;
    scene.add(g);

    walker = {
      group: g, head: head, hairCap: hairCap, body: body,
      armL: armL, armR: armR, legL: legL, legR: legR,
      handL: handL, handR: handR, ring: ring,
      phase: 0, yaw: 0
    };
  }

  function setWalkerPose(t) {
    const w = walker;
    const sw = Math.sin(w.phase);
    w.legL.rotation.x = sw * 0.62;
    w.legR.rotation.x = -sw * 0.62;
    w.armL.rotation.x = -sw * 0.52;
    w.armR.rotation.x = sw * 0.52;
    const bob = Math.abs(Math.cos(w.phase)) * 0.045;
    w.body.position.y = 1.2 + bob;
    w.head.position.y = 1.63 + bob;
    w.hairCap.position.y = 1.64 + bob;
    /* 手臂末端跟随（简单处理：按旋转后的位置摆动手部） */
    w.handL.position.set(-0.215, 0.98 + bob, Math.sin(w.armL.rotation.x) * 0.42);
    w.handR.position.set(0.215, 0.98 + bob, Math.sin(w.armR.rotation.x) * 0.42);
    w.ring.scale.setScalar(0.92 + Math.sin(t * 2.6) * 0.07);
  }

  /* ======================================================================
   * 楼层聚焦 / 相机
   * ==================================================================== */
  function setEmphasis(floorId) {
    const focus = Data.getFloor(floorId);
    Object.keys(floorNodes).forEach(function (id) {
      const node = floorNodes[id];
      const f = Data.getFloor(id);
      let a;
      if (id === floorId) a = 1;
      else if (f.buildingId === focus.buildingId) a = currentMode === 'campus' ? 1 : 0.16;
      else a = currentMode === 'campus' ? 1 : 0.09;
      node.target = a;
    });
  }

  function applyAlphas() {
    Object.keys(floorNodes).forEach(function (id) {
      const node = floorNodes[id];
      if (Math.abs(node.alpha - node.target) < 0.004) return;
      node.alpha += (node.target - node.alpha) * 0.16;
      const solid = node.alpha > 0.97;
      for (let i = 0; i < node.mats.length; i++) {
        const it = node.mats[i];
        it.m.opacity = it.base * node.alpha;
        /* 不透明的楼层走不透明渲染通道，避免大量半透明叠加拖垮帧率 */
        const wantTransparent = !solid || !it.solid;
        if (it.m.transparent !== wantTransparent) {
          it.m.transparent = wantTransparent;
          it.m.needsUpdate = true;
        }
        it.m.depthWrite = solid ? true : false;
      }
      node.group.visible = node.alpha > 0.02;
    });
  }

  function focusFloor(floorId, opts) {
    opts = opts || {};
    const f = Data.getFloor(floorId);
    if (!f) return;
    currentFloorId = floorId;
    currentMode = 'floor';
    setEmphasis(floorId);
    setPins(floorId);

    if (opts.camera === false) return;
    goal.tx = f.ox; goal.ty = f.y; goal.tz = f.oz;
    goal.radius = opts.radius || 62;
    goal.phi = 0.86;
    if (opts.theta != null) goal.theta = opts.theta;
  }

  function campusRadius() {
    const el = renderer.domElement.parentElement;
    const aspect = el && el.clientHeight ? el.clientWidth / el.clientHeight : 1;
    const hfovHalf = Math.atan(Math.tan((camera.fov * Math.PI / 180) / 2) * aspect);
    const byW = (98 / 2) / Math.tan(hfovHalf);
    const byH = (80 / 2) / Math.tan((camera.fov * Math.PI / 180) / 2) / Math.cos(0.8);
    return clamp(Math.max(byW, byH), 150, 400);
  }

  function showCampus(instant) {
    currentMode = 'campus';
    setEmphasis(currentFloorId);
    const f = Data.getFloor(currentFloorId);
    const b = Data.getBuilding(f.buildingId);
    goal.tx = b.pos.x + 14; goal.ty = 7; goal.tz = b.pos.z + 2;
    goal.radius = 150;
    goal.phi = 1.02;
    goal.theta = 0.0;
    if (instant) {
      cam.tx = goal.tx; cam.ty = goal.ty; cam.tz = goal.tz;
      cam.radius = goal.radius; cam.phi = goal.phi; cam.theta = goal.theta;
    }
  }

  function resetView() {
    if (currentMode === 'campus') showCampus();
    else focusFloor(currentFloorId, { radius: 62 });
  }

  function flyTo(x, z, y, opts) {
    opts = opts || {};
    goal.tx = x;
    goal.tz = z;
    if (y != null) goal.ty = y;
    goal.radius = opts.radius || 34;
    if (opts.phi != null) goal.phi = opts.phi;
    if (opts.theta != null) goal.theta = opts.theta;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function updateCamera(dt) {
    const k = 1 - Math.pow(0.0015, dt);
    cam.theta += (goal.theta - cam.theta) * k;
    cam.phi += (goal.phi - cam.phi) * k;
    cam.radius += (goal.radius - cam.radius) * k;
    cam.tx += (goal.tx - cam.tx) * k;
    cam.ty += (goal.ty - cam.ty) * k;
    cam.tz += (goal.tz - cam.tz) * k;

    TARGET.set(cam.tx, cam.ty, cam.tz);
    const sp = Math.sin(cam.phi), cp = Math.cos(cam.phi);
    camera.position.set(
      cam.tx + cam.radius * sp * Math.sin(cam.theta),
      cam.ty + cam.radius * cp,
      cam.tz + cam.radius * sp * Math.cos(cam.theta)
    );
    camera.lookAt(TARGET);
  }

  /* ======================================================================
   * POI 标签
   * ==================================================================== */
  function buildAllPins() {
    labelLayer.innerHTML = '';
    pinEls.length = 0;
    Data.allPois().forEach(function (poi) {
      const f = Data.getFloor(poi.floorId);
      const meta = Data.typeOf(poi.type);
      const el = document.createElement('button');
      el.className = 'pin pin-' + poi.type;
      el.style.setProperty('--pin-color', meta.accent);
      el.innerHTML = '<span class="pin-ico">' + meta.icon + '</span>';
      el.title = poi.name;
      el.style.display = 'none';
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (cb.onPoiClick) cb.onPoiClick(poi.id);
      });
      labelLayer.appendChild(el);
      pinEls.push({
        el: el, poi: poi,
        world: new THREE.Vector3(poi.x + f.ox, f.y + 2.55, poi.z + f.oz)
      });
    });
  }

  function setPins(floorId) {
    const f = Data.getFloor(floorId);
    currentPois = Data.getPois(floorId);
    pinEls.forEach(function (p) {
      p.el.style.display = (p.poi.floorId === floorId) ? 'flex' : 'none';
    });
  }

  function setSelectedPoi(poiId) {
    pinEls.forEach(function (p) {
      p.el.classList.toggle('is-active', p.poi.id === poiId);
    });
  }

  function updateLabels() {
    if (!renderer) return;
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    const v = new THREE.Vector3();
    const camPos = camera.position;
    for (let i = 0; i < pinEls.length; i++) {
      const p = pinEls[i];
      if (p.el.style.display === 'none') continue;
      v.copy(p.world).project(camera);
      const dist = camPos.distanceTo(p.world);
      if (v.z > 1 || v.z < -1 || dist > 260) { p.el.style.opacity = '0'; continue; }
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      if (sx < -80 || sy < -80 || sx > w + 80 || sy > h + 80) { p.el.style.opacity = '0'; continue; }
      p.el.style.transform = 'translate(-50%,-100%) translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
      const k = dist > 200 ? Math.max(0.15, (260 - dist) / 60) : 1;
      p.el.style.opacity = String(k);
    }
  }

  /* ======================================================================
   * 路径
   * ==================================================================== */
  let chevTex = null;

  function chevronTexture() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(20, 14); ctx.lineTo(42, 32); ctx.lineTo(20, 50);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  function ribbonGeometry(points, width, uScale) {
    const geo = new THREE.BufferGeometry();
    const pos = [], uv = [], idx = [];
    const n = points.length;
    if (n < 2) return geo;

    const dirs = [];
    for (let i = 0; i < n - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dz = points[i + 1].z - points[i].z;
      const len = Math.hypot(dx, dz) || 1e-6;
      dirs.push({ x: dx / len, z: dz / len });
    }

    let u = 0;
    for (let i = 0; i < n; i++) {
      let nx, nz, scale = 1;
      if (i === 0) { nx = -dirs[0].z; nz = dirs[0].x; }
      else if (i === n - 1) { nx = -dirs[n - 2].z; nz = dirs[n - 2].x; }
      else {
        const a = dirs[i - 1], b = dirs[i];
        let mx = -a.z + -b.z, mz = a.x + b.x;
        const ml = Math.hypot(mx, mz);
        if (ml < 0.001) { nx = -a.z; nz = a.x; }
        else {
          mx /= ml; mz /= ml;
          const dot = mx * (-a.z) + mz * (a.x);
          scale = 1 / Math.max(0.45, dot);
          nx = mx; nz = mz;
        }
      }
      const hw = (width / 2) * scale;
      if (i > 0) u += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z) * uScale;
      pos.push(points[i].x + nx * hw, 0, points[i].z + nz * hw);
      pos.push(points[i].x - nx * hw, 0, points[i].z - nz * hw);
      uv.push(u, 0, u, 1);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      idx.push(a, c, b, b, c, d);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  function disposeGroup(g) {
    if (!g) return;
    g.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
    if (g.parent) g.parent.remove(g);
  }

  function showPath(route) {
    lastPath = route;
    if (pathGroup) { disposeGroup(pathGroup); pathGroup = null; }
    if (markerGroup) { disposeGroup(markerGroup); markerGroup = null; }
    if (!route) return;

    pathGroup = new THREE.Group();
    scene.add(pathGroup);

    const flowTexes = [];

    Object.keys(route.segments).forEach(function (fid) {
      const f = Data.getFloor(fid);
      const pts = route.segments[fid].map(function (p) {
        return { x: p.x + f.ox, z: p.z + f.oz };
      });
      if (pts.length < 2) return;
      const y = f.y + 0.14;

      const halo = new THREE.Mesh(
        ribbonGeometry(pts, 1.7, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x8ab8ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })
      );
      halo.position.y = y;
      pathGroup.add(halo);

      const main = new THREE.Mesh(
        ribbonGeometry(pts, 0.66, 0.55),
        new THREE.MeshBasicMaterial({ color: 0x2f7cf6, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })
      );
      main.position.y = y + 0.015;
      pathGroup.add(main);

      if (!chevTex) chevTex = chevronTexture();
      const flowTex = chevTex.clone();
      flowTex.needsUpdate = true;
      const flow = new THREE.Mesh(
        ribbonGeometry(pts, 0.52, 1.1),
        new THREE.MeshBasicMaterial({ map: flowTex, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })
      );
      flow.position.y = y + 0.026;
      pathGroup.add(flow);
      flowTexes.push(flowTex);

      /* 拐点箭头 */
      for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i - 1], b = pts[i], c = pts[i + 1];
        const v1 = { x: b.x - a.x, z: b.z - a.z };
        const v2 = { x: c.x - b.x, z: c.z - b.z };
        const l1 = Math.hypot(v1.x, v1.z), l2 = Math.hypot(v2.x, v2.z);
        if (l1 < 0.5 || l2 < 0.5) continue;
        const dot = (v1.x * v2.x + v1.z * v2.z) / (l1 * l2);
        if (dot > 0.93) continue;
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.4, 0.95, 12),
          new THREE.MeshBasicMaterial({ color: 0x1a56c4 })
        );
        cone.rotation.x = Math.PI / 2;
        cone.rotation.z = -Math.atan2(v2.x, v2.z);
        cone.position.set(b.x, y + 0.42, b.z);
        pathGroup.add(cone);
      }
    });

    /* 竖向换乘连接（电梯井里的光柱） */
    const p3 = route.points3d || [];
    for (let i = 1; i < p3.length; i++) {
      const a = p3[i - 1], b = p3[i];
      if (Math.abs(b.y - a.y) < 0.5) continue;
      const h = Math.abs(b.y - a.y);
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, h, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x59a6ff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })
      );
      col.position.set(a.x, Math.min(a.y, b.y) + h / 2, a.z);
      pathGroup.add(col);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.06, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x2f7cf6 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(a.x, b.y + 0.1, a.z);
      pathGroup.add(ring);
    }

    /* 起终点标记 */
    markerGroup = new THREE.Group();
    scene.add(markerGroup);
    const s = route.startPoi, e = route.endPoi;
    const sf = Data.getFloor(s.floorId), ef = Data.getFloor(e.floorId);
    addMarker(markerGroup, s.x + sf.ox, s.z + sf.oz, sf.y, 0x16a34a, '起');
    addMarker(markerGroup, e.x + ef.ox, e.z + ef.oz, ef.y, 0xe11d48, '终');

    pathGroup.userData.flow = flowTexes;
  }

  function addMarker(g, x, z, y, color, text) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.95, 32),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.16, z);
    ring.userData.pulse = true;
    g.add(ring);

    const dot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.16, 20),
      new THREE.MeshBasicMaterial({ color: color })
    );
    dot.position.set(x, y + 0.18, z);
    g.add(dot);

    const lab = labelTexture(text, '#' + color.toString(16).padStart(6, '0'), '700', 48);
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(lab.aspect * 1.05, 1.05),
      new THREE.MeshBasicMaterial({ map: lab.tex, transparent: true, depthWrite: false })
    );
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, y + 0.17, z + 1.25);
    g.add(p);
  }

  function clearPath() {
    lastPath = null;
    if (pathGroup) { disposeGroup(pathGroup); pathGroup = null; }
    if (markerGroup) { disposeGroup(markerGroup); markerGroup = null; }
  }

  /* ======================================================================
   * 小人行走
   * ==================================================================== */
  function cumulative(pts) {
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const len = Math.sqrt(
        Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2) + Math.pow(b.z - a.z, 2)
      );
      if (len < 1e-4) continue;
      segs.push({ a: a, b: b, len: len, start: total });
      total += len;
    }
    return { segs: segs, total: total };
  }

  function sampleAt(data, s) {
    const segs = data.segs;
    if (!segs.length) return null;
    s = Math.max(0, Math.min(data.total, s));
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i];
      if (s <= sg.start + sg.len || i === segs.length - 1) {
        const t = sg.len > 0 ? (s - sg.start) / sg.len : 0;
        return {
          x: sg.a.x + (sg.b.x - sg.a.x) * t,
          y: sg.a.y + (sg.b.y - sg.a.y) * t,
          z: sg.a.z + (sg.b.z - sg.a.z) * t,
          dx: sg.b.x - sg.a.x, dz: sg.b.z - sg.a.z,
          dy: sg.b.y - sg.a.y,
          floorId: (t < 0.5 ? sg.a.floorId : sg.b.floorId)
        };
      }
    }
    return null;
  }

  function startWalk(route, opts) {
    opts = opts || {};
    if (!route || !route.points3d || route.points3d.length < 2) return false;
    const data = cumulative(route.points3d);
    const p = sampleAt(data, 0);
    walker.group.visible = true;
    if (p) {
      walker.group.position.set(p.x, p.y, p.z);
      walker.yaw = Math.atan2(p.dx, p.dz);
      walker.group.rotation.y = walker.yaw;
    }
    walkState = {
      data: data, s: 0,
      speed: opts.speed || 3.4,
      walking: true,
      onEnd: opts.onEnd || null,
      onFloor: opts.onFloor || null,
      follow: opts.follow !== false,
      lastFloor: null
    };
    return true;
  }

  function stopWalk() {
    walkState = null;
    if (walker) walker.group.visible = false;
  }

  function placeWalkerAt(poiId) {
    const poi = Data.getPoi(poiId);
    if (!poi || !walker) return;
    const f = Data.getFloor(poi.floorId);
    walker.group.visible = true;
    walker.group.position.set(poi.x + f.ox, f.y + 0.02, poi.z + f.oz);
    walker.phase = 0;
    setWalkerPose(0);
  }

  function hideWalker() {
    if (walker) walker.group.visible = false;
  }

  function updateWalk(dt) {
    if (!walkState || !walker) return;
    const st = walkState;
    st.s += st.speed * dt;
    const p = sampleAt(st.data, st.s);
    if (!p) { endWalk(); return; }

    walker.group.position.set(p.x, p.y, p.z);

    /* 垂直段（电梯/楼梯）：不走动，只升降 */
    const vertical = Math.abs(p.dy) > 0.5 && Math.hypot(p.dx, p.dz) < 0.4;
    if (!vertical) {
      walker.phase += dt * st.speed * 3.4;
      const targetYaw = Math.atan2(p.dx, p.dz);
      let d = targetYaw - walker.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      walker.yaw += d * Math.min(1, dt * 10);
    } else {
      walker.phase += dt * 1.2;   // 轻微摆动
    }
    walker.group.rotation.y = walker.yaw;
    setWalkerPose(clock.elapsedTime);

    /* 楼层切换回调 */
    if (p.floorId && p.floorId !== st.lastFloor) {
      st.lastFloor = p.floorId;
      if (st.onFloor) st.onFloor(p.floorId);
    }

    /* 相机第三人称跟随 */
    if (st.follow) {
      const kk = Math.min(1, dt * 3.5);
      cam.tx += (p.x - cam.tx) * kk;
      cam.tz += (p.z - cam.tz) * kk;
      cam.ty += ((p.y + 2.0) - cam.ty) * Math.min(1, dt * 2.4);
      cam.radius += (15.5 - cam.radius) * Math.min(1, dt * 2.2);
      cam.phi += (1.12 - cam.phi) * Math.min(1, dt * 2.2);
      let dth = walker.yaw + Math.PI - cam.theta;
      while (dth > Math.PI) dth -= Math.PI * 2;
      while (dth < -Math.PI) dth += Math.PI * 2;
      cam.theta += dth * Math.min(1, dt * 2.6);
      goal.tx = cam.tx; goal.tz = cam.tz; goal.ty = cam.ty;
      goal.radius = cam.radius; goal.phi = cam.phi; goal.theta = cam.theta;
    }

    if (st.s >= st.data.total - 0.05) endWalk();
  }

  function endWalk() {
    const st = walkState;
    if (!st) return;
    walkState = null;
    if (st.onEnd) st.onEnd();
  }

  function isWalking() { return !!walkState; }

  /* ======================================================================
   * 交互
   * ==================================================================== */
  function bindControls(container) {
    const el = renderer.domElement;
    let mode = null, lastX = 0, lastY = 0, moved = 0;
    let touchCount = 0, pinchStart = 0, pinchRadius = 0;

    function onDown(x, y, m) {
      mode = m; lastX = x; lastY = y; moved = 0;
    }
    function onMove(x, y) {
      if (!mode) return;
      const dx = x - lastX, dy = y - lastY;
      lastX = x; lastY = y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (mode === 'rotate') {
        goal.theta -= dx * 0.0065;
        goal.phi = clamp(goal.phi - dy * 0.0055, 0.12, 1.42);
      } else if (mode === 'pan') {
        const k = goal.radius * 0.0016;
        const rx = Math.cos(goal.theta), rz = -Math.sin(goal.theta);
        const fx = -Math.sin(goal.theta), fz = -Math.cos(goal.theta);
        goal.tx -= rx * dx * k;
        goal.tz -= rz * dx * k;
        goal.tx += fx * dy * k;
        goal.tz += fz * dy * k;
      }
    }
    function onUp(x, y) {
      const isClick = moved < 8 && mode !== null;
      mode = null;
      if (isClick) doPick(x, y);
    }

    function doPick(x, y) {
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
    }

    el.addEventListener('mousedown', function (e) {
      e.preventDefault();
      onDown(e.clientX, e.clientY, e.button === 2 || e.shiftKey ? 'pan' : 'rotate');
    });
    window.addEventListener('mousemove', function (e) { if (mode) onMove(e.clientX, e.clientY); });
    window.addEventListener('mouseup', function (e) { if (mode) onUp(e.clientX, e.clientY); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      goal.radius = clamp(goal.radius * (e.deltaY > 0 ? 1.09 : 0.917), 14, 420);
    }, { passive: false });

    el.addEventListener('touchstart', function (e) {
      touchCount = e.touches.length;
      if (touchCount === 1) {
        onDown(e.touches[0].clientX, e.touches[0].clientY, 'rotate');
      } else if (touchCount >= 2) {
        mode = 'pinch';
        moved = 999;
        pinchStart = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchRadius = goal.radius;
      }
    }, { passive: true });

    el.addEventListener('touchmove', function (e) {
      if (mode === 'pinch' && e.touches.length >= 2) {
        e.preventDefault();
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (pinchStart > 0) goal.radius = clamp(pinchRadius * (pinchStart / Math.max(1, d)), 14, 420);
      } else if (mode === 'rotate' && e.touches.length === 1) {
        e.preventDefault();
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    el.addEventListener('touchend', function (e) {
      if (mode === 'rotate' && e.changedTouches.length) {
        onUp(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      } else if (e.touches.length === 0) {
        mode = null;
      }
    }, { passive: true });
  }

  /* ======================================================================
   * 主循环
   * ==================================================================== */
  let loopError = null;
  function animate() {
    requestAnimationFrame(animate);
    try { frame(); } catch (e) { if (!loopError) { loopError = e; console.error(e); } }
  }

  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    updateWalk(dt);
    updateCamera(dt);
    applyAlphas();

    if (pathGroup && pathGroup.userData.flow) {
      pathGroup.userData.flow.forEach(function (t) { t.offset.x -= dt * 1.1; });
    }
    if (markerGroup) {
      const s = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.1;
      markerGroup.children.forEach(function (c) {
        if (c.userData.pulse) c.scale.set(s, s, s);
      });
    }

    renderer.render(scene, camera);
    updateLabels();
  }

  return {
    init: init,
    resize: resize,
    focusFloor: focusFloor,
    showCampus: showCampus,
    resetView: resetView,
    flyTo: flyTo,
    setPins: setPins,
    setSelectedPoi: setSelectedPoi,
    showPath: showPath,
    clearPath: clearPath,
    startWalk: startWalk,
    stopWalk: stopWalk,
    placeWalkerAt: placeWalkerAt,
    hideWalker: hideWalker,
    isWalking: isWalking,
    getMode: function () { return currentMode; },
    getFloorId: function () { return currentFloorId; },
    buildAllPins: buildAllPins,
    debug: function () {
      return { cam: JSON.parse(JSON.stringify(cam)), goal: JSON.parse(JSON.stringify(goal)), mode: currentMode, floor: currentFloorId, error: loopError ? String(loopError && loopError.stack || loopError) : null };
    }
  };
})();
