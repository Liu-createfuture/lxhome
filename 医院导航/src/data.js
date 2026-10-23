/* ============================================================================
 * data.js  —  院区 3D 导航 Demo · 数据层
 * 说明：真实项目中这些数据由 /api/building/list、/api/floor/info、/api/poi/list、
 *      /api/roadnet/get 提供；本文件用假数据模拟，结构与 PRD 第 6/7 章一致。
 *
 * 坐标系：每层局部坐标 x∈[-30,30] z∈[-20,20]，楼栋通过 pos 平移到院区，
 *        楼层按 index 垂直堆叠（FLOOR_H），连廊连接不同楼栋的同一楼层。
 * ========================================================================== */
const Data = (function () {
  'use strict';

  const CFG = {
    W: 60, D: 40,
    HW: 30, HD: 20,
    CORR: 3,
    WALL_H: 2.9,
    WALL_T: 0.22,
    DOOR_W: 1.9,
    FLOOR_H: 3.7
  };

  const TYPE = {
    dept:        { name: '科室',       icon: '🏥', color: '#d3e2ff', accent: '#3b82f6' },
    cashier:     { name: '收费窗口',   icon: '💳', color: '#fbe4bf', accent: '#f59e0b' },
    pharmacy:    { name: '药房',       icon: '💊', color: '#cbefdc', accent: '#10b981' },
    lab:         { name: '检验检查',   icon: '🔬', color: '#ddd0fb', accent: '#8b5cf6' },
    imaging:     { name: '影像检查',   icon: '🩻', color: '#ddd0fb', accent: '#8b5cf6' },
    toilet:      { name: '卫生间',     icon: '🚻', color: '#c8e6f9', accent: '#0ea5e9' },
    lift:        { name: '客梯',       icon: '🛗', color: '#dde5f0', accent: '#64748b' },
    barrierLift: { name: '无障碍电梯', icon: '♿', color: '#c8e6f9', accent: '#0ea5e9' },
    escalator:   { name: '自动扶梯',   icon: '🛝', color: '#dde5f0', accent: '#64748b' },
    stairs:      { name: '楼梯',       icon: '🪜', color: '#dde5f0', accent: '#64748b' },
    emergency:   { name: '急诊',       icon: '🚨', color: '#fbc9c5', accent: '#ef4444' },
    exit:        { name: '出入口',     icon: '🚪', color: '#dde5f0', accent: '#111827' },
    nurse:       { name: '护士站',     icon: '🧑‍⚕️', color: '#cbefdc', accent: '#10b981' },
    service:     { name: '服务台',     icon: '🧾', color: '#fbe4bf', accent: '#f59e0b' },
    ward:        { name: '病房',       icon: '🛏️', color: '#c8e6f9', accent: '#0ea5e9' },
    rest:        { name: '休息区',     icon: '🪑', color: '#e4e9f2', accent: '#94a3b8' },
    facility:    { name: '配套设施',   icon: '📌', color: '#e4e9f2', accent: '#94a3b8' }
  };

  const SYNONYM = {
    toilet: ['厕所', '洗手间', 'wc', 'toilet', '卫生间', '解手'],
    pharmacy: ['取药', '拿药', '开药', '西药房', '中药房'],
    exit: ['出口', '大门', '出门', '门口', '离开', '出入口'],
    barrierLift: ['无障碍', '轮椅', '电梯', '直梯'],
    lift: ['电梯', '直梯', '升降梯'],
    escalator: ['扶梯', '电扶梯', '自动扶梯'],
    stairs: ['楼梯', '步行梯', '走楼梯'],
    cashier: ['缴费', '交费', '收费', '结账', '挂号'],
    lab: ['抽血', '化验', '验血', '检查'],
    imaging: ['拍片', 'ct', '核磁', 'x光', 'b超'],
    emergency: ['急诊', '急救', '外伤'],
    nurse: ['护士', '问询', '咨询'],
    ward: ['住院', '病房', '床位']
  };

  function room(id, name, type, x0, x1, side, opt) {
    opt = opt || {};
    let z0, z1;
    if (opt.z) { z0 = opt.z[0]; z1 = opt.z[1]; }
    else if (side === 'N') { z0 = -CFG.HD; z1 = -CFG.CORR; }
    else { z0 = CFG.CORR; z1 = CFG.HD; }
    const cx = (x0 + x1) / 2;
    let doorX = opt.doorX != null ? opt.doorX : cx;
    doorX = Math.max(x0 + 1.3, Math.min(x1 - 1.3, doorX));
    return {
      id: id, name: name, type: type,
      x0: x0, x1: x1, z0: z0, z1: z1,
      doorX: doorX,
      open: !!opt.open,
      core: opt.core || null,
      noPoi: !!opt.noPoi,
      kw: opt.kw || []
    };
  }

  /* ======================= 门诊楼 ======================= */
  const MZ1 = {
    id: 'MZ1', name: '门诊楼 1 层', short: '1F', level: 1,
    rooms: [
      room('r101', '挂号收费处', 'cashier', -29, -19, 'N'),
      room('r102', '门诊药房', 'pharmacy', -19, -9, 'N'),
      room('r103', '楼梯间', 'stairs', -9, -3, 'N', { core: 'CORE_STAIR', noPoi: true }),
      room('r104', '检验科（抽血）', 'lab', 3, 12, 'N'),
      room('r105', '急诊科', 'emergency', 12, 24, 'N'),
      room('r106', '卫生间', 'toilet', 24, 29, 'N'),
      room('r107', '自助服务区', 'service', -29, -21, 'S'),
      room('r108', '出入院办理', 'service', -21, -12, 'S'),
      room('r109', '无障碍电梯厅', 'barrierLift', -12, -8, 'S', { core: 'CORE_LIFT_BF', noPoi: true }),
      room('r110', '母婴室', 'rest', -8, -3, 'S'),
      room('r111', '客梯厅', 'lift', 3, 9, 'S', { core: 'CORE_LIFT', noPoi: true }),
      room('r112', '放射科（DR / CT）', 'imaging', 9, 19, 'S'),
      room('r113', '超声科', 'lab', 19, 24, 'S'),
      room('r114', '无障碍卫生间', 'toilet', 24, 29, 'S')
    ],
    extraPois: [
      { id: 'P_GATE', name: '门诊正门', type: 'exit', x: 0, z: 17.6, nodeId: 'V18',
        intro: '门诊楼主入口，进门即为门诊大厅与导医台。' },
      { id: 'P_ER_GATE', name: '急诊入口（24 小时）', type: 'emergency', x: 28.2, z: 0, nodeId: 'H28',
        intro: '24 小时急诊通道入口，抢救室、急诊药房均在急诊科内。' },
      { id: 'P_DESK', name: '导医台', type: 'service', x: 0, z: 10, nodeId: 'V10',
        intro: '提供就诊咨询、轮椅租借、病历打印服务。' }
    ]
  };

  const MZ2 = {
    id: 'MZ2', name: '门诊楼 2 层', short: '2F', level: 2,
    rooms: [
      room('r201', '内科门诊', 'dept', -29, -19, 'N'),
      room('r202', '心血管内科', 'dept', -19, -9, 'N'),
      room('r203', '楼梯间', 'stairs', -9, -3, 'N', { core: 'CORE_STAIR', noPoi: true }),
      room('r204', '外科门诊', 'dept', 3, 12, 'N'),
      room('r205', '骨科门诊', 'dept', 12, 24, 'N'),
      room('r206', '卫生间', 'toilet', 24, 29, 'N'),
      room('r207', '检验科（生化）', 'lab', -29, -21, 'S'),
      room('r208', '收费处（2F）', 'cashier', -21, -12, 'S'),
      room('r209', '无障碍电梯厅', 'barrierLift', -12, -8, 'S', { core: 'CORE_LIFT_BF', noPoi: true }),
      room('r210', '母婴室', 'rest', -8, -3, 'S'),
      room('r211', '客梯厅', 'lift', 3, 9, 'S', { core: 'CORE_LIFT', noPoi: true }),
      room('r212', '超声科', 'lab', 9, 19, 'S'),
      room('r213', '采血室', 'lab', 19, 24, 'S'),
      room('r214', '卫生间', 'toilet', 24, 29, 'S')
    ],
    extraPois: [
      { id: 'P_201_DESK', name: '二层导医台', type: 'service', x: 0, z: 8, nodeId: 'V6',
        intro: '二层分诊咨询、叫号问题处理。' },
      { id: 'P_BR2_GATE', name: '2 层连廊（通往医技楼）', type: 'exit', x: 28.6, z: 0, nodeId: 'H28',
        intro: '经连廊可直达医技楼 2 层。' }
    ]
  };

  const MZ3 = {
    id: 'MZ3', name: '门诊楼 3 层', short: '3F', level: 3,
    rooms: [
      room('r301', '眼科', 'dept', -29, -19, 'N'),
      room('r302', '耳鼻喉科', 'dept', -19, -9, 'N'),
      room('r303', '楼梯间', 'stairs', -9, -3, 'N', { core: 'CORE_STAIR', noPoi: true }),
      room('r304', '口腔科', 'dept', 3, 12, 'N'),
      room('r305', '皮肤科', 'dept', 12, 24, 'N'),
      room('r306', '卫生间', 'toilet', 24, 29, 'N'),
      room('r307', '中医科', 'dept', -29, -21, 'S'),
      room('r308', '收费处（3F）', 'cashier', -21, -12, 'S'),
      room('r309', '无障碍电梯厅', 'barrierLift', -12, -8, 'S', { core: 'CORE_LIFT_BF', noPoi: true }),
      room('r310', '母婴室', 'rest', -8, -3, 'S'),
      room('r311', '客梯厅', 'lift', 3, 9, 'S', { core: 'CORE_LIFT', noPoi: true }),
      room('r312', '彩超室', 'lab', 9, 19, 'S', { kw: ['b超', '彩超', '心脏彩超'] }),
      room('r313', '心电图室', 'lab', 19, 24, 'S'),
      room('r314', '卫生间', 'toilet', 24, 29, 'S')
    ],
    extraPois: [
      { id: 'P_301_DESK', name: '三层导医台', type: 'service', x: 0, z: 8, nodeId: 'V6',
        intro: '三层分诊咨询。' },
      { id: 'P_BR3_GATE', name: '3 层连廊（通往住院楼）', type: 'exit', x: 0, z: 19.2, nodeId: 'V18',
        intro: '经连廊可直达住院楼 3 层病区。' }
    ]
  };

  /* ======================= 医技楼 ======================= */
  const YJ1 = {
    id: 'YJ1', name: '医技楼 1 层', short: '1F', level: 1,
    rooms: [
      room('r401', '检验中心', 'lab', -29, -19, 'N'),
      room('r402', '病理科', 'lab', -19, -9, 'N'),
      room('r403', '楼梯间', 'stairs', -9, -3, 'N', { core: 'CORE_STAIR', noPoi: true }),
      room('r404', 'CT 室', 'imaging', 3, 12, 'N', { kw: ['ct', '拍片'] }),
      room('r405', 'MRI 核磁室', 'imaging', 12, 24, 'N', { kw: ['核磁', '磁共振'] }),
      room('r406', '卫生间', 'toilet', 24, 29, 'N'),
      room('r407', '候检区', 'rest', -29, -21, 'S'),
      room('r408', '预约登记', 'service', -21, -12, 'S'),
      room('r409', '无障碍电梯厅', 'barrierLift', -12, -8, 'S', { core: 'CORE_LIFT_BF', noPoi: true }),
      room('r410', '更衣室', 'rest', -8, -3, 'S'),
      room('r411', '客梯厅', 'lift', 3, 9, 'S', { core: 'CORE_LIFT', noPoi: true }),
      room('r412', 'DR 摄片室', 'imaging', 9, 19, 'S', { kw: ['x光', '拍片'] }),
      room('r413', '内镜中心', 'lab', 19, 24, 'S'),
      room('r414', '卫生间', 'toilet', 24, 29, 'S')
    ],
    extraPois: [
      { id: 'P_401_GATE', name: '医技楼入口', type: 'exit', x: 0, z: 17.6, nodeId: 'V18',
        intro: '医技楼正门（南门）。' }
    ]
  };

  const YJ2 = {
    id: 'YJ2', name: '医技楼 2 层', short: '2F', level: 2,
    rooms: [
      room('r601', '超声科', 'lab', -29, -19, 'N', { kw: ['b超', '彩超'] }),
      room('r602', '心电图室', 'lab', -19, -9, 'N'),
      room('r603', '楼梯间', 'stairs', -9, -3, 'N', { core: 'CORE_STAIR', noPoi: true }),
      room('r604', '内镜中心', 'lab', 3, 12, 'N'),
      room('r605', '肺功能室', 'lab', 12, 24, 'N'),
      room('r606', '卫生间', 'toilet', 24, 29, 'N'),
      room('r607', '功能检查预约', 'service', -29, -21, 'S'),
      room('r608', '候检区', 'rest', -21, -12, 'S'),
      room('r609', '无障碍电梯厅', 'barrierLift', -12, -8, 'S', { core: 'CORE_LIFT_BF', noPoi: true }),
      room('r610', '休息区', 'rest', -8, -3, 'S'),
      room('r611', '客梯厅', 'lift', 3, 9, 'S', { core: 'CORE_LIFT', noPoi: true }),
      room('r612', '肌电图室', 'lab', 9, 19, 'S'),
      room('r613', '骨密度室', 'lab', 19, 24, 'S'),
      room('r614', '卫生间', 'toilet', 24, 29, 'S')
    ],
    extraPois: [
      { id: 'P_BR2_GATE2', name: '2 层连廊（通往门诊楼）', type: 'exit', x: -28.6, z: 0, nodeId: 'H-28',
        intro: '经连廊可直达门诊楼 2 层。' }
    ]
  };

  /* ======================= 住院楼 ======================= */
  const ZY1 = {
    id: 'ZY1', name: '住院楼 1 层', short: '1F', level: 1,
    rooms: [
      room('r701', '住院药房', 'pharmacy', -29, -19, 'N'),
      room('r702', '出入院办理', 'service', -19, -9, 'N'),
      room('r703', '楼梯间', 'stairs', -9, -3, 'N', { core: 'CORE_STAIR', noPoi: true }),
      room('r704', '探视接待', 'service', 3, 12, 'N'),
      room('r705', '便利店', 'facility', 12, 24, 'N'),
      room('r706', '卫生间', 'toilet', 24, 29, 'N'),
      room('r707', '住院大厅', 'rest', -29, -21, 'S'),
      room('r708', '检验科', 'lab', -21, -12, 'S'),
      room('r709', '无障碍电梯厅', 'barrierLift', -12, -8, 'S', { core: 'CORE_LIFT_BF', noPoi: true }),
      room('r710', '值班室', 'facility', -8, -3, 'S'),
      room('r711', '客梯厅', 'lift', 3, 9, 'S', { core: 'CORE_LIFT', noPoi: true }),
      room('r712', '静配中心', 'pharmacy', 9, 19, 'S'),
      room('r713', '社工服务', 'service', 19, 24, 'S'),
      room('r714', '卫生间', 'toilet', 24, 29, 'S')
    ],
    extraPois: [
      { id: 'P_701_GATE', name: '住院楼入口', type: 'exit', x: 0, z: 17.6, nodeId: 'V18',
        intro: '住院楼正门，办理入出院请至 1 层大厅。' }
    ]
  };

  const ZY2 = {
    id: 'ZY2', name: '住院楼 2 层', short: '2F', level: 2,
    rooms: [
      room('r801', '心血管内科病区', 'ward', -29, -19, 'N'),
      room('r802', '护士站', 'nurse', -19, -9, 'N'),
      room('r803', '楼梯间', 'stairs', -9, -3, 'N', { core: 'CORE_STAIR', noPoi: true }),
      room('r804', '2-01 病房', 'ward', 3, 12, 'N'),
      room('r805', '2-02 病房', 'ward', 12, 24, 'N'),
      room('r806', '卫生间', 'toilet', 24, 29, 'N'),
      room('r807', '探视等候区', 'rest', -29, -21, 'S'),
      room('r808', '治疗室', 'facility', -21, -12, 'S'),
      room('r809', '无障碍电梯厅', 'barrierLift', -12, -8, 'S', { core: 'CORE_LIFT_BF', noPoi: true }),
      room('r810', '配餐间', 'facility', -8, -3, 'S'),
      room('r811', '客梯厅', 'lift', 3, 9, 'S', { core: 'CORE_LIFT', noPoi: true }),
      room('r812', '2-03 病房', 'ward', 9, 19, 'S'),
      room('r813', '处置室', 'facility', 19, 24, 'S'),
      room('r814', '卫生间', 'toilet', 24, 29, 'S')
    ],
    extraPois: []
  };

  const ZY3 = {
    id: 'ZY3', name: '住院楼 3 层', short: '3F', level: 3,
    rooms: [
      room('r901', '骨科病区', 'ward', -29, -19, 'N'),
      room('r902', '护士站', 'nurse', -19, -9, 'N'),
      room('r903', '楼梯间', 'stairs', -9, -3, 'N', { core: 'CORE_STAIR', noPoi: true }),
      room('r904', '3-01 病房', 'ward', 3, 12, 'N'),
      room('r905', '3-02 病房', 'ward', 12, 24, 'N'),
      room('r906', '卫生间', 'toilet', 24, 29, 'N'),
      room('r907', '示教室', 'facility', -29, -21, 'S'),
      room('r908', '康复治疗室', 'facility', -21, -12, 'S'),
      room('r909', '无障碍电梯厅', 'barrierLift', -12, -8, 'S', { core: 'CORE_LIFT_BF', noPoi: true }),
      room('r910', '配餐间', 'facility', -8, -3, 'S'),
      room('r911', '客梯厅', 'lift', 3, 9, 'S', { core: 'CORE_LIFT', noPoi: true }),
      room('r912', '3-03 病房', 'ward', 9, 19, 'S'),
      room('r913', '医护办公室', 'facility', 19, 24, 'S'),
      room('r914', '卫生间', 'toilet', 24, 29, 'S')
    ],
    extraPois: [
      { id: 'P_BR3_GATE2', name: '3 层连廊（通往门诊楼）', type: 'exit', x: 0, z: -19.2, nodeId: 'V-18',
        intro: '经连廊可直达门诊楼 3 层。' }
    ]
  };

  /* ---------------- 竖向交通核心 ---------------- */
  function coresOf(floor) {
    const defs = {
      CORE_LIFT:    { type: 'lift',        name: '客梯厅',   x: 6,   z: 8,   channel: 'lift' },
      CORE_LIFT_BF: { type: 'barrierLift', name: '无障碍电梯', x: -10, z: 8, channel: 'barrierLift' },
      CORE_ESC:     { type: 'escalator',   name: '自动扶梯', x: 0,   z: 14,  channel: 'escalator' },
      CORE_STAIR:   { type: 'stairs',      name: '安全楼梯', x: -6,  z: -12, channel: 'stairs' }
    };
    return Object.keys(defs).map(function (k) {
      const c = defs[k];
      return {
        coreId: k, x: c.x, z: c.z, channel: c.channel, type: c.type,
        poi: {
          id: 'P_' + k + '_' + floor.id,
          name: c.name, type: c.type, x: c.x, z: c.z,
          nodeId: k,
          intro: c.type === 'barrierLift'
            ? '宽轿厢、低位按钮，轮椅 / 婴儿车 / 行动不便者可优先使用。'
            : (c.type === 'escalator' ? '双向自动扶梯，赶时间可选择。' : '')
        }
      };
    });
  }

  /* ======================= 楼栋 & 院区布局 ======================= */
  const BUILDINGS = [
    { id: 'B1', name: '门诊楼', pos: { x: 0, z: 0 }, floors: [MZ1, MZ2, MZ3] },
    { id: 'B2', name: '医技楼', pos: { x: 76, z: 0 }, floors: [YJ1, YJ2] },
    { id: 'B3', name: '住院楼', pos: { x: 0, z: 60 }, floors: [ZY1, ZY2, ZY3] }
  ];

  /* 连廊：连接不同楼栋同一层的走廊端节点 */
  const BRIDGES = [
    { id: 'BR2', name: '2 层连廊', fromFloor: 'MZ2', fromNode: 'H28', toFloor: 'YJ2', toNode: 'H-28', width: 5.2 },
    { id: 'BR3', name: '3 层连廊', fromFloor: 'MZ3', fromNode: 'V18', toFloor: 'ZY3', toNode: 'V-18', width: 5.2 }
  ];

  const FLOOR_MAP = {};
  const BUILDING_MAP = {};
  BUILDINGS.forEach(function (b) {
    BUILDING_MAP[b.id] = b;
    b.floors.forEach(function (f, i) {
      f.buildingId = b.id;
      f.buildingName = b.name;
      f.idx = i;
      f.y = i * CFG.FLOOR_H;
      f.ox = b.pos.x;
      f.oz = b.pos.z;
      f.cores = coresOf(f);
      FLOOR_MAP[f.id] = f;
    });
  });

  /* ======================= POI 装配 ======================= */
  const POI_MAP = {};
  const FLOOR_POIS = {};

  function buildPois(floor) {
    const list = [];
    floor.rooms.forEach(function (r) {
      if (r.noPoi) return;
      const center = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
      list.push({
        id: 'P_' + r.id,
        name: r.name,
        type: r.type,
        x: center.x, z: center.z,
        floorId: floor.id,
        buildingId: floor.buildingId,
        nodeId: 'R_' + r.id,
        roomId: r.id,
        kw: r.kw,
        intro: r.name + '，位于' + floor.buildingName + ' ' + floor.short + '，' +
          (TYPE[r.type] ? TYPE[r.type].name : '') + '。'
      });
    });
    floor.cores.forEach(function (c) {
      const p = c.poi;
      p.floorId = floor.id; p.buildingId = floor.buildingId;
      list.push(p);
    });
    (floor.extraPois || []).forEach(function (p) {
      p.floorId = floor.id; p.buildingId = floor.buildingId;
      list.push(p);
    });
    return list;
  }

  BUILDINGS.forEach(function (b) {
    b.floors.forEach(function (f) {
      const pois = buildPois(f);
      FLOOR_POIS[f.id] = pois;
      pois.forEach(function (p) { POI_MAP[p.id] = p; });
    });
  });

  /* ======================= 路网生成 ======================= */
  const NET_MAP = {};

  function buildNet(floor) {
    const nodes = [], index = {};
    function N(id, x, z, kind) {
      if (index[id]) return index[id];
      const n = { id: id, x: x, z: z, floorId: floor.id, level: floor.level, y: floor.y, kind: kind || 'corridor' };
      nodes.push(n); index[id] = n; return n;
    }
    const edges = [];
    function E(a, b, channel, opt) {
      const na = index[a], nb = index[b];
      if (!na || !nb) return;
      const dist = Math.sqrt(Math.pow(na.x - nb.x, 2) + Math.pow(na.z - nb.z, 2));
      edges.push({
        from: a, to: b,
        channel: channel || 'corridor',
        dist: Math.round(dist * 100) / 100,
        direction: (opt && opt.direction) || 'bidirectional'
      });
    }

    const HX = [-28, -24, -20, -16, -12, -8, -4, 0, 4, 8, 12, 16, 20, 24, 28];
    HX.forEach(function (x) { N('H' + x, x, 0); });
    for (let i = 0; i < HX.length - 1; i++) E('H' + HX[i], 'H' + HX[i + 1], 'corridor');

    N('V6', 0, 6); N('V10', 0, 10); N('CORE_ESC', 0, 14, 'escalator'); N('V18', 0, 18);
    N('V-6', 0, -6); N('V-10', 0, -10); N('V-18', 0, -18);
    E('H0', 'V6', 'corridor'); E('V6', 'V10', 'corridor');
    E('V10', 'CORE_ESC', 'corridor'); E('CORE_ESC', 'V18', 'corridor');
    E('H0', 'V-6', 'corridor'); E('V-6', 'V-10', 'corridor'); E('V-10', 'V-18', 'corridor');

    floor.cores.forEach(function (c) { N(c.coreId, c.x, c.z, c.channel); });

    floor.rooms.forEach(function (r) {
      const doorZ = (r.z1 === -CFG.CORR) ? -CFG.CORR : CFG.CORR;
      const dId = 'D_' + r.id;
      N(dId, r.doorX, doorZ);

      let pId = null;
      HX.forEach(function (v) { if (Math.abs(v - r.doorX) < 0.6) pId = 'H' + v; });
      if (!pId) {
        pId = 'C_' + r.id;
        N(pId, r.doorX, 0);
        let left = HX[0], right = HX[HX.length - 1];
        HX.forEach(function (v) { if (v < r.doorX) left = v; });
        for (let i = HX.length - 1; i >= 0; i--) { if (HX[i] > r.doorX) right = HX[i]; }
        E(pId, 'H' + left, 'corridor');
        if (right !== left) E(pId, 'H' + right, 'corridor');
      }
      E(dId, pId, 'corridor');

      if (r.core) {
        E(dId, r.core, 'corridor');
      } else {
        const cId = 'R_' + r.id;
        N(cId, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
        E(dId, cId, 'corridor');
      }
    });

    if (floor.id === 'MZ1') E('H28', 'D_r105', 'emergency');

    NET_MAP[floor.id] = { nodes: nodes, edges: edges, index: index };
    return NET_MAP[floor.id];
  }

  BUILDINGS.forEach(function (b) { b.floors.forEach(buildNet); });

  /* 跨层边 */
  function verticalEdges(building) {
    const out = [];
    const channelOf = { CORE_LIFT: 'lift', CORE_LIFT_BF: 'barrierLift', CORE_ESC: 'escalator', CORE_STAIR: 'stairs' };
    const distOf = { lift: 9, barrierLift: 9, escalator: 12, stairs: 15 };
    for (let i = 0; i < building.floors.length - 1; i++) {
      const fa = building.floors[i], fb = building.floors[i + 1];
      Object.keys(channelOf).forEach(function (core) {
        const ch = channelOf[core];
        if (core === 'CORE_ESC' && (fb.level - fa.level) !== 1) return;
        out.push({
          from: core, to: core,
          fromFloor: fa.id, toFloor: fb.id,
          channel: ch, dist: distOf[ch], vertical: true, direction: 'bidirectional'
        });
      });
    }
    return out;
  }

  /* 连廊几何（院区坐标） */
  function bridgeGeom(bridge) {
    const fa = FLOOR_MAP[bridge.fromFloor], fb = FLOOR_MAP[bridge.toFloor];
    const na = NET_MAP[fa.id].index[bridge.fromNode];
    const nb = NET_MAP[fb.id].index[bridge.toNode];
    if (!na || !nb) return null;
    return {
      x1: na.x + fa.ox, z1: na.z + fa.oz,
      x2: nb.x + fb.ox, z2: nb.z + fb.oz,
      y: fa.y + 0.06,
      width: bridge.width,
      name: bridge.name,
      buildingA: fa.buildingName,
      buildingB: fb.buildingName,
      levelA: fa.short,
      levelB: fb.short
    };
  }

  /* ======================= 检索 ======================= */
  function normalize(s) { return (s || '').toLowerCase().replace(/\s+/g, ''); }

  function scoreOne(p, q, syn, kw, name) {
    let score = 0;
    if (name === q) score = 120;
    else if (name.indexOf(q) === 0) score = 100;
    else if (name.indexOf(q) > -1) score = 80;
    else if (normalize(syn + ',' + kw).indexOf(q) > -1) score = 60;
    else if (q.length >= 2 && q.split('').every(function (ch) { return (name + syn + kw).indexOf(ch) > -1; })) score = 30;
    return score;
  }

  function search(keyword, floorId) {
    const q = normalize(keyword);
    if (!q) return [];
    const pool = floorId ? (FLOOR_POIS[floorId] || []) : allPois();
    const res = [];
    pool.forEach(function (p) {
      const syn = (SYNONYM[p.type] || []).join(',');
      const kw = (p.kw || []).join(',');
      const s = scoreOne(p, q, syn, kw, normalize(p.name));
      if (s > 0) res.push({ poi: p, score: s });
    });
    res.sort(function (a, b) { return b.score - a.score; });
    return res.map(function (r) { return r.poi; });
  }

  function searchAll(keyword, nearFloorId) {
    const q = normalize(keyword);
    if (!q) return [];
    const res = [];
    allPois().forEach(function (p) {
      const syn = (SYNONYM[p.type] || []).join(',');
      const kw = (p.kw || []).join(',');
      let s = scoreOne(p, q, syn, kw, normalize(p.name));
      if (!s) return;
      if (nearFloorId && p.floorId === nearFloorId) s += 15;
      res.push({ poi: p, score: s });
    });
    res.sort(function (a, b) { return b.score - a.score; });
    return res.map(function (r) { return r.poi; });
  }

  function allPois() {
    let arr = [];
    Object.keys(FLOOR_POIS).forEach(function (k) { arr = arr.concat(FLOOR_POIS[k]); });
    return arr;
  }

  return {
    CFG: CFG, TYPE: TYPE, BUILDINGS: BUILDINGS, BRIDGES: BRIDGES,
    FLOOR_MAP: FLOOR_MAP, BUILDING_MAP: BUILDING_MAP, POI_MAP: POI_MAP,
    FLOOR_POIS: FLOOR_POIS, NET_MAP: NET_MAP,
    getFloor: function (id) { return FLOOR_MAP[id]; },
    getBuilding: function (id) { return BUILDING_MAP[id]; },
    getPoi: function (id) { return POI_MAP[id]; },
    getPois: function (floorId) { return FLOOR_POIS[floorId] || []; },
    getNet: function (floorId) { return NET_MAP[floorId]; },
    verticalEdges: verticalEdges,
    bridgeGeom: bridgeGeom,
    search: search,
    searchAll: searchAll,
    allPois: allPois,
    typeOf: function (t) { return TYPE[t] || TYPE.facility; }
  };
})();
