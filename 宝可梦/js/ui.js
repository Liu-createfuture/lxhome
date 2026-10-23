/* ============================================================
   界面：标题、序章、对话、菜单、商店、任务与结局
   ============================================================ */
window.PKM = window.PKM || {};

(function () {
  const PKM = window.PKM;
  const D = PKM.DATA;
  const G = PKM.GAME;

  const CAT_LABEL = {
    ball: '精灵球', medicine: '药品', berry: '树果', key: '重要物品', treasure: '宝物'
  };

  const UI = {
    screen: 'title',
    dialogOpen: false,
    menuOpen: false,
    mapOpen: false,
    shopOpen: false,
    modalOpen: false,
    busy: false,
    transitioning: false,
    battleStarting: false,
    titleActive: true,
    endingActive: false,
    introActive: false,
    introTyping: false,
    introStage: 0,
    introDone: false,
    introStarter: null,
    introName: '小森',
    menuTab: 'party',
    bagSel: null,
    dexFilter: 'all',
    starterIndex: 0,
    dialogChoiceIndex: 0,
    dialogChoicesVisible: false,
    shopId: null,
    shopSel: null,
    shopQty: 1,
    dialogLines: [],
    dialogIndex: 0,
    dialogSpeaker: '',
    dialogOnDone: null,
    dialogChoices: null,
    typeTimer: null,
    promptText: '',
    partySig: '',
    bannerTimer: null,
    el: {},

    init() {
      const $ = id => document.getElementById(id);
      this.el = {
        hud: $('hud'),
        locName: $('loc-name'), locTime: $('loc-time'), locPhase: $('loc-phase'),
        partyDock: $('party-dock'), questText: $('quest-text'),
        navHud: $('nav-hud'), navArrow: $('nav-arrow'), navTarget: $('nav-target'), navMeta: $('nav-meta'),
        navMapBtn: $('nav-map-btn'),
        minimapPanel: $('minimap-panel'), minimapCanvas: $('minimap-canvas'),
        minimapName: $('minimap-name'), minimapObjective: $('minimap-objective'),
        minimapTime: $('minimap-time'), minimapOpen: $('minimap-open'),
        prompt: $('interact-prompt'), promptText: $('interact-text'),
        toast: $('toast-layer'),
        mapBanner: $('map-banner'), bannerName: $('map-banner-name'), bannerSub: $('map-banner-sub'),
        dialogueLayer: $('dialogue-layer'), dialogueSpeaker: $('dialogue-speaker'),
        dialogueText: $('dialogue-text'), dialogueNext: $('dialogue-next'), dialogueChoices: $('dialogue-choices'),
        menuLayer: $('menu-layer'), menuBody: $('menu-body'), menuTabs: $('menu-tabs'),
        menuTitle: $('menu-title'), menuName: $('menu-player-name'), menuMoney: $('menu-money'),
        menuFootNote: $('menu-foot-note'), menuClose: $('menu-close'),
        shopLayer: $('shop-layer'), shopTitle: $('shop-title'), shopMoney: $('shop-money'),
        shopList: $('shop-list'), shopDetail: $('shop-detail'), shopClose: $('shop-close'),
        mapLayer: $('map-layer'), mapClose: $('map-close'), regionMap: $('region-map'), localMap: $('local-map'),
        mapAreaName: $('map-area-name'), mapTime: $('map-time'), mapMoney: $('map-money'),
        mapObjectiveName: $('map-objective-name'), mapWpCount: $('map-wp-count'), mapWpTotal: $('map-wp-total'),
        mapWaypointList: $('map-waypoint-list'), mapGuideToggle: $('map-guide-toggle'), menuMapBtn: $('menu-map-btn'),
        modalLayer: $('modal-layer'), modalWindow: $('modal-window'),
        title: $('title-screen'), titleCanvas: $('title-canvas'), titleSaveInfo: $('title-save-info'),
        intro: $('intro-screen'), introPortrait: $('intro-portrait'), introText: $('intro-text'),
        introKicker: $('intro-kicker'), introNext: $('intro-next'), introNamePanel: $('intro-name'),
        playerName: $('player-name'), starterPicker: $('starter-picker'), starterCards: $('starter-cards'),
        starterNote: $('starter-note'), starterOk: $('btn-starter-ok'),
        ending: $('ending-screen'), endingCanvas: $('ending-canvas'),
        fade: $('fade-layer'), flash: $('flash-layer')
      };
      this.bindStatic();
      this.el.dialogueLayer.addEventListener('click', (e) => {
        if (e.target.closest('.dialogue-choices')) return;
        this.advanceDialog();
      });
      this.el.modalLayer.addEventListener('click', (e) => {
        if (e.target === this.el.modalLayer) this.closeModal();
      });
      this.el.menuTabs.addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]');
        if (!b) return;
        PKM.AUDIO.sfx('select');
        this.menuTab = b.dataset.tab;
        this.renderMenu();
      });
      this.el.menuClose.addEventListener('click', () => this.closeMenu());
      this.el.menuMapBtn.addEventListener('click', () => {
        this.closeMenu();
        this.openMap();
      });
      this.el.shopClose.addEventListener('click', () => this.closeShop());
      this.el.mapClose.addEventListener('click', () => this.closeMap());
      this.el.navMapBtn.addEventListener('click', () => this.openMap());
      this.el.mapGuideToggle.addEventListener('click', () => this.toggleGuide());
      this.el.minimapOpen.addEventListener('click', () => this.openMap());
      this.el.minimapCanvas.addEventListener('click', () => this.openMap());
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && document.activeElement === this.el.playerName) {
          e.preventDefault();
          this.confirmName();
        }
      });
    },

    bindStatic() {
      document.getElementById('btn-new').addEventListener('click', () => this.tryNewGame());
      document.getElementById('btn-continue').addEventListener('click', () => this.continueGame());
      document.getElementById('btn-help').addEventListener('click', () => this.showHelp());
      document.getElementById('btn-name-ok').addEventListener('click', () => this.confirmName());
      this.el.starterOk.addEventListener('click', () => this.beginJourney());
      this.el.intro.addEventListener('click', (e) => {
        if (e.target.closest('button, input, .starter-card, .intro-name, .starter-picker')) return;
        this.advanceIntro();
      });
      document.getElementById('ending-close').addEventListener('click', () => this.closeEnding());
    },

    /* ============================================================
       标题 / 存档
       ============================================================ */
    showTitle() {
      this.screen = 'title';
      this.titleActive = true;
      this.endingActive = false;
      this.introActive = false;
      G.paused = true;
      this.el.title.classList.remove('hidden');
      this.el.intro.classList.add('hidden');
      this.el.ending.classList.add('hidden');
      this.el.hud.classList.add('hidden');
      this.el.menuLayer.classList.add('hidden');
      this.el.mapLayer.classList.add('hidden');
      this.el.shopLayer.classList.add('hidden');
      this.el.modalLayer.classList.add('hidden');
      this.el.dialogueLayer.classList.add('hidden');
      this.el.mapBanner.classList.remove('show');
      this.el.fade.classList.remove('active');
      this.menuOpen = false; this.shopOpen = false; this.modalOpen = false; this.dialogOpen = false; this.mapOpen = false;
      const save = G.loadData();
      const btn = document.getElementById('btn-continue');
      if (save) {
        btn.disabled = false;
        btn.classList.remove('dim');
        const d = new Date(save.savedAt);
        const map = D.MAPS[save.data.map] ? D.MAPS[save.data.map].name : '未知之地';
        const lead = save.data.party && save.data.party[0] ? D.SPECIES[save.data.party[0].species].name : '—';
        this.el.titleSaveInfo.textContent = `${save.data.name || '旅人'} · ${map} · ${lead} Lv.${save.data.party[0] ? save.data.party[0].level : '—'} · ${d.getMonth() + 1}/${d.getDate()}`;
      } else {
        btn.disabled = true;
        btn.classList.add('dim');
        this.el.titleSaveInfo.textContent = '还没有旅程记录';
      }
      PKM.AUDIO.playMusic('title');
    },

    tryNewGame() {
      PKM.AUDIO.init();
      if (G.hasSave()) {
        this.confirm('开始新的冒险？', '已有旅程记录会被新的故事覆盖。要不要先继续旧旅程？', () => {
          this.closeModal();
          this.startIntro();
        }, () => this.closeModal(), '覆盖并开始', '再想想');
      } else {
        this.startIntro();
      }
    },

    continueGame() {
      PKM.AUDIO.init();
      if (!G.load()) {
        this.toast('没有找到可用的旅程记录。', null, '');
        return;
      }
      this.applyAudioSettings();
      this.enterGame(false);
    },

    showHelp() {
      this.openModal(`
        <div class="modal-head"><div><h2>如何走进森林</h2><div class="modal-sub">KEYBOARD &amp; TOUCH</div></div></div>
        <div class="controls-table">
          <b>鼠标左键</b><span>点击地面自动寻路；点击 NPC / 道具 / 传送点会自动走过去互动</span>
          <b>方向键 / WASD</b><span>移动（按住 Shift 奔跑）</span>
          <b>Z / Enter / 空格</b><span>交谈、调查、确认</span>
          <b>X / Esc</b><span>打开旅人手记 / 返回</span>
          <b>M</b><span>打开旅途地图与快速移动</span>
          <b>对话中</b><span>点击或按 Z 继续；再按一次可跳过打字</span>
          <b>战斗中</b><span>点击按钮，或用方向键选择、Z 确认</span>
          <b>触屏</b><span>左下方向键，右下 A / B</span>
        </div>
        <div class="modal-text" style="margin-top:14px;">捕捉野生宝可梦、收集图鉴、完成支线，再带着伙伴去森林深处。就算暂时输掉，也不会丢失伙伴。</div>
        <div class="modal-actions"><button class="pixel-btn" data-modal-close>知道了</button></div>
      `);
    },

    /* ============================================================
       序章
       ============================================================ */
    startIntro() {
      this.screen = 'intro';
      this.titleActive = false;
      this.introActive = true;
      this.endingActive = false;
      this.introStage = 0;
      this.introStarter = null;
      this.introName = '小森';
      this.el.title.classList.add('hidden');
      this.el.ending.classList.add('hidden');
      this.el.hud.classList.add('hidden');
      this.el.intro.classList.remove('hidden');
      this.el.introNamePanel.classList.add('hidden');
      this.el.starterPicker.classList.add('hidden');
      this.el.starterOk.disabled = true;
      this.el.starterNote.textContent = '每一种相遇，都会长成不同的路。';
      this.el.playerName.value = '小森';
      this.el.introKicker.textContent = '序章 · 风从森林来';
      this.el.introNext.classList.remove('hidden');
      PKM.ART.drawPortrait(this.el.introPortrait, 'prof');
      PKM.AUDIO.init();
      PKM.AUDIO.playMusic('forest');
      this.introSay('苔爷爷：风把你带来了。\n这里是青苔镇，一个被森林抱在怀里的小地方。', () => {});
    },

    introLines: [
      '苔爷爷：风把你带来了。\n这里是青苔镇，一个被森林抱在怀里的小地方。',
      '苔爷爷：最近，萤火森林的光苔一片片熄灭。\n夜里连萤火虫都找不到回家的路。',
      '苔爷爷：我老了，走不了那么远。\n你愿意带上一位伙伴，替我去看看森林的心吗？'
    ],

    introSay(text, done) {
      if (!text) return;
      this.introTyping = true;
      this.el.introText.textContent = '';
      this.el.introNext.classList.add('hidden');
      let i = 0;
      clearInterval(this.typeTimer);
      this.typeTimer = setInterval(() => {
        i++;
        this.el.introText.textContent = text.slice(0, i);
        if (i >= text.length) {
          clearInterval(this.typeTimer);
          this.typeTimer = null;
          this.introTyping = false;
          this.el.introNext.classList.remove('hidden');
          if (done) done();
        }
      }, 22);
    },

    advanceIntro() {
      if (!this.introActive) return;
      PKM.AUDIO.sfx('select');
      if (this.introTyping) {
        clearInterval(this.typeTimer);
        this.typeTimer = null;
        this.introTyping = false;
        this.el.introText.textContent = this.introLines[this.introStage];
        this.el.introNext.classList.remove('hidden');
        return;
      }
      if (this.introStage < this.introLines.length - 1) {
        this.introStage++;
        this.introSay(this.introLines[this.introStage]);
      } else if (this.el.introNamePanel.classList.contains('hidden') && this.el.starterPicker.classList.contains('hidden')) {
        this.showNameEntry();
      }
    },

    showNameEntry() {
      this.el.introNext.classList.add('hidden');
      this.el.introNamePanel.classList.remove('hidden');
      this.el.introText.textContent = '苔爷爷：先告诉我，你叫什么名字？';
      this.el.introKicker.textContent = '序章 · 名字与脚印';
      setTimeout(() => { this.el.playerName.focus(); this.el.playerName.select(); }, 40);
    },

    confirmName() {
      if (!this.introActive || this.el.introNamePanel.classList.contains('hidden')) return;
      let name = (this.el.playerName.value || '').replace(/[<>&"']/g, '').trim().slice(0, 6);
      if (!name) name = '小森';
      this.introName = name;
      this.el.playerName.blur();
      this.el.introNamePanel.classList.add('hidden');
      this.el.introKicker.textContent = '序章 · 选择你的伙伴';
      this.showStarterPicker();
    },

    showStarterPicker() {
      this.el.starterPicker.classList.remove('hidden');
      this.el.introText.textContent = `${this.introName}，这三只小家伙已经等了你很久。\n它们都在看你。`;
      this.el.introNext.classList.add('hidden');
      this.el.starterCards.innerHTML = D.STARTERS.map((id, i) => {
        const sp = D.SPECIES[id];
        const typeHtml = sp.types.map(t => `<span class="type-badge" style="background:${D.TYPES[t].color}">${D.TYPES[t].name}</span>`).join(' ');
        return `<div class="starter-card" data-starter="${id}">
          <canvas width="96" height="96" data-sp="${id}"></canvas>
          <div class="starter-name">${sp.name}</div>
          <div class="starter-types">${typeHtml}</div>
          <div class="starter-desc">${sp.desc}</div>
          <div class="starter-shape">NO.${String(sp.no).padStart(3, '0')} · ${sp.habitat}</div>
        </div>`;
      }).join('');
      this.el.starterCards.querySelectorAll('canvas[data-sp]').forEach(c => PKM.ART.drawMonsterCanvas(c, c.dataset.sp, 0, false));
      this.el.starterCards.querySelectorAll('.starter-card').forEach((card, i) => {
        card.addEventListener('click', () => this.selectStarter(i));
      });
      this.starterIndex = 0;
      this.focusStarter(0);
      this.introStarter = null;
    },

    focusStarter(index) {
      const cards = Array.from(this.el.starterCards.querySelectorAll('.starter-card'));
      if (!cards.length) return;
      this.starterIndex = (index + cards.length) % cards.length;
      cards.forEach((c, i) => c.classList.toggle('keyboard-focus', i === this.starterIndex));
    },

    selectStarter(index) {
      const cards = Array.from(this.el.starterCards.querySelectorAll('.starter-card'));
      const card = cards[index];
      if (!card) return;
      this.starterIndex = index;
      cards.forEach((c, i) => {
        c.classList.toggle('chosen', i === index);
        c.classList.toggle('keyboard-focus', i === index);
      });
      this.introStarter = card.dataset.starter;
      const sp = D.SPECIES[this.introStarter];
      this.el.starterNote.textContent = `${sp.name}歪了歪头，把额头贴向你的掌心。`;
      this.el.starterOk.disabled = false;
      PKM.AUDIO.sfx('sparkle');
    },

    beginJourney() {
      if (!this.introStarter) return;
      PKM.AUDIO.sfx('victory');
      G.newState(this.introName, this.introStarter);
      G.state.settings = { music: true, sfx: true, speed: 1 };
      this.introActive = false;
      this.el.intro.classList.add('hidden');
      this.enterGame(true);
    },

    /* ============================================================
       进入游戏
       ============================================================ */
    enterGame(fresh) {
      this.screen = 'game';
      this.titleActive = false;
      this.endingActive = false;
      this.introActive = false;
      this.el.title.classList.add('hidden');
      this.el.intro.classList.add('hidden');
      this.el.ending.classList.add('hidden');
      this.el.hud.classList.remove('hidden');
      this.menuOpen = false; this.shopOpen = false; this.modalOpen = false; this.dialogOpen = false; this.mapOpen = false; this.busy = false;
      this.el.menuLayer.classList.add('hidden');
      this.el.mapLayer.classList.add('hidden');
      this.el.shopLayer.classList.add('hidden');
      this.el.modalLayer.classList.add('hidden');
      this.el.dialogueLayer.classList.add('hidden');
      G.paused = false;
      this.applyAudioSettings();
      const map = G.currentMap();
      const currentWp = (D.WAYPOINTS || []).find(w => w.map === map.id);
      if (currentWp) G.unlockWaypoint(currentWp.id, true);
      PKM.AUDIO.playMusic(map.music || 'town');
      this.updateHUD();
      this.updateNav();
      this.mapBanner(map.name, map.subtitle);
      if (fresh) {
        G.autoSave();
        setTimeout(() => this.toast('按 X 打开旅人手记', null, ''), 1800);
        setTimeout(() => this.toast('去和镇上的苔爷爷聊聊吧', 'quest', 'quest'), 3100);
      }
    },

    applyAudioSettings() {
      const s = G.state;
      if (!s) return;
      PKM.AUDIO.setMusic(!!s.settings.music);
      PKM.AUDIO.setSfx(!!s.settings.sfx);
    },

    /* ============================================================
       HUD
       ============================================================ */
    updateHUD() {
      if (!G.state || this.screen !== 'game') return;
      const s = G.state;
      const map = G.currentMap();
      this.el.locName.textContent = map.name;
      this.el.locTime.textContent = G.clockLabel();
      this.el.locPhase.textContent = G.phaseLabel();
      let tracked = s.trackedQuest || 'main';
      if (tracked !== 'main' && G.questState(tracked).status === 'done') {
        tracked = 'main';
        s.trackedQuest = 'main';
      }
      const q = D.QUESTS[tracked] || D.QUESTS.main;
      const qs = G.questState(tracked);
      this.el.questText.textContent = `${q.title} · ${qs.hint}`;
      const sig = s.party.map(m => `${m.species}:${m.level}:${m.hp}:${m.maxHp}:${m.status}`).join('|') + '|' + s.money + '|' + s.party.length;
      if (sig !== this.partySig) {
        this.partySig = sig;
        this.renderPartyDock();
      }
    },

    updateNav() {
      if (!this.el.navHud) return;
      if (this.screen !== 'game' || !G.state || this.endingActive) {
        this.el.navHud.classList.add('hidden');
        return;
      }
      this.el.navHud.classList.remove('hidden');
      const guide = PKM.GUIDE ? PKM.GUIDE.refresh() : null;
      if (!guide || !guide.target) {
        this.el.navHud.classList.add('off');
        this.el.navTarget.textContent = '旅途暂无目标';
        this.el.navMeta.textContent = '打开地图，看看走过的地方';
        this.el.navArrow.style.transform = 'rotate(0deg)';
        return;
      }
      if (!guide.enabled) {
        this.el.navHud.classList.add('off');
        this.el.navTarget.textContent = '导航线已关闭';
        this.el.navMeta.textContent = '在设置或地图中重新打开';
        this.el.navArrow.style.transform = 'rotate(0deg)';
        return;
      }
      this.el.navHud.classList.remove('off');
      this.el.navTarget.textContent = guide.target.label || '当前目标';
      if (guide.unreachable) {
        this.el.navMeta.textContent = '暂时找不到可达路线';
      } else if (guide.transfer) {
        this.el.navMeta.textContent = `前往 ${guide.target.mapName} · ${guide.distance} 步 · 出口${guide.direction ? guide.direction.name : ''}`;
      } else if (guide.distance <= 0) {
        this.el.navMeta.textContent = `${guide.target.mapName} · 已抵达附近`;
      } else {
        this.el.navMeta.textContent = `${guide.target.mapName} · ${guide.distance} 步 · ${guide.direction ? guide.direction.name : ''}`;
      }
      this.el.navArrow.style.transform = `rotate(${guide.direction ? guide.direction.angle : 0}deg)`;
    },

    updateMiniMap() {
      if (!this.el.minimapCanvas || this.screen !== 'game' || !G.state) return;
      const map = G.currentMap();
      const guide = PKM.GUIDE ? PKM.GUIDE.current : null;
      const ctx = this.el.minimapCanvas.getContext('2d');
      PKM.RENDER.drawMiniMap(ctx, map, G.state, guide, G.time || performance.now() / 1000);
      this.el.minimapName.textContent = map.name;
      this.el.minimapObjective.textContent = guide && guide.target ? '◆ ' + guide.target.label : '◆ 暂无目标';
      this.el.minimapTime.textContent = G.clockLabel();
    },

    renderPartyDock() {
      const s = G.state;
      let html = '';
      for (let i = 0; i < 6; i++) {
        const m = s.party[i];
        if (!m) { html += '<div class="dock-empty"></div>'; continue; }
        const pct = Math.max(0, m.hp / m.maxHp * 100);
        const cls = pct < 22 ? 'low' : pct < 50 ? 'mid' : '';
        html += `<div class="dock-slot ${m.hp <= 0 ? 'dead' : ''} ${i === 0 ? 'lead' : ''}" title="${G.nameOf(m)} Lv.${m.level}">
          <canvas width="64" height="64" data-dock="${i}"></canvas>
          <div class="dock-hp"><i class="${cls}" style="width:${pct}%"></i></div>
        </div>`;
      }
      this.el.partyDock.innerHTML = html;
      this.el.partyDock.querySelectorAll('canvas[data-dock]').forEach(c => {
        const m = s.party[+c.dataset.dock];
        PKM.ART.drawMonsterCanvas(c, m.species, 0, false);
      });
    },

    updatePrompt() {
      if (!G.state || this.screen !== 'game' || this.isBlocking() || PKM.BATTLE.active) {
        if (!this.el.prompt.classList.contains('hidden')) this.el.prompt.classList.add('hidden');
        return;
      }
      if (G.move) { this.el.prompt.classList.add('hidden'); return; }
      const f = G.facing();
      let text = '';
      const npc = G.npcAt(f.x, f.y);
      if (npc) {
        const tr = npc.trainer ? D.TRAINERS[npc.trainer] : null;
        if (tr && !G.state.flags[tr.flag]) text = `挑战 ${npc.name}`;
        else if (npc.id === 'rival_route' && !G.state.flags.rival1Defeated) text = '与 小岚 对战';
        else text = `与 ${npc.name} 交谈`;
      } else {
        const b = G.buildingAt(f.x, f.y);
        if (b && b.door && b.door.x === f.x && b.door.y === f.y) {
          text = b.type === 'shop' ? '购物' : b.type === 'heal' ? '休息' : b.type === 'gym' ? '进入道馆' : b.type === 'home' ? '回家' : b.type === 'shrine' ? '查看祭坛' : '调查';
        }
      }
      if (!text) {
        const it = G.itemAt(f.x, f.y);
        if (it) text = `拾取 ${D.ITEMS[it.item].name}`;
      }
      if (!text) {
        const p = G.propAt(f.x, f.y);
        if (p && p.type === 'sign') text = '阅读木牌';
        else if (p && p.type === 'gate') text = '查看结界';
        else if (p && p.type === 'waypoint') text = '使用传送点 / 查看地图';
      }
      if (!text) {
        const t = G.tileAt(f.x, f.y);
        if (t === '~' && G.state.bag.rod) text = '钓鱼';
      }
      if (text !== this.promptText) {
        this.promptText = text;
        if (text) {
          this.el.promptText.textContent = text;
          this.el.prompt.classList.remove('hidden');
        } else {
          this.el.prompt.classList.add('hidden');
        }
      }
    },

    /* ============================================================
       对话
       ============================================================ */
    dialog(opts) {
      if (this.dialogOpen) return;
      if (!opts) return;
      G.stopAutoMove();
      let lines = opts.lines || [];
      if (typeof lines === 'string') lines = [lines];
      lines = lines.map(l => typeof l === 'string' ? { text: l } : l);
      if (!lines.length) { if (opts.onDone) opts.onDone(); return; }
      this.dialogOpen = true;
      this.dialogLines = lines;
      this.dialogIndex = 0;
      this.dialogSpeaker = opts.speaker || '';
      this.dialogOnDone = opts.onDone || null;
      this.dialogChoices = opts.choices || null;
      this.el.dialogueLayer.classList.remove('hidden');
      this.el.dialogueChoices.classList.add('hidden');
      this.el.dialogueChoices.innerHTML = '';
      this.typeDialogLine();
    },

    typeDialogLine() {
      const line = this.dialogLines[this.dialogIndex];
      this.el.dialogueSpeaker.textContent = line.speaker || this.dialogSpeaker || '旅人';
      this.el.dialogueSpeaker.style.display = (line.speaker || this.dialogSpeaker) ? '' : 'none';
      const full = line.text;
      this.el.dialogueText.textContent = '';
      this.el.dialogueNext.classList.add('hidden');
      this.dialogTyping = true;
      let i = 0;
      clearInterval(this.typeTimer);
      this.typeTimer = setInterval(() => {
        i += 2;
        this.el.dialogueText.textContent = full.slice(0, i);
        if (i >= full.length) {
          clearInterval(this.typeTimer);
          this.typeTimer = null;
          this.dialogTyping = false;
          this.el.dialogueText.textContent = full;
          const last = this.dialogIndex >= this.dialogLines.length - 1;
          if (last && this.dialogChoices) this.showDialogChoices();
          else this.el.dialogueNext.classList.remove('hidden');
        }
      }, 18);
    },

    showDialogChoices() {
      this.el.dialogueNext.classList.add('hidden');
      this.el.dialogueChoices.classList.remove('hidden');
      this.el.dialogueChoices.innerHTML = '';
      this.dialogChoicesVisible = true;
      this.dialogChoiceIndex = 0;
      this.dialogChoices.forEach((c, i) => {
        const b = document.createElement('button');
        b.textContent = c.label;
        if (i === 0) b.classList.add('focused');
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          PKM.AUDIO.sfx('select');
          const fn = c.onSelect;
          this.closeDialog();
          if (fn) fn();
        });
        this.el.dialogueChoices.appendChild(b);
      });
    },

    moveDialogChoice(delta) {
      const btns = Array.from(this.el.dialogueChoices.querySelectorAll('button'));
      if (!btns.length) return;
      this.dialogChoiceIndex = (this.dialogChoiceIndex + delta + btns.length) % btns.length;
      btns.forEach((b, i) => b.classList.toggle('focused', i === this.dialogChoiceIndex));
      PKM.AUDIO.sfx('move');
    },

    advanceDialog() {
      if (!this.dialogOpen) return;
      if (this.dialogTyping) {
        clearInterval(this.typeTimer);
        this.typeTimer = null;
        this.dialogTyping = false;
        const line = this.dialogLines[this.dialogIndex];
        this.el.dialogueText.textContent = line.text;
        if (this.dialogIndex >= this.dialogLines.length - 1 && this.dialogChoices) this.showDialogChoices();
        else this.el.dialogueNext.classList.remove('hidden');
        return;
      }
      if (this.dialogIndex < this.dialogLines.length - 1) {
        PKM.AUDIO.sfx('move');
        this.dialogIndex++;
        this.typeDialogLine();
      } else if (this.dialogChoices && this.el.dialogueChoices.classList.contains('hidden')) {
        this.showDialogChoices();
      } else if (!this.dialogChoices) {
        this.closeDialog();
      }
    },

    closeDialog() {
      if (!this.dialogOpen) return;
      clearInterval(this.typeTimer);
      this.typeTimer = null;
      this.dialogTyping = false;
      this.dialogOpen = false;
      this.dialogChoicesVisible = false;
      this.el.dialogueLayer.classList.add('hidden');
      const cb = this.dialogOnDone;
      this.dialogOnDone = null;
      this.dialogChoices = null;
      if (cb) cb();
    },

    /* ============================================================
       NPC / 剧情
       ============================================================ */
    npcInteract(npc) {
      if (this.isBlocking() && !this.dialogOpen) return;
      const fn = D.DIALOGUES[npc.dialog];
      const data = fn ? fn(G.state) : { speaker: npc.name, lines: ['……'] };
      let battleId = null;
      if (npc.trainer && !G.state.flags[D.TRAINERS[npc.trainer].flag]) {
        const tr = D.TRAINERS[npc.trainer];
        if (npc.id === 'leader' && !G.state.flags.gymGateOpen) {
          battleId = null;
        } else {
          battleId = npc.trainer;
        }
        if (npc.id === 'leader' && G.state.flags.badge) battleId = null;
      }
      if (npc.id === 'rival_route' && !G.state.flags.rival1Defeated) battleId = 'rival1';
      const opts = {
        speaker: data.speaker || npc.name,
        lines: data.lines,
        onDone: () => {
          if (data.effect) G.applyEffect(data.effect);
          if (battleId) this.startTrainer(battleId);
        }
      };
      this.dialog(opts);
    },

    startTrainer(id) {
      if (PKM.BATTLE.active) return;
      G.stopAutoMove();
      this.battleStarting = true;
      PKM.AUDIO.sfx('encounter');
      this.screenFlash();
      setTimeout(() => {
        this.battleStarting = false;
        PKM.BATTLE.startTrainer(id);
      }, 240);
    },

    storyTrigger(trg) {
      if (trg.id === 'rival_scene') {
        if (G.state.flags.rivalSceneDone) return;
        G.state.flags.rivalSceneDone = true;
        G.autoSave();
        PKM.AUDIO.sfx('encounter');
        const tr = D.TRAINERS.rival1;
        this.dialog({
          speaker: '小岚', lines: tr.intro,
          onDone: () => this.startTrainer('rival1')
        });
      }
    },

    afterBattle(res) {
      this.updateHUD();
      if (!res || res.result === 'lose') return;
      const s = G.state;
      if (res.kind === 'trainer' && res.result === 'win') {
        if (res.trainerId === 'shadow') {
          G.healParty();
          this.dialog({
            speaker: '影蚀',
            lines: [
              '影蚀：……原来如此。',
              '影蚀：光不是在祭坛里，而是在愿意为它停下来的人身上。',
              '他的身影变得很淡，像一片被风吹散的灰。',
              '光苔的暖意涌进伙伴们的身体，疲惫一点点退去。',
              '祭坛深处，忽然传来一声低沉的呼吸。'
            ],
            onDone: () => {
              this.dialog({
                speaker: '森林祭坛',
                lines: D.TRAINERS.boss.intro,
                onDone: () => this.startTrainer('boss')
              });
            }
          });
        } else if (res.trainerId === 'boss') {
          this.showEnding();
        } else if (res.trainerId === 'leader') {
          this.toast('获得森语徽章 · 森林北门已开启', 'badge', 'quest');
        } else if (res.trainerId === 'rival1') {
          this.toast('小岚暂时收起了胜负心', null, '');
        }
      }
      if (res.kind === 'wild' && res.result === 'caught') {
        if (res.data && res.data.species === 'guardian') {
          s.flags.legendaryCaught = true;
          s.flags.legendaryBattleDone = true;
          G.autoSave();
          this.dialog({
            speaker: '森之守望者',
            lines: [
              '光冠上的露水落进你掌心，凉凉的。',
              '它低下头，把额头轻轻抵在你的图鉴上。',
              '图鉴的最后一页，自己写上了一行小字：',
              '「森林会记得，你曾经为它停下来。」'
            ]
          });
          this.toast('图鉴完成：森之守望者', 'badge', 'quest');
        } else {
          this.toast('图鉴更新了', 'dex', '');
        }
      }
      G.autoSave();
    },

    shrineEvent() {
      const s = G.state;
      if (!s.flags.badge) {
        this.dialog({ speaker: '森林祭坛', lines: ['祭坛被一层厚厚的苔光包住。', '光里传来低沉的心跳声。', '或许，溪桥道馆的徽章能让你靠近它。'] });
        return;
      }
      if (!s.flags.shadowDefeated) {
        PKM.AUDIO.sfx('encounter');
        this.dialog({
          speaker: '影蚀',
          lines: D.TRAINERS.shadow.intro,
          onDone: () => this.startTrainer('shadow')
        });
        return;
      }
      if (!s.flags.bossDefeated) {
        this.dialog({
          speaker: '森林祭坛',
          lines: D.TRAINERS.boss.intro,
          onDone: () => this.startTrainer('boss')
        });
        return;
      }
      if (!s.flags.forestCleared) {
        this.showEnding();
        return;
      }
      if (G.aliveParty().length === 0) {
        this.dialog({ speaker: '祭坛', lines: ['伙伴们都太累了。', '先回去休息吧。'] });
        return;
      }
      if (!s.flags.legendaryCaught) {
        this.dialog({
          speaker: '森林祭坛',
          lines: [
            '祭坛中央浮着一团温暖的光。',
            '光里蜷着一只额前生着花冠的鹿。',
            '它没有睁开眼睛，只是轻轻动了动耳朵，像是在等一个名字。'
          ],
          choices: [
            { label: '唤醒沉睡的光', onSelect: () => this.startGuardian() },
            { label: '暂时离开', onSelect: () => {} }
          ]
        });
      } else {
        this.dialog({ speaker: '森林祭坛', lines: ['祭坛上留着一小片温暖的光。', '森之守望者正在光里做梦。', '森林很好。你也是。'] });
      }
    },

    startGuardian() {
      if (G.aliveParty().length === 0) return;
      this.screenFlash();
      PKM.AUDIO.sfx('encounter');
      this.battleStarting = true;
      setTimeout(() => {
        this.battleStarting = false;
        PKM.BATTLE.startWild('guardian', 20);
      }, 300);
    },

    /* ============================================================
       地图 / 转场
       ============================================================ */
    fadeTransition(fn) {
      if (this.transitioning) return;
      this.transitioning = true;
      G.paused = true;
      this.el.fade.classList.add('active');
      setTimeout(() => {
        try { if (fn) fn(); } catch (e) { console.error(e); }
        setTimeout(() => {
          this.el.fade.classList.remove('active');
          this.transitioning = false;
          G.paused = false;
          this.updateHUD();
        }, 220);
      }, 380);
    },

    mapBanner(name, sub) {
      clearTimeout(this.bannerTimer);
      this.el.bannerName.textContent = name;
      this.el.bannerSub.textContent = sub || '';
      this.el.mapBanner.classList.add('show');
      this.bannerTimer = setTimeout(() => this.el.mapBanner.classList.remove('show'), 2300);
    },

    screenFlash() {
      this.el.flash.classList.remove('flash');
      void this.el.flash.offsetWidth;
      this.el.flash.classList.add('flash');
    },

    /* ============================================================
       旅途地图 / 快速移动
       ============================================================ */
    openMap() {
      if (this.mapOpen) return;
      if (this.screen !== 'game' || this.dialogOpen || this.shopOpen || this.modalOpen || this.menuOpen ||
        this.busy || this.transitioning || this.battleStarting || PKM.BATTLE.active) return;
      G.stopAutoMove();
      this.mapOpen = true;
      G.paused = true;
      this.el.mapLayer.classList.remove('hidden');
      if (PKM.GUIDE) PKM.GUIDE.refresh(true);
      this.renderMap();
      PKM.AUDIO.sfx('open');
    },

    closeMap() {
      if (!this.mapOpen) return;
      this.mapOpen = false;
      this.el.mapLayer.classList.add('hidden');
      G.paused = false;
      if (PKM.GUIDE) PKM.GUIDE.refresh(true);
      this.updateNav();
      PKM.AUDIO.sfx('cancel');
    },

    toggleGuide() {
      const s = G.state;
      s.settings.guide = s.settings.guide === false;
      G.autoSave();
      if (PKM.GUIDE) PKM.GUIDE.refresh(true);
      this.renderMap();
      this.updateNav();
      PKM.AUDIO.sfx('select');
      this.toast(s.settings.guide ? '导航线已开启' : '导航线已关闭', null, '');
    },

    renderMap() {
      const s = G.state;
      if (!s) return;
      const map = G.currentMap();
      const guide = PKM.GUIDE ? PKM.GUIDE.refresh(true) : null;
      const wpCount = Object.keys(s.waypoints || {}).length;
      this.el.mapTime.textContent = `${G.clockLabel()} · ${G.phaseLabel()}`;
      this.el.mapMoney.textContent = '₽ ' + s.money;
      this.el.mapAreaName.textContent = map.name;
      this.el.mapWpCount.textContent = wpCount;
      if (this.el.mapWpTotal) this.el.mapWpTotal.textContent = (D.WAYPOINTS || []).length;
      this.el.mapObjectiveName.textContent = guide && guide.target ? guide.target.label : '暂无目标';
      this.el.mapGuideToggle.textContent = '导航线 ' + (s.settings.guide === false ? '关' : '开');
      const note = document.getElementById('map-region-note');
      if (note) {
        if (s.settings.guide === false) note.textContent = '导航线已关闭，但地图与小地图仍会显示当前位置、任务目标和已记录的传送点。';
        else if (!guide || !guide.target) note.textContent = '所有主要目标都已完成。可以去溪桥桥头听水，或回青苔镇看看妈妈。';
        else if (guide.transfer) note.textContent = `当前追踪「${guide.target.label}」。沿黄色虚线前往${D.MAPS[guide.transfer.to] ? D.MAPS[guide.transfer.to].name : '出口'}，再继续前往${guide.target.mapName}。`;
        else note.textContent = `当前追踪「${guide.target.label}」。沿黄色虚线走 ${guide.distance} 步即可抵达；目标头顶会有浮动的金色标记。`;
      }
      this.drawRegionMap(guide);
      this.drawLocalMap(guide);
      this.renderWaypointList();
    },

    drawRegionMap(guide) {
      const c = this.el.regionMap;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      // parchment
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#dbc69e');
      grad.addColorStop(.55, '#d1b98e');
      grad.addColorStop(1, '#c6ac80');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = i % 3 ? 'rgba(100,78,48,.10)' : 'rgba(255,248,225,.20)';
        ctx.fillRect((i * 73 + 17) % W, (i * 47 + 31) % H, 1, 1);
      }
      // border
      ctx.strokeStyle = '#806b4a'; ctx.lineWidth = 2; ctx.strokeRect(5, 5, W - 10, H - 10);
      ctx.strokeStyle = 'rgba(120,94,58,.35)'; ctx.lineWidth = 1; ctx.strokeRect(10, 10, W - 20, H - 20);
      // mountains
      for (const [x, y, s] of [[55, 74, 1], [100, 55, .8], [150, 82, .65], [500, 85, .8]]) {
        ctx.fillStyle = 'rgba(87, 94, 68, .30)';
        ctx.beginPath(); ctx.moveTo(x - 34 * s, y + 22 * s); ctx.lineTo(x, y - 28 * s); ctx.lineTo(x + 34 * s, y + 22 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(246, 239, 209, .22)';
        ctx.beginPath(); ctx.moveTo(x, y - 28 * s); ctx.lineTo(x + 11 * s, y - 8 * s); ctx.lineTo(x - 7 * s, y - 8 * s); ctx.closePath(); ctx.fill();
      }
      // forest masses
      const forest = (x, y, n, spread) => {
        for (let i = 0; i < n; i++) {
          const fx = x + Math.cos(i * 2.3) * spread * (.35 + (i % 3) * .25);
          const fy = y + Math.sin(i * 1.7) * spread * .45;
          ctx.fillStyle = i % 3 === 0 ? '#466648' : i % 3 === 1 ? '#3b5b42' : '#53734c';
          ctx.beginPath(); ctx.moveTo(fx - 13, fy + 14); ctx.lineTo(fx, fy - 18); ctx.lineTo(fx + 13, fy + 14); ctx.closePath(); ctx.fill();
        }
      };
      forest(288, 92, 18, 100);
      forest(470, 110, 8, 45);
      forest(80, 218, 6, 40);
      forest(500, 285, 6, 42);
      // river
      ctx.strokeStyle = '#7fa6a0'; ctx.lineWidth = 16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(400, 20); ctx.bezierCurveTo(430, 90, 360, 140, 405, 200); ctx.bezierCurveTo(435, 250, 390, 310, 370, 358); ctx.stroke();
      ctx.strokeStyle = '#9bc0b3'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(400, 20); ctx.bezierCurveTo(430, 90, 360, 140, 405, 200); ctx.bezierCurveTo(435, 250, 390, 310, 370, 358); ctx.stroke();
      ctx.strokeStyle = 'rgba(236,247,220,.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(403, 24); ctx.bezierCurveTo(428, 92, 361, 143, 406, 202); ctx.bezierCurveTo(432, 251, 391, 311, 373, 354); ctx.stroke();
      // roads
      const roads = [
        [[120, 280], [165, 252], [224, 207]],
        [[238, 207], [300, 214], [388, 227]],
        [[236, 206], [255, 160], [276, 112]],
        [[392, 228], [428, 258], [468, 300]],
        [[388, 230], [350, 268], [320, 300]],
        [[394, 222], [455, 195], [520, 165]],
        [[276, 96], [195, 98], [115, 100]]
      ];
      ctx.strokeStyle = 'rgba(120, 91, 53, .55)'; ctx.lineWidth = 4; ctx.setLineDash([2, 8]);
      for (const road of roads) {
        ctx.beginPath(); road.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      }
      ctx.setLineDash([]);
      // region route highlight
      if (guide && guide.enabled && guide.target && PKM.GUIDE.mapRoute) {
        const route = PKM.GUIDE.mapRoute(G.state.map, guide.target.map);
        const nodes = this.regionNodes();
        if (route && route.length > 1) {
          ctx.strokeStyle = 'rgba(226, 172, 72, .95)'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
          ctx.beginPath();
          route.forEach((id, i) => {
            const n = nodes[id]; if (!n) return;
            i ? ctx.lineTo(n.x, n.y) : ctx.moveTo(n.x, n.y);
          });
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      // nodes
      const nodes = this.regionNodes();
      const current = G.state.map;
      const targetMap = guide && guide.target ? guide.target.map : null;
      for (const [id, n] of Object.entries(nodes)) {
        const visited = !!G.state.flags['visited_' + id];
        const isCurrent = id === current;
        const isTarget = id === targetMap;
        const wp = (D.WAYPOINTS || []).find(w => w.map === id);
        const unlocked = wp && G.state.waypoints && G.state.waypoints[wp.id];
        if (isCurrent) {
          const pulse = .35 + .2 * Math.sin(performance.now() / 380);
          ctx.fillStyle = `rgba(239, 197, 99, ${pulse})`;
          ctx.beginPath(); ctx.arc(n.x, n.y, 27, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = 'rgba(79, 63, 40, .35)';
        ctx.beginPath(); ctx.ellipse(n.x, n.y + 18, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(n.x, n.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = visited ? '#e9d8b1' : '#b7a988';
        ctx.fill();
        ctx.strokeStyle = isCurrent ? '#b98535' : visited ? '#6b805e' : '#8d806b';
        ctx.lineWidth = isCurrent ? 4 : 2; ctx.stroke();
        // icons
        this.drawRegionIcon(ctx, n.x, n.y, n.icon, visited);
        // waypoint
        if (unlocked) {
          ctx.save(); ctx.translate(n.x + 17, n.y - 17); ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#4f8b77'; ctx.fillRect(-4, -4, 8, 8);
          ctx.fillStyle = '#e9dfbd'; ctx.fillRect(-2, -2, 4, 4);
          ctx.restore();
        }
        // labels
        ctx.textAlign = 'center';
        ctx.font = '700 13px "SimSun", serif';
        ctx.fillStyle = isCurrent ? '#3c4c33' : '#594a34';
        ctx.fillText(n.label, n.x, n.y + 39);
        ctx.font = '9px "SimSun", serif';
        ctx.fillStyle = '#816f50';
        ctx.fillText(visited ? n.sub : '未探索', n.x, n.y + 52);
        // objective marker
        if (isTarget) {
          const bob = Math.sin(performance.now() / 300) * 2;
          ctx.save(); ctx.translate(n.x, n.y - 38 + bob); ctx.rotate(Math.PI / 4);
          ctx.fillStyle = 'rgba(201, 96, 81, .25)'; ctx.fillRect(-9, -9, 18, 18);
          ctx.fillStyle = '#c96051'; ctx.fillRect(-6, -6, 12, 12);
          ctx.fillStyle = '#fff3d5'; ctx.fillRect(-2, -2, 4, 4);
          ctx.restore();
        }
        if (isCurrent) {
          ctx.fillStyle = '#f0ce75';
          ctx.beginPath(); ctx.moveTo(n.x, n.y - 30); ctx.lineTo(n.x + 6, n.y - 23); ctx.lineTo(n.x - 6, n.y - 23); ctx.closePath(); ctx.fill();
        }
      }
      // compass
      ctx.save();
      ctx.translate(48, 315);
      ctx.fillStyle = 'rgba(90, 76, 50, .55)';
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#eee1bf';
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9b4f41';
      ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(4, 0); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4f6047';
      ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(4, 0); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
      ctx.font = '700 9px "Consolas", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#5a4b35';
      ctx.fillText('N', 0, -24);
      ctx.restore();
      // subtle vignette
      const v = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 380);
      v.addColorStop(0, 'rgba(70, 50, 28, 0)'); v.addColorStop(1, 'rgba(70, 50, 28, .18)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    },

    regionNodes() {
      return {
        town: { x: 120, y: 280, label: '青苔镇', sub: '风会记住脚印', icon: 'town' },
        route: { x: 234, y: 206, label: '微风小径', sub: '草叶与暖石', icon: 'route' },
        brook: { x: 390, y: 226, label: '溪桥镇', sub: '水声洗亮日子', icon: 'brook' },
        gym: { x: 468, y: 300, label: '森语道馆', sub: '三盏苔灯', icon: 'gym' },
        forest: { x: 278, y: 94, label: '萤火森林', sub: '光在呼吸', icon: 'forest' },
        glen: { x: 320, y: 300, label: '萤光溪谷', sub: '水把萤火带走', icon: 'glen' },
        mist: { x: 520, y: 165, label: '雾松山道', sub: '云从脚下走过', icon: 'mist' },
        hollow: { x: 115, y: 100, label: '古树洞窟', sub: '树根的回声', icon: 'hollow' }
      };
    },

    drawRegionIcon(ctx, x, y, icon, visited) {
      ctx.save();
      ctx.translate(x, y + 1);
      const c1 = visited ? '#496042' : '#7f7661';
      if (icon === 'town') {
        ctx.fillStyle = c1; ctx.fillRect(-8, -4, 16, 10);
        ctx.fillStyle = visited ? '#8d5543' : '#8b7762';
        ctx.beginPath(); ctx.moveTo(-11, -4); ctx.lineTo(0, -13); ctx.lineTo(11, -4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#eadcb8'; ctx.fillRect(-2, 0, 4, 6);
      } else if (icon === 'route') {
        ctx.fillStyle = c1; ctx.fillRect(-10, 2, 20, 2);
        ctx.fillStyle = visited ? '#6f9a53' : '#887e66';
        ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(-2, -9); ctx.lineTo(4, 2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(7, -6); ctx.lineTo(12, 2); ctx.closePath(); ctx.fill();
      } else if (icon === 'brook') {
        ctx.fillStyle = c1; ctx.fillRect(-11, -1, 22, 3);
        ctx.fillStyle = '#e7d8b4'; ctx.fillRect(-9, -4, 2, 8); ctx.fillRect(7, -4, 2, 8);
        ctx.fillStyle = visited ? '#6d9b9d' : '#8d8572';
        ctx.fillRect(-13, 5, 26, 2);
      } else if (icon === 'forest') {
        ctx.fillStyle = c1; ctx.fillRect(-2, 4, 4, 8);
        ctx.beginPath(); ctx.moveTo(-11, 5); ctx.lineTo(0, -14); ctx.lineTo(11, 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = visited ? '#7f9f63' : '#93866a';
        ctx.beginPath(); ctx.moveTo(-7, 1); ctx.lineTo(0, -9); ctx.lineTo(7, 1); ctx.closePath(); ctx.fill();
      } else if (icon === 'glen') {
        ctx.fillStyle = visited ? '#5f9a9c' : '#8e8572';
        ctx.fillRect(-12, 1, 24, 4);
        ctx.fillRect(-8, 6, 16, 2);
        ctx.fillStyle = visited ? '#d8e8bb' : '#b3a98f';
        ctx.beginPath(); ctx.arc(-7, 1, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = visited ? '#e7c76d' : '#918570';
        ctx.fillRect(6, -7, 4, 4);
      } else if (icon === 'mist') {
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.moveTo(-13, 8); ctx.lineTo(-2, -13); ctx.lineTo(9, 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = visited ? '#e7e1c8' : '#aaa08a';
        ctx.fillRect(-11, -2, 12, 2); ctx.fillRect(1, -4, 9, 2);
        ctx.fillStyle = visited ? '#c8d4b0' : '#9f9480';
        ctx.beginPath(); ctx.moveTo(-2, -13); ctx.lineTo(3, -4); ctx.lineTo(-7, -4); ctx.closePath(); ctx.fill();
      } else if (icon === 'hollow') {
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.arc(0, 3, 12, Math.PI, 0); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2d2927';
        ctx.beginPath(); ctx.arc(0, 5, 7, Math.PI, 0); ctx.lineTo(7, 10); ctx.lineTo(-7, 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = visited ? '#7ae3cf' : '#958c78';
        ctx.fillRect(-1, -4, 2, 5);
      } else {
        ctx.fillStyle = c1; ctx.fillRect(-8, -5, 16, 13);
        ctx.fillStyle = visited ? '#d3b764' : '#918772';
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c1; ctx.fillRect(-2, -2, 4, 4);
        ctx.strokeStyle = visited ? '#d3b764' : '#8e8370'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, -13); ctx.stroke();
      }
      ctx.restore();
    },

    drawLocalMap(guide) {
      const c = this.el.localMap;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const W = c.width, H = c.height;
      const map = G.currentMap();
      const s = G.state;
      ctx.fillStyle = '#1a3326'; ctx.fillRect(0, 0, W, H);
      const scale = Math.max(4, Math.min(9, Math.floor(Math.min((W - 24) / map.w, (H - 30) / map.h))));
      const ox = Math.floor((W - map.w * scale) / 2);
      const oy = Math.floor((H - map.h * scale) / 2 + 3);
      const colors = {
        '.': '#6f9a53', ',': '#4f7c3f', 'p': '#c8ad78', 'f': '#7aa75b', '~': '#3f7f86', '=': '#a57b4e',
        '#': '#2c5139', 'T': '#284a33', 'r': '#8b8d7d', 'm': '#9d5d6d', 'g': '#6fbba0', 's': '#8d9080',
        'W': '#59665a', 'o': '#9b7047', '*': '#b9c795', 'x': '#4e4238'
      };
      for (let y = 0; y < map.h; y++) {
        for (let x = 0; x < map.w; x++) {
          const t = map.tiles[y][x];
          ctx.fillStyle = colors[t] || '#6f9a53';
          ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
          if (t === ',' && scale >= 5) {
            ctx.fillStyle = 'rgba(35,75,43,.5)';
            ctx.fillRect(ox + x * scale + 1, oy + y * scale + 2, 1, Math.max(2, scale - 3));
          }
        }
      }
      // buildings
      for (const b of map.buildings || []) {
        ctx.fillStyle = b.type === 'gym' ? '#6d8b62' : b.type === 'shrine' ? '#96a37f' : '#b9634d';
        ctx.fillRect(ox + b.x * scale + 1, oy + b.y * scale + 1, b.w * scale - 2, b.h * scale - 2);
        ctx.fillStyle = '#5d4836';
        ctx.fillRect(ox + b.x * scale + 1, oy + (b.y + b.h - 1) * scale + 1, b.w * scale - 2, Math.max(1, scale - 2));
        if (b.door) {
          ctx.fillStyle = '#f0ce75';
          ctx.fillRect(ox + b.door.x * scale + Math.max(1, scale / 3), oy + b.door.y * scale + Math.max(1, scale / 3), Math.max(1, scale / 3), Math.max(1, scale / 3));
        }
      }
      // guide route
      if (guide && guide.enabled && guide.path && guide.path.length > 1) {
        ctx.strokeStyle = 'rgba(244, 211, 123, .9)'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 3]);
        ctx.beginPath();
        guide.path.forEach((p, i) => {
          const px = ox + p.x * scale + scale / 2, py = oy + p.y * scale + scale / 2;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.stroke(); ctx.setLineDash([]);
      }
      // waypoints
      for (const wp of D.WAYPOINTS || []) {
        if (wp.map !== map.id) continue;
        const on = s.waypoints && s.waypoints[wp.id];
        const px = ox + wp.x * scale + scale / 2, py = oy + wp.y * scale + scale / 2;
        ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = on ? '#65c3a2' : '#7d8579';
        ctx.fillRect(-3, -3, 6, 6);
        ctx.fillStyle = on ? '#efffea' : '#b7b5a8';
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      }
      // NPC dots
      for (const n of D.NPCS.filter(n => n.map === map.id && !(n.hideFlag && s.flags[n.hideFlag]))) {
        const px = ox + n.x * scale + scale / 2, py = oy + n.y * scale + scale / 2;
        ctx.fillStyle = n.trainer ? '#c96051' : '#e9dfbd';
        ctx.fillRect(px - 1, py - 1, 3, 3);
        ctx.fillStyle = '#40503d';
        ctx.fillRect(px, py, 1, 1);
      }
      // items
      for (const it of map.items || []) {
        if (s.flags['item_' + map.id + '_' + it.id]) continue;
        const px = ox + it.x * scale + scale / 2, py = oy + it.y * scale + scale / 2;
        ctx.fillStyle = '#fff2ad'; ctx.fillRect(px - 1, py - 1, 2, 2);
      }
      // target
      if (guide && guide.enabled && guide.localTarget) {
        const px = ox + guide.localTarget.x * scale + scale / 2;
        const py = oy + guide.localTarget.y * scale + scale / 2;
        const bob = Math.sin(performance.now() / 300) * 1.5;
        ctx.save(); ctx.translate(px, py - 7 + bob); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = 'rgba(201,96,81,.25)'; ctx.fillRect(-7, -7, 14, 14);
        ctx.fillStyle = '#c96051'; ctx.fillRect(-4, -4, 8, 8);
        ctx.fillStyle = '#fff3d5'; ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,243,213,.5)'; ctx.strokeRect(px - scale / 2, py - scale / 2, scale, scale);
      }
      // player marker
      {
        const px = ox + s.player.x * scale + scale / 2, py = oy + s.player.y * scale + scale / 2;
        ctx.fillStyle = 'rgba(240,206,117,.25)';
        ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f0ce75'; ctx.fillRect(px - 3, py - 3, 6, 6);
        ctx.fillStyle = '#fffbe8'; ctx.fillRect(px - 1, py - 1, 2, 2);
        ctx.strokeStyle = '#304332'; ctx.lineWidth = 1; ctx.strokeRect(px - 3.5, py - 3.5, 7, 7);
      }
      // frame and caption
      ctx.strokeStyle = '#84704b'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2);
      ctx.fillStyle = 'rgba(8,22,15,.6)'; ctx.fillRect(7, H - 20, map.name.length * 11 + 18, 14);
      ctx.fillStyle = '#eee2c5'; ctx.font = '700 10px "SimSun", serif'; ctx.textAlign = 'left';
      ctx.fillText(map.name, 13, H - 10);
    },

    renderWaypointList() {
      const s = G.state;
      const rows = (D.WAYPOINTS || []).map(wp => {
        const unlocked = !!(s.waypoints && s.waypoints[wp.id]);
        const here = s.map === wp.map;
        return `<div class="wp-row ${unlocked ? '' : 'locked'} ${here ? 'current' : ''}" title="${wp.desc}">
          <div class="wp-icon">${unlocked ? '⌖' : '?'}</div>
          <div class="wp-main"><div class="wp-name">${wp.name}</div><div class="wp-area">${D.MAPS[wp.map].name}${here ? ' · 当前位置' : ''}</div></div>
          <button class="wp-travel" data-wp="${wp.id}" ${!unlocked || here ? 'disabled' : ''}>${!unlocked ? '未记录' : here ? '在此' : '传送'}</button>
        </div>`;
      }).join('');
      this.el.mapWaypointList.innerHTML = rows;
      this.el.mapWaypointList.querySelectorAll('[data-wp]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.wp;
          if (!G.state.waypoints[id] || G.state.map === (D.WAYPOINTS.find(w => w.id === id) || {}).map) return;
          PKM.AUDIO.sfx('select');
          this.fastTravel(id);
        });
      });
    },

    fastTravel(id) {
      const wp = (D.WAYPOINTS || []).find(w => w.id === id);
      if (!wp || !G.state.waypoints[id]) return;
      this.closeMap();
      this.fadeTransition(() => {
        G.fastTravel(id);
      });
    },

    /* ============================================================
       商店
       ============================================================ */
    openShop(id) {
      if (this.shopOpen || PKM.BATTLE.active) return;
      G.stopAutoMove();
      const shop = D.SHOPS[id] || D.SHOPS.town;
      this.shopOpen = true;
      this.shopId = id;
      this.shopSel = shop.stock[0];
      this.shopQty = 1;
      G.paused = true;
      this.el.shopLayer.classList.remove('hidden');
      this.renderShop();
      PKM.AUDIO.sfx('open');
    },

    closeShop() {
      this.shopOpen = false;
      this.el.shopLayer.classList.add('hidden');
      G.paused = false;
      PKM.AUDIO.sfx('cancel');
    },

    renderShop() {
      const shop = D.SHOPS[this.shopId] || D.SHOPS.town;
      const money = G.state.money;
      this.el.shopTitle.textContent = shop.name;
      this.el.shopMoney.textContent = money;
      this.el.shopList.innerHTML = shop.stock.map(id => {
        const it = D.ITEMS[id];
        return `<button class="shop-item ${this.shopSel === id ? 'sel' : ''}" data-shop-item="${id}">
          <canvas width="24" height="24" data-shop-icon="${id}"></canvas>
          <span class="shop-name">${it.name}</span>
          <span class="shop-price">₽ ${it.price}</span>
        </button>`;
      }).join('');
      this.el.shopList.querySelectorAll('canvas[data-shop-icon]').forEach(c => PKM.ART.drawItemIcon(c, c.dataset.shopIcon));
      this.el.shopList.querySelectorAll('[data-shop-item]').forEach(b => {
        b.addEventListener('click', () => {
          this.shopSel = b.dataset.shopItem;
          this.shopQty = 1;
          this.renderShop();
          PKM.AUDIO.sfx('move');
        });
      });
      const item = D.ITEMS[this.shopSel];
      const total = item.price * this.shopQty;
      this.el.shopDetail.innerHTML = `
        <canvas class="big-icon" width="64" height="64" data-big-icon="${this.shopSel}"></canvas>
        <h3>${item.name}</h3>
        <p>${item.desc}</p>
        <div class="qty-row">
          <button data-shop-qty="-1">−</button><b>${this.shopQty}</b><button data-shop-qty="1">＋</button>
        </div>
        <div class="buy-row">
          <span class="buy-total">₽ ${total}</span>
          <button class="pixel-btn gold" data-shop-buy ${total > money ? 'disabled' : ''}>购买</button>
        </div>
        <small style="margin-top:8px;color:#8a7758;font-size:9px;">持有 ₽ ${money} · 精灵球和伤药会放进背包</small>`;
      PKM.ART.drawItemIcon(this.el.shopDetail.querySelector('canvas'), this.shopSel);
      this.el.shopDetail.querySelectorAll('[data-shop-qty]').forEach(b => {
        b.addEventListener('click', () => {
          this.shopQty = Math.max(1, Math.min(99, this.shopQty + parseInt(b.dataset.shopQty, 10)));
          this.renderShop();
        });
      });
      const buy = this.el.shopDetail.querySelector('[data-shop-buy]');
      if (buy) buy.addEventListener('click', () => this.buySelected());
    },

    buySelected() {
      const item = D.ITEMS[this.shopSel];
      const total = item.price * this.shopQty;
      if (G.state.money < total) {
        this.toast('金币不够。', null, '');
        PKM.AUDIO.sfx('cancel');
        return;
      }
      G.state.money -= total;
      G.addItem(this.shopSel, this.shopQty, true);
      G.autoSave();
      PKM.AUDIO.sfx('sparkle');
      this.toast(`购买了 ${item.name} ×${this.shopQty}`, this.shopSel);
      this.shopQty = 1;
      this.updateHUD();
      this.renderShop();
    },

    /* ============================================================
       菜单
       ============================================================ */
    openMenu(tab) {
      if (this.screen !== 'game' || this.dialogOpen || this.shopOpen || this.modalOpen || this.mapOpen || PKM.BATTLE.active ||
        this.busy || this.transitioning || this.battleStarting) return;
      G.stopAutoMove();
      this.menuOpen = true;
      this.menuTab = tab || this.menuTab || 'party';
      G.paused = true;
      this.el.menuLayer.classList.remove('hidden');
      PKM.AUDIO.sfx('open');
      this.renderMenu();
    },

    closeMenu() {
      if (!this.menuOpen) return;
      this.menuOpen = false;
      this.el.menuLayer.classList.add('hidden');
      G.paused = false;
      this.updateHUD();
      PKM.AUDIO.sfx('cancel');
    },

    renderMenu() {
      const s = G.state;
      const tabs = [
        ['party', '队伍'], ['bag', '背包'], ['dex', '图签'], ['quests', '任务'], ['save', '存档'], ['settings', '设置']
      ];
      this.el.menuTabs.innerHTML = tabs.map(([id, name]) =>
        `<button class="menu-tab ${this.menuTab === id ? 'active' : ''}" data-tab="${id}">${this.menuTab === id ? '<span class="tab-dot"></span>' : ''}${name}</button>`).join('');
      this.el.menuName.textContent = s.name;
      this.el.menuMoney.textContent = '₽ ' + s.money;
      this.el.menuTitle.textContent = ({ party: '队伍与行囊', bag: '旅人行囊', dex: '怪物图签', quests: '旅人任务', save: '旅程记录', settings: '设置' })[this.menuTab];
      this.el.menuFootNote.textContent = `图鉴 ${Object.keys(s.dexCaught).length}/${D.DEX_ORDER.length} · ${G.playSecondsLabel()}`;
      const render = {
        party: () => this.renderPartyTab(),
        bag: () => this.renderBagTab(),
        dex: () => this.renderDexTab(),
        quests: () => this.renderQuestTab(),
        save: () => this.renderSaveTab(),
        settings: () => this.renderSettingsTab()
      }[this.menuTab];
      if (render) render();
    },

    renderPartyTab() {
      const s = G.state;
      const cards = s.party.map((m, i) => {
        const sp = D.SPECIES[m.species];
        const pct = Math.max(0, m.hp / m.maxHp * 100);
        return `<div class="party-card ${i === 0 ? 'lead' : ''} ${m.hp <= 0 ? 'fainted' : ''}" data-party-index="${i}">
          <div class="card-sprite"><canvas width="64" height="64" data-party-sprite="${i}"></canvas></div>
          <div class="card-main">
            <div class="card-name"><span>${G.nameOf(m)}</span><span class="card-lv">Lv.${m.level}</span></div>
            <div class="type-row">${sp.types.map(t => `<span class="type-badge" style="background:${D.TYPES[t].color}">${D.TYPES[t].name}</span>`).join('')}</div>
            <div class="card-hp-row"><div class="hp-track"><i class="${pct < 22 ? 'low' : pct < 50 ? 'mid' : ''}" style="width:${pct}%"></i></div><small>${Math.max(0, m.hp)}/${m.maxHp}</small></div>
            ${m.status ? `<span class="status-chip ${m.status}" style="margin-top:4px">${({ burn: '灼伤', poison: '中毒', par: '麻痹', sleep: '睡眠' })[m.status]}</span>` : ''}
          </div>
        </div>`;
      }).join('');
      const pc = s.pc.length ? s.pc.map((m, i) => `
        <div class="pc-row">
          <canvas width="32" height="32" data-pc-sprite="${i}"></canvas>
          <span>${G.nameOf(m)} <small>Lv.${m.level}</small></span>
          <button class="pixel-btn small" data-pc-take="${i}">取回</button>
        </div>`).join('') : '<div class="side-empty">电脑箱空着。<br>捕获超过 6 只时，伙伴会暂时待在这里。</div>';
      this.el.menuBody.innerHTML = `
        <div class="party-layout">
          <div class="party-grid">${cards || '<div class="bag-empty">还没有伙伴。</div>'}</div>
          <div class="party-side">
            <h3>队伍状态</h3>
            <div class="save-stat"><span>徽章</span><b>${s.badges.length ? '森语徽章 ×' + s.badges.length : '尚未获得'}</b></div>
            <div class="save-stat" style="margin-top:7px;"><span>捕获记录</span><b>${s.catches} 只</b></div>
            <div style="margin-top:14px;font-size:10px;color:#7d6b50;line-height:1.8;">点击伙伴可以查看详细能力、招式与成长记录，也可以把健康的伙伴设为队首。</div>
            <h3 style="margin-top:18px;">电脑箱</h3>
            <div class="pc-list">${pc}</div>
          </div>
        </div>`;
      this.el.menuBody.querySelectorAll('canvas[data-party-sprite]').forEach(c => {
        const m = s.party[+c.dataset.partySprite];
        PKM.ART.drawMonsterCanvas(c, m.species, 0, false);
      });
      this.el.menuBody.querySelectorAll('canvas[data-pc-sprite]').forEach(c => {
        const m = s.pc[+c.dataset.pcSprite];
        PKM.ART.drawMonsterCanvas(c, m.species, 0, false);
      });
      this.el.menuBody.querySelectorAll('[data-party-index]').forEach(el => {
        el.addEventListener('click', () => this.showMonDetail(+el.dataset.partyIndex));
      });
      this.el.menuBody.querySelectorAll('[data-pc-take]').forEach(el => {
        el.addEventListener('click', () => this.takeFromPC(+el.dataset.pcTake));
      });
    },

    takeFromPC(index) {
      const s = G.state;
      if (s.party.length >= 6) { this.toast('队伍已经满了。', null, ''); return; }
      const m = s.pc.splice(index, 1)[0];
      if (!m) return;
      s.party.push(m);
      G.autoSave();
      PKM.AUDIO.sfx('sparkle');
      this.toast(`${G.nameOf(m)}回到了队伍`, null, 'g');
      this.renderMenu();
      this.updateHUD();
    },

    showMonDetail(index) {
      const s = G.state;
      const m = s.party[index];
      if (!m) return;
      const sp = D.SPECIES[m.species];
      const need = G.expNeeded(m.level);
      const stats = [
        ['HP', m.maxHp, 190], ['攻击', m.stats.atk, 180], ['防御', m.stats.def, 180],
        ['特攻', m.stats.spa, 180], ['特防', m.stats.spd, 180], ['速度', m.stats.spe, 180]
      ].map(([name, val, max]) => `<div class="stat-line"><span>${name}</span><div class="stat-track"><i style="width:${Math.min(100, val / max * 100)}%"></i></div><b style="font:700 9px Consolas;color:#6d5c41">${val}</b></div>`).join('');
      const moves = m.moves.map(mv => {
        const move = D.MOVES[mv.id];
        return `<div class="move-pill" style="--move-color:${D.TYPES[move.type].color}">
          <b>${move.name}</b>
          <small>${D.TYPES[move.type].name} · ${move.cat === 'status' ? '变化' : '威力 ' + move.power} · PP ${mv.pp}/${mv.maxPp}</small>
        </div>`;
      }).join('');
      const evo = sp.evolve ? `会在 Lv.${sp.evolve.level} 左右成长` : '已经成长为成熟的形态';
      this.openModal(`
        <div class="modal-head">
          <div class="modal-sprite"><canvas width="96" height="96" id="detail-sprite"></canvas></div>
          <div style="flex:1">
            <h2>${G.nameOf(m)}</h2>
            <div class="modal-sub">NO.${String(sp.no).padStart(3, '0')} · ${sp.habitat}</div>
            <div class="type-row" style="margin-top:6px">${sp.types.map(t => `<span class="type-badge" style="background:${D.TYPES[t].color}">${D.TYPES[t].name}</span>`).join('')}</div>
            <div class="modal-sub" style="margin-top:6px">Lv.${m.level} · 经验 ${m.exp}/${need} · ${m.status ? '状态：' + ({ burn: '灼伤', poison: '中毒', par: '麻痹', sleep: '睡眠' })[m.status] : '状态良好'}</div>
          </div>
        </div>
        <div class="modal-text">${sp.desc}</div>
        <div class="stat-grid">${stats}</div>
        <div class="modal-sub">招式 · ${evo}</div>
        <div class="move-list">${moves}</div>
        <div class="modal-sub">相遇：${D.MAPS[m.met] ? D.MAPS[m.met].name : '旅途中'} · Lv.${m.metLevel}</div>
        <div class="modal-actions">
          ${index > 0 && m.hp > 0 ? '<button class="pixel-btn gold" id="detail-lead">设为首发</button>' : ''}
          <button class="pixel-btn" data-modal-close>关闭</button>
        </div>`);
      PKM.ART.drawMonsterCanvas(document.getElementById('detail-sprite'), m.species, 0, false);
      const lead = document.getElementById('detail-lead');
      if (lead) lead.addEventListener('click', () => {
        G.swapLead(index);
        this.closeModal();
        this.renderMenu();
        this.updateHUD();
        PKM.AUDIO.sfx('sparkle');
        this.toast(`${G.nameOf(m)}成为了队首`, null, 'g');
      });
    },

    renderBagTab() {
      const s = G.state;
      const ids = Object.keys(s.bag).filter(id => s.bag[id] > 0);
      if (!ids.includes(this.bagSel)) this.bagSel = ids[0] || null;
      const rows = ids.map(id => {
        const it = D.ITEMS[id];
        return `<button class="bag-row ${this.bagSel === id ? 'sel' : ''}" data-bag-row="${id}">
          <canvas width="32" height="32" data-bag-icon="${id}"></canvas>
          <span class="bag-info"><span class="bag-name">${it.name}</span><br><span class="bag-cat">${CAT_LABEL[it.cat] || '物品'}</span></span>
          <span class="bag-count">×${s.bag[id]}</span>
        </button>`;
      }).join('');
      const item = this.bagSel ? D.ITEMS[this.bagSel] : null;
      const usable = item && ['medicine', 'berry'].includes(item.cat);
      this.el.menuBody.innerHTML = `
        <div class="bag-layout">
          <div class="bag-grid">${rows || '<div class="bag-empty">行囊里空空的。</div>'}</div>
          <div class="bag-detail">
            ${item ? `<canvas class="detail-icon" width="64" height="64" data-detail-icon="${this.bagSel}"></canvas>
              <h3>${item.name}</h3>
              <div class="modal-sub">${CAT_LABEL[item.cat] || ''} · 持有 ${s.bag[this.bagSel]}</div>
              <p>${item.desc}</p>
              <div class="detail-actions">
                ${usable ? `<button class="pixel-btn gold" id="bag-use">使用</button>` : ''}
                ${item.cat === 'ball' ? '<span class="modal-sub">在战斗中使用</span>' : ''}
                ${item.cat === 'treasure' && item.sell ? `<button class="pixel-btn" id="bag-sell">出售 ₽ ${item.sell}</button>` : ''}
              </div>` : '<div class="bag-empty">选择一件物品。</div>'}
          </div>
        </div>`;
      this.el.menuBody.querySelectorAll('canvas[data-bag-icon]').forEach(c => PKM.ART.drawItemIcon(c, c.dataset.bagIcon));
      const detailIcon = this.el.menuBody.querySelector('canvas[data-detail-icon]');
      if (detailIcon) PKM.ART.drawItemIcon(detailIcon, detailIcon.dataset.detailIcon);
      this.el.menuBody.querySelectorAll('[data-bag-row]').forEach(el => {
        el.addEventListener('click', () => {
          this.bagSel = el.dataset.bagRow;
          this.renderBagTab();
          PKM.AUDIO.sfx('move');
        });
      });
      const use = document.getElementById('bag-use');
      if (use) use.addEventListener('click', () => this.openBagTarget(this.bagSel));
      const sell = document.getElementById('bag-sell');
      if (sell) sell.addEventListener('click', () => {
        const it = D.ITEMS[this.bagSel];
        if (!it || !it.sell) return;
        G.state.money += it.sell;
        G.removeItem(this.bagSel, 1);
        this.updateHUD();
        this.renderBagTab();
        this.toast(`出售了 ${it.name}，获得 ₽ ${it.sell}`, null, 'g');
        PKM.AUDIO.sfx('sparkle');
      });
    },

    openBagTarget(itemId) {
      const s = G.state;
      const item = D.ITEMS[itemId];
      const rows = s.party.map((m, i) => {
        const sp = D.SPECIES[m.species];
        const pct = Math.max(0, m.hp / m.maxHp * 100);
        return `<button class="battle-party-btn" data-use-target="${i}" style="width:100%">
          <span class="party-sprite-wrap"><canvas width="48" height="48" data-use-sprite="${i}"></canvas></span>
          <span class="party-info">
            <span class="party-name">${G.nameOf(m)}</span>
            <span class="party-lv">Lv.${m.level} · ${sp.types.map(t => D.TYPES[t].name).join('/')}</span>
            <span class="party-hp-row"><span class="mini-hp"><i style="width:${pct}%"></i></span><small>${Math.max(0, m.hp)}/${m.maxHp}</small></span>
          </span>
        </button>`;
      }).join('');
      this.openModal(`
        <h2 class="confirm-title">对谁使用 ${item.name}？</h2>
        <div class="confirm-text">${item.desc}</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:14px">${rows}</div>
        <div class="modal-actions"><button class="pixel-btn" data-modal-close>取消</button></div>`);
      this.el.modalWindow.querySelectorAll('canvas[data-use-sprite]').forEach(c => {
        const m = s.party[+c.dataset.useSprite];
        PKM.ART.drawMonsterCanvas(c, m.species, 0, false);
      });
      this.el.modalWindow.querySelectorAll('[data-use-target]').forEach(el => {
        el.addEventListener('click', () => {
          const res = G.useMedicine(+el.dataset.useTarget, itemId);
          if (!res.ok) {
            PKM.AUDIO.sfx('cancel');
            this.toast(res.msg, null, '');
            return;
          }
          PKM.AUDIO.sfx('heal');
          this.closeModal();
          this.updateHUD();
          this.renderBagTab();
          this.toast(res.msg, null, 'g');
        });
      });
    },

    renderDexTab() {
      const s = G.state;
      const caught = Object.keys(s.dexCaught).length;
      const seen = Object.keys(s.dexSeen).length;
      const filters = [['all', '全部'], ['caught', '已捕获'], ['seen', '已遇见'], ['unknown', '未发现']];
      const list = D.DEX_ORDER.filter(id => {
        if (this.dexFilter === 'caught') return !!s.dexCaught[id];
        if (this.dexFilter === 'seen') return !!s.dexSeen[id] && !s.dexCaught[id];
        if (this.dexFilter === 'unknown') return !s.dexSeen[id];
        return true;
      });
      const cards = list.map(id => {
        const sp = D.SPECIES[id];
        const isCaught = !!s.dexCaught[id];
        const isSeen = !!s.dexSeen[id];
        return `<div class="dex-card ${isCaught ? 'caught' : isSeen ? 'seen' : 'unknown'}" data-dex="${id}">
          <div class="dex-no">#${String(sp.no).padStart(3, '0')}</div>
          <canvas width="56" height="56" data-dex-sprite="${id}"></canvas>
          <div class="dex-name">${isSeen ? sp.name : '？？？'}</div>
          <div class="dex-types">${sp.types.map(t => `<i style="background:${D.TYPES[t].color}"></i>`).join('')}</div>
          <div class="dex-hp">HP <b>${isSeen ? sp.base.hp : '—'}</b></div>
          <div class="dex-state">${isCaught ? '● 已捕获' : isSeen ? '○ 已遇见' : '· 未发现'}</div>
        </div>`;
      }).join('');
      this.el.menuBody.innerHTML = `
        <div class="dex-head">
          <div><h3>怪物图签</h3><div class="dex-progress">遇见 ${seen} · 捕获 ${caught} / ${D.DEX_ORDER.length}</div></div>
          <div class="dex-filters">${filters.map(([id, name]) => `<button data-dex-filter="${id}" class="${this.dexFilter === id ? 'on' : ''}">${name}</button>`).join('')}</div>
        </div>
        <div class="dex-grid">${cards || '<div class="bag-empty">这个分类里还没有记录。</div>'}</div>
        <div class="dex-note">图签记录基础体力、成长区间、出没地、弱点和招式。战斗中的当前血量会在战斗界面实时显示。</div>`;
      this.el.menuBody.querySelectorAll('canvas[data-dex-sprite]').forEach(c => {
        PKM.ART.drawMonsterCanvas(c, c.dataset.dexSprite, 0, false);
      });
      this.el.menuBody.querySelectorAll('[data-dex-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.dexFilter = btn.dataset.dexFilter;
          PKM.AUDIO.sfx('move');
          this.renderDexTab();
        });
      });
      this.el.menuBody.querySelectorAll('[data-dex]').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.dex;
          if (!s.dexSeen[id]) { this.toast('还没有在森林里遇见它。', null, ''); return; }
          this.showDexDetail(id);
        });
      });
    },

    speciesLocations(id) {
      const found = [];
      for (const [mid, map] of Object.entries(D.MAPS)) {
        const enc = (map.encounters || []).filter(e => e.species === id);
        const fish = (map.fishing || []).filter(e => e.species === id);
        if (enc.length) found.push(`${map.name} Lv.${Math.min(...enc.map(e => e.min))}-${Math.max(...enc.map(e => e.max))}`);
        if (fish.length) found.push(`${map.name}（垂钓）Lv.${Math.min(...fish.map(e => e.min))}-${Math.max(...fish.map(e => e.max))}`);
      }
      const from = Object.values(D.SPECIES).find(sp => sp.evolve && sp.evolve.to === id);
      if (from) found.push(`由 ${from.name} 进化`);
      return found;
    },

    weaknessText(types) {
      const weak = [];
      for (const [type, chart] of Object.entries(D.TYPE_CHART)) {
        let mult = 1;
        types.forEach(t => { if (chart[t] !== undefined) mult *= chart[t]; });
        if (mult > 1) weak.push({ name: D.TYPES[type].name, mult });
      }
      return weak.sort((a, b) => b.mult - a.mult).map(w => `${w.name} ×${w.mult}`).join('、') || '没有明显弱点';
    },

    showDexDetail(id) {
      const sp = D.SPECIES[id];
      const caught = !!G.state.dexCaught[id];
      const hp10 = G.monStats(id, 10).hp;
      const hp20 = G.monStats(id, 20).hp;
      const hp30 = G.monStats(id, 30).hp;
      const stats = [
        ['HP', sp.base.hp], ['攻击', sp.base.atk], ['防御', sp.base.def],
        ['特攻', sp.base.spa], ['特防', sp.base.spd], ['速度', sp.base.spe]
      ].map(([n, v]) => `<div class="stat-line"><span>${n}</span><div class="stat-track"><i style="width:${Math.min(100, v / 130 * 100)}%"></i></div><b style="font:700 9px Consolas;color:#6d5c41">${v}</b></div>`).join('');
      const moves = sp.learnset.slice(-6).map(([, mid]) => D.MOVES[mid]).map(mv =>
        `<div class="move-pill" style="--move-color:${D.TYPES[mv.type].color}"><b>${mv.name}</b><small>${D.TYPES[mv.type].name} · ${mv.cat === 'status' ? '变化' : '威力 ' + mv.power}</small></div>`).join('');
      const locs = this.speciesLocations(id);
      const evoTarget = sp.evolve ? D.SPECIES[sp.evolve.to] : null;
      const evoFrom = Object.values(D.SPECIES).find(x => x.evolve && x.evolve.to === id);
      const evoText = evoTarget ? `会在 Lv.${sp.evolve.level} 左右进化成 ${evoTarget.name}` : evoFrom ? `由 ${evoFrom.name} 进化而来` : '没有进一步的进化';
      const rarity = sp.rate >= 150 ? '常见' : sp.rate >= 80 ? '少见' : sp.rate >= 40 ? '稀有' : '非常稀有';
      this.openModal(`
        <div class="modal-head">
          <div class="modal-sprite"><canvas width="96" height="96" id="dex-detail-sprite"></canvas></div>
          <div style="flex:1">
            <h2>${sp.name}</h2>
            <div class="modal-sub">NO.${String(sp.no).padStart(3, '0')} · ${sp.habitat} · ${caught ? '已捕获' : '已遇见'}</div>
            <div class="type-row" style="margin-top:6px">${sp.types.map(t => `<span class="type-badge" style="background:${D.TYPES[t].color}">${D.TYPES[t].name}</span>`).join('')}</div>
            <div class="dex-detail-hp"><span>基础体力</span><b>${sp.base.hp}</b><small>预计 HP：Lv.10 ${hp10} / Lv.20 ${hp20} / Lv.30 ${hp30}</small></div>
          </div>
        </div>
        <div class="modal-text">${sp.desc}</div>
        <div class="stat-grid">${stats}</div>
        <div class="dex-detail-grid">
          <div><small>出没地</small><b>${locs.join('、') || '暂未发现野生记录'}</b></div>
          <div><small>捕获难度</small><b>${rarity} · 捕获率 ${sp.rate}</b></div>
          <div><small>成长</small><b>${evoText}</b></div>
          <div><small>弱点</small><b>${this.weaknessText(sp.types)}</b></div>
        </div>
        <div class="modal-sub" style="margin-top:10px">常见招式</div>
        <div class="move-list">${moves}</div>
        <div class="modal-actions"><button class="pixel-btn" data-modal-close>关闭</button></div>`);
      PKM.ART.drawMonsterCanvas(document.getElementById('dex-detail-sprite'), id, 0, false);
    },

    renderQuestTab() {
      const s = G.state;
      const order = ['main', 'hairpin', 'musician', 'researcher', 'fisher', 'glen_lantern', 'mist_bell'];
      const tracked = s.trackedQuest || 'main';
      const cards = order.map(id => {
        const q = D.QUESTS[id];
        const st = G.questState(id);
        if (st.status === 'hidden') return '';
        const statusText = st.status === 'done' ? '完成' : st.status === 'ready' ? '可交付' : '进行中';
        const on = tracked === id;
        return `<div class="quest-card ${q.type === 'main' ? 'main' : ''} ${st.status === 'done' ? 'done' : ''}">
          <div class="quest-top"><span class="quest-type">${q.type === 'main' ? 'MAIN' : 'SIDE'}</span><h4>${q.title}</h4><span class="quest-status ${st.status}">${statusText}</span>
          <button class="quest-track ${on ? 'on' : ''}" data-track="${id}" ${st.status === 'done' ? 'disabled' : ''}>${on ? '追踪中' : '追踪'}</button></div>
          <div class="quest-hint">${st.hint}</div>
          <div class="quest-reward">${q.desc}</div>
        </div>`;
      }).join('');
      this.el.menuBody.innerHTML = `<div class="quest-list">${cards}
        <div style="font-size:10px;color:#7d6b50;line-height:1.8;">追踪任务后，世界中的黄色虚线和顶部罗盘会指向下一个目标。按 M 可以随时打开旅途地图。</div>
      </div>`;
      this.el.menuBody.querySelectorAll('[data-track]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.track;
          if (G.questState(id).status === 'done') return;
          s.trackedQuest = id;
          G.autoSave();
          if (PKM.GUIDE) PKM.GUIDE.refresh(true);
          PKM.AUDIO.sfx('select');
          this.renderQuestTab();
          this.updateHUD();
          this.updateNav();
          this.toast(`正在追踪：${D.QUESTS[id].title}`, 'quest', 'quest');
        });
      });
    },

    renderSaveTab() {
      const s = G.state;
      const save = G.loadData();
      const d = save ? new Date(save.savedAt) : null;
      const badges = s.badges.length ? s.badges.map(() => '<div class="badge-medal">✦</div>').join('') : '<div class="badge-medal empty">·</div>';
      this.el.menuBody.innerHTML = `
        <div class="save-layout">
          <div class="save-hero">
            <h3>${s.name}的旅程</h3>
            <div class="save-sub">${d ? `上次记录 ${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '尚未手动保存'}</div>
            <div class="save-stats">
              <div class="save-stat"><span>游戏时间</span><b>${G.playSecondsLabel()}</b></div>
              <div class="save-stat"><span>持有金币</span><b>₽ ${s.money}</b></div>
              <div class="save-stat"><span>捕获数量</span><b>${s.catches} 只</b></div>
              <div class="save-stat"><span>图鉴记录</span><b>${Object.keys(s.dexCaught).length} / ${D.DEX_ORDER.length}</b></div>
              <div class="save-stat"><span>行走步数</span><b>${s.steps}</b></div>
              <div class="save-stat"><span>当前伙伴</span><b>${s.party.length} / 6</b></div>
            </div>
            <div class="modal-sub">徽章</div>
            <div class="badge-row">${badges}<span style="font-size:10px;color:#79684c;margin-left:6px">${s.badges.length ? '森语徽章' : '还没有徽章'}</span></div>
            <div class="modal-actions" style="margin-top:20px">
              <button class="pixel-btn gold" id="save-now">保存旅程</button>
              <button class="pixel-btn" id="return-title">返回标题</button>
              <button class="pixel-btn danger" id="delete-save">删除记录</button>
            </div>
          </div>
          <div class="controls-card">
            <b>自动记录</b><br>切换地图、捕获、治疗和战斗结束后，旅程会自动保存。<br><br>
            <b>给旅人的话</b><br>输掉战斗不会失去伙伴。你会回到驿站，钱包会轻一点，但脚印还在。
          </div>
        </div>`;
      document.getElementById('save-now').addEventListener('click', () => {
        if (G.saveData()) {
          PKM.AUDIO.sfx('save');
          this.toast('旅程已经记录。', null, 'g');
          this.renderSaveTab();
        }
      });
      document.getElementById('return-title').addEventListener('click', () => {
        this.confirm('回到标题画面？', '当前旅程会先保存。下次可以从“继续旅程”回来。', () => {
          this.closeModal();
          G.saveData();
          this.closeMenu();
          this.showTitle();
        }, () => this.closeModal(), '保存并返回', '继续赶路');
      });
      document.getElementById('delete-save').addEventListener('click', () => {
        this.confirm('删除这段旅程？', '所有伙伴、徽章与记录都会消失。这个动作无法撤销。', () => {
          this.confirm('真的要删除吗？', '森林会记得你，但存档不会。', () => {
            G.deleteSave();
            this.closeModal();
            this.closeMenu();
            this.showTitle();
            this.toast('旅程记录已删除。', null, '');
          }, () => this.closeModal(), '确认删除', '不要删');
        }, () => this.closeModal(), '删除', '取消');
      });
    },

    renderSettingsTab() {
      const s = G.state;
      const speed = s.settings.speed || 1;
      this.el.menuBody.innerHTML = `
        <div class="settings-list">
          <div class="setting-row">
            <div class="setting-label"><b>音乐</b><small>原创芯片音源 · 森林与旅途的旋律</small></div>
            <div class="toggle"><button data-setting="music" data-value="1" class="${s.settings.music ? 'on' : ''}">开</button><button data-setting="music" data-value="0" class="${!s.settings.music ? 'on' : ''}">关</button></div>
          </div>
          <div class="setting-row">
            <div class="setting-label"><b>音效</b><small>脚步、招式、捕捉与升级</small></div>
            <div class="toggle"><button data-setting="sfx" data-value="1" class="${s.settings.sfx ? 'on' : ''}">开</button><button data-setting="sfx" data-value="0" class="${!s.settings.sfx ? 'on' : ''}">关</button></div>
          </div>
          <div class="setting-row">
            <div class="setting-label"><b>战斗速度</b><small>只影响文字与动画，不影响平衡</small></div>
            <div class="toggle"><button data-setting="speed" data-value="1" class="${speed === 1 ? 'on' : ''}">1×</button><button data-setting="speed" data-value="2" class="${speed === 2 ? 'on' : ''}">2×</button></div>
          </div>
          <div class="setting-row">
            <div class="setting-label"><b>导航线</b><small>在世界中显示通往当前目标的虚线路径</small></div>
            <div class="toggle"><button data-setting="guide" data-value="1" class="${s.settings.guide !== false ? 'on' : ''}">开</button><button data-setting="guide" data-value="0" class="${s.settings.guide === false ? 'on' : ''}">关</button></div>
          </div>
          <div class="setting-row">
            <div class="setting-label"><b>全屏</b><small>把森林铺满整块屏幕</small></div>
            <button class="pixel-btn" id="fullscreen-btn">切换全屏</button>
          </div>
        </div>
        <div class="controls-card" style="margin-top:12px">
          <b>鼠标点击</b>自动寻路与互动 · <b>方向键 / WASD</b>移动 · <b>Shift</b>奔跑<br>
          <b>Z / Enter</b>交谈与确认 · <b>X / Esc</b>菜单与返回<br>
          <b>M</b>旅途地图 · 地图上可快速移动与切换导航线<br>
          触屏设备会自动出现方向键与 A / B 按钮。
        </div>`;
      this.el.menuBody.querySelectorAll('[data-setting]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.setting;
          const value = parseInt(btn.dataset.value, 10);
          if (key === 'music') s.settings.music = !!value;
          if (key === 'sfx') s.settings.sfx = !!value;
          if (key === 'speed') s.settings.speed = value;
          if (key === 'guide') s.settings.guide = !!value;
          this.applyAudioSettings();
          if (PKM.GUIDE) PKM.GUIDE.refresh(true);
          G.autoSave();
          PKM.AUDIO.sfx('select');
          this.renderSettingsTab();
          this.updateNav();
        });
      });
      const fs = document.getElementById('fullscreen-btn');
      if (fs) fs.addEventListener('click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        else document.exitFullscreen && document.exitFullscreen();
      });
    },

    /* ============================================================
       弹窗
       ============================================================ */
    openModal(html) {
      this.modalOpen = true;
      this.el.modalLayer.classList.remove('hidden');
      this.el.modalWindow.innerHTML = html;
      this.el.modalWindow.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', () => this.closeModal()));
    },

    closeModal() {
      this.modalOpen = false;
      this.el.modalLayer.classList.add('hidden');
      this.el.modalWindow.innerHTML = '';
    },

    confirm(title, text, onYes, onNo, yesLabel, noLabel) {
      this.openModal(`
        <h2 class="confirm-title">${title}</h2>
        <div class="confirm-text">${text}</div>
        <div class="modal-actions">
          <button class="pixel-btn gold" id="confirm-yes">${yesLabel || '确认'}</button>
          <button class="pixel-btn" id="confirm-no">${noLabel || '取消'}</button>
        </div>`);
      document.getElementById('confirm-yes').addEventListener('click', () => {
        PKM.AUDIO.sfx('select');
        if (onYes) onYes();
      });
      document.getElementById('confirm-no').addEventListener('click', () => {
        PKM.AUDIO.sfx('cancel');
        if (onNo) onNo(); else this.closeModal();
      });
    },

    /* ============================================================
       治疗 / 钓鱼
       ============================================================ */
    healSequence() {
      if (this.busy || PKM.BATTLE.active) return;
      this.busy = true;
      G.paused = true;
      const scene = document.createElement('div');
      scene.className = 'mini-scene';
      scene.innerHTML = `<div class="heal-card">
        <div class="heal-pulse">✦</div>
        <h3>伙伴们正在休息</h3>
        <p>暖炉的光落在毛皮与叶片上。<br>体力、PP 和异常状态都会恢复。</p>
      </div>`;
      document.getElementById('stage').appendChild(scene);
      setTimeout(() => {
        G.healParty();
        this.updateHUD();
        PKM.AUDIO.sfx('heal');
        const h = scene.querySelector('h3');
        if (h) h.textContent = '恢复了精神！';
        const p = scene.querySelector('p');
        if (p) p.textContent = '伙伴们蹭了蹭你，准备再次出发。';
      }, 700);
      setTimeout(() => {
        scene.remove();
        this.busy = false;
        G.paused = false;
        this.toast('伙伴们恢复了体力与 PP', 'heal', 'g');
        this.updateHUD();
      }, 1700);
    },

    startFishing() {
      if (this.busy || PKM.BATTLE.active) return;
      const map = G.currentMap();
      if (!map.fishing || !map.fishing.length) {
        this.dialog({ speaker: '水面', lines: ['这里的水太浅了，看不到鱼影。'] });
        return;
      }
      this.busy = true;
      G.paused = true;
      const scene = document.createElement('div');
      scene.className = 'mini-scene';
      scene.innerHTML = `<div class="fishing-card">
        <h3>静静等待</h3>
        <p>浮标在水面上轻轻打转……</p>
        <div class="fishing-water"><div class="bobber"></div></div>
        <p style="font-size:10px;color:#8a7758">水下的影子正在靠近</p>
      </div>`;
      document.getElementById('stage').appendChild(scene);
      PKM.AUDIO.sfx('run');
      setTimeout(() => {
        scene.remove();
        this.busy = false;
        G.paused = false;
        const roll = G.rollFishing();
        if (!roll) {
          this.dialog({ speaker: '水面', lines: ['浮标晃了一下，又安静了。', '今天鱼群似乎很谨慎。'] });
          return;
        }
        this.screenFlash();
        this.battleStarting = true;
        setTimeout(() => {
          this.battleStarting = false;
          PKM.BATTLE.startWild(roll.species, roll.level);
        }, 180);
      }, 1600);
    },

    /* ============================================================
       结局
       ============================================================ */
    showEnding() {
      const s = G.state;
      s.flags.forestCleared = true;
      s.flags.endingSeen = true;
      G.healParty();
      G.autoSave();
      this.screen = 'ending';
      this.endingActive = true;
      this.titleActive = false;
      G.paused = true;
      this.el.hud.classList.add('hidden');
      this.el.ending.classList.remove('hidden');
      this.el.mapBanner.classList.remove('show');
      PKM.AUDIO.playMusic('ending');
      this.drawEndingScene(0);
      this.toast('萤火森林的光，重新亮起', 'quest', 'quest');
    },

    closeEnding() {
      this.endingActive = false;
      this.screen = 'game';
      this.el.ending.classList.add('hidden');
      this.el.hud.classList.remove('hidden');
      G.paused = false;
      PKM.AUDIO.playMusic('forest');
      this.updateHUD();
      this.dialog({
        speaker: '风',
        lines: [
          '森林的黎明比往常更长。',
          '祭坛深处，还有一道温暖的光在沉睡。',
          '也许，等你的伙伴再长大一点，可以回来看看它。'
        ]
      });
    },

    drawEndingScene(t) {
      const c = this.el.endingCanvas;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const W = 320, H = 200;
      const sky = ['#1e3438', '#314c4a', '#5a705c', '#a18a66', '#d7b277'];
      for (let i = 0; i < 5; i++) { ctx.fillStyle = sky[i]; ctx.fillRect(0, i * 36, W, 37); }
      // sun
      ctx.fillStyle = 'rgba(255,232,170,.18)';
      ctx.beginPath(); ctx.arc(238, 84, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f5d795';
      ctx.beginPath(); ctx.arc(238, 84, 16, 0, Math.PI * 2); ctx.fill();
      // rays
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + t * .03;
        ctx.strokeStyle = 'rgba(255,232,170,.14)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(238 + Math.cos(a) * 20, 84 + Math.sin(a) * 20); ctx.lineTo(238 + Math.cos(a) * 50, 84 + Math.sin(a) * 50); ctx.stroke();
      }
      // clouds
      for (let i = 0; i < 3; i++) {
        const x = ((i * 130 + t * 2) % 360) - 20;
        ctx.fillStyle = 'rgba(240,224,194,.10)';
        ctx.beginPath(); ctx.ellipse(x, 54 + i * 13, 28, 5, 0, 0, Math.PI * 2); ctx.fill();
      }
      // mountains
      ctx.fillStyle = '#3f5445';
      ctx.beginPath(); ctx.moveTo(0, 132); ctx.lineTo(52, 82); ctx.lineTo(110, 132); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#445a49';
      ctx.beginPath(); ctx.moveTo(70, 132); ctx.lineTo(142, 66); ctx.lineTo(210, 132); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#384d3e';
      ctx.beginPath(); ctx.moveTo(180, 132); ctx.lineTo(258, 92); ctx.lineTo(330, 132); ctx.closePath(); ctx.fill();
      // forest
      for (let layer = 0; layer < 2; layer++) {
        const base = 138 + layer * 16;
        for (let i = 0; i < 20; i++) {
          const x = i * 18 + (layer ? 9 : 0);
          const h = 26 + (i * 13 % 22) + layer * 10;
          ctx.fillStyle = layer ? '#1b3529' : '#274535';
          ctx.beginPath(); ctx.moveTo(x - 9, base); ctx.lineTo(x, base - h); ctx.lineTo(x + 9, base); ctx.closePath(); ctx.fill();
        }
      }
      ctx.fillStyle = '#122c20'; ctx.fillRect(0, 142, W, 58);
      // path of light
      const gr = ctx.createLinearGradient(0, 150, 0, 200);
      gr.addColorStop(0, 'rgba(242,215,149,.4)');
      gr.addColorStop(1, 'rgba(242,215,149,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(216, 146); ctx.lineTo(268, 146); ctx.lineTo(316, 200); ctx.lineTo(160, 200); ctx.closePath(); ctx.fill();
      // shrine silhouette
      ctx.fillStyle = '#203a2b';
      ctx.fillRect(224, 128, 36, 20);
      ctx.fillStyle = '#2f5038';
      ctx.beginPath(); ctx.moveTo(216, 130); ctx.lineTo(242, 112); ctx.lineTo(268, 130); ctx.closePath(); ctx.fill();
      // guardian
      PKM.ART.drawMonster(ctx, 'guardian', 243, 122, 76, t, false);
      // glowing moss
      for (let i = 0; i < 18; i++) {
        const x = (i * 37 + 11) % W, y = 146 + (i * 17) % 48;
        const a = .25 + .5 * (0.5 + .5 * Math.sin(t * 2 + i));
        ctx.fillStyle = `rgba(180,255,205,${a})`;
        ctx.fillRect(x, y, 1, 1);
      }
      // foreground grass
      for (let i = 0; i < 50; i++) {
        const x = (i * 47) % W, y = 170 + (i * 23) % 30;
        ctx.strokeStyle = i % 2 ? '#1c3e2b' : '#28503a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x + 1, y); ctx.stroke();
      }
      // vignette
      const v = ctx.createRadialGradient(160, 100, 50, 160, 100, 200);
      v.addColorStop(0, 'rgba(4,12,8,0)'); v.addColorStop(1, 'rgba(4,12,8,.42)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    },

    /* ============================================================
       输入与状态
       ============================================================ */
    isBlocking() {
      return this.dialogOpen || this.menuOpen || this.mapOpen || this.shopOpen || this.modalOpen || this.busy ||
        this.transitioning || this.battleStarting || this.screen !== 'game' || PKM.BATTLE.active;
    },

    handleKey(key) {
      if (PKM.BATTLE.active) return false;
      if (this.modalOpen) {
        if (key === 'cancel') { PKM.AUDIO.sfx('cancel'); this.closeModal(); }
        else if (key === 'confirm') {
          const primary = this.el.modalWindow.querySelector('#confirm-yes') ||
            this.el.modalWindow.querySelector('[data-modal-close]') ||
            this.el.modalWindow.querySelector('.pixel-btn');
          if (primary) { PKM.AUDIO.sfx('select'); primary.click(); }
        }
        return true;
      }
      if (this.mapOpen) {
        if (key === 'cancel' || key === 'menu' || key === 'map') this.closeMap();
        return true;
      }
      if (this.shopOpen) {
        if (key === 'cancel' || key === 'menu') this.closeShop();
        return true;
      }
      if (this.menuOpen) {
        if (key === 'cancel' || key === 'menu') this.closeMenu();
        else if (key === 'left' || key === 'right') {
          const order = ['party', 'bag', 'dex', 'quests', 'save', 'settings'];
          let i = order.indexOf(this.menuTab);
          i = (i + (key === 'right' ? 1 : -1) + order.length) % order.length;
          this.menuTab = order[i];
          PKM.AUDIO.sfx('move');
          this.renderMenu();
        }
        return true;
      }
      if (this.dialogOpen) {
        if (this.dialogChoicesVisible) {
          if (key === 'left') this.moveDialogChoice(-1);
          else if (key === 'right') this.moveDialogChoice(1);
          else if (key === 'confirm') {
            const btns = this.el.dialogueChoices.querySelectorAll('button');
            if (btns[this.dialogChoiceIndex]) btns[this.dialogChoiceIndex].click();
          }
        } else if (key === 'confirm' || key === 'cancel') {
          this.advanceDialog();
        }
        return true;
      }
      if (this.introActive) {
        if (!this.el.introNamePanel.classList.contains('hidden')) {
          if (key === 'confirm') this.confirmName();
          return true;
        }
        if (!this.el.starterPicker.classList.contains('hidden')) {
          if (key === 'left') { this.focusStarter(this.starterIndex - 1); PKM.AUDIO.sfx('move'); }
          else if (key === 'right') { this.focusStarter(this.starterIndex + 1); PKM.AUDIO.sfx('move'); }
          else if (key === 'confirm') {
            if (this.introStarter === this.el.starterCards.querySelectorAll('.starter-card')[this.starterIndex]?.dataset.starter) this.beginJourney();
            else this.selectStarter(this.starterIndex);
          }
          return true;
        }
        if (key === 'confirm') this.advanceIntro();
        return true;
      }
      if (this.endingActive) {
        if (key === 'confirm') this.closeEnding();
        return true;
      }
      return false;
    },

    /* ============================================================
       提示
       ============================================================ */
    toast(text, icon, tone) {
      if (!this.el.toast) return;
      const t = document.createElement('div');
      t.className = 'toast ' + (tone || '');
      let iconEl;
      if (icon && D.ITEMS[icon]) {
        const c = document.createElement('canvas'); c.width = 24; c.height = 24;
        PKM.ART.drawItemIcon(c, icon);
        iconEl = c;
      } else {
        iconEl = document.createElement('span');
        iconEl.className = 'toast-icon';
        iconEl.textContent = icon === 'quest' ? '◆' : icon === 'badge' ? '✦' : icon === 'heal' ? '✚' : icon === 'dex' ? '▤' : icon === 'rune' ? '✧' : icon === 'waypoint' ? '⌖' : '·';
      }
      t.appendChild(iconEl);
      const span = document.createElement('span');
      span.textContent = text;
      t.appendChild(span);
      this.el.toast.appendChild(t);
      while (this.el.toast.children.length > 4) this.el.toast.firstChild.remove();
      setTimeout(() => {
        t.classList.add('out');
        setTimeout(() => t.remove(), 320);
      }, 3000);
    }
  };

  PKM.UI = UI;
  PKM.HEAL = { open() { UI.healSequence(); } };
})();
