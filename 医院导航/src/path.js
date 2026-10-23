/* ============================================================================
 * path.js  —  院区路径规划（Dijkstra + 分步指引文本）
 * 支持：同层、跨层（电梯/扶梯/楼梯）、跨楼栋（连廊）
 * 对应 PRD 6.2 POST /api/route/calc
 * ========================================================================== */
const PathFinder = (function () {
  'use strict';

  const PROFILE = {
    normal:      { corridor: 1.0, stairs: 1.15, escalator: 1.10, lift: 3.2, barrierLift: 3.2, emergency: 1.2, bridge: 1.0 },
    barrierFree: { corridor: 1.0, stairs: null, escalator: null, lift: 2.4, barrierLift: 1.0, emergency: null, bridge: 1.0 },
    emergency:   { corridor: 2.4, stairs: 1.8, escalator: 1.8, lift: 2.6, barrierLift: 2.6, emergency: 0.35, bridge: 1.4 }
  };

  const CHANNEL_NAME = {
    corridor: '走廊', stairs: '楼梯', escalator: '自动扶梯',
    lift: '客梯', barrierLift: '无障碍电梯', emergency: '急救通道', bridge: '连廊'
  };

  const RIDE_TIME = { lift: 22, barrierLift: 26, escalator: 14, stairs: 35 };
  const WALK_SPEED = 1.15;

  /* ---------------- 全院区图 ---------------- */
  let graph = null;

  function buildGraph() {
    if (graph) return graph;
    const nodes = {}, adj = {};

    function key(floorId, nodeId) { return floorId + ':' + nodeId; }
    function addEdge(a, b, dist, channel, vertical) {
      if (!adj[a] || !adj[b]) return;
      adj[a].push({ to: b, dist: dist, channel: channel, vertical: !!vertical });
      adj[b].push({ to: a, dist: dist, channel: channel, vertical: !!vertical });
    }

    Data.BUILDINGS.forEach(function (b) {
      b.floors.forEach(function (f) {
        const net = Data.getNet(f.id);
        net.nodes.forEach(function (n) {
          const k = key(f.id, n.id);
          nodes[k] = {
            key: k, nodeId: n.id,
            x: n.x, z: n.z,                    // 楼层局部坐标
            wx: n.x + f.ox, wz: n.z + f.oz,    // 院区坐标
            y: f.y,
            floorId: f.id, level: f.level
          };
          adj[k] = [];
        });
        net.edges.forEach(function (e) {
          addEdge(key(f.id, e.from), key(f.id, e.to), e.dist, e.channel);
        });
      });

      Data.verticalEdges(b).forEach(function (v) {
        addEdge(key(v.fromFloor, v.from), key(v.toFloor, v.to), v.dist, v.channel, true);
      });
    });

    Data.BRIDGES.forEach(function (br) {
      const a = key(br.fromFloor, br.fromNode);
      const b = key(br.toFloor, br.toNode);
      if (!nodes[a] || !nodes[b]) return;
      const dist = Math.sqrt(Math.pow(nodes[a].wx - nodes[b].wx, 2) + Math.pow(nodes[a].wz - nodes[b].wz, 2));
      addEdge(a, b, Math.round(dist * 10) / 10, 'bridge');
    });

    graph = { nodes: nodes, adj: adj };
    return graph;
  }

  /* ---------------- 最小堆 ---------------- */
  function Heap() { this.a = []; }
  Heap.prototype.push = function (item) {
    const a = this.a; a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      const t = a[p]; a[p] = a[i]; a[i] = t; i = p;
    }
  };
  Heap.prototype.pop = function () {
    const a = this.a;
    if (!a.length) return null;
    const top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        const t = a[m]; a[m] = a[i]; a[i] = t; i = m;
      }
    }
    return top;
  };

  /* ---------------- 规划 ---------------- */
  function calc(startPoiId, endPoiId, routeType) {
    const startPoi = Data.getPoi(startPoiId);
    const endPoi = Data.getPoi(endPoiId);
    if (!startPoi || !endPoi) return { error: '起点或终点不存在' };
    if (startPoi.id === endPoi.id) return { error: '起点与终点相同' };

    const profile = PROFILE[routeType] || PROFILE.normal;
    const g = buildGraph();
    const sKey = startPoi.floorId + ':' + startPoi.nodeId;
    const eKey = endPoi.floorId + ':' + endPoi.nodeId;
    if (!g.nodes[sKey] || !g.nodes[eKey]) return { error: '点位未绑定路网节点，请联系管理员' };

    const dist = {}, prev = {}, visited = {};
    dist[sKey] = 0;
    const heap = new Heap();
    heap.push({ key: sKey, f: 0 });
    let guard = 0;
    while (heap.a.length && guard++ < 40000) {
      const cur = heap.pop();
      if (visited[cur.key]) continue;
      visited[cur.key] = true;
      if (cur.key === eKey) break;
      const edges = g.adj[cur.key] || [];
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const factor = profile[e.channel];
        if (factor === null || factor === undefined) continue;
        const cost = e.dist * factor + (e.vertical ? 4 : 0);
        const nd = dist[cur.key] + cost;
        if (dist[e.to] === undefined || nd < dist[e.to]) {
          dist[e.to] = nd;
          prev[e.to] = { from: cur.key, edge: e };
          heap.push({ key: e.to, f: nd });
        }
      }
    }
    if (dist[eKey] === undefined) {
      return { error: routeType === 'barrierFree' ? '无可通行无障碍路线，请联系服务台' : '未找到可通行路线' };
    }

    const keys = [];
    let k = eKey;
    while (k) {
      keys.unshift(k);
      const p = prev[k];
      k = p ? p.from : null;
    }
    const pathNodes = keys.map(function (key) {
      const n = g.nodes[key];
      return { key: key, x: n.x, z: n.z, wx: n.wx, wz: n.wz, y: n.y, floorId: n.floorId, level: n.level };
    });

    let totalDist = 0;
    const pathEdges = [];
    for (let i = 1; i < keys.length; i++) {
      const e = prev[keys[i]].edge;
      pathEdges.push(e);
      totalDist += e.dist;
    }

    let time = totalDist / WALK_SPEED;
    pathEdges.forEach(function (e) {
      if (e.vertical) time += RIDE_TIME[e.channel] || 20;
    });

    const steps = buildSteps(pathNodes, pathEdges, startPoi, endPoi);

    /* 按楼层切分（局部坐标，用于各楼层组内绘制） */
    const segments = {};
    pathNodes.forEach(function (n) {
      if (!segments[n.floorId]) segments[n.floorId] = [];
      segments[n.floorId].push({ x: n.x, z: n.z, y: n.y });
    });

    /* 3D 院区坐标序列（小人行走） */
    const points3d = pathNodes.map(function (n) {
      return { x: n.wx, y: n.y, z: n.wz, floorId: n.floorId };
    });

    return {
      totalDistance: Math.round(totalDist),
      estimatedTime: Math.round(time),
      steps: steps,
      segments: segments,
      floors: Object.keys(segments),
      points3d: points3d,
      startPoi: startPoi,
      endPoi: endPoi,
      routeType: routeType,
      crossBuilding: startPoi.buildingId !== endPoi.buildingId
    };
  }

  /* ---------------- 分步文本 ---------------- */
  function angleOf(a, b) { return Math.atan2(b.z - a.z, b.x - a.x); }

  function buildSteps(pathNodes, pathEdges, startPoi, endPoi) {
    const steps = [];
    let run = null;
    let turn = null;
    let afterRide = null;
    let seq = 1;

    function push(step) { step.n = seq++; steps.push(step); }

    function flush() {
      if (!run || run.dist < 0.8) { run = null; turn = null; return; }
      const d = Math.max(1, Math.round(run.dist));
      let text;
      if (afterRide === '连廊') {
        text = (turn ? '出连廊' + turn + '，' : '出连廊后') + '直行 ' + d + ' 米';
        afterRide = null;
      } else if (afterRide) {
        text = (turn ? '出电梯后' + turn + '，' : '出电梯后') + '直行 ' + d + ' 米';
        afterRide = null;
      } else if (turn) {
        text = (run.finalRun ? turn : turn + '进入走廊') + '，直行 ' + d + ' 米';
      } else {
        text = (seq === 1 ? '向前直行 ' : '继续直行 ') + d + ' 米';
      }
      push({ text: text, dist: d, point: run.point, floorId: run.floorId });
      run = null;
      turn = null;
    }

    for (let i = 0; i < pathEdges.length; i++) {
      const e = pathEdges[i];
      const from = pathNodes[i], to = pathNodes[i + 1];

      if (e.vertical) {
        flush();
        const tf = Data.getFloor(to.floorId);
        push({
          text: '乘坐' + (CHANNEL_NAME[e.channel] || '电梯') + '前往 ' + tf.level + ' 楼',
          type: 'vertical', channel: e.channel,
          fromFloor: from.floorId, toFloor: to.floorId,
          point: { x: to.x, z: to.z, floorId: to.floorId }
        });
        afterRide = '电梯';
        turn = null;
        continue;
      }

      if (e.channel === 'bridge') {
        flush();
        const tf = Data.getFloor(to.floorId);
        push({
          text: '经 ' + tf.level + ' 层连廊前往' + tf.buildingName,
          type: 'bridge',
          fromFloor: from.floorId, toFloor: to.floorId,
          point: { x: to.x, z: to.z, floorId: to.floorId }
        });
        afterRide = '连廊';
        turn = null;
        continue;
      }

      const dir = angleOf(from, to);
      if (!run) {
        run = { dist: 0, dir: dir, point: { x: from.x, z: from.z, floorId: from.floorId }, floorId: from.floorId };
      } else {
        let delta = dir - run.dir;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        if (Math.abs(delta) > 0.55) {
          const cross = Math.cos(run.dir) * Math.sin(dir) - Math.sin(run.dir) * Math.cos(dir);
          flush();
          turn = cross > 0 ? '右转' : '左转';
          run = { dist: 0, dir: dir, point: { x: from.x, z: from.z, floorId: from.floorId }, floorId: from.floorId };
        } else {
          run.dir = run.dir * 0.5 + dir * 0.5;
        }
      }
      if (i === pathEdges.length - 1) run.finalRun = true;
      run.dist += e.dist;
    }
    flush();

    push({
      text: '到达：' + endPoi.name,
      type: 'arrive',
      point: { x: endPoi.x, z: endPoi.z, floorId: endPoi.floorId }
    });

    return compact(steps);
  }

  function compact(steps) {
    const out = [];
    steps.forEach(function (s) {
      const last = out[out.length - 1];
      if (s.type === 'vertical' && last && last.type === 'vertical' && last.channel === s.channel) {
        const f = Data.getFloor(s.toFloor);
        last.text = '乘坐' + (CHANNEL_NAME[s.channel] || '电梯') + '前往 ' + f.level + ' 楼';
        last.toFloor = s.toFloor;
        last.point = s.point;
        return;
      }
      const plain = !s.type;
      if (last && plain && last.type !== 'vertical' && last.type !== 'bridge' && last.type !== 'arrive' && s.dist <= 5) {
        last.dist += s.dist;
        last.text = last.text.replace(/直行 \d+ 米$/, '直行 ' + last.dist + ' 米');
        return;
      }
      out.push(s);
    });
    out.forEach(function (s, i) { s.n = i + 1; });
    return out;
  }

  function walkMinutes(dist) { return Math.max(1, Math.round(dist / WALK_SPEED / 60)); }
  function fmtDuration(sec) {
    sec = Math.max(1, Math.round(sec));
    if (sec < 60) return sec + ' 秒';
    return Math.round(sec / 60) + ' 分钟';
  }

  return {
    calc: calc, walkMinutes: walkMinutes, fmtDuration: fmtDuration,
    PROFILE: PROFILE, CHANNEL_NAME: CHANNEL_NAME,
    graph: function () { return buildGraph(); }
  };
})();
