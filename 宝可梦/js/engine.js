/* ============================================================
   游戏引擎：状态、队伍、地图移动、存档与任务
   ============================================================ */
window.PKM = window.PKM || {};

(function () {
  const PKM = window.PKM;
  const D = PKM.DATA;
  const SAVE_KEY = 'pkm_forest_whisper_save_v1';
  const TILE = 16;

  const GAME = {
    state: null,
    time: 0,
    hooks: {},
    move: null,
    autoPath: null,
    autoInteract: null,
    clickFx: null,
    sinceEncounter: 0,
    lastSave: 0,
    paused: false,

    /* ---------- 基础 ---------- */
    newState(name, starter) {
      const start = D.MAPS.town;
      const rivalMap = { sproutle: 'emberfox', emberfox: 'bubblotter', bubblotter: 'sproutle' };
      const s = {
        version: D.VERSION,
        name: name || '小森',
        money: 800,
        starter,
        rivalStarter: rivalMap[starter] || 'emberfox',
        map: 'town',
        player: { x: 16, y: 6, dir: 'down', frame: 0, running: false },
        visual: { x: 16 * TILE, y: 6 * TILE },
        party: [],
        pc: [],
        bag: { pokeball: 5, potion: 2 },
        dexSeen: {},
        dexCaught: {},
        flags: { introDone: true, leftHome: false, dexGiven: false, rivalSceneDone: false, visited_town: true },
        quests: { main: 'active' },
        trackedQuest: 'main',
        waypoints: { town_inn: true },
        runes: {},
        badges: [],
        achievements: {},
        trainerWins: 0,
        clock: 7 * 60 + 20,
        hour: 7 + 20 / 60,
        night: false,
        playSeconds: 0,
        steps: 0,
        catches: 0,
        settings: { music: true, sfx: true, speed: 1, guide: true },
        uid: 1
      };
      const mon = this.createMon(starter, 6);
      s.party.push(mon);
      this.markSeen(starter, s);
      this.markCaught(starter, s);
      this.state = s;
      this.move = null;
      this.sinceEncounter = 0;
      return s;
    },

    currentMap() { return D.MAPS[this.state.map]; },

    monStats(speciesId, level) {
      const b = D.SPECIES[speciesId].base;
      const stats = {};
      stats.hp = Math.floor((2 * b.hp + 31) * level / 100) + level + 10;
      stats.atk = Math.floor((2 * b.atk + 31) * level / 100) + 5;
      stats.def = Math.floor((2 * b.def + 31) * level / 100) + 5;
      stats.spa = Math.floor((2 * b.spa + 31) * level / 100) + 5;
      stats.spd = Math.floor((2 * b.spd + 31) * level / 100) + 5;
      stats.spe = Math.floor((2 * b.spe + 31) * level / 100) + 5;
      return stats;
    },

    movesFor(speciesId, level) {
      const learn = D.SPECIES[speciesId].learnset.filter(x => x[0] <= level);
      const seen = [];
      for (let i = learn.length - 1; i >= 0; i--) {
        if (!seen.includes(learn[i][1])) seen.unshift(learn[i][1]);
      }
      return seen.slice(-4).map(id => ({ id, pp: D.MOVES[id].pp, maxPp: D.MOVES[id].pp }));
    },

    createMon(speciesId, level, opts) {
      const sp = D.SPECIES[speciesId];
      if (!sp) throw new Error('未知宝可梦: ' + speciesId);
      level = Math.max(1, Math.min(100, level | 0));
      const stats = this.monStats(speciesId, level);
      const s = this.state;
      const uid = s ? s.uid++ : Math.floor(Math.random() * 1e9);
      const mon = {
        uid,
        species: speciesId,
        level,
        exp: 0,
        hp: opts && opts.hp != null ? opts.hp : stats.hp,
        maxHp: stats.hp,
        stats,
        moves: this.movesFor(speciesId, level),
        status: null,
        statusTurns: 0,
        nickname: (opts && opts.nickname) || null,
        met: (opts && opts.met) || (this.state ? this.state.map : 'town'),
        metLevel: (opts && opts.metLevel) || level,
        shiny: false,
        sp: 0,
        moveRanks: {},
        training: { power: 0, guard: 0, swift: 0 }
      };
      this.normalizeMon(mon);
      return mon;
    },

    /* 兼容旧存档：补上技能点、招式等级、特训数据 */
    normalizeMon(mon) {
      if (!mon) return mon;
      if (typeof mon.sp !== 'number') mon.sp = 0;
      if (!mon.moveRanks || typeof mon.moveRanks !== 'object') mon.moveRanks = {};
      if (!mon.training || typeof mon.training !== 'object') mon.training = {};
      ['power', 'guard', 'swift'].forEach(k => {
        if (typeof mon.training[k] !== 'number') mon.training[k] = 0;
      });
      if (!Array.isArray(mon.moves)) mon.moves = this.movesFor(mon.species, mon.level);
      mon.moves.forEach(mv => {
        const rank = Math.max(1, Math.min(D.MOVE_RANK_MAX || 5, mon.moveRanks[mv.id] || 1));
        mon.moveRanks[mv.id] = rank;
        const maxPp = D.MOVES[mv.id].pp + (D.MOVE_RANK_PP[rank] || 0);
        if (typeof mv.maxPp !== 'number' || mv.maxPp < maxPp) mv.maxPp = maxPp;
        if (typeof mv.pp !== 'number' || mv.pp > mv.maxPp) mv.pp = mv.maxPp;
      });
      return mon;
    },

    /* 按特训重算能力值。healDiff 为真时，体力上限的增长会补到当前体力上。 */
    recalcStats(mon, healDiff) {
      if (!mon) return mon;
      this.normalizeMon(mon);
      const raw = this.monStats(mon.species, mon.level);
      const t = mon.training;
      const oldMax = mon.maxHp || raw.hp;
      mon.stats = {
        hp: Math.floor(raw.hp * (1 + .06 * t.guard)),
        atk: Math.floor(raw.atk * (1 + .05 * t.power)),
        def: Math.floor(raw.def * (1 + .04 * t.guard)),
        spa: Math.floor(raw.spa * (1 + .05 * t.power)),
        spd: Math.floor(raw.spd * (1 + .04 * t.guard)),
        spe: Math.floor(raw.spe * (1 + .05 * t.swift))
      };
      mon.maxHp = mon.stats.hp;
      if (healDiff) mon.hp = Math.min(mon.maxHp, Math.max(0, mon.hp) + Math.max(0, mon.maxHp - oldMax));
      else mon.hp = Math.max(0, Math.min(mon.maxHp, mon.hp));
      return mon;
    },

    /* ---------- 招式等级 ---------- */
    moveRank(mon, moveId) {
      if (!mon || !mon.moveRanks) return 1;
      return Math.max(1, Math.min(D.MOVE_RANK_MAX || 5, mon.moveRanks[moveId] || 1));
    },

    /* 招式在实战中的实际数值：威力、命中、PP 上限、要害等级 */
    effMove(mon, mv) {
      if (!mv) return null;
      if (mv.struggle) return { rank: 1, power: 40, acc: 100, maxPp: 1, crit: 0 };
      const base = D.MOVES[mv.id] || { power: 0, acc: 100, pp: 1 };
      const rank = this.moveRank(mon, mv.id);
      const mul = (D.MOVE_RANK_POWER[rank - 1] || 1);
      const accBonus = D.MOVE_RANK_ACC[rank] || 0;
      return {
        rank,
        power: base.power ? Math.round(base.power * mul) : 0,
        basePower: base.power || 0,
        acc: base.acc === 0 ? 0 : Math.min(100, base.acc + accBonus),
        maxPp: base.pp + (D.MOVE_RANK_PP[rank] || 0),
        crit: (base.crit || 0) + (rank >= 5 ? 1 : 0)
      };
    },

    upgradeMove(mon, index) {
      if (!mon) return { ok: false, msg: '没有可以强化的对象。' };
      const mv = mon.moves[index];
      if (!mv) return { ok: false, msg: '找不到这个招式。' };
      this.normalizeMon(mon);
      const rank = this.moveRank(mon, mv.id);
      const max = D.MOVE_RANK_MAX || 5;
      if (rank >= max) return { ok: false, msg: '这个招式已经练到极限了。' };
      if ((mon.sp || 0) <= 0) return { ok: false, msg: '技能点不够，先去战斗升级吧。' };
      mon.sp--;
      const oldMax = mv.maxPp;
      mon.moveRanks[mv.id] = rank + 1;
      const eff = this.effMove(mon, mv);
      mv.maxPp = eff.maxPp;
      mv.pp = Math.min(mv.maxPp, mv.pp + Math.max(0, mv.maxPp - oldMax));
      this.autoSave();
      return { ok: true, msg: `${D.MOVES[mv.id].name} 练到了 ${rank + 1} 级。`, rank: rank + 1 };
    },

    upgradeTraining(mon, key) {
      if (!mon || !D.TRAINING[key]) return { ok: false, msg: '没有可以训练的项目。' };
      this.normalizeMon(mon);
      const max = D.TRAIN_MAX || 5;
      if (mon.training[key] >= max) return { ok: false, msg: `${D.TRAINING[key].name}已经满了。` };
      if ((mon.sp || 0) <= 0) return { ok: false, msg: '技能点不够，先去战斗升级吧。' };
      mon.sp--;
      mon.training[key]++;
      this.recalcStats(mon, true);
      this.autoSave();
      return { ok: true, msg: `${this.nameOf(mon)}的${D.TRAINING[key].name}达到 ${mon.training[key]} 级。`, rank: mon.training[key] };
    },

    /* 自动把技能点分配到三条特训线上（优先补最低的一项） */
    autoTrain(mon, times) {
      if (!mon) return { ok: false, count: 0, msg: '没有可以训练的对象。' };
      this.normalizeMon(mon);
      let n = 0;
      const max = D.TRAIN_MAX || 5;
      while ((mon.sp || 0) > 0 && n < (times || 99)) {
        const keys = Object.keys(D.TRAINING).filter(k => mon.training[k] < max);
        if (!keys.length) break;
        keys.sort((a, b) => mon.training[a] - mon.training[b]);
        mon.training[keys[0]]++;
        mon.sp--;
        n++;
      }
      if (!n) return { ok: false, count: 0, msg: '技能点不足，或者特训已经满了。' };
      this.recalcStats(mon, true);
      this.autoSave();
      return { ok: true, count: n, msg: `${this.nameOf(mon)}完成了 ${n} 级特训。` };
    },

    /* 教招式：slot 为要替换的招式位置，-1 表示新增一格 */
    teachMove(mon, moveId, slot) {
      if (!mon || !D.MOVES[moveId]) return { ok: false, msg: '这个招式无法学习。' };
      this.normalizeMon(mon);
      if (mon.moves.some(m => m.id === moveId)) return { ok: false, msg: `${this.nameOf(mon)}已经会这个招式了。` };
      const entry = { id: moveId, pp: D.MOVES[moveId].pp, maxPp: D.MOVES[moveId].pp };
      if (slot >= 0 && slot < mon.moves.length) {
        const old = mon.moves[slot];
        delete mon.moveRanks[old.id];
        mon.moves[slot] = entry;
      } else if (mon.moves.length < 4) {
        mon.moves.push(entry);
      } else {
        return { ok: false, msg: '四个招式格都满了，需要替换一个。' };
      }
      mon.moveRanks[moveId] = 1;
      this.normalizeMon(mon);
      this.autoSave();
      return { ok: true, msg: `${this.nameOf(mon)}学会了${D.MOVES[moveId].name}。` };
    },

    renameMon(mon, name) {
      if (!mon) return false;
      const clean = String(name || '').trim().slice(0, 6);
      mon.nickname = clean && clean !== D.SPECIES[mon.species].name ? clean : null;
      this.autoSave();
      return true;
    },


    nameOf(mon) { return mon.nickname || D.SPECIES[mon.species].name; },

    expNeeded(level) { return Math.floor(18 + level * level * 3.6); },

    gainExperience(mon, amount) {
      const result = { gained: amount, levels: [], moves: [], sp: 0 };
      if (mon.level >= 100) return result;
      mon.exp += amount;
      while (mon.level < 100 && mon.exp >= this.expNeeded(mon.level)) {
        mon.exp -= this.expNeeded(mon.level);
        mon.level++;
        this.recalcStats(mon, true);
        mon.sp = (mon.sp || 0) + (D.SP_PER_LEVEL || 2);
        result.sp += (D.SP_PER_LEVEL || 2);
        result.levels.push(mon.level);
        // learn newest move at this level
        const learnNow = D.SPECIES[mon.species].learnset.filter(x => x[0] === mon.level);
        for (const [, mid] of learnNow) {
          if (mon.moves.some(m => m.id === mid)) continue;
          if (mon.moves.length < 4) {
            mon.moves.push({ id: mid, pp: D.MOVES[mid].pp, maxPp: D.MOVES[mid].pp });
          } else {
            mon.moves.shift();
            mon.moves.push({ id: mid, pp: D.MOVES[mid].pp, maxPp: D.MOVES[mid].pp });
          }
          mon.moveRanks[mid] = 1;
          result.moves.push(mid);
        }
        this.normalizeMon(mon);
        const evo = D.SPECIES[mon.species].evolve;
        if (evo && mon.level >= evo.level) result.evolution = { from: mon.species, to: evo.to, mon };
      }
      return result;
    },

    evolveMon(mon) {
      const evo = D.SPECIES[mon.species].evolve;
      if (!evo) return null;
      const oldName = D.SPECIES[mon.species].name;
      mon.species = evo.to;
      mon.sp = (mon.sp || 0) + (D.SP_EVOLVE || 3);
      this.recalcStats(mon, true);
      this.markSeen(mon.species);
      this.markCaught(mon.species);
      const s = this.state;
      if (s) s.flags.evolved = true;
      return { oldName, newName: D.SPECIES[evo.to].name, sp: D.SP_EVOLVE || 3 };
    },

    markSeen(speciesId, state) {
      const s = state || this.state;
      if (!s || !D.SPECIES[speciesId]) return;
      s.dexSeen[speciesId] = true;
    },
    markCaught(speciesId, state) {
      const s = state || this.state;
      if (!s || !D.SPECIES[speciesId]) return;
      s.dexSeen[speciesId] = true;
      s.dexCaught[speciesId] = true;
    },

    addItem(id, qty = 1, silent) {
      const s = this.state;
      if (!D.ITEMS[id]) return;
      s.bag[id] = (s.bag[id] || 0) + qty;
      if (!silent) PKM.AUDIO.sfx('sparkle');
      this.autoSave();
    },
    countItem(id) { return (this.state.bag[id] || 0); },
    removeItem(id, qty = 1) {
      const s = this.state;
      if (!s.bag[id]) return false;
      s.bag[id] -= qty;
      if (s.bag[id] <= 0) delete s.bag[id];
      this.autoSave();
      return true;
    },

    healParty() {
      const s = this.state;
      s.party.forEach(m => {
        m.hp = m.maxHp;
        m.status = null;
        m.statusTurns = 0;
        m.moves.forEach(mv => { mv.pp = mv.maxPp; });
      });
      PKM.AUDIO.sfx('heal');
      this.autoSave();
    },

    aliveParty() { return this.state.party.filter(m => m.hp > 0); },

    firstHealthy() {
      const i = this.state.party.findIndex(m => m.hp > 0);
      return i >= 0 ? i : -1;
    },

    swapLead(index) {
      const p = this.state.party;
      if (index <= 0 || index >= p.length) return;
      const [m] = p.splice(index, 1);
      p.unshift(m);
      this.autoSave();
    },

    addMon(mon) {
      if (this.state.party.length < 6) {
        this.state.party.push(mon);
        return { toPC: false };
      }
      this.state.pc.push(mon);
      return { toPC: true };
    },

    /* ---------- 时间 ---------- */
    updateTime(dt) {
      const s = this.state;
      if (!s) return;
      s.clock += dt * 0.8;
      if (s.clock >= 1440) s.clock -= 1440;
      s.playSeconds += dt;
      s.hour = s.clock / 60;
      s.night = s.hour >= 19 || s.hour < 6;
    },

    clockLabel() {
      const s = this.state;
      if (!s) return '07:20';
      const h = Math.floor(s.clock / 60) % 24;
      const m = Math.floor(s.clock % 60);
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    },

    phaseLabel() {
      const h = this.state.hour;
      if (h < 5) return '深夜';
      if (h < 8) return '清晨';
      if (h < 11) return '上午';
      if (h < 14) return '正午';
      if (h < 17) return '午后';
      if (h < 19) return '黄昏';
      return '夜晚';
    },

    playSecondsLabel() {
      const sec = Math.floor(this.state.playSeconds);
      const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
      return `${h} 小时 ${String(m).padStart(2, '0')} 分`;
    },

    /* ---------- 地图 ---------- */
    tileAt(x, y) {
      const m = this.currentMap();
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) return null;
      return m.tiles[y][x];
    },

    buildingAt(x, y) {
      const m = this.currentMap();
      return (m.buildings || []).find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
    },

    buildingBlocks(b) {
      return b.type !== 'gate' && b.type !== 'shelter';
    },

    npcAt(x, y) {
      const s = this.state;
      return D.NPCS.find(n => n.map === s.map && n.x === x && n.y === y &&
        !(n.hideFlag && s.flags[n.hideFlag]));
    },

    propAt(x, y) {
      const m = this.currentMap();
      return (m.props || []).find(p => {
        if (p.type === 'rune') return p.x === x && p.y === y;
        if (p.type === 'gate') return !sFlag(this.state, 'gymGateOpen') && x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h;
        return p.x === x && p.y === y;
      });
    },

    isSolid(x, y) {
      const t = this.tileAt(x, y);
      if (!t) return true;
      if (D.TILE_SOLID[t]) return true;
      const b = this.buildingAt(x, y);
      if (b && this.buildingBlocks(b)) return true;
      if (this.npcAt(x, y)) return true;
      const p = this.propAt(x, y);
      if (p && (p.type === 'sign' || p.type === 'gate')) return true;
      return false;
    },

    portalAt(x, y) {
      const m = this.currentMap();
      return (m.portals || []).find(p => x >= p.x && x < p.x + (p.w || 1) && y >= p.y && y < p.y + (p.h || 1));
    },

    itemAt(x, y) {
      const m = this.currentMap();
      return (m.items || []).find(it => it.x === x && it.y === y && !this.state.flags['item_' + m.id + '_' + it.id]);
    },

    triggerAt(x, y) {
      const m = this.currentMap();
      return (m.triggers || []).find(tr => x >= tr.x && x < tr.x + tr.w && y >= tr.y && y < tr.y + tr.h && !this.state.flags[tr.once]);
    },

    unlockWaypoint(id, silent) {
      const s = this.state;
      if (!s) return false;
      const wp = (D.WAYPOINTS || []).find(w => w.id === id);
      if (!wp || s.waypoints[id]) return false;
      s.waypoints[id] = true;
      this.autoSave();
      if (!silent && PKM.UI && PKM.UI.screen === 'game') {
        PKM.UI.toast(`传送点已记录：${wp.name}`, 'waypoint', 'g');
      }
      if (PKM.GUIDE) PKM.GUIDE.refresh(true);
      return true;
    },

    fastTravel(id) {
      const s = this.state;
      const wp = (D.WAYPOINTS || []).find(w => w.id === id);
      if (!s || !wp || !s.waypoints[id]) return false;
      this.setMap(wp.map, wp.spawnX, wp.spawnY, wp.dir || 'down');
      if (PKM.UI && PKM.UI.screen === 'game') {
        PKM.UI.toast(`传送至 ${wp.name}`, 'waypoint', 'g');
        PKM.UI.mapBanner(D.MAPS[wp.map].name, D.MAPS[wp.map].subtitle);
      }
      return true;
    },

    setMap(mapId, tx, ty, dir) {
      const s = this.state;
      s.map = mapId;
      s.player.x = tx; s.player.y = ty;
      s.player.dir = dir || 'down';
      s.visual.x = tx * TILE; s.visual.y = ty * TILE;
      this.move = null;
      s.flags['visited_' + mapId] = true;
      this.sinceEncounter = 0;
      const waypoint = (D.WAYPOINTS || []).find(w => w.map === mapId);
      if (waypoint) this.unlockWaypoint(waypoint.id);
      PKM.AUDIO.playMusic(D.MAPS[mapId].music || 'route');
      this.autoSave();
      if (PKM.MAIN && PKM.MAIN.onMapChanged) PKM.MAIN.onMapChanged(mapId);
    },

    stopAutoMove() {
      this.autoPath = null;
      this.autoInteract = null;
    },

    faceToward(tx, ty) {
      const s = this.state;
      const dx = tx - s.player.x, dy = ty - s.player.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx > 0) s.player.dir = 'right';
        else if (dx < 0) s.player.dir = 'left';
      } else {
        if (dy > 0) s.player.dir = 'down';
        else if (dy < 0) s.player.dir = 'up';
      }
    },

    clickMove(tx, ty) {
      const s = this.state;
      if (!s || this.paused) return false;
      const map = this.currentMap();
      if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return false;
      this.clickFx = { x: tx, y: ty, t: .55 };
      const targetNpc = this.npcAt(tx, ty);
      const targetItem = this.itemAt(tx, ty);
      const targetBuilding = this.buildingAt(tx, ty);
      const targetProp = this.propAt(tx, ty);
      const tile = this.tileAt(tx, ty);
      const door = targetBuilding && targetBuilding.door && targetBuilding.door.x === tx && targetBuilding.door.y === ty;
      const sign = targetProp && (targetProp.type === 'sign' || targetProp.type === 'waypoint' || targetProp.type === 'gate');
      const water = tile === '~';
      const interactable = !!(targetNpc || targetItem || door || sign || (water && s.bag.rod));
      let goal = { x: tx, y: ty };
      let face = null;
      if (interactable) {
        const candidates = [];
        for (const d of [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }]) {
          const cx = tx + d.x, cy = ty + d.y;
          if (cx < 0 || cy < 0 || cx >= map.w || cy >= map.h) continue;
          if (!this.isSolid(cx, cy)) candidates.push({ x: cx, y: cy });
        }
        const paths = [];
        for (const c of candidates) {
          if (PKM.GUIDE) {
            const p = PKM.GUIDE.findPath(map, { x: s.player.x, y: s.player.y }, c, s);
            if (p) paths.push({ goal: c, path: p });
          }
        }
        if (!paths.length) {
          PKM.AUDIO.sfx('bump');
          return false;
        }
        paths.sort((a, b) => a.path.length - b.path.length);
        goal = paths[0].goal;
        const dx = tx - goal.x, dy = ty - goal.y;
        if (Math.abs(dx) >= Math.abs(dy)) face = dx > 0 ? 'right' : 'left';
        else face = dy > 0 ? 'down' : 'up';
      } else {
        if (this.isSolid(tx, ty)) {
          PKM.AUDIO.sfx('bump');
          return false;
        }
      }
      const path = PKM.GUIDE ? PKM.GUIDE.findPath(map, { x: s.player.x, y: s.player.y }, goal, s) : null;
      if (!path) {
        PKM.AUDIO.sfx('bump');
        return false;
      }
      this.autoPath = path.slice(1).map(p => ({ x: p.x, y: p.y }));
      this.autoInteract = interactable ? { x: tx, y: ty, face } : null;
      PKM.AUDIO.sfx('move');
      this.followAutoPath();
      return true;
    },

    followAutoPath() {
      if (this.move || !this.autoPath) return;
      if (!this.autoPath.length) {
        const ai = this.autoInteract;
        this.autoPath = null;
        this.autoInteract = null;
        if (ai) {
          this.state.player.dir = ai.face || this.state.player.dir;
          this.interact();
        }
        return;
      }
      const s = this.state;
      const next = this.autoPath[0];
      const dx = next.x - s.player.x, dy = next.y - s.player.y;
      if (Math.abs(dx) + Math.abs(dy) !== 1) { this.stopAutoMove(); return; }
      const dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
      const ok = this.tryMove(dir);
      if (ok) this.autoPath.shift();
      else this.stopAutoMove();
    },

    tryMove(dir) {
      const s = this.state;
      if (!s || this.move || this.paused) return false;
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      if (!d) return false;
      s.player.dir = dir;
      const nx = s.player.x + d[0], ny = s.player.y + d[1];
      const portal = this.portalAt(nx, ny);
      if (portal && portal.requires && !s.flags[portal.requires]) {
        PKM.AUDIO.sfx('bump');
        if (PKM.UI) PKM.UI.dialog({ speaker: '苔光结界', lines: (portal.blocked || '这里被结界挡住了。').split('\n') });
        return false;
      }
      if (this.isSolid(nx, ny)) {
        PKM.AUDIO.sfx('bump');
        s.player.bump = .14;
        return false;
      }
      this.move = {
        fromX: s.player.x, fromY: s.player.y, toX: nx, toY: ny,
        t: 0, dur: (s.player.running ? .104 : .142)
      };
      s.player.x = nx; s.player.y = ny;
      return true;
    },

    update(dt) {
      const s = this.state;
      if (!s) return;
      this.time += dt;
      this.updateTime(dt);
      if (this.clickFx) {
        this.clickFx.t -= dt;
        if (this.clickFx.t <= 0) this.clickFx = null;
      }
      if (s.player.bump > 0) s.player.bump -= dt;
      if (this.move) {
        const mv = this.move;
        mv.t += dt;
        const p = Math.min(1, mv.t / mv.dur);
        s.visual.x = (mv.fromX + (mv.toX - mv.fromX) * p) * TILE;
        s.visual.y = (mv.fromY + (mv.toY - mv.fromY) * p) * TILE;
        s.player.frame = Math.floor(mv.t / .07) % 3;
        if (p >= 1) {
          s.visual.x = mv.toX * TILE; s.visual.y = mv.toY * TILE;
          s.player.frame = 0;
          this.move = null;
          this.onStepComplete();
          if (this.autoPath && !this.move && !this.paused &&
            !(PKM.UI && PKM.UI.isBlocking())) {
            this.followAutoPath();
          }
        }
      } else {
        s.player.frame = 0;
      }
    },

    onStepComplete() {
      const s = this.state;
      s.steps++;
      this.sinceEncounter++;
      const m = this.currentMap();
      const x = s.player.x, y = s.player.y;
      // portal
      const portal = this.portalAt(x, y);
      if (portal) {
        this.stopAutoMove();
        if (this.hooks.onPortal) this.hooks.onPortal(portal);
        return;
      }
      // story trigger
      const trg = this.triggerAt(x, y);
      if (trg) {
        this.stopAutoMove();
        if (this.hooks.onTrigger) this.hooks.onTrigger(trg);
        return;
      }
      // gym rune
      if (s.map === 'gym' && !s.flags.gymGateOpen) {
        const rune = (m.props || []).find(p => p.type === 'rune' && p.x === x && p.y === y);
        if (rune && !s.runes[rune.id]) {
          s.runes[rune.id] = true;
          PKM.AUDIO.sfx('heal');
          if (PKM.UI) PKM.UI.toast('苔灯亮起了一盏', 'rune', 'g');
          const lit = Object.keys(s.runes).length;
          if (lit >= 3) {
            s.flags.gymGateOpen = true;
            PKM.AUDIO.sfx('victory');
            if (PKM.UI) PKM.UI.toast('三盏苔灯全部亮起，结界消失了', 'badge', 'g');
            this.autoSave();
          }
        }
      }
      // waypoint stone underfoot
      const wpProp = (m.props || []).find(p => p.type === 'waypoint' && p.x === x && p.y === y);
      if (wpProp) this.unlockWaypoint(wpProp.id);
      // tall grass
      const t = this.tileAt(x, y);
      if (t === ',' && this.sinceEncounter > 3) {
        const enc = this.rollEncounter(m.encounters);
        if (enc && Math.random() < .14) {
          this.sinceEncounter = 0;
          this.state.flags.encounterCooldown = 0;
          this.stopAutoMove();
          if (this.hooks.onEncounter) this.hooks.onEncounter(enc.species, enc.level, 'wild');
          return;
        }
      }
      if (this.hooks.onStep) this.hooks.onStep();
    },

    rollEncounter(table) {
      if (!table || !table.length) return null;
      let total = 0;
      table.forEach(e => total += e.weight);
      let r = Math.random() * total;
      for (const e of table) {
        r -= e.weight;
        if (r <= 0) {
          const level = e.min + Math.floor(Math.random() * (e.max - e.min + 1));
          return { species: e.species, level };
        }
      }
      return { species: table[0].species, level: table[0].min };
    },

    rollFishing() {
      const m = this.currentMap();
      return this.rollEncounter(m.fishing);
    },

    facing() {
      const s = this.state;
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[s.player.dir];
      return { x: s.player.x + d[0], y: s.player.y + d[1] };
    },

    interact() {
      const s = this.state;
      if (!s || this.move || this.paused) return;
      this.autoPath = null;
      this.autoInteract = null;
      const f = this.facing();
      const npc = this.npcAt(f.x, f.y);
      if (npc) {
        if (PKM.UI) PKM.UI.npcInteract(npc);
        return;
      }
      const b = this.buildingAt(f.x, f.y);
      if (b && b.door && b.door.x === f.x && b.door.y === f.y) {
        this.interactBuilding(b);
        return;
      }
      const p = this.propAt(f.x, f.y);
      if (p) {
        if (p.type === 'sign') {
          if (PKM.UI) PKM.UI.dialog({ speaker: '木牌', lines: p.text });
          return;
        }
        if (p.type === 'waypoint') {
          const wp = (D.WAYPOINTS || []).find(w => w.id === p.id);
          if (wp) {
            this.unlockWaypoint(wp.id);
            if (PKM.UI) {
              PKM.UI.toast(`${wp.name} · 已记录为传送点`, 'waypoint', 'g');
              PKM.UI.openMap();
            }
          }
          return;
        }
        if (p.type === 'gate') {
          if (PKM.UI) PKM.UI.dialog({ speaker: '苔光结界', lines: ['结界里浮着三枚叶影。', '踩亮馆内的三盏苔灯，它就会消失。'] });
          return;
        }
      }
      const it = this.itemAt(f.x, f.y);
      if (it) {
        this.state.flags['item_' + s.map + '_' + it.id] = true;
        this.addItem(it.item, it.qty || 1, true);
        PKM.AUDIO.sfx('sparkle');
        if (PKM.UI) PKM.UI.toast(`拾取了 ${D.ITEMS[it.item].name} ×${it.qty || 1}`, it.item, 'item');
        this.autoSave();
        return;
      }
      const t = this.tileAt(f.x, f.y);
      if (t === '~') {
        if (!s.bag.rod) {
          if (PKM.UI) PKM.UI.dialog({ speaker: '水面', lines: ['水面泛着细碎的光。', '或许需要一根钓竿。'] });
        } else if (PKM.UI) {
          PKM.UI.startFishing();
        }
        return;
      }
      if (t === '#' || t === 'T') {
        if (PKM.UI) PKM.UI.dialog({ speaker: '树影', lines: ['树叶沙沙响了一声。', '有只小虫从树皮上爬过去。'] });
        return;
      }
      // face something empty: small flavor
      if (PKM.UI && Math.random() < .08) PKM.UI.toast('风吹过草叶……', null, '');
    },

    interactBuilding(b) {
      const s = this.state;
      switch (b.type) {
        case 'shop':
          if (PKM.UI) PKM.UI.openShop(b.id === 'shop' ? 'town' : (s.flags.badge ? 'brook_late' : 'brook'));
          break;
        case 'heal':
          PKM.HEAL.open(b.id);
          break;
        case 'home':
          if (b.id === 'home') {
            if (PKM.UI) PKM.UI.dialog({
              speaker: '家门', lines: ['门轴发出熟悉的吱呀声。', '屋里飘着炖菜的香气。', '妈妈把伙伴们抱到暖炉旁，让它们好好休息。'],
              onDone: () => { this.healParty(); if (PKM.UI) PKM.UI.toast('伙伴们恢复了精神', 'heal', 'g'); }
            });
          } else {
            if (PKM.UI) PKM.UI.dialog({ speaker: '老屋', lines: ['门锁着。窗台上摆着一排晒干的苔草。', '门缝里透出淡淡的木头香。'] });
          }
          break;
        case 'gym':
          if (PKM.UI) PKM.UI.fadeTransition(() => {
            this.setMap('gym', 9, 14, 'up');
            if (PKM.UI) PKM.UI.mapBanner('森语道馆', '三盏苔灯，一束心光');
          });
          break;
        case 'shrine':
          if (PKM.UI) PKM.UI.shrineEvent();
          break;
        case 'lab':
          if (PKM.UI) PKM.UI.dialog({ speaker: '研究所', lines: ['门虚掩着，里面传来纸张翻动的声音。', '苔爷爷似乎更喜欢在门外晒太阳。'] });
          break;
        case 'gate':
          break;
        default:
          if (PKM.UI) PKM.UI.dialog({ speaker: '门', lines: ['门锁着。'] });
      }
    },

    /* ---------- 对话效果 ---------- */
    applyEffect(effect) {
      if (!effect) return;
      const s = this.state;
      switch (effect.type) {
        case 'heal':
          PKM.HEAL.open('npc');
          break;
        case 'shop':
          if (PKM.UI) PKM.UI.openShop(effect.shop);
          break;
        case 'give':
          this.addItem(effect.item, effect.qty || 1);
          if (PKM.UI) PKM.UI.toast(`获得了 ${D.ITEMS[effect.item].name} ×${effect.qty || 1}`, effect.item);
          break;
        case 'give_rod':
          s.bag.rod = 1;
          this.autoSave();
          if (PKM.UI) PKM.UI.toast('获得了 旧钓竿', 'rod');
          break;
        case 'hairpin':
          this.removeItem('hairpin', 1);
          s.flags.hairpinDone = true;
          if (s.trackedQuest === 'hairpin') s.trackedQuest = 'main';
          this.addItem('greatball', 3);
          this.addItem('potion', 1);
          s.money += 300;
          this.autoSave();
          if (PKM.UI) PKM.UI.toast('任务完成：遗落的发夹', 'quest');
          break;
        case 'musician':
          this.removeItem('berry', 2);
          s.flags.musicianDone = true;
          if (s.trackedQuest === 'musician') s.trackedQuest = 'main';
          s.money += 500;
          this.addItem('superpotion', 1);
          this.autoSave();
          if (PKM.UI) PKM.UI.toast('任务完成：橙橙果的旋律', 'quest');
          break;
        case 'researcher':
          s.flags.researcherDone = true;
          if (s.trackedQuest === 'researcher') s.trackedQuest = 'main';
          this.addItem('ultraball', 3);
          this.autoSave();
          if (PKM.UI) PKM.UI.toast('任务完成：森林观察员', 'quest');
          break;
        case 'fisher':
          s.flags.fisherDone = true;
          if (s.trackedQuest === 'fisher') s.trackedQuest = 'main';
          this.addItem('pearl', 1);
          s.money += 400;
          this.autoSave();
          if (PKM.UI) PKM.UI.toast('任务完成：水边的证明', 'quest');
          break;
        case 'glen_lantern':
          s.flags.glenLanternDone = true;
          if (s.trackedQuest === 'glen_lantern') s.trackedQuest = 'main';
          this.addItem('ultraball', 2);
          s.money += 600;
          this.autoSave();
          if (PKM.UI) PKM.UI.toast('任务完成：溪谷的灯', 'quest');
          break;
        case 'mist_bell':
          this.removeItem('windbell', 1);
          s.flags.mistBellDone = true;
          if (s.trackedQuest === 'mist_bell') s.trackedQuest = 'main';
          s.money += 900;
          this.addItem('revive', 1);
          this.autoSave();
          if (PKM.UI) PKM.UI.toast('任务完成：山顶的松风铃', 'quest');
          break;
      }
    },

    useMedicine(index, itemId) {
      const s = this.state;
      const mon = s.party[index];
      const item = D.ITEMS[itemId];
      if (!mon || !item) return { ok: false, msg: '没有可以使用的对象。' };
      if (item.revive) {
        if (mon.hp > 0) return { ok: false, msg: `${this.nameOf(mon)}并没有昏厥。` };
        mon.hp = Math.max(1, Math.floor(mon.maxHp * item.revive));
        this.removeItem(itemId, 1);
        return { ok: true, msg: `${this.nameOf(mon)}恢复了体力！` };
      }
      if (item.heal) {
        if (mon.hp <= 0) return { ok: false, msg: `${this.nameOf(mon)}已经昏厥，需要活力块。` };
        if (mon.hp >= mon.maxHp && (!item.cure || !mon.status)) return { ok: false, msg: `体力已经是满的。` };
        const heal = Math.min(item.heal, mon.maxHp - mon.hp);
        mon.hp += heal;
        if (item.cure) { mon.status = null; mon.statusTurns = 0; }
        this.removeItem(itemId, 1);
        return { ok: true, msg: `${this.nameOf(mon)}回复了 ${heal} 点体力${item.cure ? '，状态也恢复了' : ''}。` };
      }
      if (item.cure) {
        if (!mon.status) return { ok: false, msg: `${this.nameOf(mon)}没有异常状态。` };
        mon.status = null; mon.statusTurns = 0;
        this.removeItem(itemId, 1);
        return { ok: true, msg: `${this.nameOf(mon)}的异常状态解除了。` };
      }
      if (item.pp) {
        const move = mon.moves.find(m => m.pp < m.maxPp);
        if (!move) return { ok: false, msg: '所有招式的 PP 都是满的。' };
        move.pp = Math.min(move.maxPp, move.pp + item.pp);
        this.removeItem(itemId, 1);
        return { ok: true, msg: `${D.MOVES[move.id].name}的 PP 回复了。` };
      }
      return { ok: false, msg: '现在不能使用这个道具。' };
    },

    /* ---------- 存档 ---------- */
    saveData() {
      const s = this.state;
      if (!s) return false;
      try {
        const data = JSON.parse(JSON.stringify(s));
        delete data.visual;
        delete data.hour;
        delete data.night;
        localStorage.setItem(SAVE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
        this.lastSave = Date.now();
        return true;
      } catch (e) {
        console.error('save failed', e);
        return false;
      }
    },

    autoSave() {
      if (!this.state) return;
      this.saveData();
    },

    hasSave() {
      try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
    },

    loadData() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.data || !parsed.data.party) return null;
        return parsed;
      } catch (e) { return null; }
    },

    load() {
      const parsed = this.loadData();
      if (!parsed) return false;
      const s = parsed.data;
      s.settings = Object.assign({ music: true, sfx: true, speed: 1, guide: true }, s.settings || {});
      s.flags = s.flags || {};
      s.bag = s.bag || {};
      s.waypoints = s.waypoints || { town_inn: true };
      (D.WAYPOINTS || []).forEach(w => {
        if (s.flags['visited_' + w.map]) s.waypoints[w.id] = true;
      });
      s.trackedQuest = s.trackedQuest || 'main';
      s.dexSeen = s.dexSeen || {};
      s.dexCaught = s.dexCaught || {};
      s.pc = s.pc || [];
      s.runes = s.runes || {};
      s.badges = s.badges || [];
      s.clock = s.clock || 7 * 60 + 20;
      s.hour = s.clock / 60;
      s.night = s.hour >= 19 || s.hour < 6;
      s.achievements = s.achievements || {};
      s.trainerWins = s.trainerWins || 0;
      if (!s.visual) s.visual = { x: s.player.x * TILE, y: s.player.y * TILE };
      this.state = s;
      (s.party || []).forEach(m => this.normalizeMon(m));
      (s.pc || []).forEach(m => this.normalizeMon(m));
      this.move = null;
      this.sinceEncounter = 0;
      return true;
    },

    deleteSave() {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    },

    /* ---------- 成就 ---------- */
    checkAchievements() {
      const s = this.state;
      if (!s || !D.ACHIEVEMENTS) return [];
      s.achievements = s.achievements || {};
      const unlocked = [];
      for (const a of D.ACHIEVEMENTS) {
        if (s.achievements[a.id]) continue;
        let ok = false;
        try { ok = !!a.cond(s, this); } catch (e) { ok = false; }
        if (!ok) continue;
        s.achievements[a.id] = Date.now();
        const reward = a.reward || {};
        if (reward.money) s.money += reward.money;
        if (reward.item) s.bag[reward.item] = (s.bag[reward.item] || 0) + (reward.qty || 1);
        unlocked.push(a);
      }
      if (unlocked.length) this.autoSave();
      return unlocked;
    },

    achievementCount() {
      const s = this.state;
      if (!s || !s.achievements) return 0;
      return Object.keys(s.achievements).length;
    },

    /* ---------- 任务 ---------- */
    questState(id) {
      const s = this.state;
      if (id === 'main') {
        if (s.flags.legendaryCaught) return { status: 'done', hint: '森林的黎明已经完整。可以继续旅行，或回家看看。' };
        if (s.flags.forestCleared) return { status: 'done', hint: '森林的光已经恢复。祭坛深处，似乎还有一道沉睡的光。' };
        if (s.flags.bossDefeated) return { status: 'active', hint: '回到森林祭坛，见证最后的黎明。' };
        if (s.flags.shadowDefeated) return { status: 'active', hint: '阴影退去，但祭坛里的守护者仍在躁动。' };
        if (s.flags.badge) return { status: 'active', hint: '穿过萤火森林，抵达最深处的心脏祭坛。' };
        if (s.flags.rival1Defeated) return { status: 'active', hint: '前往东边的溪桥镇，挑战森语道馆的苔音。' };
        if (s.flags.rivalSceneDone) return { status: 'active', hint: '沿着微风小径向北，进入萤火森林。' };
        return { status: 'active', hint: '离开青苔镇，沿着微风小径向北走。' };
      }
      if (id === 'hairpin') {
        if (s.flags.hairpinDone) return { status: 'done', hint: '苔花发夹已经回到小满手中。' };
        if (this.countItem('hairpin')) return { status: 'ready', hint: '把苔花发夹带回溪桥镇交给小满。' };
        return { status: 'active', hint: '在微风小径的草丛附近寻找会发光的苔花发夹。' };
      }
      if (id === 'musician') {
        if (s.flags.musicianDone) return { status: 'done', hint: '乐师写出了新的旋律。' };
        if (this.countItem('berry') >= 2) return { status: 'ready', hint: '把 2 颗橙橙果交给溪桥镇的流浪乐师。' };
        return { status: 'active', hint: `收集 2 颗橙橙果（${this.countItem('berry')}/2）。` };
      }
      if (id === 'researcher') {
        if (s.flags.researcherDone) return { status: 'done', hint: '图鉴数据已经交给了晨跑者。' };
        const n = Object.keys(s.dexCaught).length;
        if (n >= 6) return { status: 'ready', hint: `向溪桥镇的晨跑者展示图鉴（${n}/6）。` };
        return { status: 'active', hint: `捕获 6 种不同的宝可梦（${n}/6）。` };
      }
      if (id === 'fisher') {
        if (s.flags.fisherDone) return { status: 'done', hint: '阿河很满意你带来的水边伙伴。' };
        if (!s.bag.rod) return { status: 'active', hint: '和溪桥镇水边的阿河聊聊，拿到旧钓竿。' };
        if (s.party.some(m => D.SPECIES[m.species].types.includes('water'))) return { status: 'ready', hint: '带着水属性宝可梦去找阿河。' };
        return { status: 'active', hint: '在溪边钓起一只水属性宝可梦。' };
      }
      if (id === 'glen_lantern') {
        if (s.flags.glenLanternDone) return { status: 'done', hint: '小灯拍到了溪谷的灯。' };
        if (s.dexCaught && s.dexCaught.lanternfish) return { status: 'ready', hint: '带着灯鳍鱼的图鉴记录去找溪谷的小灯。' };
        return { status: 'active', hint: '在萤光溪谷的水边寻找灯鳍鱼。' };
      }
      if (id === 'mist_bell') {
        if (s.flags.mistBellDone) return { status: 'done', hint: '松风铃回到了画家手中。' };
        if ((s.bag.windbell || 0) > 0) return { status: 'ready', hint: '把松风铃带回雾松山道交给松岚。' };
        return { status: 'active', hint: '在雾松山道山顶附近寻找旧铜铃。' };
      }
      return { status: 'hidden', hint: '' };
    },

    activeQuests() {
      return Object.keys(D.QUESTS).filter(id => this.questState(id).status !== 'hidden');
    },

    mainHint() {
      return this.questState('main').hint;
    },

    /* ---------- 类型 ---------- */
    effectiveness(moveType, defenderTypes) {
      let mult = 1;
      const chart = D.TYPE_CHART[moveType] || {};
      defenderTypes.forEach(t => {
        const m = chart[t];
        if (m !== undefined) mult *= m;
      });
      return mult;
    },

    /* ---------- 迁移/重开 ---------- */
    respawnAtHeal() {
      const s = this.state;
      const lost = Math.min(s.money, Math.floor(s.money * .12));
      s.money -= lost;
      this.healParty();
      this.setMap('town', 24, 17, 'up');
      if (PKM.UI) {
        PKM.UI.fadeTransition(() => {
          PKM.UI.dialog({
            speaker: '驿站看护',
            lines: ['看护：你们倒在路边，是路过的采药人把你们送回来的。', `伙伴们已经没事了。不过……钱包里少了 ${lost} 金币。`, '下次出发前，记得多带些伤药。']
          });
        });
      }
    }
  };

  function sFlag(state, f) { return !!state.flags[f]; }

  PKM.GAME = GAME;
})();
