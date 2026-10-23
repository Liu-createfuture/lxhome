/* ============================================================
   旅途导航：任务目标、跨地图路线、BFS 引导线与快速移动
   ============================================================ */
window.PKM = window.PKM || {};

(function () {
  const PKM = window.PKM;
  const D = PKM.DATA;
  const G = PKM.GAME;

  const DIRS = [
    { dx: 0, dy: -1, name: '北' }, { dx: 1, dy: -1, name: '东北' },
    { dx: 1, dy: 0, name: '东' }, { dx: 1, dy: 1, name: '东南' },
    { dx: 0, dy: 1, name: '南' }, { dx: -1, dy: 1, name: '西南' },
    { dx: -1, dy: 0, name: '西' }, { dx: -1, dy: -1, name: '西北' }
  ];

  const GUIDE = {
    current: null,
    key: '',
    lastRefresh: 0,

    target() {
      const s = G.state;
      if (!s) return null;
      const tracked = s.trackedQuest || 'main';
      let t = tracked === 'main' ? this.mainTarget(s) : this.questTarget(tracked, s);
      if (!t && tracked !== 'main') t = this.mainTarget(s);
      if (!t) return null;
      const map = D.MAPS[t.map];
      return Object.assign({ mapName: map ? map.name : '未知之地' }, t);
    },

    mainTarget(s) {
      if (!s.flags.dexGiven) {
        return { map: 'town', x: 8, y: 7, label: '苔爷爷', kind: 'npc', quest: 'main' };
      }
      if (!s.flags.rival1Defeated) {
        return { map: 'route', x: 18, y: 21, label: '小岚', kind: 'npc', quest: 'main' };
      }
      if (!s.flags.badge) {
        if (s.map === 'gym') {
          if (!s.flags.gymGateOpen) {
            const runes = [{ id: 'rune1', x: 3, y: 9 }, { id: 'rune2', x: 8, y: 9 }, { id: 'rune3', x: 13, y: 9 }];
            const rune = runes.find(r => !s.runes[r.id]) || runes[0];
            return { map: 'gym', x: rune.x, y: rune.y, label: '未亮的苔灯', kind: 'rune', quest: 'main' };
          }
          return { map: 'gym', x: 9, y: 4, label: '馆主苔音', kind: 'npc', quest: 'main' };
        }
        return { map: 'brook', x: 23, y: 8, label: '森语道馆', kind: 'place', quest: 'main' };
      }
      if (!s.flags.forestCleared) {
        return { map: 'forest', x: 16, y: 5, label: '森林祭坛', kind: 'place', quest: 'main' };
      }
      if (!s.flags.legendaryCaught) {
        return { map: 'forest', x: 16, y: 5, label: '沉睡的光', kind: 'legend', quest: 'main' };
      }
      return null;
    },

    questTarget(id, s) {
      if (id === 'hairpin') {
        if (s.flags.hairpinDone) return null;
        if ((s.bag.hairpin || 0) > 0) return { map: 'brook', x: 9, y: 9, label: '小满', kind: 'npc', quest: id };
        return { map: 'route', x: 9, y: 20, label: '苔花发夹', kind: 'item', quest: id };
      }
      if (id === 'musician') {
        if (s.flags.musicianDone) return null;
        if ((s.bag.berry || 0) >= 2) return { map: 'brook', x: 10, y: 14, label: '流浪乐师', kind: 'npc', quest: id };
        if (!s.flags['item_route_route_berry']) return { map: 'route', x: 12, y: 23, label: '橙橙果', kind: 'item', quest: id };
        if (!s.flags['item_town_town_berry']) return { map: 'town', x: 10, y: 15, label: '橙橙果', kind: 'item', quest: id };
        return { map: 'town', x: 25, y: 6, label: '青苔杂货铺', kind: 'place', quest: id };
      }
      if (id === 'researcher') {
        if (s.flags.researcherDone) return null;
        if (Object.keys(s.dexCaught || {}).length >= 6) return { map: 'brook', x: 26, y: 11, label: '晨跑者', kind: 'npc', quest: id };
        return { map: 'route', x: 10, y: 12, label: '微风小径草丛', kind: 'grass', quest: id };
      }
      if (id === 'fisher') {
        if (s.flags.fisherDone) return null;
        if (!s.bag.rod) return { map: 'brook', x: 18, y: 18, label: '钓鱼佬阿河', kind: 'npc', quest: id };
        const hasWater = (s.party || []).some(m => D.SPECIES[m.species].types.includes('water'));
        if (hasWater) return { map: 'brook', x: 18, y: 18, label: '钓鱼佬阿河', kind: 'npc', quest: id };
        return { map: 'brook', x: 14, y: 11, label: '桥边水面', kind: 'water', quest: id };
      }
      if (id === 'glen_lantern') {
        if (s.flags.glenLanternDone) return null;
        if (s.dexCaught && s.dexCaught.lanternfish) return { map: 'glen', x: 24, y: 16, label: '摄影师小灯', kind: 'npc', quest: id };
        if (s.bag.rod) return { map: 'glen', x: 20, y: 15, label: '溪谷水面', kind: 'water', quest: id };
        return { map: 'glen', x: 18, y: 7, label: '溪谷草丛', kind: 'grass', quest: id };
      }
      if (id === 'mist_bell') {
        if (s.flags.mistBellDone) return null;
        if ((s.bag.windbell || 0) > 0) return { map: 'mist', x: 21, y: 3, label: '画家松岚', kind: 'npc', quest: id };
        return { map: 'mist', x: 23, y: 2, label: '松风铃', kind: 'item', quest: id };
      }
      return null;
    },

    walkable(x, y, map, state) {
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
      const t = map.tiles[y][x];
      if (D.TILE_SOLID[t]) return false;
      const b = (map.buildings || []).find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
      if (b && b.type !== 'gate' && b.type !== 'shelter') return false;
      const npc = D.NPCS.find(n => n.map === map.id && n.x === x && n.y === y && !(n.hideFlag && state.flags[n.hideFlag]));
      if (npc) return false;
      const prop = (map.props || []).find(p => p.x === x && p.y === y && (p.type === 'sign' || (p.type === 'gate' && !state.flags.gymGateOpen)));
      if (prop) return false;
      return true;
    },

    findPath(map, start, goal, state) {
      if (!map || !start || !goal) return null;
      if (start.x === goal.x && start.y === goal.y) return [{ x: start.x, y: start.y }];
      const key = (x, y) => y * map.w + x;
      const queue = [{ x: start.x, y: start.y }];
      const prev = new Map();
      prev.set(key(start.x, start.y), null);
      let head = 0, found = false;
      while (head < queue.length) {
        const cur = queue[head++];
        if (cur.x === goal.x && cur.y === goal.y) { found = true; break; }
        for (const d of DIRS.slice(0, 8)) {
          if (d.dx && d.dy) continue;
          const nx = cur.x + d.dx, ny = cur.y + d.dy;
          if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
          const k = key(nx, ny);
          if (prev.has(k)) continue;
          if (!this.walkable(nx, ny, map, state) && !(nx === goal.x && ny === goal.y)) continue;
          prev.set(k, cur);
          queue.push({ x: nx, y: ny });
        }
      }
      if (!found) {
        // try a neighbouring approach tile for solid objectives
        for (const d of DIRS.slice(0, 8)) {
          if (d.dx && d.dy) continue;
          const nx = goal.x + d.dx, ny = goal.y + d.dy;
          if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
          if (!this.walkable(nx, ny, map, state)) continue;
          return this.findPath(map, start, { x: nx, y: ny }, state);
        }
        return null;
      }
      const path = [];
      let cur = { x: goal.x, y: goal.y };
      while (cur) {
        path.push({ x: cur.x, y: cur.y });
        cur = prev.get(key(cur.x, cur.y));
      }
      path.reverse();
      return path;
    },

    mapRoute(currentMap, targetMap) {
      if (currentMap === targetMap) return [currentMap];
      const prev = new Map();
      const visited = new Set([currentMap]);
      const queue = [currentMap];
      let head = 0;
      while (head < queue.length) {
        const cur = queue[head++];
        const map = D.MAPS[cur];
        for (const p of map.portals || []) {
          if (visited.has(p.to)) continue;
          visited.add(p.to);
          prev.set(p.to, cur);
          if (p.to === targetMap) {
            const route = [targetMap];
            let x = targetMap;
            while (prev.has(x)) { x = prev.get(x); route.unshift(x); }
            return route;
          }
          queue.push(p.to);
        }
      }
      return null;
    },

    nextPortal(currentMap, targetMap, state) {
      if (currentMap === targetMap) return null;
      const visited = new Set([currentMap]);
      const queue = [{ map: currentMap, first: null }];
      let head = 0;
      while (head < queue.length) {
        const cur = queue[head++];
        const map = D.MAPS[cur.map];
        const portals = map.portals || [];
        for (const p of portals) {
          const first = cur.first || p;
          if (p.to === targetMap) return first;
          if (!visited.has(p.to)) {
            visited.add(p.to);
            queue.push({ map: p.to, first });
          }
        }
      }
      return null;
    },

    directionOf(dx, dy) {
      if (!dx && !dy) return { name: '抵达', angle: 0 };
      let best = DIRS[0], bestDot = -Infinity;
      const len = Math.hypot(dx, dy) || 1;
      for (const d of DIRS) {
        const dot = (d.dx * dx + d.dy * dy) / len;
        if (dot > bestDot) { bestDot = dot; best = d; }
      }
      return { name: best.name, angle: Math.atan2(dy, dx) * 180 / Math.PI };
    },

    refresh(force) {
      const s = G.state;
      if (!s) { this.current = null; return null; }
      const target = this.target();
      const enabled = !s.settings || s.settings.guide !== false;
      const targetKey = target ? `${target.quest}:${target.map}:${target.x}:${target.y}` : 'none';
      const key = `${s.map}:${s.player.x}:${s.player.y}:${s.trackedQuest}:${enabled}:${targetKey}:${Object.keys(s.waypoints || {}).join(',')}`;
      if (!force && key === this.key) return this.current;
      this.key = key;
      if (!target) {
        this.current = { enabled, target: null, path: null, sameMap: false, distance: 0, direction: null };
        return this.current;
      }
      if (!enabled) {
        this.current = { enabled: false, target, path: null, sameMap: target.map === s.map, distance: 0, direction: null };
        return this.current;
      }
      let sameMap = target.map === s.map;
      let localTarget = { x: target.x, y: target.y };
      let transfer = null;
      if (!sameMap) {
        const portal = this.nextPortal(s.map, target.map, s);
        if (!portal) {
          this.current = { enabled, target, path: null, sameMap: false, distance: 0, direction: null, unreachable: true };
          return this.current;
        }
        transfer = portal;
        localTarget = { x: portal.x + Math.floor((portal.w || 1) / 2), y: portal.y + Math.floor((portal.h || 1) / 2) };
        if (!this.walkable(localTarget.x, localTarget.y, D.MAPS[s.map], s)) {
          localTarget = { x: portal.x, y: portal.y };
        }
      }
      const map = D.MAPS[s.map];
      const path = this.findPath(map, { x: s.player.x, y: s.player.y }, localTarget, s);
      if (!path) {
        this.current = { enabled, target, path: null, sameMap, distance: 0, direction: null, transfer, unreachable: true };
        return this.current;
      }
      const step = path[1] || path[0];
      const direction = this.directionOf(step.x - s.player.x, step.y - s.player.y);
      this.current = {
        enabled, target, path, sameMap, transfer,
        localTarget,
        distance: Math.max(0, path.length - 1),
        direction
      };
      return this.current;
    }
  };

  PKM.GUIDE = GUIDE;
})();
