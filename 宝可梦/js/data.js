/* ============================================================
   宝可梦：森之秘语 — 游戏数据
   所有宝可梦、角色与地图均为原创同人设定
   ============================================================ */
window.PKM = window.PKM || {};

(function () {
  const PKM = window.PKM;

  /* ---------- 属性 ---------- */
  PKM.TYPES = {
    normal:   { name: '一般', color: '#b9b29b', dark: '#746e5d' },
    fire:     { name: '火',   color: '#e8794a', dark: '#9b3f2d' },
    water:    { name: '水',   color: '#5c9fd6', dark: '#2f648f' },
    grass:    { name: '草',   color: '#72b45c', dark: '#3f7135' },
    electric: { name: '电',   color: '#e8c34a', dark: '#9c761d' },
    bug:      { name: '虫',   color: '#a7b34e', dark: '#69732a' },
    flying:   { name: '飞行', color: '#9b8ed8', dark: '#5e5393' },
    rock:     { name: '岩石', color: '#b09962', dark: '#70603a' },
    ghost:    { name: '幽灵', color: '#7e6aa6', dark: '#4b3d69' },
    poison:   { name: '毒',   color: '#a968ad', dark: '#68386b' },
    fairy:    { name: '妖精', color: '#e59bb4', dark: '#a35572' },
    dark:     { name: '恶',   color: '#766c62', dark: '#453d36' }
  };

  PKM.TYPE_CHART = {
    normal:   { rock: 0.5, ghost: 0 },
    fire:     { grass: 2, bug: 2, fire: 0.5, water: 0.5, rock: 0.5 },
    water:    { fire: 2, rock: 2, water: 0.5, grass: 0.5 },
    grass:    { water: 2, rock: 2, fire: 0.5, grass: 0.5, bug: 0.5, flying: 0.5, poison: 0.5 },
    electric: { water: 2, flying: 2, grass: 0.5, electric: 0.5, rock: 0.5 },
    bug:      { grass: 2, dark: 2, fire: 0.5, flying: 0.5, rock: 0.5, ghost: 0.5, fairy: 0.5 },
    flying:   { grass: 2, bug: 2, electric: 0.5, rock: 0.5 },
    rock:     { fire: 2, flying: 2, bug: 2, water: 0.5, grass: 0.5 },
    ghost:    { ghost: 2, dark: 0.5, normal: 0 },
    poison:   { grass: 2, fairy: 2, rock: 0.5, ghost: 0.5, poison: 0.5 },
    fairy:    { dark: 2, fire: 0.5, poison: 0.5, rock: 0.5 },
    dark:     { ghost: 2, dark: 0.5, fairy: 0.5 }
  };

  /* ---------- 招式 ---------- */
  const M = (name, type, cat, power, acc, pp, extra) =>
    Object.assign({ name, type, cat, power, acc, pp, prio: 0, crit: 0 }, extra || {});

  PKM.MOVES = {
    tackle:      M('撞击', 'normal', 'physical', 40, 100, 35, { desc: '用整个身体撞向对手。' }),
    scratch:     M('抓', 'normal', 'physical', 40, 100, 35, { desc: '用锋利的爪子抓击对手。' }),
    growl:       M('叫声', 'normal', 'status', 0, 100, 40, { stat: { stat: 'atk', stages: -1, target: 'foe' }, desc: '可爱地叫一声，降低对手攻击。' }),
    tailwhip:    M('摇尾巴', 'normal', 'status', 0, 100, 30, { stat: { stat: 'def', stages: -1, target: 'foe' }, desc: '摇动尾巴让对手放松警惕。' }),
    quickattack: M('电光一闪', 'normal', 'physical', 40, 100, 30, { prio: 1, desc: '以极快的速度扑向对手，必定先制。' }),
    headbutt:    M('头锤', 'normal', 'physical', 70, 100, 15, { flinch: 20, desc: '用坚硬的脑袋撞过去，可能使对手畏缩。' }),
    bodyslam:    M('泰山压顶', 'normal', 'physical', 85, 100, 10, { status: { status: 'par', chance: 25, target: 'foe' }, desc: '用整个身体压住对手，可能麻痹。' }),
    takedown:    M('舍身冲撞', 'normal', 'physical', 90, 95, 10, { recoil: 0.25, desc: '拼命撞向对手，自己也会受伤。' }),
    swift:       M('高速星星', 'normal', 'special', 60, 0, 20, { desc: '发射星形光线，必定命中。' }),

    bite:        M('咬住', 'dark', 'physical', 60, 100, 20, { flinch: 25, desc: '用利牙咬住对手，可能使其畏缩。' }),
    suckerpunch: M('突袭', 'dark', 'physical', 70, 100, 5, { prio: 1, desc: '趁对手不备发动先制攻击。' }),
    snarl:       M('大声咆哮', 'dark', 'special', 55, 95, 15, { stat: { stat: 'spa', stages: -1, target: 'foe' }, desc: '大声咆哮，降低对手特攻。' }),

    lick:        M('舌舔', 'ghost', 'physical', 30, 100, 30, { status: { status: 'par', chance: 25, target: 'foe' }, desc: '用长舌头舔对手，可能使其麻痹。' }),
    confuseray:  M('奇异之光', 'ghost', 'status', 0, 100, 10, { confuse: { chance: 100, target: 'foe' }, desc: '发出诡异光芒，使对手混乱。' }),
    shadowball:  M('暗影球', 'ghost', 'special', 80, 100, 10, { stat: { stat: 'spd', stages: -1, target: 'foe', chance: 25 }, desc: '投出黑影般的能量球，可能降低特防。' }),
    nightshade:  M('黑夜魔影', 'ghost', 'special', 60, 100, 15, { desc: '制造出可怕的幻影攻击对手。' }),

    fairywind:   M('妖精之风', 'fairy', 'special', 40, 100, 30, { desc: '刮起带着妖精气息的微风。' }),
    charm:       M('撒娇', 'fairy', 'status', 0, 100, 20, { stat: { stat: 'atk', stages: -2, target: 'foe' }, desc: '可爱地撒娇，大幅降低对手攻击。' }),
    dazzlingleam:M('魔法闪耀', 'fairy', 'special', 80, 100, 10, { desc: '释放强烈的魔法光芒攻击对手。' }),
    moonblast:   M('月亮之力', 'fairy', 'special', 95, 100, 10, { stat: { stat: 'spa', stages: -1, target: 'foe', chance: 30 }, desc: '借用月亮的力量，可能降低对手特攻。' }),
    bellchime:   M('铃兰钟声', 'fairy', 'special', 70, 100, 15, { confuse: { chance: 10, target: 'foe' }, desc: '摇响看不见的铃兰，可能使对手混乱。' }),

    poisonpowder:M('毒粉', 'poison', 'status', 0, 75, 35, { status: { status: 'poison', chance: 100, target: 'foe' }, desc: '撒出毒粉，使对手中毒。' }),
    acid:        M('溶解液', 'poison', 'special', 40, 100, 30, { stat: { stat: 'spd', stages: -1, target: 'foe', chance: 20 }, desc: '喷出酸性液体，可能降低对手特防。' }),
    sludge:      M('污泥攻击', 'poison', 'special', 65, 100, 20, { status: { status: 'poison', chance: 30, target: 'foe' }, desc: '投掷污泥，可能使对手中毒。' }),

    bugbite:     M('虫咬', 'bug', 'physical', 60, 100, 20, { desc: '用利牙咬住对手撕扯。' }),
    stringshot:  M('吐丝', 'bug', 'status', 0, 95, 40, { stat: { stat: 'spe', stages: -2, target: 'foe' }, desc: '吐出丝线，大幅降低对手速度。' }),
    signalbeam:  M('信号光束', 'bug', 'special', 75, 100, 10, { confuse: { chance: 10, target: 'foe' }, desc: '发射神秘光束，可能使对手混乱。' }),
    webshot:     M('黏网', 'bug', 'physical', 65, 100, 15, { stat: { stat: 'spe', stages: -1, target: 'foe' }, desc: '喷出黏稠的网，降低对手速度。' }),

    peck:        M('啄', 'flying', 'physical', 35, 100, 35, { desc: '用尖嘴啄击对手。' }),
    gust:        M('起风', 'flying', 'special', 40, 100, 35, { desc: '刮起一阵风攻击对手。' }),
    wingattack:  M('翅膀攻击', 'flying', 'physical', 60, 100, 20, { desc: '展开翅膀用力拍打对手。' }),
    aerialace:   M('燕返', 'flying', 'physical', 60, 0, 20, { desc: '以敏捷的身手斩击，必定命中。' }),

    rockthrow:   M('落石', 'rock', 'physical', 50, 90, 15, { desc: '向对手投掷小石块。' }),
    rocktomb:    M('岩石封锁', 'rock', 'physical', 60, 95, 15, { stat: { stat: 'spe', stages: -1, target: 'foe' }, desc: '投下岩石，降低对手速度。' }),
    harden:      M('变硬', 'rock', 'status', 0, 0, 30, { stat: { stat: 'def', stages: 1, target: 'self' }, desc: '使身体变硬，提高自己的防御。' }),

    ember:       M('火花', 'fire', 'special', 40, 100, 25, { status: { status: 'burn', chance: 10, target: 'foe' }, desc: '发射小火焰，可能使对手灼伤。' }),
    flamewheel:  M('火焰轮', 'fire', 'physical', 60, 100, 20, { status: { status: 'burn', chance: 10, target: 'foe' }, desc: '裹着火焰撞向对手，可能灼伤。' }),
    willowisp:   M('鬼火', 'fire', 'status', 0, 85, 15, { status: { status: 'burn', chance: 100, target: 'foe' }, desc: '释放幽蓝色火焰，使对手灼伤。' }),
    flamethrower:M('喷射火焰', 'fire', 'special', 90, 100, 10, { status: { status: 'burn', chance: 10, target: 'foe' }, desc: '喷射灼热火焰，可能使对手灼伤。' }),

    vinewhip:    M('藤鞭', 'grass', 'physical', 45, 100, 25, { desc: '用细长的藤蔓抽打对手。' }),
    razorleaf:   M('飞叶快刀', 'grass', 'physical', 55, 95, 25, { crit: 1, desc: '射出锋利的叶片，容易击中要害。' }),
    leechseed:   M('寄生种子', 'grass', 'status', 0, 90, 10, { seed: { chance: 100, target: 'foe' }, desc: '种下种子，每回合吸取对手体力。' }),
    synthesis:   M('光合作用', 'grass', 'status', 0, 0, 5, { heal: 0.5, desc: '沐浴阳光，回复最大体力的一半。' }),
    magicalleaf: M('魔法叶', 'grass', 'special', 60, 0, 20, { desc: '发出追踪对手的魔法叶片，必定命中。' }),
    petalstorm:  M('花瓣舞', 'grass', 'special', 90, 100, 10, { desc: '卷起漫天花瓣，猛烈攻击对手。' }),
    absorb:      M('吸取', 'grass', 'special', 40, 100, 25, { drain: 0.5, desc: '吸取对手体力，回复造成伤害的一半。' }),
    pinecone:    M('松果弹', 'grass', 'physical', 55, 95, 20, { flinch: 20, desc: '弹出坚硬的松果，可能使对手畏缩。' }),
    sleepspowder:M('催眠粉', 'grass', 'status', 0, 75, 15, { status: { status: 'sleep', chance: 100, target: 'foe' }, desc: '撒出催眠粉末，使对手陷入睡眠。' }),
    stunspore:   M('麻痹粉', 'grass', 'status', 0, 75, 30, { status: { status: 'par', chance: 100, target: 'foe' }, desc: '撒出麻痹粉末，使对手麻痹。' }),

    watergun:    M('水枪', 'water', 'special', 40, 100, 25, { desc: '向对手喷射强力水柱。' }),
    bubble:      M('泡沫', 'water', 'special', 40, 100, 30, { stat: { stat: 'spe', stages: -1, target: 'foe', chance: 10 }, desc: '喷出泡沫，可能降低对手速度。' }),
    aquajet:     M('水流喷射', 'water', 'physical', 40, 100, 20, { prio: 1, desc: '以极快速度冲撞，必定先制。' }),
    waterpulse:  M('水之波动', 'water', 'special', 60, 100, 20, { confuse: { chance: 20, target: 'foe' }, desc: '用水之波动攻击，可能使对手混乱。' }),

    thundershock:M('电击', 'electric', 'special', 40, 100, 30, { status: { status: 'par', chance: 10, target: 'foe' }, desc: '发出电流攻击，可能使对手麻痹。' }),
    spark:       M('电光', 'electric', 'physical', 60, 100, 20, { status: { status: 'par', chance: 30, target: 'foe' }, desc: '裹着电流撞向对手，可能麻痹。' }),
    zapfin:      M('电鳍', 'electric', 'special', 70, 100, 15, { status: { status: 'par', chance: 20, target: 'foe' }, desc: '用带电的鳍释放电流，可能使对手麻痹。' }),
    thunderwave: M('电磁波', 'electric', 'status', 0, 90, 20, { status: { status: 'par', chance: 100, target: 'foe' }, desc: '发出微弱电流，使对手麻痹。' }),
    charge:      M('充电', 'electric', 'status', 0, 0, 20, { stat: { stat: 'spa', stages: 1, target: 'self' }, desc: '积蓄电力，提高自己的特攻。' })
  };

  /* ---------- 宝可梦 ---------- */
  const L = (lv, id) => [lv, id];
  PKM.SPECIES = {
    sproutle: {
      no: 1, name: '芽芽鹿', types: ['grass'], shape: 'deer', rate: 45, exp: 62,
      base: { hp: 55, atk: 45, def: 50, spa: 65, spd: 60, spe: 45 },
      evolve: { level: 16, to: 'verdantle' },
      learnset: [L(1, 'tackle'), L(1, 'growl'), L(4, 'vinewhip'), L(7, 'leechseed'), L(10, 'razorleaf'), L(13, 'synthesis'), L(16, 'magicalleaf')],
      palette: { o: '#203826', d: '#3e6b42', m: '#79b65b', l: '#bde59a', a: '#f0d58a', e: '#f7f3df', p: '#1b2a20' },
      desc: '额头上一片嫩叶会随着心情轻轻摇动。喜欢在清晨的露水里打滚。',
      habitat: '青苔镇周边'
    },
    verdantle: {
      no: 2, name: '森角鹿', types: ['grass', 'fairy'], shape: 'deer', rate: 45, exp: 145,
      base: { hp: 75, atk: 62, def: 70, spa: 90, spd: 80, spe: 60 },
      learnset: [L(1, 'tackle'), L(1, 'growl'), L(4, 'vinewhip'), L(7, 'leechseed'), L(10, 'razorleaf'), L(13, 'synthesis'), L(16, 'magicalleaf'), L(19, 'dazzlingleam'), L(23, 'moonblast')],
      palette: { o: '#1f3527', d: '#3f7052', m: '#62ae77', l: '#b8ecca', a: '#ffdf8a', e: '#fff7dd', p: '#18291e' },
      desc: '枝角上会开出细小的白花。据说它走过的地方，第二年春天格外葱郁。',
      habitat: '萤火森林深处'
    },
    emberfox: {
      no: 3, name: '火尾狐', types: ['fire'], shape: 'fox', rate: 45, exp: 62,
      base: { hp: 50, atk: 58, def: 45, spa: 60, spd: 50, spe: 60 },
      evolve: { level: 16, to: 'blazequeen' },
      learnset: [L(1, 'scratch'), L(1, 'tailwhip'), L(4, 'ember'), L(7, 'quickattack'), L(10, 'willowisp'), L(13, 'flamewheel'), L(16, 'bite')],
      palette: { o: '#361f22', d: '#963e2d', m: '#e87046', l: '#ffb56b', a: '#ffe6a7', e: '#fff8e6', p: '#3a1d1b' },
      desc: '尾巴尖上永远跳着一簇小火苗。睡着时火苗会变成暖烘烘的橙色。',
      habitat: '微风小径的暖石旁'
    },
    blazequeen: {
      no: 4, name: '烬尾狐', types: ['fire'], shape: 'fox', rate: 45, exp: 145,
      base: { hp: 70, atk: 80, def: 65, spa: 85, spd: 70, spe: 85 },
      learnset: [L(1, 'scratch'), L(1, 'tailwhip'), L(4, 'ember'), L(7, 'quickattack'), L(10, 'willowisp'), L(13, 'flamewheel'), L(16, 'bite'), L(19, 'flamethrower'), L(22, 'suckerpunch')],
      palette: { o: '#33191d', d: '#9e372b', m: '#d9563f', l: '#ffab58', a: '#ffdf7a', e: '#fff4d6', p: '#2b1114' },
      desc: '九条尾焰在夜里像流动的绸缎。它会用火尾为迷路的人照亮山路。',
      habitat: '萤火森林的暖岩'
    },
    bubblotter: {
      no: 5, name: '水泡獭', types: ['water'], shape: 'otter', rate: 45, exp: 62,
      base: { hp: 55, atk: 55, def: 50, spa: 55, spd: 55, spe: 50 },
      evolve: { level: 16, to: 'riverotter' },
      learnset: [L(1, 'tackle'), L(1, 'tailwhip'), L(4, 'watergun'), L(7, 'bubble'), L(10, 'aquajet'), L(13, 'bite'), L(16, 'waterpulse')],
      palette: { o: '#1f303c', d: '#2f6980', m: '#63b4c9', l: '#b7e8ef', a: '#f4d8a1', e: '#f9f6e7', p: '#1a2831' },
      desc: '会把水含在嘴里吹成泡泡。泡泡破裂的声音是它表达开心的方式。',
      habitat: '溪桥镇的浅滩'
    },
    riverotter: {
      no: 6, name: '溪澜獭', types: ['water'], shape: 'otter', rate: 45, exp: 145,
      base: { hp: 78, atk: 78, def: 72, spa: 75, spd: 75, spe: 65 },
      learnset: [L(1, 'tackle'), L(1, 'tailwhip'), L(4, 'watergun'), L(7, 'bubble'), L(10, 'aquajet'), L(13, 'bite'), L(16, 'waterpulse'), L(19, 'headbutt'), L(22, 'takedown')],
      palette: { o: '#1b2c38', d: '#2c5e7e', m: '#4f9cc5', l: '#a8ddf0', a: '#f7e0a8', e: '#f7f3df', p: '#14232c' },
      desc: '能在湍流里稳稳站住。它梳理毛发时会哼出像溪水一样的调子。',
      habitat: '溪桥镇下游'
    },
    mossball: {
      no: 7, name: '苔团团', types: ['grass'], shape: 'mossball', rate: 190, exp: 48,
      base: { hp: 55, atk: 45, def: 60, spa: 45, spd: 50, spe: 25 },
      evolve: { level: 14, to: 'mosslord' },
      learnset: [L(1, 'tackle'), L(1, 'harden'), L(4, 'absorb'), L(7, 'stringshot'), L(10, 'rockthrow'), L(13, 'leechseed')],
      palette: { o: '#2b3924', d: '#4b6b36', m: '#7da055', l: '#b7d183', a: '#d7b377', e: '#f3f0d8', p: '#25301f' },
      desc: '常年蹲在树根旁，背上的苔藓越厚代表它越年长。下雨时会轻轻打呼噜。',
      habitat: '微风小径的树荫'
    },
    mosslord: {
      no: 8, name: '苔岩巨', types: ['grass', 'rock'], shape: 'mossball', rate: 75, exp: 128,
      base: { hp: 80, atk: 70, def: 90, spa: 60, spd: 70, spe: 30 },
      learnset: [L(1, 'tackle'), L(1, 'harden'), L(4, 'absorb'), L(7, 'stringshot'), L(10, 'rockthrow'), L(13, 'leechseed'), L(16, 'headbutt'), L(19, 'rocktomb')],
      palette: { o: '#2b3327', d: '#55604a', m: '#84956b', l: '#c1c9a0', a: '#b59a6b', e: '#f4eccf', p: '#252b22' },
      desc: '身上的岩石与苔藓共生了几百年。它移动得很慢，但从不迷路。',
      habitat: '萤火森林的古道'
    },
    lumibug: {
      no: 9, name: '流萤', types: ['bug', 'electric'], shape: 'bug', rate: 170, exp: 54,
      base: { hp: 45, atk: 35, def: 40, spa: 55, spd: 50, spe: 65 },
      evolve: { level: 12, to: 'lanternmoth' },
      learnset: [L(1, 'tackle'), L(1, 'stringshot'), L(4, 'thundershock'), L(8, 'bugbite'), L(11, 'thunderwave')],
      palette: { o: '#2a3122', d: '#7c6f32', m: '#e0b64c', l: '#ffe89a', a: '#68d8c4', e: '#fffbe0', p: '#283020' },
      desc: '尾部的光点会随着同伴的节奏闪烁。夏夜里，它们像会呼吸的星星。',
      habitat: '萤火森林'
    },
    lanternmoth: {
      no: 10, name: '灯蛾', types: ['bug', 'electric'], shape: 'moth', rate: 85, exp: 132,
      base: { hp: 60, atk: 45, def: 55, spa: 80, spd: 70, spe: 90 },
      learnset: [L(1, 'tackle'), L(1, 'stringshot'), L(4, 'thundershock'), L(8, 'bugbite'), L(11, 'thunderwave'), L(14, 'signalbeam'), L(17, 'spark')],
      palette: { o: '#2b2a25', d: '#8d713a', m: '#d8a24a', l: '#ffe8a4', a: '#7ae3cf', e: '#fff8d8', p: '#27251c' },
      desc: '翅膀上的鳞粉会在夜里发出柔和的光。它喜欢绕着古树的树冠飞。',
      habitat: '萤火森林树冠'
    },
    peckling: {
      no: 11, name: '咕咕雀', types: ['normal', 'flying'], shape: 'bird', rate: 190, exp: 50,
      base: { hp: 40, atk: 45, def: 35, spa: 30, spd: 35, spe: 65 },
      evolve: { level: 13, to: 'skyquill' },
      learnset: [L(1, 'peck'), L(1, 'growl'), L(4, 'gust'), L(8, 'quickattack'), L(11, 'wingattack')],
      palette: { o: '#332a23', d: '#7f6045', m: '#b58b62', l: '#e8cfaa', a: '#e8895c', e: '#fff5df', p: '#2b211a' },
      desc: '总在路边蹦蹦跳跳，好奇心旺盛。被人盯着看时会假装在整理羽毛。',
      habitat: '微风小径'
    },
    skyquill: {
      no: 12, name: '风翎雀', types: ['normal', 'flying'], shape: 'bird', rate: 90, exp: 126,
      base: { hp: 58, atk: 65, def: 50, spa: 45, spd: 50, spe: 85 },
      learnset: [L(1, 'peck'), L(1, 'growl'), L(4, 'gust'), L(8, 'quickattack'), L(11, 'wingattack'), L(14, 'aerialace'), L(17, 'swift')],
      palette: { o: '#2b2b34', d: '#5f6f8c', m: '#8fa7c8', l: '#d9e6f4', a: '#e8895c', e: '#fff7e3', p: '#20222b' },
      desc: '尾羽像一束被风梳开的蓝线。它会顺着上升气流盘旋一整个下午。',
      habitat: '溪桥镇上空'
    },
    pebblar: {
      no: 13, name: '岩壳虫', types: ['rock', 'bug'], shape: 'beetle', rate: 180, exp: 56,
      base: { hp: 50, atk: 55, def: 70, spa: 30, spd: 40, spe: 25 },
      evolve: { level: 14, to: 'boulderon' },
      learnset: [L(1, 'tackle'), L(1, 'harden'), L(4, 'rockthrow'), L(8, 'bugbite'), L(11, 'rocktomb')],
      palette: { o: '#302b24', d: '#68533b', m: '#a6794d', l: '#d9c39a', a: '#7b7d73', e: '#f4edd7', p: '#29231c' },
      desc: '壳上嵌着细碎的石粒。遇到危险时会把身体缩成一枚圆滚滚的石球。',
      habitat: '微风小径的碎石地'
    },
    boulderon: {
      no: 14, name: '磐甲虫', types: ['rock', 'bug'], shape: 'beetle', rate: 80, exp: 136,
      base: { hp: 70, atk: 80, def: 100, spa: 45, spd: 55, spe: 35 },
      learnset: [L(1, 'tackle'), L(1, 'harden'), L(4, 'rockthrow'), L(8, 'bugbite'), L(11, 'rocktomb'), L(15, 'headbutt'), L(18, 'bodyslam')],
      palette: { o: '#2b2925', d: '#5a5b51', m: '#8c8d7c', l: '#c6c3a1', a: '#a6794d', e: '#f7f0d9', p: '#25241f' },
      desc: '背甲硬得可以当磨刀石。它用角顶开挡路的石块，为森林里的小动物开路。',
      habitat: '萤火森林岩壁'
    },
    carplet: {
      no: 15, name: '溪鲤', types: ['water'], shape: 'fish', rate: 190, exp: 48,
      base: { hp: 45, atk: 40, def: 40, spa: 45, spd: 40, spe: 60 },
      evolve: { level: 15, to: 'streamkoi' },
      learnset: [L(1, 'tackle'), L(1, 'tailwhip'), L(4, 'bubble'), L(8, 'watergun'), L(11, 'aquajet')],
      palette: { o: '#3a241e', d: '#a8552f', m: '#e18c52', l: '#ffd09a', a: '#f6f2d6', e: '#fff9e8', p: '#37211b' },
      desc: '在溪石间灵活穿梭的小鱼。喜欢逆着水流游，仿佛在和自己比赛。',
      habitat: '所有清澈水域'
    },
    streamkoi: {
      no: 16, name: '锦溪鲤', types: ['water'], shape: 'fish', rate: 75, exp: 130,
      base: { hp: 70, atk: 65, def: 65, spa: 70, spd: 60, spe: 75 },
      learnset: [L(1, 'tackle'), L(1, 'tailwhip'), L(4, 'bubble'), L(8, 'watergun'), L(11, 'aquajet'), L(14, 'waterpulse'), L(17, 'headbutt')],
      palette: { o: '#37211c', d: '#b6472e', m: '#e36b4a', l: '#ffe1b0', a: '#f7d76b', e: '#fff9e5', p: '#2e1b18' },
      desc: '鳞片在阳光下像撒了金粉。传说跃过溪桥的锦溪鲤会带来一整年的好运。',
      habitat: '溪桥镇深潭'
    },
    shadewing: {
      no: 17, name: '影蝠', types: ['dark', 'flying'], shape: 'bat', rate: 155, exp: 58,
      base: { hp: 45, atk: 50, def: 35, spa: 45, spd: 40, spe: 70 },
      evolve: { level: 16, to: 'nightfang' },
      learnset: [L(1, 'lick'), L(1, 'growl'), L(4, 'gust'), L(8, 'bite'), L(11, 'confuseray'), L(14, 'wingattack')],
      palette: { o: '#241f2c', d: '#4a3d61', m: '#6b5d84', l: '#a99bc2', a: '#d96c8a', e: '#ffe9d8', p: '#251d2c' },
      desc: '倒挂在古树洞里睡觉。它并不坏，只是喜欢躲在阴影里观察路过的旅人。',
      habitat: '萤火森林的树洞'
    },
    nightfang: {
      no: 18, name: '夜牙蝠', types: ['dark', 'flying'], shape: 'bat', rate: 80, exp: 138,
      base: { hp: 65, atk: 75, def: 55, spa: 65, spd: 55, spe: 95 },
      learnset: [L(1, 'lick'), L(1, 'growl'), L(4, 'gust'), L(8, 'bite'), L(11, 'confuseray'), L(14, 'wingattack'), L(17, 'suckerpunch'), L(20, 'shadowball')],
      palette: { o: '#1f1d27', d: '#3f3659', m: '#4e426b', l: '#8f7bb5', a: '#e07d99', e: '#ffe9d8', p: '#211a2a' },
      desc: '翅膀边缘有一圈淡淡的月光。它在夜里飞行时不发出一点声音。',
      habitat: '萤火森林最深处'
    },
    mushpo: {
      no: 19, name: '蘑噗', types: ['grass', 'poison'], shape: 'mushroom', rate: 175, exp: 56,
      base: { hp: 55, atk: 40, def: 50, spa: 65, spd: 60, spe: 30 },
      evolve: { level: 15, to: 'sporecap' },
      learnset: [L(1, 'absorb'), L(1, 'growl'), L(4, 'poisonpowder'), L(7, 'acid'), L(10, 'sleepspowder'), L(13, 'headbutt')],
      palette: { o: '#3a2628', d: '#a85a55', m: '#d97c72', l: '#f2b6a1', a: '#f6e7c9', e: '#fff6e8', p: '#32201f' },
      desc: '伞盖下藏着会发光的孢子。打喷嚏的时候，周围的草会长得特别快。',
      habitat: '萤火森林湿润处'
    },
    sporecap: {
      no: 20, name: '孢伞王', types: ['grass', 'poison'], shape: 'mushroom', rate: 75, exp: 134,
      base: { hp: 75, atk: 55, def: 70, spa: 90, spd: 85, spe: 40 },
      learnset: [L(1, 'absorb'), L(1, 'growl'), L(4, 'poisonpowder'), L(7, 'acid'), L(10, 'sleepspowder'), L(13, 'headbutt'), L(16, 'sludge'), L(19, 'moonblast')],
      palette: { o: '#35252a', d: '#8c4a63', m: '#b85f79', l: '#e7a1b1', a: '#f8e8c6', e: '#fff4e4', p: '#2d1e22' },
      desc: '巨大的伞盖上布满会呼吸的纹路。它走一步，森林里就多一簇小蘑菇。',
      habitat: '萤火森林蘑菇圈'
    },
    sparkmouse: {
      no: 21, name: '电光鼠', types: ['electric'], shape: 'mouse', rate: 165, exp: 54,
      base: { hp: 40, atk: 45, def: 35, spa: 50, spd: 40, spe: 75 },
      learnset: [L(1, 'thundershock'), L(1, 'tailwhip'), L(4, 'quickattack'), L(7, 'charge'), L(10, 'spark'), L(13, 'thunderwave'), L(16, 'swift')],
      palette: { o: '#3a2a1e', d: '#b08a2f', m: '#e8c84f', l: '#fff0a1', a: '#de7c4b', e: '#fffbe8', p: '#30251a' },
      desc: '脸颊上的小电囊会在开心时噼啪作响。它跑过草地时会留下一串小小的火星。',
      habitat: '微风小径的电石堆'
    },
    emberpup: {
      no: 22, name: '焰仔', types: ['fire'], shape: 'pup', rate: 160, exp: 52,
      base: { hp: 45, atk: 55, def: 40, spa: 50, spd: 40, spe: 65 },
      learnset: [L(1, 'ember'), L(1, 'growl'), L(4, 'quickattack'), L(7, 'willowisp'), L(10, 'bite'), L(13, 'flamewheel')],
      palette: { o: '#35221e', d: '#a85a31', m: '#e8924f', l: '#ffc988', a: '#fff0b8', e: '#fff8e6', p: '#301d18' },
      desc: '尾巴像一小团炭火。它总想帮忙生火，却常常把烤栗子烤成黑炭。',
      habitat: '微风小径的暖石'
    },
    wisp: {
      no: 23, name: '蔓灵', types: ['fairy', 'grass'], shape: 'wisp', rate: 60, exp: 92,
      base: { hp: 50, atk: 35, def: 45, spa: 70, spd: 65, spe: 55 },
      learnset: [L(1, 'absorb'), L(1, 'charm'), L(4, 'fairywind'), L(8, 'leechseed'), L(12, 'magicalleaf'), L(16, 'dazzlingleam')],
      palette: { o: '#294234', d: '#4f8a64', m: '#8fd0a8', l: '#d7f7dd', a: '#f5e6a4', e: '#fffbe8', p: '#263b2e' },
      desc: '由古老的树灵凝结而成。它会在月夜把萤火聚成一条发光的小径。',
      habitat: '萤火森林月夜'
    },
    gloam: {
      no: 24, name: '幽苔兽', types: ['ghost', 'grass'], shape: 'ghost', rate: 5, exp: 180,
      base: { hp: 95, atk: 70, def: 80, spa: 100, spd: 90, spe: 60 },
      learnset: [L(1, 'shadowball'), L(1, 'magicalleaf'), L(1, 'sleepspowder'), L(1, 'synthesis'), L(1, 'nightshade')],
      palette: { o: '#1d2f27', d: '#355448', m: '#4f7361', l: '#88a886', a: '#7de0c1', e: '#e9ffd9', p: '#163a2d' },
      desc: '被阴影侵蚀的古老苔灵。它并非邪恶，只是被夺走了守护了千年的光。',
      habitat: '森林祭坛'
    },
    guardian: {
      no: 25, name: '森之守望者', types: ['grass', 'fairy'], shape: 'guardian', rate: 12, exp: 260,
      base: { hp: 110, atk: 85, def: 95, spa: 115, spd: 110, spe: 80 },
      learnset: [L(1, 'moonblast'), L(1, 'petalstorm'), L(1, 'dazzlingleam'), L(1, 'synthesis'), L(1, 'magicalleaf')],
      palette: { o: '#33442e', d: '#7d9657', m: '#d8e8b0', l: '#f4f9d9', a: '#f3c96b', e: '#fffbe8', p: '#3c4a2e', halo: '#fff6c9' },
      desc: '只在森林的光完全恢复后现身。它额前的光冠里，盛着整座森林的黎明。',
      habitat: '森林祭坛（传说）'
    },
    mistfox: {
      no: 26, name: '雾隐狐', types: ['ghost', 'fairy'], shape: 'fox', rate: 120, exp: 78,
      base: { hp: 55, atk: 45, def: 45, spa: 72, spd: 62, spe: 76 },
      evolve: { level: 20, to: 'mistqueen' },
      learnset: [L(1, 'lick'), L(1, 'growl'), L(4, 'fairywind'), L(8, 'confuseray'), L(12, 'shadowball'), L(15, 'suckerpunch'), L(18, 'moonblast')],
      palette: { o: '#211c30', d: '#4d3b66', m: '#8c74b8', l: '#d3c3e6', a: '#f2b8d1', e: '#fff8e8', p: '#241c30' },
      desc: '雾松山道深处的狐狸。它走过的地方会留下一小段淡紫色的雾，雾里偶尔有星星。',
      habitat: '雾松山道'
    },
    mistqueen: {
      no: 27, name: '幻月狐', types: ['ghost', 'fairy'], shape: 'fox', rate: 55, exp: 160,
      base: { hp: 75, atk: 58, def: 65, spa: 102, spd: 86, spe: 102 },
      learnset: [L(1, 'shadowball'), L(1, 'moonblast'), L(1, 'charm'), L(1, 'suckerpunch'), L(1, 'confuseray')],
      palette: { o: '#1c182a', d: '#3e2f5b', m: '#7357a0', l: '#c6b0e6', a: '#ffd7e8', e: '#fff8e8', p: '#1c182a' },
      desc: '尾巴拖着一小片月晕。它只在雾最浓的时候出现，安静地看着山下的灯火。',
      habitat: '雾松山道（月夜）'
    },
    pinelet: {
      no: 28, name: '松果团', types: ['grass', 'rock'], shape: 'mossball', rate: 165, exp: 74,
      base: { hp: 65, atk: 55, def: 72, spa: 38, spd: 52, spe: 24 },
      evolve: { level: 18, to: 'pineguard' },
      learnset: [L(1, 'tackle'), L(1, 'harden'), L(4, 'absorb'), L(7, 'rockthrow'), L(8, 'pinecone'), L(12, 'leechseed'), L(15, 'headbutt')],
      palette: { o: '#2b2c22', d: '#4e5833', m: '#7f9550', l: '#bfcf87', a: '#b98e58', e: '#f7f3dd', p: '#25271f' },
      desc: '会把自己滚成一颗松果的形状。冬天来临前，它会在山道边堆起一座小小的松果塔。',
      habitat: '雾松山道'
    },
    pineguard: {
      no: 29, name: '松岩卫', types: ['grass', 'rock'], shape: 'mossball', rate: 70, exp: 155,
      base: { hp: 92, atk: 82, def: 108, spa: 50, spd: 72, spe: 28 },
      learnset: [L(1, 'pinecone'), L(1, 'rocktomb'), L(1, 'bodyslam'), L(1, 'synthesis'), L(1, 'petalstorm')],
      palette: { o: '#2b2d25', d: '#525b43', m: '#88966b', l: '#c7cfa4', a: '#bda274', e: '#f8f2dc', p: '#26281f' },
      desc: '背上的松针和岩石一起长了上百年。它站在山道拐角，为每一个上山的人挡住风。',
      habitat: '雾松山道高处'
    },
    lanternfish: {
      no: 30, name: '灯鳍鱼', types: ['water', 'electric'], shape: 'fish', rate: 140, exp: 82,
      base: { hp: 60, atk: 45, def: 55, spa: 72, spd: 62, spe: 58 },
      learnset: [L(1, 'thundershock'), L(1, 'watergun'), L(4, 'bubble'), L(10, 'zapfin'), L(14, 'waterpulse'), L(17, 'thunderwave')],
      palette: { o: '#1f303e', d: '#245c78', m: '#3f95b0', l: '#9be2e3', a: '#ffe378', e: '#fffbe8', p: '#192833' },
      desc: '鳍上挂着一盏小小的灯。它在溪谷的夜里成群游动，像一条会呼吸的银河。',
      habitat: '萤光溪谷的水域'
    },
    cavespider: {
      no: 31, name: '穴织蛛', types: ['bug', 'rock'], shape: 'bug', rate: 150, exp: 78,
      base: { hp: 50, atk: 62, def: 72, spa: 35, spd: 45, spe: 46 },
      evolve: { level: 19, to: 'webweaver' },
      learnset: [L(1, 'bugbite'), L(1, 'harden'), L(4, 'rockthrow'), L(7, 'stringshot'), L(10, 'webshot'), L(14, 'rocktomb')],
      palette: { o: '#2b2826', d: '#5d5350', m: '#8c8078', l: '#c2b6a8', a: '#9d6f8a', e: '#f9f0dc', p: '#282321' },
      desc: '在洞窟顶部织出像星图一样的网。它并不凶，只是很在意自己的网有没有被碰歪。',
      habitat: '古树洞窟'
    },
    webweaver: {
      no: 32, name: '织岩蛛', types: ['bug', 'rock'], shape: 'bug', rate: 65, exp: 160,
      base: { hp: 70, atk: 88, def: 102, spa: 50, spd: 62, spe: 58 },
      learnset: [L(1, 'webshot'), L(1, 'rocktomb'), L(1, 'signalbeam'), L(1, 'suckerpunch'), L(1, 'harden')],
      palette: { o: '#28232a', d: '#51455a', m: '#7a6688', l: '#b8a8c4', a: '#d59ab3', e: '#fbf0e2', p: '#241f26' },
      desc: '把细小的萤石织进网里，让洞窟在夜里也有星光。它守着最深处的树根。',
      habitat: '古树洞窟深处'
    },
    bellspirit: {
      no: 33, name: '铃兰灵', types: ['fairy', 'grass'], shape: 'wisp', rate: 85, exp: 96,
      base: { hp: 55, atk: 35, def: 50, spa: 82, spd: 72, spe: 62 },
      learnset: [L(1, 'absorb'), L(1, 'fairywind'), L(1, 'charm'), L(8, 'magicalleaf'), L(12, 'bellchime'), L(15, 'synthesis'), L(18, 'dazzlingleam')],
      palette: { o: '#30402f', d: '#6a8b5c', m: '#b7d6a4', l: '#eff8dc', a: '#f4b8cf', e: '#fffbe8', p: '#2a3b2d' },
      desc: '溪谷里看不见的小铃铛。风一吹，它的花瓣就会发出很轻很轻的响声。',
      habitat: '萤光溪谷'
    }
  };

  /* ---------- 道具 ---------- */
  PKM.ITEMS = {
    pokeball:   { name: '精灵球', price: 200, sell: 100, cat: 'ball', ball: 1, icon: 'ball', desc: '用来捕捉野生宝可梦的普通球。' },
    greatball:  { name: '超级球', price: 600, sell: 300, cat: 'ball', ball: 1.5, icon: 'greatball', desc: '比精灵球更容易捕捉的球。' },
    ultraball:  { name: '高级球', price: 1200, sell: 600, cat: 'ball', ball: 2.2, icon: 'ultraball', desc: '性能极佳的高级球。' },
    potion:     { name: '伤药', price: 300, sell: 150, cat: 'medicine', heal: 25, icon: 'potion', desc: '回复一只宝可梦 25 点体力。' },
    superpotion:{ name: '好伤药', price: 700, sell: 350, cat: 'medicine', heal: 60, icon: 'superpotion', desc: '回复一只宝可梦 60 点体力。' },
    hyperpotion:{ name: '全复药', price: 1500, sell: 750, cat: 'medicine', heal: 999, cure: true, icon: 'hyperpotion', desc: '完全回复体力，并治愈异常状态。' },
    antidote:   { name: '万灵药', price: 500, sell: 250, cat: 'medicine', cure: true, icon: 'antidote', desc: '治愈灼伤、中毒、麻痹或睡眠。' },
    revive:     { name: '活力块', price: 1800, sell: 900, cat: 'medicine', revive: 0.5, icon: 'revive', desc: '让昏厥的宝可梦恢复一半体力。' },
    berry:      { name: '橙橙果', price: 120, sell: 60, cat: 'berry', heal: 15, icon: 'berry', desc: '甜甜的树果，回复 15 点体力。乐师正在收集它。' },
    lureberry:  { name: '光莓', price: 300, sell: 150, cat: 'berry', pp: 10, icon: 'lureberry', desc: '带着微光的莓果，回复一个招式 10 点 PP。' },
    hairpin:    { name: '苔花发夹', price: 0, sell: 0, cat: 'key', icon: 'hairpin', desc: '小满遗失的苔花发夹，在溪边草丛里闪着微光。' },
    windbell:   { name: '松风铃', price: 0, sell: 0, cat: 'key', icon: 'windbell', desc: '山顶捡到的旧铜铃。风一吹，声音像从很远的地方传来。' },
    pearl:      { name: '溪珍珠', price: 0, sell: 500, cat: 'treasure', icon: 'pearl', desc: '圆润的溪珍珠。可以卖个好价钱。' },
    rod:        { name: '旧钓竿', price: 0, sell: 0, cat: 'key', icon: 'rod', desc: '面向水面按 Z，就能钓起水中的宝可梦。' },
    dex:        { name: '森林图鉴', price: 0, sell: 0, cat: 'key', icon: 'dex', desc: '苔爷爷送的图鉴，会自动记录遇见与捕获的宝可梦。' },
    badge:      { name: '森语徽章', price: 0, sell: 0, cat: 'key', icon: 'badge', desc: '溪桥道馆的证明。萤火森林的守卫会认可它。' }
  };

  /* ---------- 快速移动点 ---------- */
  PKM.WAYPOINTS = [
    { id: 'town_inn', name: '青苔驿站', map: 'town', x: 21, y: 17, spawnX: 21, spawnY: 18, dir: 'up', desc: '驿站门口的老石灯，灯芯里藏着一小片会呼吸的苔光。' },
    { id: 'route_rest', name: '林间凉亭', map: 'route', x: 30, y: 20, spawnX: 30, spawnY: 21, dir: 'up', desc: '凉亭旁的路标。风从叶缝里穿过时，石头会发出很轻的鸣响。' },
    { id: 'brook_bridge', name: '溪桥桥头', map: 'brook', x: 18, y: 13, spawnX: 18, spawnY: 14, dir: 'up', desc: '桥头的系船石。桥下的锦溪鲤会跟着光游过来。' },
    { id: 'forest_gate', name: '萤火森林入口', map: 'forest', x: 17, y: 24, spawnX: 17, spawnY: 25, dir: 'up', desc: '森林入口的指路石。靠近它的时候，会听见远处有谁在哼歌。' },
    { id: 'glen_bridge', name: '溪谷木桥', map: 'glen', x: 15, y: 14, spawnX: 15, spawnY: 15, dir: 'up', desc: '横跨溪谷的木桥。桥板被水汽浸得发亮，踩上去会发出好听的吱呀声。' },
    { id: 'mist_view', name: '松风观景台', map: 'mist', x: 20, y: 4, spawnX: 20, spawnY: 5, dir: 'up', desc: '山道最高处的观景石。云会从脚边慢慢走过，松涛像远处的海。' },
    { id: 'hollow_mouth', name: '古树洞口', map: 'hollow', x: 21, y: 10, spawnX: 20, spawnY: 10, dir: 'left', desc: '古树洞口的指路石。石头里封着一小簇不会熄灭的萤光。' }
  ];

  /* ---------- 商店 ---------- */
  PKM.SHOPS = {
    town: { name: '青苔杂货铺', stock: ['pokeball', 'potion', 'antidote', 'berry'] },
    brook: { name: '溪桥补给站', stock: ['pokeball', 'greatball', 'superpotion', 'antidote', 'revive', 'berry', 'lureberry'] },
    brook_late: { name: '溪桥补给站', stock: ['greatball', 'ultraball', 'superpotion', 'hyperpotion', 'antidote', 'revive', 'berry', 'lureberry'] }
  };

  /* ---------- 地图工具 ---------- */
  function makeMap(def) {
    const grid = Array.from({ length: def.h }, () => Array(def.w).fill(def.base || '.'));
    (def.paints || []).forEach(p => {
      if (p.op === 'rect') {
        for (let y = p.y; y < p.y + p.h; y++) {
          for (let x = p.x; x < p.x + p.w; x++) {
            if (x >= 0 && y >= 0 && x < def.w && y < def.h) grid[y][x] = p.t;
          }
        }
      } else if (p.op === 'ellipse') {
        for (let y = 0; y < def.h; y++) {
          for (let x = 0; x < def.w; x++) {
            const dx = (x - p.x) / p.rx, dy = (y - p.y) / p.ry;
            if (dx * dx + dy * dy <= 1) grid[y][x] = p.t;
          }
        }
      } else if (p.op === 'scatter') {
        const list = p.cells || [];
        list.forEach(([x, y]) => { if (x >= 0 && y >= 0 && x < def.w && y < def.h) grid[y][x] = p.t; });
      }
    });
    return Object.assign({}, def, { tiles: grid.map(row => row.join('')) });
  }

  PKM.TILE_SOLID = { '#': true, 'T': true, '~': true, 'r': true, 'W': true, 'm': false, '.': false, ',': false, 'p': false, 'f': false, '=': false, 's': false, 'o': false, 'g': false, 'x': false, '*': false, 'd': false };

  /* ---------- 地图 ---------- */
  PKM.MAPS = {
    town: makeMap({
      id: 'town', name: '青苔镇', subtitle: '风会记住每一枚脚印',
      w: 32, h: 24, base: '.', music: 'town', mood: 'town',
      paints: [
        { op: 'rect', x: 0, y: 0, w: 32, h: 1, t: '#' },
        { op: 'rect', x: 0, y: 23, w: 32, h: 1, t: '#' },
        { op: 'rect', x: 0, y: 0, w: 1, h: 24, t: '#' },
        { op: 'rect', x: 31, y: 0, w: 1, h: 24, t: '#' },
        { op: 'rect', x: 15, y: 0, w: 2, h: 2, t: 'p' },
        { op: 'rect', x: 15, y: 2, w: 2, h: 9, t: 'p' },
        { op: 'rect', x: 6, y: 7, w: 22, h: 3, t: 'p' },
        { op: 'rect', x: 7, y: 5, w: 1, h: 2, t: 'p' },
        { op: 'rect', x: 16, y: 5, w: 1, h: 2, t: 'p' },
        { op: 'rect', x: 25, y: 5, w: 1, h: 2, t: 'p' },
        { op: 'rect', x: 24, y: 10, w: 1, h: 6, t: 'p' },
        { op: 'rect', x: 12, y: 10, w: 8, h: 5, t: 'p' },
        { op: 'ellipse', x: 6, y: 18, rx: 5, ry: 4, t: '~' },
        { op: 'rect', x: 2, y: 10, w: 4, h: 4, t: 'f' },
        { op: 'rect', x: 20, y: 19, w: 5, h: 2, t: 'f' },
        { op: 'rect', x: 9, y: 12, w: 3, h: 2, t: 'f' },
        { op: 'rect', x: 28, y: 10, w: 2, h: 5, t: 'f' },
        { op: 'rect', x: 2, y: 3, w: 1, h: 4, t: '#' },
        { op: 'rect', x: 27, y: 2, w: 3, h: 1, t: '#' },
        { op: 'rect', x: 12, y: 15, w: 1, h: 5, t: '#' },
        { op: 'rect', x: 13, y: 20, w: 3, h: 1, t: '#' },
        { op: 'rect', x: 28, y: 19, w: 2, h: 3, t: '#' },
        { op: 'scatter', t: 'r', cells: [[10, 18], [11, 19], [27, 14], [3, 9], [29, 16]] }
      ],
      buildings: [
        { id: 'lab', type: 'lab', x: 4, y: 2, w: 7, h: 4, door: { x: 7, y: 5 }, label: '苔语研究所' },
        { id: 'home', type: 'home', x: 14, y: 2, w: 6, h: 4, door: { x: 16, y: 5 }, label: '我的家' },
        { id: 'shop', type: 'shop', x: 23, y: 2, w: 6, h: 4, door: { x: 25, y: 5 }, label: '青苔杂货铺' },
        { id: 'heal', type: 'heal', x: 21, y: 12, w: 7, h: 4, door: { x: 24, y: 15 }, label: '青苔驿站' },
        { id: 'cottage', type: 'home', x: 3, y: 12, w: 5, h: 4, door: { x: 5, y: 15 }, label: '老屋' }
      ],
      props: [
        { type: 'sign', x: 11, y: 8, text: ['青苔镇', '北边是微风小径。', '请把垃圾带回家，森林会记得。'] },
        { type: 'sign', x: 22, y: 11, text: ['青苔驿站', '为旅人与宝可梦提供免费休息。'] },
        { type: 'sign', x: 10, y: 6, text: ['苔语研究所', '研究森林里的光与宝可梦。'] },
        { type: 'waypoint', id: 'town_inn', x: 21, y: 17 }
      ],
      portals: [
        { x: 15, y: 0, w: 2, h: 1, to: 'route', tx: 16, ty: 23, dir: 'up', label: '微风小径' }
      ],
      items: [
        { id: 'town_potion', x: 27, y: 21, item: 'potion', qty: 1 },
        { id: 'town_berry', x: 10, y: 15, item: 'berry', qty: 2 }
      ],
      ambient: 'petal'
    }),

    route: makeMap({
      id: 'route', name: '微风小径', subtitle: '草叶间藏着细小的风',
      w: 36, h: 26, base: '.', music: 'route', mood: 'route',
      paints: [
        { op: 'rect', x: 0, y: 0, w: 36, h: 1, t: '#' },
        { op: 'rect', x: 0, y: 25, w: 36, h: 1, t: '#' },
        { op: 'rect', x: 0, y: 0, w: 1, h: 26, t: '#' },
        { op: 'rect', x: 35, y: 0, w: 1, h: 26, t: '#' },
        { op: 'rect', x: 16, y: 24, w: 2, h: 2, t: 'p' },
        { op: 'rect', x: 16, y: 18, w: 2, h: 7, t: 'p' },
        { op: 'rect', x: 14, y: 14, w: 7, h: 5, t: 'p' },
        { op: 'rect', x: 20, y: 13, w: 5, h: 2, t: 'p' },
        { op: 'rect', x: 24, y: 10, w: 5, h: 4, t: 'p' },
        { op: 'rect', x: 28, y: 11, w: 7, h: 2, t: 'p' },
        { op: 'rect', x: 35, y: 11, w: 1, h: 2, t: 'p' },
        { op: 'rect', x: 17, y: 3, w: 2, h: 12, t: 'p' },
        { op: 'rect', x: 17, y: 0, w: 2, h: 3, t: 'p' },
        { op: 'ellipse', x: 6, y: 18, rx: 5, ry: 4, t: '~' },
        { op: 'rect', x: 5, y: 8, w: 8, h: 5, t: ',' },
        { op: 'rect', x: 22, y: 17, w: 8, h: 5, t: ',' },
        { op: 'rect', x: 8, y: 19, w: 5, h: 4, t: ',' },
        { op: 'rect', x: 29, y: 4, w: 5, h: 4, t: ',' },
        { op: 'rect', x: 3, y: 11, w: 5, h: 1, t: ',' },
        { op: 'rect', x: 25, y: 21, w: 6, h: 2, t: 'f' },
        { op: 'rect', x: 11, y: 5, w: 5, h: 2, t: 'f' },
        { op: 'rect', x: 2, y: 3, w: 2, h: 5, t: '#' },
        { op: 'rect', x: 26, y: 2, w: 6, h: 1, t: '#' },
        { op: 'rect', x: 12, y: 10, w: 2, h: 4, t: '#' },
        { op: 'rect', x: 29, y: 14, w: 2, h: 2, t: '#' },
        { op: 'rect', x: 3, y: 23, w: 5, h: 1, t: '#' },
        { op: 'rect', x: 28, y: 24, w: 4, h: 1, t: '#' },
        { op: 'scatter', t: 'r', cells: [[5, 14], [10, 22], [21, 9], [24, 6], [31, 19], [33, 15], [14, 22], [7, 6]] }
      ],
      buildings: [
        { id: 'route_gate', type: 'gate', x: 15, y: 1, w: 5, h: 3, door: { x: 17, y: 3 }, label: '萤火森林入口' },
        { id: 'rest_roof', type: 'shelter', x: 29, y: 17, w: 4, h: 3, door: { x: 30, y: 19 }, label: '林间凉亭' }
      ],
      props: [
        { type: 'sign', x: 15, y: 22, text: ['微风小径', '南：青苔镇　北：萤火森林', '草丛里似乎有什么在动。'] },
        { type: 'sign', x: 33, y: 10, text: ['东：溪桥镇', '桥下的水声很好听。'] },
        { type: 'waypoint', id: 'route_rest', x: 30, y: 20 }
      ],
      portals: [
        { x: 16, y: 25, w: 2, h: 1, to: 'town', tx: 16, ty: 6, dir: 'down', label: '青苔镇' },
        { x: 35, y: 11, w: 1, h: 2, to: 'brook', tx: 2, ty: 10, dir: 'right', label: '溪桥镇' },
        { x: 17, y: 0, w: 2, h: 1, to: 'forest', tx: 15, ty: 25, dir: 'up', label: '萤火森林', requires: 'badge', blocked: '入口被一层苔光结界挡住了。\n「持有溪桥道馆的森语徽章者，方可入内。」' }
      ],
      items: [
        { id: 'route_potion', x: 6, y: 6, item: 'potion', qty: 1 },
        { id: 'route_ball', x: 31, y: 16, item: 'pokeball', qty: 3 },
        { id: 'route_hairpin', x: 9, y: 20, item: 'hairpin', qty: 1, sparkle: true },
        { id: 'route_berry', x: 12, y: 23, item: 'berry', qty: 2 }
      ],
      triggers: [
        { id: 'rival_scene', x: 14, y: 19, w: 7, h: 4, once: 'rivalSceneDone' }
      ],
      encounters: [
        { species: 'peckling', min: 3, max: 6, weight: 28 },
        { species: 'mossball', min: 3, max: 6, weight: 25 },
        { species: 'sparkmouse', min: 4, max: 7, weight: 16 },
        { species: 'emberpup', min: 4, max: 6, weight: 12 },
        { species: 'pebblar', min: 4, max: 7, weight: 14 },
        { species: 'wisp', min: 5, max: 7, weight: 3 },
        { species: 'bubblotter', min: 4, max: 6, weight: 2 }
      ],
      fishing: [
        { species: 'carplet', min: 3, max: 8, weight: 82 },
        { species: 'streamkoi', min: 7, max: 10, weight: 15 },
        { species: 'wisp', min: 6, max: 8, weight: 3 }
      ],
      ambient: 'wind'
    }),

    brook: makeMap({
      id: 'brook', name: '溪桥镇', subtitle: '水声把日子洗得发亮',
      w: 30, h: 22, base: '.', music: 'brook', mood: 'town',
      paints: [
        { op: 'rect', x: 0, y: 0, w: 30, h: 1, t: '#' },
        { op: 'rect', x: 0, y: 21, w: 30, h: 1, t: '#' },
        { op: 'rect', x: 0, y: 0, w: 1, h: 22, t: '#' },
        { op: 'rect', x: 29, y: 0, w: 1, h: 22, t: '#' },
        { op: 'rect', x: 0, y: 10, w: 1, h: 2, t: 'p' },
        { op: 'rect', x: 13, y: 2, w: 4, h: 18, t: '~' },
        { op: 'rect', x: 12, y: 10, w: 6, h: 2, t: '=' },
        { op: 'rect', x: 1, y: 10, w: 12, h: 2, t: 'p' },
        { op: 'rect', x: 17, y: 10, w: 9, h: 3, t: 'p' },
        { op: 'rect', x: 22, y: 8, w: 2, h: 5, t: 'p' },
        { op: 'rect', x: 21, y: 14, w: 2, h: 2, t: 'p' },
        { op: 'rect', x: 6, y: 6, w: 1, h: 4, t: 'p' },
        { op: 'rect', x: 6, y: 17, w: 2, h: 1, t: 'p' },
        { op: 'rect', x: 8, y: 17, w: 2, h: 5, t: 'p' },
        { op: 'rect', x: 26, y: 18, w: 4, h: 2, t: 'p' },
        { op: 'ellipse', x: 4, y: 17, rx: 2, ry: 1, t: 'f' },
        { op: 'rect', x: 18, y: 3, w: 3, h: 3, t: 'f' },
        { op: 'rect', x: 24, y: 17, w: 3, h: 2, t: 'f' },
        { op: 'rect', x: 2, y: 4, w: 2, h: 3, t: '#' },
        { op: 'rect', x: 18, y: 18, w: 1, h: 2, t: '#' },
        { op: 'rect', x: 26, y: 5, w: 2, h: 2, t: '#' },
        { op: 'scatter', t: 'r', cells: [[12, 4], [17, 5], [12, 17], [20, 19], [27, 9], [3, 8]] }
      ],
      buildings: [
        { id: 'gym', type: 'gym', x: 21, y: 3, w: 6, h: 5, door: { x: 23, y: 7 }, label: '森语道馆' },
        { id: 'brook_shop', type: 'shop', x: 19, y: 12, w: 6, h: 3, door: { x: 22, y: 14 }, label: '溪桥补给站' },
        { id: 'brook_house1', type: 'home', x: 3, y: 3, w: 6, h: 4, door: { x: 6, y: 6 }, label: '临水人家' },
        { id: 'brook_house2', type: 'home', x: 4, y: 13, w: 6, h: 4, door: { x: 7, y: 16 }, label: '溪边小屋' }
      ],
      props: [
        { type: 'sign', x: 10, y: 9, text: ['溪桥镇', '东：森语道馆', '西：微风小径'] },
        { type: 'sign', x: 18, y: 8, text: ['森语道馆', '馆主苔音：草与妖精的行家。'] },
        { type: 'sign', x: 9, y: 16, text: ['溪桥', '据说桥下住着会唱歌的锦溪鲤。'] },
        { type: 'waypoint', id: 'brook_bridge', x: 18, y: 13 }
      ],
      portals: [
        { x: 0, y: 10, w: 1, h: 2, to: 'route', tx: 33, ty: 12, dir: 'left', label: '微风小径' },
        { x: 8, y: 21, w: 2, h: 1, to: 'glen', tx: 13, ty: 1, dir: 'down', label: '萤光溪谷' },
        { x: 29, y: 18, w: 1, h: 2, to: 'mist', tx: 2, ty: 22, dir: 'up', label: '雾松山道' }
      ],
      items: [
        { id: 'brook_pearl', x: 18, y: 20, item: 'pearl', qty: 1 },
        { id: 'brook_potion', x: 27, y: 3, item: 'superpotion', qty: 1 }
      ],
      encounters: null,
      ambient: 'water'
    }),

    glen: makeMap({
      id: 'glen', name: '萤光溪谷', subtitle: '水把萤火带向远方',
      w: 28, h: 22, base: '.', music: 'brook', mood: 'forest',
      paints: [
        { op: 'rect', x: 0, y: 0, w: 28, h: 1, t: '#' },
        { op: 'rect', x: 0, y: 21, w: 28, h: 1, t: '#' },
        { op: 'rect', x: 0, y: 0, w: 1, h: 22, t: '#' },
        { op: 'rect', x: 27, y: 0, w: 1, h: 22, t: '#' },
        { op: 'rect', x: 21, y: 2, w: 3, h: 10, t: '~' },
        { op: 'ellipse', x: 21, y: 16, rx: 5, ry: 4, t: '~' },
        { op: 'rect', x: 13, y: 0, w: 2, h: 7, t: 'p' },
        { op: 'rect', x: 7, y: 6, w: 7, h: 2, t: 'p' },
        { op: 'rect', x: 7, y: 7, w: 2, h: 8, t: 'p' },
        { op: 'rect', x: 7, y: 14, w: 14, h: 2, t: 'p' },
        { op: 'rect', x: 9, y: 15, w: 2, h: 6, t: 'p' },
        { op: 'rect', x: 20, y: 14, w: 5, h: 2, t: '=' },
        { op: 'rect', x: 24, y: 15, w: 3, h: 2, t: 'p' },
        { op: 'rect', x: 3, y: 9, w: 4, h: 5, t: ',' },
        { op: 'rect', x: 9, y: 17, w: 4, h: 4, t: ',' },
        { op: 'rect', x: 17, y: 5, w: 3, h: 4, t: ',' },
        { op: 'rect', x: 25, y: 5, w: 2, h: 4, t: ',' },
        { op: 'rect', x: 2, y: 3, w: 2, h: 4, t: '#' },
        { op: 'rect', x: 25, y: 3, w: 2, h: 2, t: '#' },
        { op: 'rect', x: 17, y: 18, w: 3, h: 2, t: '#' },
        { op: 'rect', x: 3, y: 16, w: 3, h: 3, t: '#' },
        { op: 'scatter', t: 'T', cells: [[5, 2], [10, 3], [16, 2], [24, 10], [25, 19], [2, 19]] },
        { op: 'scatter', t: 'f', cells: [[6, 15], [12, 16], [18, 15], [23, 17], [14, 8], [5, 14], [19, 20]] },
        { op: 'scatter', t: 'm', cells: [[4, 12], [22, 20], [16, 6], [25, 12]] },
        { op: 'scatter', t: 'r', cells: [[11, 19], [26, 17], [5, 6], [19, 11]] }
      ],
      buildings: [],
      props: [
        { type: 'sign', x: 12, y: 7, text: ['萤光溪谷', '沿着水声走，能找到会发光的鱼。'] },
        { type: 'sign', x: 24, y: 14, text: ['溪谷木桥', '桥下的锦溪鲤会跟着萤火游动。'] },
        { type: 'waypoint', id: 'glen_bridge', x: 15, y: 14 }
      ],
      portals: [
        { x: 13, y: 0, w: 2, h: 1, to: 'brook', tx: 8, ty: 20, dir: 'down', label: '溪桥镇' }
      ],
      items: [
        { id: 'glen_great', x: 5, y: 8, item: 'greatball', qty: 2 },
        { id: 'glen_potion', x: 18, y: 20, item: 'superpotion', qty: 1 },
        { id: 'glen_pearl', x: 26, y: 8, item: 'pearl', qty: 1 }
      ],
      encounters: [
        { species: 'carplet', min: 9, max: 12, weight: 18 },
        { species: 'streamkoi', min: 11, max: 14, weight: 8 },
        { species: 'lumibug', min: 10, max: 13, weight: 18 },
        { species: 'lanternmoth', min: 12, max: 15, weight: 8 },
        { species: 'bellspirit', min: 11, max: 14, weight: 12 },
        { species: 'lanternfish', min: 11, max: 15, weight: 14 },
        { species: 'wisp', min: 11, max: 14, weight: 6 },
        { species: 'mistfox', min: 11, max: 14, weight: 6 }
      ],
      fishing: [
        { species: 'carplet', min: 9, max: 13, weight: 55 },
        { species: 'streamkoi', min: 12, max: 15, weight: 25 },
        { species: 'lanternfish', min: 11, max: 15, weight: 20 }
      ],
      ambient: 'water'
    }),

    mist: makeMap({
      id: 'mist', name: '雾松山道', subtitle: '云从脚下慢慢走过',
      w: 26, h: 24, base: '.', music: 'route', mood: 'route',
      paints: [
        { op: 'rect', x: 0, y: 0, w: 26, h: 1, t: '#' },
        { op: 'rect', x: 0, y: 23, w: 26, h: 1, t: '#' },
        { op: 'rect', x: 0, y: 0, w: 1, h: 24, t: '#' },
        { op: 'rect', x: 25, y: 0, w: 1, h: 24, t: '#' },
        { op: 'rect', x: 18, y: 1, w: 6, h: 5, t: 's' },
        { op: 'rect', x: 2, y: 18, w: 2, h: 6, t: 'p' },
        { op: 'rect', x: 2, y: 17, w: 7, h: 1, t: 'p' },
        { op: 'rect', x: 8, y: 11, w: 2, h: 7, t: 'p' },
        { op: 'rect', x: 8, y: 10, w: 7, h: 1, t: 'p' },
        { op: 'rect', x: 14, y: 5, w: 2, h: 6, t: 'p' },
        { op: 'rect', x: 14, y: 4, w: 8, h: 1, t: 'p' },
        { op: 'rect', x: 20, y: 2, w: 2, h: 3, t: 'p' },
        { op: 'rect', x: 4, y: 12, w: 3, h: 4, t: ',' },
        { op: 'rect', x: 10, y: 6, w: 3, h: 4, t: ',' },
        { op: 'rect', x: 17, y: 8, w: 4, h: 4, t: ',' },
        { op: 'rect', x: 22, y: 13, w: 2, h: 5, t: ',' },
        { op: 'scatter', t: 'T', cells: [[3, 2], [6, 3], [11, 2], [19, 10], [23, 7], [2, 9], [24, 20], [5, 21], [16, 15]] },
        { op: 'scatter', t: 'r', cells: [[4, 5], [7, 8], [12, 12], [18, 6], [22, 17], [15, 20], [10, 18]] },
        { op: 'scatter', t: 'f', cells: [[6, 14], [13, 8], [21, 11], [3, 16], [17, 4]] }
      ],
      buildings: [],
      props: [
        { type: 'sign', x: 3, y: 17, text: ['雾松山道', '山顶的云会记住每一个抬头的人。'] },
        { type: 'waypoint', id: 'mist_view', x: 20, y: 4 },
        { type: 'sign', x: 19, y: 4, text: ['松风观景台', '天气好的时候，能看见整片萤火森林。'] }
      ],
      portals: [
        { x: 2, y: 23, w: 2, h: 1, to: 'brook', tx: 27, ty: 18, dir: 'right', label: '溪桥镇' }
      ],
      items: [
        { id: 'mist_ultra', x: 22, y: 2, item: 'ultraball', qty: 1 },
        { id: 'mist_super', x: 5, y: 20, item: 'superpotion', qty: 1 },
        { id: 'mist_revive', x: 15, y: 3, item: 'revive', qty: 1 },
        { id: 'mist_windbell', x: 23, y: 2, item: 'windbell', qty: 1 }
      ],
      encounters: [
        { species: 'pebblar', min: 11, max: 14, weight: 18 },
        { species: 'boulderon', min: 13, max: 15, weight: 7 },
        { species: 'peckling', min: 10, max: 13, weight: 16 },
        { species: 'skyquill', min: 12, max: 15, weight: 8 },
        { species: 'sparkmouse', min: 11, max: 14, weight: 14 },
        { species: 'mistfox', min: 12, max: 15, weight: 12 },
        { species: 'pinelet', min: 11, max: 15, weight: 15 },
        { species: 'pineguard', min: 14, max: 16, weight: 5 },
        { species: 'wisp', min: 11, max: 14, weight: 5 }
      ],
      fishing: [],
      ambient: 'wind'
    }),

    hollow: makeMap({
      id: 'hollow', name: '古树洞窟', subtitle: '树根记得比人更久',
      w: 24, h: 20, base: 'x', music: 'forest', mood: 'forest',
      paints: [
        { op: 'rect', x: 0, y: 0, w: 24, h: 1, t: 'W' },
        { op: 'rect', x: 0, y: 19, w: 24, h: 1, t: 'W' },
        { op: 'rect', x: 0, y: 0, w: 1, h: 20, t: 'W' },
        { op: 'rect', x: 23, y: 0, w: 1, h: 20, t: 'W' },
        { op: 'rect', x: 18, y: 9, w: 6, h: 2, t: 's' },
        { op: 'rect', x: 5, y: 9, w: 14, h: 2, t: 's' },
        { op: 'rect', x: 8, y: 3, w: 2, h: 7, t: 's' },
        { op: 'rect', x: 8, y: 10, w: 2, h: 6, t: 's' },
        { op: 'rect', x: 6, y: 14, w: 7, h: 2, t: 's' },
        { op: 'rect', x: 17, y: 6, w: 2, h: 4, t: 's' },
        { op: 'rect', x: 17, y: 4, w: 5, h: 2, t: 's' },
        { op: 'rect', x: 14, y: 13, w: 5, h: 4, t: '~' },
        { op: 'rect', x: 14, y: 12, w: 5, h: 1, t: '=' },
        { op: 'scatter', t: 'g', cells: [[6, 5], [11, 4], [13, 7], [18, 8], [5, 16], [18, 14], [21, 5]] },
        { op: 'scatter', t: 'm', cells: [[4, 5], [12, 11], [20, 16], [6, 17], [15, 5]] },
        { op: 'scatter', t: 'r', cells: [[3, 3], [14, 6], [21, 12], [11, 17], [3, 12], [16, 17]] },
        { op: 'scatter', t: 'g', cells: [[9, 2], [19, 2], [22, 10], [4, 10], [13, 18]] }
      ],
      buildings: [],
      props: [
        { type: 'sign', x: 21, y: 12, text: ['古树洞窟', '不要拿走会呼吸的石头。'] },
        { type: 'waypoint', id: 'hollow_mouth', x: 21, y: 10 }
      ],
      portals: [
        { x: 23, y: 9, w: 1, h: 2, to: 'forest', tx: 2, ty: 16, dir: 'right', label: '萤火森林' }
      ],
      items: [
        { id: 'hollow_great', x: 19, y: 5, item: 'greatball', qty: 2 },
        { id: 'hollow_revive', x: 4, y: 17, item: 'revive', qty: 1 },
        { id: 'hollow_lure', x: 12, y: 3, item: 'lureberry', qty: 2 }
      ],
      encounters: [
        { species: 'cavespider', min: 12, max: 16, weight: 26 },
        { species: 'webweaver', min: 15, max: 17, weight: 7 },
        { species: 'pebblar', min: 11, max: 14, weight: 15 },
        { species: 'boulderon', min: 14, max: 16, weight: 7 },
        { species: 'shadewing', min: 12, max: 15, weight: 18 },
        { species: 'nightfang', min: 14, max: 17, weight: 8 },
        { species: 'mushpo', min: 11, max: 14, weight: 10 },
        { species: 'wisp', min: 12, max: 15, weight: 5 }
      ],
      fishing: [
        { species: 'carplet', min: 11, max: 14, weight: 80 },
        { species: 'lanternfish', min: 12, max: 16, weight: 20 }
      ],
      ambient: 'firefly'
    }),

    forest: makeMap({
      id: 'forest', name: '萤火森林', subtitle: '光在树根之间慢慢呼吸',
      w: 32, h: 28, base: '.', music: 'forest', mood: 'forest',
      paints: [
        { op: 'rect', x: 0, y: 0, w: 32, h: 1, t: '#' },
        { op: 'rect', x: 0, y: 27, w: 32, h: 1, t: '#' },
        { op: 'rect', x: 0, y: 0, w: 1, h: 28, t: '#' },
        { op: 'rect', x: 31, y: 0, w: 1, h: 28, t: '#' },
        { op: 'rect', x: 15, y: 27, w: 2, h: 1, t: 'p' },
        { op: 'rect', x: 0, y: 16, w: 6, h: 2, t: 'p' },
        { op: 'rect', x: 15, y: 23, w: 2, h: 5, t: 'p' },
        { op: 'rect', x: 12, y: 21, w: 6, h: 3, t: 'p' },
        { op: 'rect', x: 5, y: 20, w: 8, h: 2, t: 'p' },
        { op: 'rect', x: 5, y: 11, w: 2, h: 10, t: 'p' },
        { op: 'rect', x: 5, y: 10, w: 10, h: 2, t: 'p' },
        { op: 'rect', x: 14, y: 5, w: 2, h: 6, t: 'p' },
        { op: 'rect', x: 12, y: 4, w: 8, h: 2, t: 'p' },
        { op: 'rect', x: 13, y: 2, w: 6, h: 2, t: '*' },
        { op: 'rect', x: 7, y: 14, w: 6, h: 4, t: ',' },
        { op: 'rect', x: 18, y: 14, w: 8, h: 5, t: ',' },
        { op: 'rect', x: 20, y: 6, w: 7, h: 5, t: ',' },
        { op: 'rect', x: 2, y: 4, w: 6, h: 4, t: ',' },
        { op: 'rect', x: 24, y: 22, w: 5, h: 3, t: ',' },
        { op: 'ellipse', x: 22, y: 24, rx: 4, ry: 2, t: '~' },
        { op: 'rect', x: 2, y: 8, w: 2, h: 7, t: 'T' },
        { op: 'rect', x: 22, y: 2, w: 4, h: 3, t: 'T' },
        { op: 'rect', x: 27, y: 13, w: 2, h: 8, t: 'T' },
        { op: 'rect', x: 9, y: 17, w: 1, h: 2, t: 'T' },
        { op: 'rect', x: 11, y: 7, w: 2, h: 2, t: 'T' },
        { op: 'rect', x: 18, y: 19, w: 2, h: 2, t: 'T' },
        { op: 'rect', x: 24, y: 12, w: 2, h: 1, t: 'T' },
        { op: 'scatter', t: 'm', cells: [[8, 8], [9, 9], [21, 10], [4, 13], [25, 18], [14, 18], [19, 8], [29, 24], [3, 22]] },
        { op: 'scatter', t: 'g', cells: [[14, 5], [15, 5], [13, 4], [18, 4], [6, 20], [17, 22], [12, 14], [26, 8]] },
        { op: 'scatter', t: 'r', cells: [[13, 19], [19, 12], [23, 9], [8, 4], [28, 5], [4, 24], [26, 18]] },
        { op: 'scatter', t: 'f', cells: [[12, 22], [13, 22], [7, 19], [19, 22], [17, 16], [22, 20], [3, 11], [25, 4]] },
        { op: 'scatter', t: '#', cells: [[1, 1], [2, 1], [3, 1], [21, 1], [22, 1], [23, 1], [29, 1], [30, 1], [1, 6], [2, 6], [1, 13], [2, 13], [3, 13], [1, 18], [2, 18], [3, 18], [4, 18], [8, 12], [9, 12], [10, 12], [11, 12], [17, 7], [18, 7], [17, 8], [18, 8], [21, 11], [22, 11], [23, 11], [27, 14], [28, 14], [29, 6], [30, 6], [29, 7], [30, 7], [8, 23], [9, 23], [10, 23], [11, 23], [19, 26], [20, 26], [21, 26], [22, 26], [27, 22], [28, 22], [29, 22], [26, 17], [25, 17], [24, 17]] },
        { op: 'scatter', t: 'T', cells: [[26, 2], [30, 13], [1, 10], [28, 5], [10, 2], [2, 24], [20, 20], [3, 20]] }
      ],
      buildings: [
        { id: 'shrine', type: 'shrine', x: 13, y: 2, w: 6, h: 3, door: { x: 16, y: 4 }, label: '森林祭坛' }
      ],
      props: [
        { type: 'sign', x: 14, y: 24, text: ['萤火森林', '请轻声前行。', '光苔正在沉睡。'] },
        { type: 'sign', x: 9, y: 10, text: ['古老的路标', '「当三盏苔灯亮起，森林会记起自己的名字。」'] },
        { type: 'waypoint', id: 'forest_gate', x: 17, y: 24 }
      ],
      portals: [
        { x: 15, y: 27, w: 2, h: 1, to: 'route', tx: 17, ty: 3, dir: 'down', label: '微风小径' },
        { x: 0, y: 16, w: 1, h: 2, to: 'hollow', tx: 21, ty: 10, dir: 'left', label: '古树洞窟' }
      ],
      items: [
        { id: 'forest_great', x: 20, y: 4, item: 'greatball', qty: 2 },
        { id: 'forest_super', x: 3, y: 7, item: 'superpotion', qty: 1 },
        { id: 'forest_revive', x: 29, y: 12, item: 'revive', qty: 1 },
        { id: 'forest_lure', x: 26, y: 25, item: 'lureberry', qty: 2 }
      ],
      encounters: [
        { species: 'lumibug', min: 5, max: 8, weight: 24 },
        { species: 'mushpo', min: 5, max: 8, weight: 22 },
        { species: 'shadewing', min: 6, max: 9, weight: 18 },
        { species: 'mossball', min: 5, max: 7, weight: 12 },
        { species: 'pebblar', min: 6, max: 9, weight: 12 },
        { species: 'lanternmoth', min: 8, max: 10, weight: 6 },
        { species: 'wisp', min: 8, max: 10, weight: 6 },
        { species: 'sproutle', min: 7, max: 9, weight: 2 },
        { species: 'emberfox', min: 7, max: 9, weight: 2 },
        { species: 'bubblotter', min: 7, max: 9, weight: 2 }
      ],
      fishing: [
        { species: 'carplet', min: 5, max: 9, weight: 75 },
        { species: 'streamkoi', min: 8, max: 11, weight: 20 },
        { species: 'wisp', min: 7, max: 9, weight: 5 }
      ],
      ambient: 'firefly'
    }),

    gym: makeMap({
      id: 'gym', name: '森语道馆', subtitle: '三盏苔灯，一束心光',
      w: 18, h: 16, base: 's', music: 'gym', mood: 'gym',
      paints: [
        { op: 'rect', x: 0, y: 0, w: 18, h: 1, t: 'W' },
        { op: 'rect', x: 0, y: 15, w: 18, h: 1, t: 'W' },
        { op: 'rect', x: 0, y: 0, w: 1, h: 16, t: 'W' },
        { op: 'rect', x: 17, y: 0, w: 1, h: 16, t: 'W' },
        { op: 'rect', x: 8, y: 15, w: 2, h: 1, t: 'o' },
        { op: 'rect', x: 8, y: 13, w: 2, h: 2, t: 'o' },
        { op: 'rect', x: 2, y: 2, w: 14, h: 1, t: 'g' },
        { op: 'rect', x: 4, y: 10, w: 10, h: 1, t: 'g' },
        { op: 'scatter', t: 'm', cells: [[2, 4], [15, 4], [2, 12], [15, 12]] }
      ],
      buildings: [],
      props: [
        { type: 'gate', id: 'gym_gate', x: 1, y: 6, w: 16, h: 1, label: '苔光结界' },
        { type: 'rune', id: 'rune1', x: 3, y: 9 },
        { type: 'rune', id: 'rune2', x: 8, y: 9 },
        { type: 'rune', id: 'rune3', x: 13, y: 9 }
      ],
      portals: [
        { x: 8, y: 15, w: 2, h: 1, to: 'brook', tx: 23, ty: 9, dir: 'down', label: '溪桥镇' }
      ],
      items: []
    })
  };

  /* ---------- 训练家 ---------- */
  PKM.TRAINERS = {
    rival1: {
      name: '小岚', klass: '劲敌', sprite: 'rival', palette: 'rival',
      team: [{ species: 'counter', level: 5 }, { species: 'peckling', level: 4 }],
      reward: 320, flag: 'rival1Defeated',
      intro: ['小岚：慢死了，小森！', '我在这儿等了半天，就是想看看苔爷爷给了你什么宝贝。', '来一场吧——输的人负责给全镇的宝可梦刷毛！'],
      win: ['小岚：切……还挺有两下子。', '不过别得意，等我从溪桥回来，一定会更强。', '对了，前面草丛里有不少野生宝可梦。记得多带几只伙伴。'],
      after: ['小岚：我在溪桥道馆等你。可别连徽章都拿不到。']
    },
    route_bug: {
      name: '阿拓', klass: '捕虫少年', sprite: 'boy', palette: 'bug',
      team: [{ species: 'pebblar', level: 5 }, { species: 'mossball', level: 6 }],
      reward: 240, flag: 'trainer_ato',
      intro: ['阿拓：嘘——你听，石头下面有窸窸窣窣的声音！', '我的宝可梦说，你的鞋底沾了森林的苔藓。', '那就用对战来交个朋友吧！'],
      win: ['阿拓：哇，你的宝可梦真精神！', '这只岩壳虫是我在碎石地捡到的，壳上还粘着一颗小石子呢。']
    },
    route_bird: {
      name: '小禾', klass: '短裤小子', sprite: 'kid', palette: 'sky',
      team: [{ species: 'peckling', level: 5 }, { species: 'sparkmouse', level: 6 }],
      reward: 260, flag: 'trainer_xiaohe',
      intro: ['小禾：我在练「像风一样冲刺」！', '妈妈说，只要跑得够快，就能追上前面的云。', '接招吧！'],
      win: ['小禾：呼、呼……我跑不动了。', '不过输给厉害的对手，好像也不赖！']
    },
    gym_1: {
      name: '苗苗', klass: '道馆学徒', sprite: 'girl', palette: 'grass',
      team: [{ species: 'mossball', level: 8 }, { species: 'mushpo', level: 8 }],
      reward: 400, flag: 'trainer_gym1',
      intro: ['苗苗：欢迎来到森语道馆。', '踩亮三盏苔灯，苔音馆主才会见你。', '不过——先过我这关！'],
      win: ['苗苗：苔灯在你脚下亮起来了。去吧，馆主在上面等你。']
    },
    gym_2: {
      name: '森森', klass: '道馆学徒', sprite: 'boy', palette: 'forest',
      team: [{ species: 'peckling', level: 8 }, { species: 'shadewing', level: 9 }],
      reward: 420, flag: 'trainer_gym2',
      intro: ['森森：嘘，苔灯最怕吵闹。', '能用招式说话的人，才配见到馆主。'],
      win: ['森森：你的节奏很稳。三盏灯，已经全部亮了。']
    },
    forest_ranger: {
      name: '青栎', klass: '守林人', sprite: 'ranger', palette: 'forest',
      team: [{ species: 'mosslord', level: 11 }, { species: 'boulderon', level: 10 }],
      reward: 620, flag: 'trainer_qingli',
      intro: ['青栎：站住。你踩到我的影子了。', '森林最近很不安。光苔一片片熄灭，连影子蝠都开始往南飞。', '让我看看你是否有守护它的力量。'],
      win: ['青栎：好。你的脚步没有惊动树根。', '祭坛在最深处。无论看到什么，记得——光不会真的消失，它只是躲了起来。']
    },
    forest_herbalist: {
      name: '采苓', klass: '采药人', sprite: 'girl', palette: 'mushroom',
      team: [{ species: 'sporecap', level: 11 }, { species: 'lanternmoth', level: 10 }],
      reward: 580, flag: 'trainer_cailing',
      intro: ['采苓：哎呀，别踩那朵紫伞菇！', '它可是我的宝可梦的早餐。', '既然遇上了，就陪我活动活动筋骨吧。'],
      win: ['采苓：好身手。送你一颗光莓吧——它能让疲惫的招式重新亮起来。']
    },
    glen_angler: {
      name: '阿溪', klass: '溪谷钓手', sprite: 'boy', palette: 'fish',
      team: [{ species: 'carplet', level: 12 }, { species: 'lanternfish', level: 12 }, { species: 'lumibug', level: 11 }],
      reward: 780, flag: 'trainer_axi',
      intro: ['阿溪：嘘——别惊动水面的光。', '灯鳍鱼只在安静的时候浮上来。', '不过既然你来了，就先陪我的伙伴游一圈吧。'],
      win: ['阿溪：好水性。你听见水底那声轻响了吗？', '灯鳍鱼在为你亮灯呢。']
    },
    mist_hiker: {
      name: '云阶', klass: '山道向导', sprite: 'ranger', palette: 'forest',
      team: [{ species: 'pebblar', level: 12 }, { species: 'skyquill', level: 13 }, { species: 'pineguard', level: 13 }],
      reward: 920, flag: 'trainer_yunjie',
      intro: ['云阶：上山的石阶有三百级。', '我数过很多遍，每次都会多数出一级。', '让我看看你的脚步够不够稳。'],
      win: ['云阶：脚步很稳。山顶的云会喜欢你的。', '下山的时候慢一点，松针很滑。']
    },
    hollow_warden: {
      name: '根守', klass: '洞窟守门人', sprite: 'ranger', palette: 'villain',
      team: [{ species: 'boulderon', level: 14 }, { species: 'webweaver', level: 14 }, { species: 'nightfang', level: 13 }],
      reward: 1100, flag: 'trainer_genshou',
      intro: ['根守：古树的根在这里盘了一千年。', '它们记得每一个走进洞窟的人。', '你也想让它们记住吗？先让我看看你的分量。'],
      win: ['根守：嗯，脚印不轻不重，刚刚好。', '深处的萤石在为你亮。去看看吧，别碰会呼吸的石头。']
    },
    shadow: {
      name: '影蚀', klass: '窃光者', sprite: 'villain', palette: 'villain',
      team: [{ species: 'nightfang', level: 13 }, { species: 'shadewing', level: 12 }],
      reward: 900, flag: 'shadowDefeated',
      intro: ['影蚀：……你来得比我预想的快。', '这些光苔，一千年才长一寸。可它们只肯为森林发光，多浪费。', '把光交给我，我可以让它照亮整片大陆。'],
      win: ['影蚀：不可能……光居然选择了你？', '不，还没结束。祭坛里的那位——早就被阴影喂饱了。']
    },
    leader: {
      name: '苔音', klass: '森语道馆馆主', sprite: 'leader', palette: 'leader',
      team: [{ species: 'mushpo', level: 9 }, { species: 'mosslord', level: 10 }, { species: 'sporecap', level: 12 }],
      reward: 1200, flag: 'gymDefeated', badge: true,
      intro: ['苔音：三盏苔灯都亮了。你听见它们的声音了吗？', '草会记得每一滴雨，妖精会记得每一个名字。', '让我看看，你的旅途是否也被它们记得。'],
      win: ['苔音：很好。森林认可你了。', '这枚森语徽章，请收下。', '北边萤火森林的结界会为你打开。去看看吧——那里的光，正在等人。'],
      after: ['苔音：徽章不是终点。它只是一片叶子，提醒你曾经在这里停过。']
    },
    boss: {
      name: '幽苔兽', klass: '被侵蚀的守护者', sprite: 'gloam', palette: 'gloam',
      team: [{ species: 'gloam', level: 15 }],
      reward: 0, flag: 'bossDefeated', boss: true,
      intro: ['祭坛中央的苔光忽然缩成一团。', '幽苔兽：……光……是我的……', '幽苔兽：不要……再夺走……'],
      win: ['幽苔兽发出一声悠长的低鸣，阴影像潮水一样退去。', '光苔一盏接一盏亮起，森林重新开始呼吸。'],
      after: []
    }
  };

  /* ---------- NPC ---------- */
  PKM.NPCS = [
    { id: 'mom', map: 'town', x: 18, y: 6, dir: 'left', name: '妈妈', sprite: 'woman', palette: 'mom', dialog: 'mom' },
    { id: 'prof', map: 'town', x: 8, y: 6, dir: 'down', name: '苔爷爷', sprite: 'elder', palette: 'prof', dialog: 'prof' },
    { id: 'clerk', map: 'town', x: 26, y: 6, dir: 'down', name: '杂货铺老板', sprite: 'man', palette: 'clerk', dialog: 'clerk' },
    { id: 'nurse', map: 'town', x: 24, y: 16, dir: 'down', name: '驿站看护', sprite: 'nurse', palette: 'nurse', dialog: 'nurse' },
    { id: 'kid1', map: 'town', x: 12, y: 12, dir: 'right', name: '小满的弟弟', sprite: 'kid', palette: 'kid', dialog: 'kid1' },
    { id: 'elder1', map: 'town', x: 27, y: 18, dir: 'left', name: '晒太阳的老人', sprite: 'elder', palette: 'old', dialog: 'elder1' },
    { id: 'rival_route', map: 'route', x: 18, y: 20, dir: 'left', name: '小岚', sprite: 'rival', palette: 'rival', dialog: 'rival_route', hideFlag: 'rival1Defeated' },
    { id: 'ato', map: 'route', x: 10, y: 12, dir: 'right', name: '阿拓', sprite: 'boy', palette: 'bug', dialog: 'ato', trainer: 'route_bug' },
    { id: 'xiaohe', map: 'route', x: 26, y: 19, dir: 'left', name: '小禾', sprite: 'kid', palette: 'sky', dialog: 'xiaohe', trainer: 'route_bird' },
    { id: 'girl_brook', map: 'brook', x: 9, y: 8, dir: 'down', name: '小满', sprite: 'girl', palette: 'pink', dialog: 'girl_brook' },
    { id: 'musician', map: 'brook', x: 10, y: 13, dir: 'right', name: '流浪乐师', sprite: 'man', palette: 'music', dialog: 'musician' },
    { id: 'fisher', map: 'brook', x: 18, y: 17, dir: 'left', name: '钓鱼佬阿河', sprite: 'man', palette: 'fish', dialog: 'fisher' },
    { id: 'gymguide', map: 'brook', x: 20, y: 8, dir: 'down', name: '道馆向导', sprite: 'boy', palette: 'guide', dialog: 'gymguide' },
    { id: 'brook_nurse', map: 'brook', x: 18, y: 8, dir: 'down', name: '溪桥看护', sprite: 'nurse', palette: 'nurse', dialog: 'brook_nurse' },
    { id: 'brook_elder', map: 'brook', x: 25, y: 18, dir: 'up', name: '桥边老人', sprite: 'elder', palette: 'old', dialog: 'brook_elder' },
    { id: 'athlete', map: 'brook', x: 26, y: 10, dir: 'left', name: '晨跑者', sprite: 'boy', palette: 'sky', dialog: 'athlete' },
    { id: 'gym_1', map: 'gym', x: 3, y: 12, dir: 'right', name: '苗苗', sprite: 'girl', palette: 'grass', dialog: 'gym_1', trainer: 'gym_1' },
    { id: 'gym_2', map: 'gym', x: 14, y: 12, dir: 'left', name: '森森', sprite: 'boy', palette: 'forest', dialog: 'gym_2', trainer: 'gym_2' },
    { id: 'leader', map: 'gym', x: 9, y: 3, dir: 'down', name: '苔音', sprite: 'leader', palette: 'leader', dialog: 'leader', trainer: 'leader' },
    { id: 'ranger', map: 'forest', x: 7, y: 16, dir: 'right', name: '青栎', sprite: 'ranger', palette: 'forest', dialog: 'ranger', trainer: 'forest_ranger' },
    { id: 'herbalist', map: 'forest', x: 21, y: 12, dir: 'left', name: '采苓', sprite: 'girl', palette: 'mushroom', dialog: 'herbalist', trainer: 'forest_herbalist' },
    { id: 'glen_angler', map: 'glen', x: 12, y: 13, dir: 'right', name: '阿溪', sprite: 'boy', palette: 'fish', dialog: 'glen_angler', trainer: 'glen_angler' },
    { id: 'glen_photo', map: 'glen', x: 25, y: 16, dir: 'left', name: '摄影师小灯', sprite: 'girl', palette: 'pink', dialog: 'glen_photo' },
    { id: 'mist_hiker', map: 'mist', x: 10, y: 14, dir: 'left', name: '云阶', sprite: 'ranger', palette: 'forest', dialog: 'mist_hiker', trainer: 'mist_hiker' },
    { id: 'mist_painter', map: 'mist', x: 22, y: 3, dir: 'left', name: '画家松岚', sprite: 'woman', palette: 'music', dialog: 'mist_painter' },
    { id: 'hollow_warden', map: 'hollow', x: 5, y: 11, dir: 'right', name: '根守', sprite: 'ranger', palette: 'villain', dialog: 'hollow_warden', trainer: 'hollow_warden' },
    { id: 'hollow_kid', map: 'hollow', x: 18, y: 10, dir: 'left', name: '洞窟探险家', sprite: 'kid', palette: 'sky', dialog: 'hollow_kid' }
  ];

  /* ---------- 任务 ---------- */
  PKM.QUESTS = {
    main: { title: '森之微光', type: 'main', desc: '萤火森林的光苔正在熄灭。查明原因，让森林重新亮起来。' },
    hairpin: { title: '遗落的发夹', type: 'side', desc: '小满在溪边弄丢了苔花发夹。听说它掉在微风小径的草丛里。' },
    musician: { title: '橙橙果的旋律', type: 'side', desc: '流浪乐师需要 2 颗橙橙果，想写一首关于森林的歌。' },
    researcher: { title: '森林观察员', type: 'side', desc: '溪桥的晨跑者想知道森林里究竟有多少种宝可梦。捕获 6 种不同的宝可梦。' },
    fisher: { title: '水边的证明', type: 'side', desc: '钓鱼佬阿河想看看你钓上来的水属性宝可梦。' },
    glen_lantern: { title: '溪谷的灯', type: 'side', desc: '溪谷的摄影师想亲眼看看传说中的灯鳍鱼。' },
    mist_bell: { title: '山顶的松风铃', type: 'side', desc: '雾松山道的画家在找一枚被风吹走的旧铜铃。' }
  };

  /* ---------- 对话 ---------- */
  const B = (n) => `（背包里有 ${n} 个精灵球）`;
  PKM.DIALOGUES = {
    mom: (S) => {
      if (S.flags.leftHome) {
        return { speaker: '妈妈', lines: ['妈妈：回来啦。', '看你鞋子上的泥，走了不少路吧？', '来，先把伙伴们安顿好。'], effect: { type: 'heal' } };
      }
      S.flags.leftHome = true;
      return { speaker: '妈妈', lines: ['妈妈：醒啦？苔爷爷刚才来找过你。', '他说森林里的光苔又暗了一片，想请你帮个忙。', '你的伙伴已经等在研究所门口了。路上小心，记得常回来吃饭。', B(5)], effect: { type: 'heal' } };
    },
    prof: (S) => {
      if (!S.flags.dexGiven) {
        S.flags.dexGiven = true;
        return { speaker: '苔爷爷', lines: ['苔爷爷：风把你带来了。', '这片森林叫萤火森林。每到夏夜，光苔会和小小的萤火一起亮起来。', '可最近，光正一片片熄灭。连最老的树都开始做梦。', '拿着这本图鉴，带上你的伙伴，去溪桥镇找苔音吧。她是森林的守门人。', S.starter ? `苔爷爷：${PKM.SPECIES[S.starter].name}似乎很喜欢你呢。` : '苔爷爷：去吧，路会自己长出来的。'], effect: { type: 'give', item: 'dex', qty: 1 } };
      }
      if (!S.flags.badge) {
        return { speaker: '苔爷爷', lines: ['苔爷爷：溪桥镇在东边。沿着微风小径一直走。', '草丛里会遇到野生宝可梦。按 Z 打开背包，用精灵球捕捉它们。', '属性相克会让战斗轻松很多。火克草，草克水，水克火。', '别忘了，伙伴不是工具。累了就让它们在驿站休息。'] };
      }
      if (!S.flags.forestCleared) {
        return { speaker: '苔爷爷', lines: ['苔爷爷：徽章的光芒我在这里都看见了。', '萤火森林的结界已经打开。去吧。', '如果遇到无法战胜的阴影，就想想你的伙伴为什么愿意跟着你。'] };
      }
      return { speaker: '苔爷爷', lines: ['苔爷爷：森林的光回来了。谢谢你，年轻的旅人。', '祭坛上似乎还有一道沉睡的光。或许，它在等一个足够温柔的挑战者。', '去看看吧。图鉴里还有空白页呢。'] };
    },
    clerk: (S) => ({ speaker: '杂货铺老板', lines: ['老板：欢迎光临青苔杂货铺。', '精灵球和伤药都是旅人的老朋友。', '要是徽章拿回来了，溪桥的货更全。'], effect: { type: 'shop', shop: 'town' } }),
    nurse: () => ({ speaker: '驿站看护', lines: ['看护：欢迎来到青苔驿站。', '把伙伴交给我吧，几分钟就好。'], effect: { type: 'heal' } }),
    brook_nurse: () => ({ speaker: '溪桥看护', lines: ['看护：溪桥的风很软，适合让伙伴们打个盹。', '都交给我吧。'], effect: { type: 'heal' } }),
    kid1: (S) => {
      if (S.flags.hairpinDone) return { speaker: '小满的弟弟', lines: ['弟弟：姐姐把发夹找回来了，今天给我多盛了一碗汤。', '你要是路过溪桥，替我谢谢她。'] };
      return { speaker: '小满的弟弟', lines: ['弟弟：我姐姐小满在溪桥镇。', '她昨天哭着说发夹掉在草丛里了。', '你要是看见一枚会发光的苔花发夹，能帮我带给她吗？'] };
    },
    elder1: () => ({ speaker: '晒太阳的老人', lines: ['老人：年轻人，别急着赶路。', '我在这把椅子上看了四十年云。', '云的影子走过屋顶，就像宝可梦从梦里走过。'] }),
    rival_route: (S) => {
      if (S.flags.rival1Defeated) return { speaker: '小岚', lines: ['小岚：还磨蹭什么？溪桥道馆就在东边。', '我可不会等你。'] };
      return { speaker: '小岚', lines: ['小岚：喂——小森！', '你终于肯离开镇子了。', '苔爷爷把那么稀有的伙伴给了你，我得亲自试试它够不够格。'] };
    },
    ato: (S) => {
      if (S.flags.trainer_ato) return { speaker: '阿拓', lines: ['阿拓：岩壳虫翻石头的时候，会先用角敲一敲。', '它们其实很温柔，只是看起来像小石头。'] };
      return { speaker: '阿拓', lines: ['阿拓：你也是来听石头下面的声音吗？', '我的宝可梦说，你的鞋底沾了森林的苔藓。', '那就用对战来交个朋友吧！'] };
    },
    xiaohe: (S) => {
      if (S.flags.trainer_xiaohe) return { speaker: '小禾', lines: ['小禾：我每天从镇口跑到溪桥，再跑回来。', '总有一天，我要跑得比风还快！'] };
      return { speaker: '小禾', lines: ['小禾：我在练「像风一样冲刺」！', '妈妈说，只要跑得够快，就能追上前面的云。', '接招吧！'] };
    },
    girl_brook: (S) => {
      if (S.flags.hairpinDone) return { speaker: '小满', lines: ['小满：发夹别在头发上了，好看吗？', '谢谢你。下次来溪桥，我请你吃烤团子。'] };
      if ((S.bag.hairpin || 0) > 0) {
        return {
          speaker: '小满', lines: ['小满：这个……是我的苔花发夹！', '我在溪边追一只流萤，回来就找不到了。', '谢谢你特地送来。这个给你，是我攒的超级球。'],
          effect: { type: 'hairpin' }
        };
      }
      return { speaker: '小满', lines: ['小满：呜……我的苔花发夹不见了。', '是妈妈留给我的，上面有一片会发光的苔花。', '我记得昨天在微风小径的草丛边停过……'] };
    },
    musician: (S) => {
      if (S.flags.musicianDone) return { speaker: '流浪乐师', lines: ['乐师：你听，这段旋律像不像森林在翻身？', '等我写完，要在这里弹给所有人听。'] };
      if ((S.bag.berry || 0) >= 2) {
        return {
          speaker: '流浪乐师', lines: ['乐师：橙橙果的甜味，能让高音变得柔软。', '你愿意给我两颗吗？', '作为交换，这些钱和一瓶好伤药请收下。'],
          effect: { type: 'musician' }
        };
      }
      return { speaker: '流浪乐师', lines: ['乐师：我想写一首关于森林的歌。', '可我的旋律总是少一点甜味。', '要是能有 2 颗橙橙果就好了。微风小径的树丛里应该能找到。'] };
    },
    fisher: (S) => {
      if (S.flags.fisherDone) return { speaker: '钓鱼佬阿河', lines: ['阿河：水面的波纹会说话。', '耐心一点，大鱼总在最后咬钩。'] };
      if (!S.bag.rod) {
        return {
          speaker: '钓鱼佬阿河', lines: ['阿河：你盯着水面看了很久。', '想试试吗？这根旧钓竿跟着我二十年了。', '送给你吧。面向水面按 Z，就能钓鱼。', '钓上水属性宝可梦后，再来给我看看。'],
          effect: { type: 'give_rod' }
        };
      }
      const hasWater = (S.party || []).some(m => PKM.SPECIES[m.species].types.includes('water'));
      if (hasWater) {
        return {
          speaker: '钓鱼佬阿河', lines: ['阿河：哦？你身上有水的气息。', '让我看看……好家伙，养得真精神。', '这枚溪珍珠给你。水边的孩子，运气都不会太差。'],
          effect: { type: 'fisher' }
        };
      }
      return { speaker: '钓鱼佬阿河', lines: ['阿河：钓到水属性宝可梦了吗？', '带在身边再来找我。水会记住对它好的人。'] };
    },
    gymguide: (S) => ({ speaker: '道馆向导', lines: ['向导：森语道馆的规则很简单。', '踩亮三盏苔灯，结界就会打开。', S.flags.badge ? '你已经拿到徽章了？那还来做什么，哈哈哈。' : '馆主苔音使用草与妖精属性。火、毒、飞行会让她很头疼。'] }),
    brook_elder: () => ({ speaker: '桥边老人', lines: ['老人：溪桥的桥墩是活的。', '每年春天，它会长出新的根。', '人也一样。走过的地方，都会在身体里长根。'] }),
    athlete: (S) => {
      if (S.flags.researcherDone) return { speaker: '晨跑者', lines: ['晨跑者：你的图鉴已经写满大半了。', '森林会记住每一个被认真看过的小生命。'] };
      const count = Object.keys(S.dexCaught || {}).length;
      if (count >= 6) {
        return {
          speaker: '晨跑者', lines: ['晨跑者：等等，你身上的图鉴在发光。', `已经记录了 ${count} 种宝可梦？真了不起。`, '这些高级球给你。替我把森林的故事继续写下去。'],
          effect: { type: 'researcher' }
        };
      }
      return { speaker: '晨跑者', lines: ['晨跑者：我每天沿着溪桥跑十个来回。', '森林里到底有多少种宝可梦呢？', `我的图鉴只记了 3 种。你要是能捕获 6 种，我就服你。（目前 ${count}/6）`] };
    },
    gym_1: (S) => {
      if (S.flags.trainer_gym1) return { speaker: '苗苗', lines: ['苗苗：踩苔灯的时候，要像踩在云上一样轻。'] };
      return { speaker: '苗苗', lines: ['苗苗：欢迎来到森语道馆。', '踩亮三盏苔灯，苔音馆主才会见你。', '不过——先过我这关！'] };
    },
    gym_2: (S) => {
      if (S.flags.trainer_gym2) return { speaker: '森森', lines: ['森森：你的节奏很稳。像雨落在叶子上。'] };
      return { speaker: '森森', lines: ['森森：嘘，苔灯最怕吵闹。', '能用招式说话的人，才配见到馆主。'] };
    },
    leader: (S) => {
      if (S.flags.badge) return { speaker: '苔音', lines: ['苔音：徽章不是终点。它只是一片叶子，提醒你曾经在这里停过。', '森林北边的光，还在等你。'] };
      if (!S.flags.gymGateOpen) {
        return { speaker: '苔音', lines: ['苔音：结界还在。三盏苔灯都亮起来，我才会转身。'] };
      }
      return { speaker: '苔音', lines: ['苔音：三盏苔灯都亮了。你听见它们的声音了吗？', '草会记得每一滴雨，妖精会记得每一个名字。', '让我看看，你的旅途是否也被它们记得。'] };
    },
    ranger: (S) => {
      if (S.flags.trainer_qingli) return { speaker: '青栎', lines: ['青栎：祭坛在最深处。', '无论看到什么，记得——光不会真的消失，它只是躲了起来。'] };
      return { speaker: '青栎', lines: ['青栎：站住。你踩到我的影子了。', '森林最近很不安。光苔一片片熄灭，连影蝠都开始往南飞。', '让我看看你是否有守护它的力量。'] };
    },
    herbalist: (S) => {
      if (S.flags.trainer_cailing) return { speaker: '采苓', lines: ['采苓：光莓要趁露水没干的时候采。', '吃了它，疲惫的招式会重新亮起来。'] };
      return { speaker: '采苓', lines: ['采苓：哎呀，别踩那朵紫伞菇！', '它可是我的宝可梦的早餐。', '既然遇上了，就陪我活动活动筋骨吧。'] };
    },
    glen_angler: (S) => {
      if (S.flags.trainer_axi) return { speaker: '阿溪', lines: ['阿溪：水面的光又亮了一格。', '灯鳍鱼喜欢安静的人。你刚才站得很稳。'] };
      return { speaker: '阿溪', lines: ['阿溪：嘘——别惊动水面的光。', '灯鳍鱼只在安静的时候浮上来。', '不过既然你来了，就先陪我的伙伴游一圈吧。'] };
    },
    glen_photo: (S) => {
      if (S.flags.glenLanternDone) return { speaker: '小灯', lines: ['小灯：照片洗出来了。', '灯鳍鱼的光在底片上变成了一串小小的星星。', '等展览的时候，我会在第一张下面写你的名字。'] };
      if (S.dexCaught && S.dexCaught.lanternfish) {
        return {
          speaker: '小灯',
          lines: ['小灯：等等，你身上有灯鳍鱼的光！', '我追着它跑了三天，只拍到一团模糊的蓝。', '能让我看看你的图鉴吗？……真的！', '这些高级球给你。替我把这条溪谷的光拍下去。'],
          effect: { type: 'glen_lantern' }
        };
      }
      return { speaker: '小灯', lines: ['小灯：我在等灯鳍鱼。', '它们只在水最静的时候出现，鳍上像挂着一盏小灯。', '如果你钓到或遇到一只，一定要来告诉我。'] };
    },
    mist_hiker: (S) => {
      if (S.flags.trainer_yunjie) return { speaker: '云阶', lines: ['云阶：山顶的云今天很低。', '不过没关系，路还在脚下。'] };
      return { speaker: '云阶', lines: ['云阶：上山的石阶有三百级。', '我数过很多遍，每次都会多数出一级。', '让我看看你的脚步够不够稳。'] };
    },
    mist_painter: (S) => {
      if (S.flags.mistBellDone) return { speaker: '松岚', lines: ['松岚：听，风铃又响了。', '我把这个声音画成了一片会流动的松林。'] };
      if ((S.bag.windbell || 0) > 0) {
        return {
          speaker: '松岚',
          lines: ['松岚：这个声音……是我的松风铃！', '它被山顶的风吹走了，我找了一整个下午。', '谢谢你。这枚铃铛对你也许只是旧铜，但对我来说，是整座山的呼吸。', '这些金币和活力块请收下。'],
          effect: { type: 'mist_bell' }
        };
      }
      return { speaker: '松岚', lines: ['松岚：我在找一枚旧铜铃。', '风把它从画架边卷走了，大概落在观景台附近。', '如果你在山顶看见它，能帮我带回来吗？'] };
    },
    hollow_warden: (S) => {
      if (S.flags.trainer_genshou) return { speaker: '根守', lines: ['根守：洞窟很深，但你的灯够亮。', '去吧，深处的萤石会为你指路。'] };
      return { speaker: '根守', lines: ['根守：古树的根在这里盘了一千年。', '它们记得每一个走进洞窟的人。', '你也想让它们记住吗？先让我看看你的分量。'] };
    },
    hollow_kid: (S) => ({ speaker: '洞窟探险家', lines: ['探险家：我在这儿发现了一块会呼吸的石头！', '它每分钟亮一次，像是在数自己的心跳。', '不过根守说不能带走。好吧，我拍张照。'] })
  };

  /* ---------- 图鉴顺序 ---------- */
  PKM.DEX_ORDER = Object.keys(PKM.SPECIES);
  PKM.STARTERS = ['sproutle', 'emberfox', 'bubblotter'];
  PKM.VERSION = '1.0.0';

  PKM.DATA = {
    TYPES: PKM.TYPES,
    TYPE_CHART: PKM.TYPE_CHART,
    MOVES: PKM.MOVES,
    SPECIES: PKM.SPECIES,
    ITEMS: PKM.ITEMS,
    SHOPS: PKM.SHOPS,
    MAPS: PKM.MAPS,
    TRAINERS: PKM.TRAINERS,
    NPCS: PKM.NPCS,
    QUESTS: PKM.QUESTS,
    DIALOGUES: PKM.DIALOGUES,
    WAYPOINTS: PKM.WAYPOINTS,
    TILE_SOLID: PKM.TILE_SOLID,
    DEX_ORDER: PKM.DEX_ORDER,
    STARTERS: PKM.STARTERS,
    VERSION: PKM.VERSION
  };
})();
