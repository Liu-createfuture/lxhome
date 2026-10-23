/* ============================================================================
 * app.js  —  交互与状态机
 * 视图：campus（院区全楼）/ floor（单层）
 * 流程：home（首页）→ poi（点位详情）→ setup（设起终点）→ nav（导航指引 + 小人）
 * ========================================================================== */
(function () {
  'use strict';

  const $ = function (s) { return document.querySelector(s); };
  const sheet = $('#sheet');
  const toastEl = $('#toast');
  const searchInput = $('#searchInput');
  const searchPanel = $('#searchPanel');

  const state = {
    buildingId: 'B1',
    floorId: 'MZ1',
    mode: 'campus',           // campus | floor
    screen: 'home',
    selPoi: null,
    startPoi: null,
    endPoi: null,
    routeType: 'normal',
    route: null,
    stepIndex: 0,
    pickingStart: false,
    tts: true,
    favs: [],
    demo: false
  };

  /* ======================================================================
   * 基础工具
   * ==================================================================== */
  let toastTimer = null;
  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2200);
  }

  let loadTimer = null;
  function showLoading(title) {
    const el = $('#loading');
    el.style.display = '';
    el.classList.remove('hide');
    $('#loadingTitle').textContent = title || '正在加载 3D 场景';
    let p = 0;
    $('#loadBar').style.width = '0%';
    $('#loadPct').textContent = '0';
    clearInterval(loadTimer);
    loadTimer = setInterval(function () {
      p = Math.min(92, p + 14 + Math.random() * 16);
      $('#loadBar').style.width = p + '%';
      $('#loadPct').textContent = Math.round(p);
      if (p >= 92) clearInterval(loadTimer);
    }, 80);
  }
  function hideLoading() {
    clearInterval(loadTimer);
    $('#loadBar').style.width = '100%';
    $('#loadPct').textContent = '100';
    const el = $('#loading');
    setTimeout(function () { el.classList.add('hide'); }, 160);
    setTimeout(function () { el.style.display = 'none'; }, 620);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function poiPlace(poi) {
    const f = Data.getFloor(poi.floorId);
    return f ? (f.buildingName + ' ' + f.short) : '';
  }
  function worldOf(poi) {
    const f = Data.getFloor(poi.floorId);
    return { x: poi.x + f.ox, z: poi.z + f.oz, y: f.y };
  }

  /* ======================================================================
   * 语音
   * ==================================================================== */
  const voiceReady = 'speechSynthesis' in window;
  function speak(text) {
    if (!state.tts || !voiceReady) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 1;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
  function stopSpeak() {
    if (voiceReady) { try { window.speechSynthesis.cancel(); } catch (e) {} }
  }

  /* ======================================================================
   * 收藏
   * ==================================================================== */
  function loadFavs() {
    try {
      const raw = localStorage.getItem('hospnav.favs2');
      state.favs = raw ? JSON.parse(raw) : [];
    } catch (e) { state.favs = []; }
  }
  function saveFavs() {
    try { localStorage.setItem('hospnav.favs2', JSON.stringify(state.favs)); } catch (e) {}
  }
  function isFav(id) { return state.favs.indexOf(id) > -1; }
  function toggleFav(id) {
    if (isFav(id)) {
      state.favs = state.favs.filter(function (x) { return x !== id; });
      toast('已取消收藏');
    } else {
      state.favs.unshift(id);
      toast('已收藏');
    }
    saveFavs();
    renderSheet();
  }

  /* ======================================================================
   * 楼栋 / 楼层
   * ==================================================================== */
  function buildBuildingSelect() {
    const sel = $('#buildingSel');
    sel.innerHTML = Data.BUILDINGS.map(function (b) {
      return '<option value="' + b.id + '">' + b.name + '</option>';
    }).join('');
    sel.addEventListener('change', function () { selectBuilding(sel.value); });
  }

  function selectBuilding(id) {
    state.buildingId = id;
    $('#buildingSel').value = id;
    stopDemo();
    exitNav(true);
    const b = Data.getBuilding(id);
    if (b) selectFloor(b.floors[0].id, { loading: true });
  }

  function renderFloorRail() {
    const rail = $('#floorRail');
    const b = Data.getBuilding(state.buildingId);
    const floors = b.floors.slice().sort(function (a, c) { return c.level - a.level; });
    let html = '<button class="floor-btn floor-all' + (state.mode === 'campus' ? ' is-active' : '') +
      '" data-floor="CAMPUS">全楼</button>';
    html += floors.map(function (f) {
      const hasRoute = state.route && state.route.segments[f.id];
      return '<button class="floor-btn' + (state.mode === 'floor' && f.id === state.floorId ? ' is-active' : '') +
        (hasRoute ? ' has-route' : '') + '" data-floor="' + f.id + '">' + f.short + '</button>';
    }).join('');
    rail.innerHTML = html;
  }

  $('#floorRail').addEventListener('click', function (e) {
    const b = e.target.closest('[data-floor]');
    if (!b) return;
    if (b.dataset.floor === 'CAMPUS') {
      state.mode = 'campus';
      Scene3D.showCampus();
      renderFloorRail();
      renderSheet();
    } else {
      selectFloor(b.dataset.floor);
    }
  });

  function selectFloor(floorId, opts) {
    opts = opts || {};
    const f = Data.getFloor(floorId);
    if (!f) return;
    if (opts.loading) showLoading('正在加载 ' + f.buildingName + ' ' + f.short);

    state.floorId = floorId;
    state.buildingId = f.buildingId;
    state.mode = 'floor';
    $('#buildingSel').value = f.buildingId;

    const doIt = function () {
      Scene3D.focusFloor(floorId, { radius: opts.radius });
      renderFloorRail();
      renderSheet();
      if (opts.loading) hideLoading();
    };
    if (opts.loading) setTimeout(doIt, 420);
    else doIt();
  }

  /* ======================================================================
   * 面板渲染
   * ==================================================================== */
  function renderSheet() {
    if (!state.floorId) return;
    if (state.screen === 'poi' && state.selPoi) sheet.innerHTML = viewPoi();
    else if (state.screen === 'setup') sheet.innerHTML = viewSetup();
    else if (state.screen === 'nav' && state.route) sheet.innerHTML = viewNav();
    else sheet.innerHTML = viewHome();

    document.body.classList.toggle('navigating', state.screen === 'nav');
    requestAnimationFrame(measureSheet);
  }

  function measureSheet() {
    document.documentElement.style.setProperty('--sheet-h', sheet.offsetHeight + 'px');
  }

  function viewHome() {
    const f = Data.getFloor(state.floorId);
    const favs = state.favs.map(function (id) { return Data.getPoi(id); }).filter(Boolean);
    const favHtml = favs.length ? (
      '<div class="fav-head">我的收藏</div><div class="fav-list">' +
      favs.slice(0, 8).map(function (p) {
        const meta = Data.typeOf(p.type);
        return '<button class="fav-item" data-fav="' + p.id + '">' +
          '<span style="font-size:13px">' + meta.icon + '</span>' + esc(p.name) +
          '<span class="x" data-unfav="' + p.id + '">✕</span></button>';
      }).join('') + '</div>'
    ) : '';

    const b = Data.getBuilding(state.buildingId);
    const floorCount = b.floors.length;

    return '' +
      '<div class="sheet-title"><h2>' + (state.mode === 'campus' ? b.name + ' · 全楼' : b.name + ' · ' + f.short) + '</h2>' +
      '<span class="sheet-sub">3D 室内导航</span></div>' +
      '<p class="tip-line">' + (state.mode === 'campus'
        ? '院区共 <b>3 栋楼 ' + totalFloors() + ' 个楼层</b>，楼栋之间由 <b>2 层 / 3 层连廊</b>相连。点击楼层可进入单层查看。'
        : '点击地图上的<b>圆形图标</b>，或搜索<b>科室 / 检查 / 卫生间</b>，即可查看位置并规划步行路线。') +
      '</p>' + favHtml;
  }

  function totalFloors() {
    let n = 0;
    Data.BUILDINGS.forEach(function (b) { n += b.floors.length; });
    return n;
  }

  function viewPoi() {
    const p = state.selPoi;
    const meta = Data.typeOf(p.type);
    const fav = isFav(p.id);
    return '' +
      '<div class="poi-head">' +
        '<div class="poi-ico" style="background:' + meta.color + ';color:' + meta.accent + '">' + meta.icon + '</div>' +
        '<div class="poi-meta">' +
          '<div class="poi-name">' + esc(p.name) + '</div>' +
          '<div class="poi-tags"><span class="tag blue">' + meta.name + '</span>' +
          '<span class="tag">' + poiPlace(p) + '</span></div>' +
        '</div>' +
        '<button class="icon-btn" data-act="closePoi" style="width:32px;height:32px;background:#f3f7fc;box-shadow:none;font-size:13px">✕</button>' +
      '</div>' +
      '<p class="poi-intro">' + esc(p.intro || '') + '</p>' +
      '<div class="actions">' +
        '<button class="btn btn-ghost' + (fav ? ' on' : '') + '" data-act="fav">' + (fav ? '★ 已收藏' : '☆ 收藏') + '</button>' +
        '<button class="btn btn-primary" data-act="goto">去这里</button>' +
      '</div>' +
      (state.route ? '<div class="actions"><button class="btn btn-line" data-act="backnav">← 返回导航</button></div>' : '');
  }

  function isEmergencyRelated() {
    const s = state.startPoi, e = state.endPoi;
    return (s && s.type === 'emergency') || (e && e.type === 'emergency');
  }

  function viewSetup() {
    const opts = [
      { k: 'normal', icon: '🚶', t: '普通路线', d: '距离最短，可走楼梯与扶梯' },
      { k: 'barrierFree', icon: '♿', t: '无障碍路线', d: '避开台阶与扶梯，仅走平缓通道 + 无障碍电梯' }
    ];
    if (isEmergencyRelated()) {
      opts.push({ k: 'emergency', icon: '🚨', t: '急诊优先路线', d: '优先急救专用通道，避开人流密集区域' });
    }
    const startTxt = state.startPoi
      ? esc(state.startPoi.name) + ' · ' + poiPlace(state.startPoi)
      : '请选择起点';

    return '' +
      '<div class="sheet-title"><h2>发起导航</h2>' +
      '<button class="icon-btn" data-act="cancelSetup" style="width:30px;height:30px;background:#f3f7fc;box-shadow:none;font-size:13px">✕</button></div>' +
      '<div class="setup-row"><span class="dot s"></span><span class="setup-label">起点</span>' +
        '<span class="setup-val' + (state.startPoi ? '' : ' muted') + '">' + startTxt + '</span>' +
        '<button class="setup-act" data-act="pickStart">' + (state.startPoi ? '重选' : '选择') + '</button></div>' +
      '<div class="setup-row"><span class="dot e"></span><span class="setup-label">终点</span>' +
        '<span class="setup-val">' + esc(state.endPoi.name) + ' · ' + poiPlace(state.endPoi) + '</span>' +
        '<span class="setup-act disabled">已定</span></div>' +
      '<div class="setup-row"><span class="dot" style="background:#cbd7e6"></span><span class="setup-label">定位</span>' +
        '<span class="setup-val muted">我的当前位置（二期）</span>' +
        '<span class="setup-act disabled">不可用</span></div>' +
      (state.startPoi && state.startPoi.buildingId !== state.endPoi.buildingId
        ? '<div class="hint warn">起点与终点不在同一楼栋，路线将自动经连廊通行</div>' : '') +
      '<div class="route-opts">' + opts.map(function (o) {
        return '<button class="opt' + (state.routeType === o.k ? ' is-on' : '') + '" data-route="' + o.k + '">' +
          '<span class="opt-ico">' + o.icon + '</span>' +
          '<span class="opt-main"><span class="opt-t">' + o.t + '</span><span class="opt-d">' + o.d + '</span></span>' +
          '<span class="opt-radio"></span></button>';
      }).join('') + '</div>' +
      (state.pickingStart
        ? '<div class="hint warn">请在地图上点击一个点位，或在上方搜索，作为导航起点</div>'
        : (state.startPoi ? '' : '<div class="hint">一期无室内定位，请手动选择起点（如当前所在的大厅、电梯口）。</div>')) +
      '<div class="actions"><button class="btn btn-primary" data-act="start"' +
        (state.startPoi ? '' : ' disabled') + '>开始导航</button></div>';
  }

  function currentStep() {
    return state.route.steps[state.stepIndex] || state.route.steps[0];
  }

  function stepIcon(s) {
    if (s.type === 'vertical') {
      if (s.channel === 'barrierLift') return '♿';
      if (s.channel === 'lift') return '🛗';
      if (s.channel === 'escalator') return '🛝';
      return '🪜';
    }
    if (s.type === 'bridge') return '🌉';
    if (s.type === 'arrive') return '📍';
    return '↑';
  }

  function viewNav() {
    const r = state.route;
    const cur = currentStep();
    const routeName = { normal: '普通路线', barrierFree: '无障碍路线', emergency: '急诊优先' }[r.routeType];

    const stepsHtml = r.steps.map(function (s, i) {
      return '<button class="step' + (i === state.stepIndex ? ' is-on' : (i < state.stepIndex ? ' is-done' : '')) +
        '" data-step="' + i + '">' +
        '<span class="step-num">' + (i < state.stepIndex ? '✓' : (i + 1)) + '</span>' +
        '<span class="step-txt">' + esc(s.text) + '</span></button>';
    }).join('');

    let note = '';
    if (r.crossBuilding) {
      note = '<div class="floor-note">🌉 跨楼栋路线：中途经连廊前往' +
        Data.getFloor(r.endPoi.floorId).buildingName + '，共 ' + r.floors.length + ' 个楼层</div>';
    } else if (r.floors.length > 1) {
      note = '<div class="floor-note">🛗 跨楼层路线：共 ' + r.floors.length + ' 层，可切换楼层查看各段</div>';
    }

    return '' +
      '<div class="nav-head">' +
        '<div class="nav-stat">' +
          '<div class="stat"><b>' + r.totalDistance + '</b><small>米</small></div>' +
          '<div class="stat"><b>' + PathFinder.fmtDuration(r.estimatedTime) + '</b></div>' +
          '<div class="stat"><span class="tag blue">' + routeName + '</span></div>' +
        '</div>' +
        '<button class="voice-btn' + (state.tts ? ' on' : '') + '" data-act="voice">' +
          (state.tts ? '🔈 语音开' : '🔇 已静音') + '</button>' +
      '</div>' +
      '<button class="current-step" data-act="nextStep">' +
        '<span class="arrow">' + stepIcon(cur) + '</span>' +
        '<span class="txt">' + esc(cur.text) + '</span>' +
        '<span class="arrow" style="margin-left:auto;opacity:.7">›</span></button>' +
      note +
      '<div class="steps">' + stepsHtml + '</div>' +
      '<div class="nav-actions">' +
        '<button class="btn btn-line" data-act="demo">' + (state.demo ? '■ 停止演示' : '▶ 演示路线') + '</button>' +
        '<button class="btn btn-line" data-act="replan">重新规划</button>' +
        '<button class="btn btn-ghost" data-act="exit" style="flex:0 0 auto">退出</button>' +
      '</div>';
  }

  /* ======================================================================
   * 点位 / 搜索
   * ==================================================================== */
  function handlePoiClick(id) {
    const poi = Data.getPoi(id);
    if (!poi) return;
    if (state.pickingStart) { setStart(poi); return; }
    selectPoi(poi, true);
  }

  function selectPoi(poi, fly) {
    state.selPoi = poi;
    Scene3D.setSelectedPoi(poi.id);

    if (poi.floorId !== state.floorId) {
      state.floorId = poi.floorId;
      state.buildingId = poi.buildingId;
      $('#buildingSel').value = poi.buildingId;
      Scene3D.focusFloor(poi.floorId, { radius: 56, camera: false });
      renderFloorRail();
    }
    if (state.screen !== 'setup' || state.pickingStart) state.screen = 'poi';

    if (fly) {
      const w = worldOf(poi);
      Scene3D.flyTo(w.x, w.z, w.y + 1, { radius: 32, phi: 0.84 });
      if (state.mode === 'campus') {
        state.mode = 'floor';
        renderFloorRail();
      }
    }
    renderSheet();
  }

  function setStart(poi) {
    state.startPoi = poi;
    state.pickingStart = false;
    state.screen = 'setup';
    if (poi.floorId !== state.floorId) {
      state.floorId = poi.floorId;
      state.buildingId = poi.buildingId;
      $('#buildingSel').value = poi.buildingId;
      Scene3D.focusFloor(poi.floorId, { radius: 56 });
      renderFloorRail();
    }
    toast('起点已设为：' + poi.name);
    renderSheet();
  }

  function handleBlank() {
    if (state.pickingStart) toast('请点击地图上的点位图标');
  }

  /* ---------------- 搜索 ---------------- */
  let searchTimer = null;

  function renderSearch(kw) {
    if (!kw) { closeSearch(); return; }
    const list = Data.searchAll(kw, state.floorId).slice(0, 14);
    if (!list.length) {
      searchPanel.innerHTML = '<div class="res-empty">没有找到「' + esc(kw) + '」，试试"卫生间""药房""彩超"</div>';
      searchPanel.classList.add('show');
      $('#chips').classList.add('is-hidden');
      return;
    }
    searchPanel.innerHTML = list.map(function (p) {
      const meta = Data.typeOf(p.type);
      return '<button class="res-item" data-poi="' + p.id + '">' +
        '<span class="res-ico" style="background:' + meta.color + ';color:' + meta.accent + '">' + meta.icon + '</span>' +
        '<span class="res-main"><span class="res-name">' + esc(p.name) + '</span>' +
        '<span class="res-sub">' + meta.name + ' · ' + poiPlace(p) + '</span></span></button>';
    }).join('');
    searchPanel.classList.add('show');
    $('#chips').classList.add('is-hidden');
  }

  function closeSearch() {
    searchPanel.classList.remove('show');
    if (state.screen !== 'nav') $('#chips').classList.remove('is-hidden');
  }

  searchInput.addEventListener('input', function () {
    const v = searchInput.value.trim();
    $('#searchBox').classList.toggle('has-value', !!v);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { renderSearch(v); }, 120);
  });
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const first = searchPanel.querySelector('[data-poi]');
      if (first) first.click();
    }
  });
  $('#searchClear').addEventListener('click', function () {
    searchInput.value = '';
    $('#searchBox').classList.remove('has-value');
    closeSearch();
  });

  searchPanel.addEventListener('click', function (e) {
    const item = e.target.closest('[data-poi]');
    if (!item) return;
    const poi = Data.getPoi(item.dataset.poi);
    closeSearch();
    searchInput.value = poi.name;
    $('#searchBox').classList.add('has-value');
    if (state.pickingStart) setStart(poi);
    else selectPoi(poi, true);
  });

  document.addEventListener('click', function (e) {
    if (!searchPanel.contains(e.target) && e.target !== searchInput && !$('#searchBox').contains(e.target)) {
      closeSearch();
    }
  });

  $('#chips').addEventListener('click', function (e) {
    const chip = e.target.closest('[data-chip]');
    if (!chip) return;
    quickNav(chip.dataset.chip);
  });

  function quickNav(kw) {
    const list = Data.searchAll(kw, state.floorId);
    if (!list.length) { toast('暂未找到：' + kw); return; }
    const poi = list[0];
    if (state.pickingStart) { setStart(poi); return; }
    selectPoi(poi, true);
    toast('已定位到：' + poi.name + ' · ' + poiPlace(poi));
  }

  /* ======================================================================
   * 导航
   * ==================================================================== */
  function doNavigate() {
    if (state.routeType === 'emergency' && !isEmergencyRelated()) state.routeType = 'normal';
    if (!state.startPoi) { toast('请先选择起点'); return; }
    if (!state.endPoi) { toast('请先选择终点'); return; }

    const res = PathFinder.calc(state.startPoi.id, state.endPoi.id, state.routeType);
    if (res.error) { toast(res.error, 2600); return; }

    state.route = res;
    state.stepIndex = 0;
    state.screen = 'nav';
    state.demo = false;

    /* 定位到起点楼层并显示全程路线 */
    const sf = Data.getFloor(res.startPoi.floorId);
    state.floorId = sf.id;
    state.buildingId = sf.buildingId;
    state.mode = 'floor';
    $('#buildingSel').value = sf.buildingId;
    Scene3D.focusFloor(sf.id, { radius: 58 });
    Scene3D.showPath(res);
    Scene3D.placeWalkerAt(res.startPoi.id);

    renderFloorRail();
    renderSheet();
    setTimeout(function () { speak(res.steps[0].text); }, 350);
  }

  function goStep(i) {
    if (!state.route) return;
    const steps = state.route.steps;
    i = Math.max(0, Math.min(steps.length - 1, i));
    state.stepIndex = i;
    const s = steps[i];

    if (s.point) {
      const f = Data.getFloor(s.point.floorId);
      if (f.id !== state.floorId) {
        state.floorId = f.id;
        state.buildingId = f.buildingId;
        $('#buildingSel').value = f.buildingId;
        Scene3D.focusFloor(f.id, { radius: 50, camera: false });
        renderFloorRail();
      }
      Scene3D.flyTo(s.point.x + f.ox, s.point.z + f.oz, f.y + 1, { radius: 30, phi: 0.85 });
    }
    renderSheet();
    speak(s.text);
  }

  function stopDemo() {
    if (state.demo) {
      Scene3D.stopWalk();
      state.demo = false;
      $('#demoBar').classList.remove('show');
      if (state.screen === 'nav') renderSheet();
    }
  }

  function startDemo() {
    if (!state.route) return;
    if (state.demo) { stopDemo(); return; }
    stopSpeak();
    state.demo = true;
    $('#demoBar').classList.add('show');
    state.screen = 'nav';
    renderSheet();

    Scene3D.startWalk(state.route, {
      speed: 3.6,
      onFloor: function (fid) {
        if (fid === state.floorId) return;
        state.floorId = fid;
        state.buildingId = Data.getFloor(fid).buildingId;
        $('#buildingSel').value = state.buildingId;
        Scene3D.focusFloor(fid, { camera: false });
        renderFloorRail();
      },
      onEnd: function () {
        state.demo = false;
        $('#demoBar').classList.remove('show');
        const ef = Data.getFloor(state.route.endPoi.floorId);
        state.floorId = ef.id;
        state.buildingId = ef.buildingId;
        Scene3D.focusFloor(ef.id, { radius: 44 });
        renderFloorRail();
        renderSheet();
        toast('已到达：' + state.route.endPoi.name);
        speak('已到达' + state.route.endPoi.name);
      }
    });
  }

  function exitNav(silent) {
    stopDemo();
    state.route = null;
    state.stepIndex = 0;
    Scene3D.clearPath();
    Scene3D.hideWalker();
    stopSpeak();
    if (state.screen === 'nav' || state.screen === 'setup') state.screen = 'home';
    renderFloorRail();
    if (!silent) { renderSheet(); toast('已退出导航'); }
  }

  /* ======================================================================
   * 面板事件
   * ==================================================================== */
  sheet.addEventListener('click', function (e) {
    const unfav = e.target.closest('[data-unfav]');
    if (unfav) {
      e.stopPropagation();
      state.favs = state.favs.filter(function (x) { return x !== unfav.dataset.unfav; });
      saveFavs(); renderSheet(); return;
    }
    const favItem = e.target.closest('[data-fav]');
    if (favItem) {
      const p = Data.getPoi(favItem.dataset.fav);
      if (p) selectPoi(p, true);
      return;
    }
    const stepBtn = e.target.closest('[data-step]');
    if (stepBtn) { goStep(parseInt(stepBtn.dataset.step, 10)); return; }

    const routeOpt = e.target.closest('[data-route]');
    if (routeOpt) { state.routeType = routeOpt.dataset.route; renderSheet(); return; }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'goto':
        state.endPoi = state.selPoi;
        state.screen = 'setup';
        state.pickingStart = false;
        renderSheet();
        break;
      case 'fav': toggleFav(state.selPoi.id); break;
      case 'closePoi':
        state.selPoi = null;
        Scene3D.setSelectedPoi(null);
        state.screen = 'home';
        renderSheet();
        break;
      case 'backnav':
        state.screen = 'nav';
        renderSheet();
        break;
      case 'pickStart':
        state.pickingStart = true;
        state.screen = 'setup';
        renderSheet();
        toast('请在地图上点击点位，或搜索后选择起点', 2600);
        break;
      case 'cancelSetup':
        state.pickingStart = false;
        state.screen = state.selPoi ? 'poi' : 'home';
        renderSheet();
        break;
      case 'start': doNavigate(); break;
      case 'voice':
        state.tts = !state.tts;
        if (!state.tts) stopSpeak();
        renderSheet();
        if (state.tts) speak(currentStep().text);
        break;
      case 'nextStep':
        if (state.stepIndex >= state.route.steps.length - 1) { toast('已到达目的地'); break; }
        goStep(state.stepIndex + 1);
        break;
      case 'demo': startDemo(); break;
      case 'replan':
        stopDemo();
        Scene3D.clearPath();
        Scene3D.hideWalker();
        state.route = null;
        state.screen = 'setup';
        renderFloorRail();
        renderSheet();
        break;
      case 'exit': exitNav(); break;
    }
  });

  /* ======================================================================
   * 顶部按钮
   * ==================================================================== */
  $('#resetBtn').addEventListener('click', function () {
    if (state.mode === 'campus') Scene3D.showCampus();
    else Scene3D.focusFloor(state.floorId);
  });

  $('#helpBtn').addEventListener('click', function () { $('#helpModal').classList.add('show'); });
  $('#helpClose').addEventListener('click', function () { $('#helpModal').classList.remove('show'); });
  $('#helpModal').addEventListener('click', function (e) {
    if (e.target.id === 'helpModal') $('#helpModal').classList.remove('show');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      $('#helpModal').classList.remove('show');
      closeSearch();
    }
  });

  /* ======================================================================
   * 启动
   * ==================================================================== */
  function boot() {
    buildBuildingSelect();
    loadFavs();
    showLoading('正在加载院区 3D 场景');

    try {
      Scene3D.init($('#scene'), {
        onPoiClick: handlePoiClick,
        onBlankClick: handleBlank
      });
    } catch (err) {
      console.error(err);
      clearInterval(loadTimer);
      $('#loadingTitle').textContent = '模型加载失败，请刷新重试';
      $('#loadPct').textContent = '0';
      $('#loadBar').style.width = '0%';
      $('.loading-tip').textContent = '当前浏览器可能不支持 WebGL，请更换 Chrome / Edge / 微信内置浏览器';
      return;
    }

    Scene3D.buildAllPins();
    state.buildingId = 'B1';
    state.floorId = 'MZ1';
    Scene3D.focusFloor('MZ1', { camera: false });

    setTimeout(function () {
      Scene3D.showCampus(true);
      renderFloorRail();
      renderSheet();
      hideLoading();
      measureSheet();
    }, 620);

    if (window.ResizeObserver) {
      new ResizeObserver(measureSheet).observe(sheet);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
