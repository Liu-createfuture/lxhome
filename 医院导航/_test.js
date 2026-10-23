const fs = require('fs'), vm = require('vm');
const code = fs.readFileSync('src/data.js', 'utf8') + '\n' + fs.readFileSync('src/path.js', 'utf8') + '\n' +
`globalThis.__out = (function(){
  const t = {};
  t.pois = Data.allPois().length;
  t.floors = Object.keys(Data.FLOOR_MAP).length;
  const r1 = PathFinder.calc('P_r102','P_r605','normal');
  const r2 = PathFinder.calc('P_r102','P_r605','barrierFree');
  const r3 = PathFinder.calc('P_r105','P_r904','normal');
  const r4 = PathFinder.calc('P_GATE','P_r312','barrierFree');
  return {t, r1, r2, r3, r4};
})();`;
const ctx = { console, Math, Object, Array, JSON, String, Number, Date };
vm.createContext(ctx); vm.runInContext(code, ctx);
const o = ctx.__out;
console.log('POI', o.t.pois, 'floors', o.t.floors);
function show(r, tag) {
  console.log('\n---', tag, '---');
  if (r.error) { console.log('ERR', r.error); return; }
  console.log('dist', r.totalDistance, 'time', r.estimatedTime, 'cross', r.crossBuilding, 'floors', r.floors.join(' > '));
  r.steps.forEach(s => console.log('  ' + s.n + '.', s.text));
  console.log('  3d points', r.points3d.length, 'segments', Object.keys(r.segments).map(k => k + ':' + r.segments[k].length).join(' '));
}
show(o.r1, '门诊药房(1F) -> 肺功能室(医技2F) 普通');
show(o.r2, '门诊药房(1F) -> 肺功能室(医技2F) 无障碍');
show(o.r3, '急诊科(1F) -> 3-01 病房(住院3F) 普通');
show(o.r4, '门诊正门 -> 彩超室(3F) 无障碍');
