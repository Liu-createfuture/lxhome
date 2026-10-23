/* ============================================================
   启动、输入、渲染循环与舞台缩放
   ============================================================ */
(function () {
  const PKM = window.PKM;
  const D = PKM.DATA;
  const G = PKM.GAME;
  const UI = PKM.UI;
  const B = PKM.BATTLE;

  const Main = {
    worldCtx: null,
    titleCtx: null,
    last: 0,
    lastHud: 0,
    lastNav: 0,
    lastMini: 0,
    lastTitleDraw: 0,
    lastEndingDraw: 0,
    dirOrder: [],
    shift: false,
    moveCooldown: 0,
    autoSaveTimer: 0,
    touchCoarse: false,
    initialized: false,

    boot() {
      if (this.initialized) return;
      this.initialized = true;
      UI.init();
      B.init();
      this.setupCanvas();
      this.setupHooks();
      this.setupInput();
      this.setupResize();
      this.fitStage();
      UI.showTitle();
      this.drawTitle(0);
      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
      this.autoSaveTimer = setInterval(() => {
        if (G.state && UI.screen === 'game' && !B.active) G.autoSave();
      }, 45000);
      window.addEventListener('beforeunload', () => {
        if (G.state) G.saveData();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && G.state) G.saveData();
      });
    },

    setupCanvas() {
      this.worldCtx = document.getElementById('world-canvas').getContext('2d');
      this.worldCtx.imageSmoothingEnabled = false;
      this.titleCtx = document.getElementById('title-canvas').getContext('2d');
      this.titleCtx.imageSmoothingEnabled = false;
    },

    setupHooks() {
      G.hooks.onPortal = (portal) => {
        UI.fadeTransition(() => {
          G.setMap(portal.to, portal.tx, portal.ty, portal.dir);
          const map = G.currentMap();
          UI.mapBanner(map.name, map.subtitle);
          PKM.AUDIO.sfx('door');
        });
      };
      G.hooks.onTrigger = (trg) => {
        UI.storyTrigger(trg);
      };
      G.hooks.onEncounter = (species, level) => {
        if (B.active) return;
        UI.battleStarting = true;
        UI.screenFlash();
        PKM.AUDIO.sfx('encounter');
        setTimeout(() => {
          UI.battleStarting = false;
          B.startWild(species, level);
        }, 300);
      };
      G.hooks.onMapChanged = () => {
        UI.updateHUD();
      };
    },

    setupResize() {
      window.addEventListener('resize', () => this.fitStage());
      window.addEventListener('orientationchange', () => setTimeout(() => this.fitStage(), 120));
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => this.fitStage());
        window.visualViewport.addEventListener('scroll', () => this.fitStage());
      }
      if (window.screen && screen.orientation && screen.orientation.addEventListener) {
        screen.orientation.addEventListener('change', () => setTimeout(() => this.fitStage(), 120));
      }
      // 输入框收起键盘后重新量一次尺寸
      document.addEventListener('focusout', () => setTimeout(() => this.fitStage(), 120));
    },

    fitStage() {
      // 正在输入名字时 iOS 键盘会压缩视口，先不要跟着缩放
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
      const stage = document.getElementById('stage');
      const vw = window.innerWidth, vh = Math.max(320, window.innerHeight);
      const coarse = this.touchCoarse;
      const portrait = vh > vw * 1.02;
      const pad = coarse ? 6 : 22;
      const scale = Math.max(.12, Math.min((vw - pad * 2) / 960, (vh - pad * 2) / 600));
      const stageW = 960 * scale, stageH = 600 * scale;
      const x = Math.round((vw - stageW) / 2);
      // 竖屏：画面贴近顶部，下方留给触屏按键；横屏：垂直居中
      const y = Math.round(coarse && portrait ? Math.max(6, pad) : (vh - stageH) / 2);
      stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      document.documentElement.style.setProperty('--stage-scale', scale);
      document.body.classList.toggle('is-mobile', coarse);
      document.body.classList.toggle('is-portrait', portrait);
      // 小屏时整体放大面板里的关键文字
      stage.classList.toggle('ui-boost', coarse && scale < 0.76);
      document.documentElement.style.setProperty('--stage-bottom', Math.round(y + stageH + 10) + 'px');
    },

    setupInput() {
      const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
      const touchy = (navigator.maxTouchPoints || 0) > 0 &&
        Math.min(window.innerWidth, window.innerHeight) < 900;
      this.touchCoarse = mq('(pointer: coarse)') || touchy;
      // unlock audio on first gesture
      const unlock = () => {
        PKM.AUDIO.init();
        if (UI.titleActive) PKM.AUDIO.playMusic('title');
        if (G.state) UI.applyAudioSettings();
      };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
      window.addEventListener('contextmenu', (e) => e.preventDefault());

      const worldCanvas = document.getElementById('world-canvas');
      worldCanvas.addEventListener('click', (e) => {
        if (e.button !== 0 || UI.screen !== 'game' || UI.isBlocking() || B.active) return;
        const rect = worldCanvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const vx = (e.clientX - rect.left) / rect.width * 320;
        const vy = (e.clientY - rect.top) / rect.height * 200;
        const cam = PKM.RENDER.lastCamera || { camX: 0, camY: 0 };
        const tx = Math.floor((vx + cam.camX) / 16);
        const ty = Math.floor((vy + cam.camY) / 16);
        this.dirOrder = [];
        this.moveCooldown = 0;
        G.clickMove(tx, ty);
      });

      window.addEventListener('keydown', (e) => {
        const ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
        if (e.key === 'Shift') { this.shift = true; return; }
        const action = this.mapKey(e.key);
        if (!action) return;
        if (['confirm', 'cancel', 'menu', 'map', 'up', 'down', 'left', 'right'].includes(action)) e.preventDefault();
        if (e.repeat && (action === 'confirm' || action === 'cancel' || action === 'menu' || action === 'map')) return;
        if (B.active) { B.handleKey(action); return; }
        if (UI.handleKey(action)) return;
        if (UI.screen === 'title') {
          if (action === 'confirm') {
            if (G.hasSave()) UI.continueGame();
            else UI.tryNewGame();
          }
          return;
        }
        if (UI.screen !== 'game') return;
        if (['up', 'down', 'left', 'right'].includes(action)) {
          G.stopAutoMove();
          this.addDir(action);
          this.moveCooldown = 0;
          if (!G.move && !G.paused) {
            const ok = G.tryMove(action);
            if (!ok) this.moveCooldown = .2;
          }
          return;
        }
        if (action === 'confirm') {
          if (G.paused || UI.isBlocking()) return;
          G.interact();
        } else if (action === 'cancel' || action === 'menu') {
          UI.openMenu();
        } else if (action === 'map') {
          UI.openMap();
        }
      });
      window.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') { this.shift = false; return; }
        const action = this.mapKey(e.key);
        if (['up', 'down', 'left', 'right'].includes(action)) this.removeDir(action);
      });
      window.addEventListener('blur', () => { this.dirOrder = []; this.shift = false; });

      // touch buttons
      const touch = document.getElementById('touch-controls');
      const dpad = touch.querySelector('.dpad');
      this.padDir = null;
      const paintPad = (dir) => {
        dpad.querySelectorAll('[data-dir]').forEach(b => {
          b.classList.toggle('pressed', b.dataset.dir === dir);
        });
      };
      const releasePad = () => {
        if (this.padDir) this.removeDir(this.padDir);
        this.padDir = null;
        paintPad(null);
      };
      const pressDir = (dir) => {
        if (!dir || dir === this.padDir) return;
        releasePad();
        this.padDir = dir;
        paintPad(dir);
        if (B.active) { B.handleKey(dir); return; }
        if (UI.isBlocking()) return;
        G.stopAutoMove();
        this.addDir(dir);
        this.moveCooldown = 0;
        if (!G.move && !G.paused) {
          const ok = G.tryMove(dir);
          if (!ok) this.moveCooldown = .2;
        }
      };
      const readPad = (e) => {
        const r = dpad.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        if (Math.hypot(dx, dy) < r.width * .11) return null;
        return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      };
      let padPointer = null;
      dpad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        PKM.AUDIO.init();
        padPointer = e.pointerId;
        try { dpad.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        const dir = readPad(e);
        if (dir) pressDir(dir);
        else paintPad(null);
      });
      dpad.addEventListener('pointermove', (e) => {
        if (padPointer === null || e.pointerId !== padPointer) return;
        e.preventDefault();
        const dir = readPad(e);
        if (dir) pressDir(dir);
      });
      const endPad = (e) => {
        if (padPointer !== null && e.pointerId !== padPointer) return;
        padPointer = null;
        releasePad();
      };
      dpad.addEventListener('pointerup', endPad);
      dpad.addEventListener('pointercancel', endPad);
      dpad.addEventListener('lostpointercapture', endPad);
      touch.querySelectorAll('[data-touch]').forEach(btn => {
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          PKM.AUDIO.init();
          const k = btn.dataset.touch === 'a' ? 'confirm' : 'cancel';
          if (B.active) { B.handleKey(k); return; }
          if (UI.handleKey(k)) return;
          if (UI.screen !== 'game') return;
          if (k === 'confirm') {
            if (!G.paused && !UI.isBlocking()) G.interact();
          } else {
            UI.openMenu();
          }
        });
      });

      // 全屏 / 横屏
      const fsEl = document.documentElement;
      const requestFs = fsEl.requestFullscreen || fsEl.webkitRequestFullscreen || fsEl.msRequestFullscreen;
      const exitFs = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      const lockLandscape = () => {
        try {
          if (screen.orientation && screen.orientation.lock) {
            const p = screen.orientation.lock('landscape');
            if (p && p.catch) p.catch(() => {});
          }
        } catch (err) { /* 部分浏览器不支持锁定，忽略 */ }
      };
      const toggleFs = () => {
        try {
          if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (requestFs) {
              const p = requestFs.call(fsEl);
              if (p && p.then) p.then(lockLandscape).catch(() => {});
              else lockLandscape();
            }
          } else if (exitFs) {
            exitFs.call(document);
          }
        } catch (err) { /* 忽略 */ }
        setTimeout(() => this.fitStage(), 260);
      };
      const mb = document.getElementById('mb-fullscreen');
      if (mb) mb.addEventListener('click', toggleFs);
      const mbMap = document.getElementById('mb-map');
      if (mbMap) mbMap.addEventListener('click', () => {
        PKM.AUDIO.init();
        PKM.AUDIO.sfx('select');
        UI.openMap();
      });
    },

    mapKey(key) {
      const k = String(key).toLowerCase();
      if (k === 'arrowup' || k === 'w') return 'up';
      if (k === 'arrowdown' || k === 's') return 'down';
      if (k === 'arrowleft' || k === 'a') return 'left';
      if (k === 'arrowright' || k === 'd') return 'right';
      if (k === 'z' || k === 'enter' || k === ' ') return 'confirm';
      if (k === 'x' || k === 'escape' || k === 'backspace') return 'cancel';
      if (k === 'm') return 'map';
      return null;
    },

    addDir(dir) {
      this.dirOrder = this.dirOrder.filter(d => d !== dir);
      this.dirOrder.push(dir);
    },
    removeDir(dir) {
      this.dirOrder = this.dirOrder.filter(d => d !== dir);
    },

    updateMovement(dt) {
      this.moveCooldown = Math.max(0, this.moveCooldown - dt);
      if (!G.state) return;
      G.state.player.running = this.shift;
      if (G.paused || UI.isBlocking() || B.active || G.move) return;
      if (this.moveCooldown > 0) return;
      const dir = this.dirOrder[this.dirOrder.length - 1];
      if (!dir) return;
      const ok = G.tryMove(dir);
      if (!ok) this.moveCooldown = .22;
    },

    loop(now) {
      const dt = Math.min(.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      const t = now / 1000;

      if (UI.titleActive && UI.screen === 'title') {
        if (now - this.lastTitleDraw > 32) {
          this.drawTitle(t);
          this.lastTitleDraw = now;
        }
      }

      if (UI.endingActive) {
        if (now - this.lastEndingDraw > 45) {
          UI.drawEndingScene(t);
          this.lastEndingDraw = now;
        }
      }

      if (UI.screen === 'game' && G.state) {
        G.update(dt);
        this.updateMovement(dt);
        if (!B.active) {
          UI.updatePrompt();
          PKM.RENDER.drawWorld(this.worldCtx, G.currentMap(), G.state, t);
        }
      }

      if (now - this.lastHud > 500) {
        this.lastHud = now;
        UI.updateHUD();
        if (this.touchCoarse) {
          const tc = document.getElementById('touch-controls');
          const show = UI.screen === 'game' && !UI.menuOpen && !UI.mapOpen && !UI.shopOpen && !UI.modalOpen &&
            !UI.transitioning && !UI.dialogOpen && !UI.busy && !PKM.BATTLE.active && !UI.battleStarting;
          tc.classList.toggle('hidden', !show);
        }
      }
      if (now - this.lastNav > 200) {
        this.lastNav = now;
        if (UI.screen === 'game') UI.updateNav();
      }
      if (now - this.lastMini > 150) {
        this.lastMini = now;
        if (UI.screen === 'game') UI.updateMiniMap();
      }

      requestAnimationFrame((n) => this.loop(n));
    },

    drawTitle(t) {
      if (!this.titleCtx) return;
      PKM.RENDER.drawTitleScene(this.titleCtx, t);
    }
  };

  window.PKM_MAIN = Main;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Main.boot());
  } else {
    Main.boot();
  }
})();
