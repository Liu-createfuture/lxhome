/* ============================================================
   战斗系统：回合、属性、状态、捕获、经验与进化
   ============================================================ */
window.PKM = window.PKM || {};

(function () {
  const PKM = window.PKM;
  const D = PKM.DATA;
  const G = PKM.GAME;

  const STATUS_LABEL = { burn: '灼伤', poison: '中毒', par: '麻痹', sleep: '睡眠' };
  const STAT_LABEL = { atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };

  const B = {
    active: false,
    busy: false,
    over: false,
    kind: null,
    trainer: null,
    trainerId: null,
    enemyTeam: [],
    enemyIndex: 0,
    playerIndex: 0,
    enemyMon: null,
    playerMon: null,
    menu: null,
    focus: 0,
    msgResolve: null,
    msgTimer: null,
    forcedSwitch: false,
    participants: new Set(),
    turns: 0,
    el: {},
    lastResult: null,

    init() {
      const $ = id => document.getElementById(id);
      this.el = {
        layer: $('battle-layer'),
        bg: $('battle-bg'),
        message: $('battle-message'),
        actions: $('battle-actions'),
        submenu: $('battle-submenu'),
        enemyCanvas: $('enemy-sprite'),
        playerCanvas: $('player-sprite'),
        enemyCombatant: $('enemy-combatant'),
        playerCombatant: $('player-combatant'),
        enemyName: $('battle-enemy-name'),
        enemyLv: $('battle-enemy-lv'),
        enemyHp: $('battle-enemy-hp'),
        enemyHpText: $('battle-enemy-hptext'),
        enemyStatus: $('battle-enemy-status'),
        enemyTeam: $('battle-enemy-team'),
        playerName: $('battle-player-name'),
        playerLv: $('battle-player-lv'),
        playerHp: $('battle-player-hp'),
        playerHpText: $('battle-player-hptext'),
        playerStatus: $('battle-player-status'),
        playerExp: $('battle-player-exp'),
        playerExpText: $('battle-player-exptext'),
        fx: $('battle-fx')
      };
      this.el.message.addEventListener('click', () => this.skipMessage());
      this.el.layer.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-bact]');
        if (!btn || btn.disabled) return;
        e.preventDefault();
        const act = btn.dataset.bact;
        if (act === 'fight') { PKM.AUDIO.sfx('select'); this.showMoves(); }
        else if (act === 'bag') { PKM.AUDIO.sfx('select'); this.showBag(); }
        else if (act === 'party') { PKM.AUDIO.sfx('select'); this.showParty(false); }
        else if (act === 'run') { PKM.AUDIO.sfx('select'); this.attemptRun(); }
        else if (act === 'back') { PKM.AUDIO.sfx('cancel'); this.showMainMenu(); }
        else if (act === 'move') { PKM.AUDIO.sfx('select'); this.chooseMove(+btn.dataset.index); }
        else if (act === 'item') { PKM.AUDIO.sfx('select'); this.useItem(btn.dataset.item); }
        else if (act === 'switch') { PKM.AUDIO.sfx('select'); this.chooseSwitch(+btn.dataset.index); }
      });
    },

    setupBase() {
      this.active = true;
      this.busy = true;
      this.over = false;
      this.menu = null;
      this.focus = 0;
      this.forcedSwitch = false;
      this.participants = new Set();
      this.turns = 0;
      this.lastResult = null;
      this.el.layer.classList.remove('hidden');
      this.el.layer.classList.add('battle-enter');
      this.el.message.textContent = '';
      this.el.actions.innerHTML = '';
      this.el.submenu.innerHTML = '';
      this.el.actions.classList.remove('hidden');
      this.el.fx.innerHTML = '';
      this.el.playerCombatant.className = 'combatant player';
      this.el.enemyCombatant.className = 'combatant enemy';
      this.el.layer.classList.remove('battle-shake');
      PKM.AUDIO.playMusic('battle');
      G.paused = true;
      // background
      const mood = G.state.map === 'forest' || G.state.map === 'shrine' ? 'forest'
        : G.state.map === 'gym' ? 'gym'
          : (G.state.night ? 'night' : 'route');
      const ctx = this.el.bg.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      PKM.RENDER.drawBattleBackdrop(ctx, mood, 0);
    },

    startWild(speciesId, level, opts) {
      if (this.active) return;
      G.markSeen(speciesId);
      this.kind = 'wild';
      this.trainer = null;
      this.trainerId = null;
      this.enemyIndex = 0;
      this.enemyTeam = [G.createMon(speciesId, level, { met: G.state.map, metLevel: level })];
      this.playerIndex = G.firstHealthy();
      if (this.playerIndex < 0) { G.respawnAtHeal(); return; }
      this.playerMon = G.state.party[this.playerIndex];
      this.enemyMon = this.enemyTeam[0];
      this.prepareMons();
      this.setupBase();
      this.participants.add(this.playerMon.uid);
      this.drawSprites();
      this.updateInfo(true);
      this.showTeamDots();
      this.introWild();
    },

    startTrainer(trainerId) {
      if (this.active) return;
      const tr = D.TRAINERS[trainerId];
      if (!tr) return;
      this.kind = 'trainer';
      this.trainer = tr;
      this.trainerId = trainerId;
      this.enemyIndex = 0;
      this.enemyTeam = tr.team.map(t => {
        let sp = t.species;
        if (sp === 'counter') sp = G.state.rivalStarter || 'emberfox';
        G.markSeen(sp);
        return G.createMon(sp, t.level, { met: G.state.map });
      });
      this.playerIndex = G.firstHealthy();
      if (this.playerIndex < 0) { G.respawnAtHeal(); return; }
      this.playerMon = G.state.party[this.playerIndex];
      this.enemyMon = this.enemyTeam[0];
      this.prepareMons();
      this.setupBase();
      this.participants.add(this.playerMon.uid);
      this.drawSprites();
      this.updateInfo(true);
      this.showTeamDots();
      this.introTrainer();
    },

    prepareMons() {
      const prep = (m) => {
        m.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        m.confused = 0;
        m.flinch = false;
        m.seeded = false;
      };
      prep(this.playerMon);
      this.enemyTeam.forEach(prep);
    },

    prepareNextEnemy() {
      const m = this.enemyMon;
      m.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      m.confused = 0;
      m.flinch = false;
      m.seeded = false;
    },

    async introWild() {
      PKM.AUDIO.sfx('encounter');
      await this.delay(500);
      await this.msg(`野生的${D.SPECIES[this.enemyMon.species].name}出现了！`, 900);
      this.sendout('player');
      await this.msg(`上吧，${G.nameOf(this.playerMon)}！`, 650);
      this.showMainMenu();
    },

    async introTrainer() {
      PKM.AUDIO.sfx('encounter');
      await this.delay(450);
      const tr = this.trainer;
      await this.msg(`${tr.klass} ${tr.name} 想要对战！`, 750);
      await this.msg(`${tr.name}派出了${D.SPECIES[this.enemyMon.species].name}！`, 750);
      this.sendout('player');
      await this.msg(`上吧，${G.nameOf(this.playerMon)}！`, 650);
      this.showMainMenu();
    },

    delay(ms) {
      const speed = G.state.settings.speed || 1;
      return new Promise(r => setTimeout(r, Math.max(30, ms / speed)));
    },
    speedNow() { return G.state.settings.speed || 1; },

    msg(text, hold = 700) {
      if (this.over) return Promise.resolve();
      return new Promise(resolve => {
        this.el.message.textContent = text;
        this.el.message.classList.remove('msg-pop');
        void this.el.message.offsetWidth;
        this.el.message.classList.add('msg-pop');
        this.msgResolve = resolve;
        this.msgTimer = setTimeout(() => this.finishMsg(), Math.max(80, hold / this.speedNow()));
      });
    },
    finishMsg() {
      if (this.msgTimer) { clearTimeout(this.msgTimer); this.msgTimer = null; }
      if (this.msgResolve) {
        const r = this.msgResolve;
        this.msgResolve = null;
        r();
      }
    },
    skipMessage() {
      if (this.msgResolve) this.finishMsg();
    },

    drawSprites() {
      PKM.ART.drawMonsterCanvas(this.el.enemyCanvas, this.enemyMon.species, 0, true);
      PKM.ART.drawMonsterCanvas(this.el.playerCanvas, this.playerMon.species, 0, false);
      this.el.enemyCombatant.classList.remove('fainted', 'captured');
      this.el.playerCombatant.classList.remove('fainted');
    },

    sendout(side) {
      const el = side === 'player' ? this.el.playerCombatant : this.el.enemyCombatant;
      el.classList.remove('sendout');
      void el.offsetWidth;
      el.classList.add('sendout');
      setTimeout(() => el.classList.remove('sendout'), 700);
    },

    label(mon, side) {
      const n = G.nameOf(mon);
      if (side === 'player') return n;
      if (this.kind === 'wild') return '野生的' + n;
      return (this.trainer ? this.trainer.name + '的' : '对手的') + n;
    },

    updateInfo(instant) {
      const p = this.playerMon, e = this.enemyMon;
      if (!p || !e) return;
      this.el.enemyName.textContent = G.nameOf(e);
      this.el.enemyLv.textContent = 'Lv.' + e.level;
      const ep = Math.max(0, e.hp / e.maxHp * 100);
      this.el.enemyHp.style.width = ep + '%';
      this.el.enemyHp.className = 'hp-fill ' + (ep < 22 ? 'low' : ep < 50 ? 'mid' : '');
      this.el.enemyHpText.textContent = `${Math.max(0, e.hp)}/${e.maxHp}`;
      this.el.enemyStatus.textContent = e.status ? STATUS_LABEL[e.status] : '';
      this.el.enemyStatus.className = 'status-chip ' + (e.status || 'empty');
      this.el.playerName.textContent = G.nameOf(p);
      this.el.playerLv.textContent = 'Lv.' + p.level;
      const hp = Math.max(0, p.hp / p.maxHp * 100);
      this.el.playerHp.style.width = hp + '%';
      this.el.playerHp.className = 'hp-fill ' + (hp < 22 ? 'low' : hp < 50 ? 'mid' : '');
      this.el.playerHpText.textContent = `${Math.max(0, p.hp)}/${p.maxHp}`;
      this.el.playerStatus.textContent = p.status ? STATUS_LABEL[p.status] : '';
      this.el.playerStatus.className = 'status-chip ' + (p.status || 'empty');
      const need = G.expNeeded(p.level);
      this.el.playerExp.style.width = Math.min(100, p.exp / need * 100) + '%';
      this.el.playerExpText.textContent = p.level >= 100 ? 'MAX' : `${p.exp}/${need}`;
    },

    showTeamDots() {
      if (this.kind !== 'trainer') { this.el.enemyTeam.innerHTML = ''; return; }
      this.el.enemyTeam.innerHTML = this.enemyTeam.map((m, i) => {
        const cls = i < this.enemyIndex ? 'dot used' : i === this.enemyIndex ? 'dot active' : 'dot';
        return `<span class="${cls}"></span>`;
      }).join('');
    },

    showMainMenu() {
      if (this.over) return;
      this.menu = 'main';
      this.busy = false;
      this.focus = 0;
      this.forcedSwitch = false;
      this.el.submenu.innerHTML = '';
      this.el.submenu.classList.add('hidden');
      this.el.actions.classList.remove('hidden');
      this.el.actions.innerHTML = `
        <div class="battle-actions-inner">
          <div class="battle-prompt">要做什么？</div>
          <div class="battle-action-grid">
            <button data-bact="fight" class="battle-btn fight"><span>战斗</span><small>FIGHT</small></button>
            <button data-bact="bag" class="battle-btn"><span>背包</span><small>BAG</small></button>
            <button data-bact="party" class="battle-btn"><span>伙伴</span><small>TEAM</small></button>
            <button data-bact="run" class="battle-btn"><span>${this.kind === 'trainer' ? '投降' : '逃跑'}</span><small>RUN</small></button>
          </div>
        </div>`;
      this.el.message.textContent = this.kind === 'wild' ? '野生的宝可梦正警惕地看着你。' : `${this.trainer.name}正在等待你的行动。`;
      this.setFocus(0);
    },

    showMoves() {
      if (this.busy && this.menu) return;
      this.menu = 'moves';
      this.busy = false;
      this.focus = 0;
      this.el.actions.classList.add('hidden');
      this.el.submenu.classList.remove('hidden');
      const moves = this.playerMon.moves;
      this.el.submenu.innerHTML = `
        <div class="moves-panel">
          <div class="battle-prompt">选择招式 <span class="hint">X 返回 · 招式等级在特训页提升</span></div>
          <div class="move-grid" style="grid-template-columns:repeat(${Math.min(4, Math.max(1, moves.length))},1fr)">
            ${moves.map((mv, i) => {
              const m = D.MOVES[mv.id];
              const t = D.TYPES[m.type];
              const eff = G.effMove(this.playerMon, mv);
              const pp = mv.pp <= 0;
              return `<button class="move-btn ${pp ? 'disabled' : ''}" data-bact="move" data-index="${i}" ${pp ? 'disabled' : ''} style="--type:${t.color};--type-dark:${t.dark}">
                <span class="move-type">${t.name}${eff.rank > 1 ? `<i class="move-rank">Lv.${eff.rank}</i>` : ''}</span>
                <span class="move-name">${m.name}</span>
                <span class="move-meta">${m.cat === 'status' ? '变化' : (eff.power + ' 威力')} · PP ${mv.pp}/${mv.maxPp}</span>
              </button>`;
            }).join('')}
          </div>
          <button class="back-btn" data-bact="back">返回</button>
        </div>`;
      this.setFocus(0);
    },

    showBag() {
      if (this.menu === 'bag' || this.busy) return;
      this.menu = 'bag';
      this.busy = false;
      this.focus = 0;
      this.el.actions.classList.add('hidden');
      this.el.submenu.classList.remove('hidden');
      const ids = Object.keys(G.state.bag).filter(id => {
        const cat = D.ITEMS[id] && D.ITEMS[id].cat;
        return cat === 'ball' || cat === 'medicine' || cat === 'berry';
      });
      const html = ids.length ? ids.map(id => {
        const it = D.ITEMS[id];
        return `<button class="bag-item-btn" data-bact="item" data-item="${id}">
          <span class="bag-icon" data-icon="${id}"></span>
          <span class="bag-name">${it.name}</span>
          <span class="bag-qty">×${G.state.bag[id]}</span>
        </button>`;
      }).join('') : '<div class="empty-note">背包里没有可以在战斗中使用的道具。</div>';
      this.el.submenu.innerHTML = `
        <div class="bag-panel">
          <div class="battle-prompt">要使用什么？ <span class="hint">X 返回</span></div>
          <div class="battle-bag-grid">${html}</div>
          <button class="back-btn" data-bact="back">返回</button>
        </div>`;
      this.el.submenu.querySelectorAll('[data-icon]').forEach(el => {
        const c = document.createElement('canvas'); c.width = 24; c.height = 24;
        PKM.ART.drawItemIcon(c, el.dataset.icon);
        el.appendChild(c);
      });
      this.setFocus(0);
    },

    showParty(forced) {
      if (!forced && this.busy && this.menu) return;
      this.menu = 'party';
      this.busy = false;
      this.forcedSwitch = !!forced;
      this.focus = 0;
      this.el.actions.classList.add('hidden');
      this.el.submenu.classList.remove('hidden');
      const cards = G.state.party.map((m, i) => {
        const sp = D.SPECIES[m.species];
        const active = i === this.playerIndex;
        const dead = m.hp <= 0;
        return `<button class="battle-party-btn ${active ? 'active' : ''} ${dead ? 'fainted' : ''}" data-bact="switch" data-index="${i}" ${active || dead ? 'disabled' : ''}>
          <span class="party-sprite-wrap"><canvas class="party-sprite" data-species="${m.species}" width="64" height="64"></canvas></span>
          <span class="party-info">
            <span class="party-name">${G.nameOf(m)} ${active ? '<i>出战中</i>' : ''}</span>
            <span class="party-lv">Lv.${m.level} ${sp.types.map(t => `<b style="color:${D.TYPES[t].color}">${D.TYPES[t].name}</b>`).join(' ')}</span>
            <span class="party-hp-row"><span class="mini-hp"><i style="width:${Math.max(0, m.hp / m.maxHp * 100)}%"></i></span><small>${Math.max(0, m.hp)}/${m.maxHp}</small></span>
            ${m.status ? `<span class="status-chip ${m.status}">${STATUS_LABEL[m.status]}</span>` : ''}
          </span>
        </button>`;
      }).join('');
      this.el.submenu.innerHTML = `
        <div class="party-panel">
          <div class="battle-prompt">${forced ? '选择下一只上场的宝可梦' : '要换上哪一只？'} <span class="hint">${forced ? '' : 'X 返回'}</span></div>
          <div class="battle-party-list">${cards}</div>
          ${forced ? '' : '<button class="back-btn" data-bact="back">返回</button>'}
        </div>`;
      this.el.submenu.querySelectorAll('canvas[data-species]').forEach(c => {
        PKM.ART.drawMonsterCanvas(c, c.dataset.species, 0, false);
      });
      this.setFocus(0);
    },

    activePanel() {
      return this.el.submenu.classList.contains('hidden') ? this.el.actions : this.el.submenu;
    },

    setFocus(i) {
      this.focus = i;
      const buttons = Array.from(this.activePanel().querySelectorAll('[data-bact]:not([disabled])'));
      this.el.layer.querySelectorAll('.focused').forEach(b => b.classList.remove('focused'));
      if (buttons[i]) buttons[i].classList.add('focused');
    },

    handleKey(key) {
      if (!this.active) return false;
      if (this.msgResolve && (key === 'confirm' || key === 'cancel')) {
        this.skipMessage(); return true;
      }
      if (!this.menu) return true;
      if (key === 'cancel') {
        if (this.forcedSwitch) return true;
        if (this.menu !== 'main') { PKM.AUDIO.sfx('cancel'); this.showMainMenu(); }
        return true;
      }
      const buttons = Array.from(this.activePanel().querySelectorAll('[data-bact]:not([disabled])'));
      if (!buttons.length) return true;
      if (key === 'left') { this.setFocus((this.focus - 1 + buttons.length) % buttons.length); PKM.AUDIO.sfx('move'); }
      else if (key === 'right') { this.setFocus((this.focus + 1) % buttons.length); PKM.AUDIO.sfx('move'); }
      else if (key === 'up') { this.setFocus((this.focus - 2 + buttons.length) % buttons.length); PKM.AUDIO.sfx('move'); }
      else if (key === 'down') { this.setFocus((this.focus + 2) % buttons.length); PKM.AUDIO.sfx('move'); }
      else if (key === 'confirm') {
        PKM.AUDIO.sfx('select');
        if (buttons[this.focus]) buttons[this.focus].click();
      }
      return true;
    },

    /* ---------- 选择行动 ---------- */
    chooseMove(index) {
      if (this.busy || this.menu !== 'moves') return;
      const mv = this.playerMon.moves[index];
      if (!mv || mv.pp <= 0) return;
      this.busy = true;
      this.menu = null;
      this.hidePanels();
      this.resolveMoveTurn(mv, index);
    },

    async resolveMoveTurn(playerMove, index) {
      const enemyMove = this.chooseEnemyMove();
      const pSpeed = this.effSpeed(this.playerMon);
      const eSpeed = this.effSpeed(this.enemyMon);
      const pPrio = D.MOVES[playerMove.id].prio;
      const ePrio = enemyMove ? D.MOVES[enemyMove.id].prio : 0;
      let playerFirst;
      if (pPrio !== ePrio) playerFirst = pPrio > ePrio;
      else if (pSpeed !== eSpeed) playerFirst = pSpeed > eSpeed;
      else playerFirst = Math.random() < .5;

      const order = playerFirst ? ['player', 'enemy'] : ['enemy', 'player'];
      for (const side of order) {
        if (this.over) return;
        if (this.enemyMon.hp <= 0 || this.playerMon.hp <= 0) break;
        if (side === 'player') {
          await this.performMove(this.playerMon, this.enemyMon, playerMove, 'player');
        } else if (enemyMove) {
          await this.performMove(this.enemyMon, this.playerMon, enemyMove, 'enemy');
        }
      }
      if (this.over) return;
      await this.endOfTurn();
      if (this.over) return;
      await this.settleFaints();
      if (this.over) return;
      this.busy = false;
      this.showMainMenu();
    },

    effSpeed(mon) {
      let s = mon.stats.spe * this.stageMul(mon.stages.spe);
      if (mon.status === 'par') s *= .5;
      return Math.floor(s);
    },

    stageMul(stage) {
      if (stage >= 0) return (2 + stage) / 2;
      return 2 / (2 - stage);
    },

    chooseEnemyMove() {
      const moves = this.enemyMon.moves.filter(m => m.pp > 0);
      if (!moves.length) return { id: 'tackle', pp: 1, maxPp: 1, struggle: true };
      let best = moves[0], bestScore = -1;
      for (const mv of moves) {
        const m = D.MOVES[mv.id];
        let score = 0;
        if (m.cat === 'status') {
          if (m.heal) score = this.enemyMon.hp < this.enemyMon.maxHp * .5 ? 38 : 6;
          else if (m.status && !this.playerMon.status) score = 30;
          else if (m.stat && m.stat.target === 'self') score = 18;
          else if (m.stat) score = 24;
          else if (m.seed && !this.playerMon.seeded) score = 28;
          else if (m.confuse && !this.playerMon.confused) score = 22;
          else score = 4;
        } else {
          const eff = G.effectiveness(m.type, D.SPECIES[this.playerMon.species].types);
          score = (m.power || 1) * eff * (D.SPECIES[this.enemyMon.species].types.includes(m.type) ? 1.2 : 1);
          score += Math.random() * 12;
        }
        if (score > bestScore) { bestScore = score; best = mv; }
      }
      if (Math.random() < .15) best = moves[Math.floor(Math.random() * moves.length)];
      return best;
    },

    async canAct(mon, side) {
      if (mon.status === 'sleep') {
        if (mon.statusTurns <= 0) {
          mon.status = null;
          await this.msg(`${this.label(mon, side)}醒过来了！`, 650);
          return true;
        }
        mon.statusTurns--;
        await this.msg(`${this.label(mon, side)}正在呼呼大睡……`, 650);
        return false;
      }
      if (mon.status === 'par' && Math.random() < .25) {
        await this.msg(`${this.label(mon, side)}被电流麻痹了，无法行动！`, 650);
        return false;
      }
      if (mon.confused > 0) {
        mon.confused--;
        if (mon.confused <= 0) {
          await this.msg(`${this.label(mon, side)}摆脱了混乱！`, 500);
        } else if (Math.random() < .34) {
          const dmg = Math.max(1, Math.floor(((((2 * mon.level / 5 + 2) * 40 * mon.stats.atk / mon.stats.def) / 50) + 2) * .8));
          mon.hp = Math.max(0, mon.hp - dmg);
          this.hitAnim(side, 'ghost');
          this.updateInfo();
          await this.msg(`${this.label(mon, side)}在混乱中打伤了自己！`, 750);
          return false;
        }
      }
      if (mon.flinch) {
        mon.flinch = false;
        await this.msg(`${this.label(mon, side)}畏缩了，无法行动！`, 600);
        return false;
      }
      return true;
    },

    async performMove(attacker, defender, mv, side) {
      const defenderSide = side === 'player' ? 'enemy' : 'player';
      const move = mv.struggle ? { name: '挣扎', type: 'normal', cat: 'physical', power: 40, acc: 100, recoil: .25 } : D.MOVES[mv.id];
      const eff = mv.struggle ? null : G.effMove(attacker, mv);
      if (!mv.struggle) {
        if (mv.pp <= 0) {
          await this.msg(`${this.label(attacker, side)}没有可用的 PP 了！`, 600);
          return;
        }
        mv.pp--;
      }
      const acted = await this.canAct(attacker, side);
      if (!acted || this.over) return;
      await this.msg(`${this.label(attacker, side)}使用了${move.name}！`, 520);
      this.attackAnim(side);

      const acc = eff ? eff.acc : move.acc;
      if (acc !== 0 && Math.random() * 100 >= acc) {
        PKM.AUDIO.sfx('weakhit');
        await this.msg('但是没有命中……', 600);
        return;
      }
      if (move.cat === 'status') {
        await this.useStatusMove(attacker, defender, move, side, defenderSide);
        return;
      }
      await this.dealDamage(attacker, defender, move, side, defenderSide, eff);
      if (defender.hp <= 0) return;
      await this.applyAfterEffects(attacker, defender, move, side, defenderSide);
    },

    async useStatusMove(attacker, defender, move, side, defenderSide) {
      const dTypes = D.SPECIES[defender.species].types;
      if (['催眠粉', '麻痹粉', '毒粉', '寄生种子'].includes(move.name) && dTypes.includes('grass')) {
        await this.msg(`对${this.label(defender, defenderSide)}没有效果……`, 650);
        return;
      }
      if (move.heal) {
        if (attacker.hp >= attacker.maxHp) {
          await this.msg('但是体力已经是满的！', 600);
          return;
        }
        const amount = Math.floor(attacker.maxHp * move.heal);
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + amount);
        PKM.AUDIO.sfx('heal');
        this.updateInfo();
        await this.msg(`${this.label(attacker, side)}回复了 ${amount} 点体力！`, 700);
        return;
      }
      if (move.status) {
        if (defender.status) {
          await this.msg('但是失败了……', 550);
          return;
        }
        if (Math.random() * 100 < move.status.chance) {
          defender.status = move.status.status;
          defender.statusTurns = move.status.status === 'sleep' ? 1 + Math.floor(Math.random() * 3) : 0;
          this.updateInfo();
          PKM.AUDIO.sfx('sparkle');
          await this.msg(`${this.label(defender, defenderSide)}${move.status.status === 'sleep' ? '睡着了' : move.status.status === 'burn' ? '被灼伤了' : move.status.status === 'par' ? '麻痹了' : '中毒了'}！`, 720);
        } else {
          await this.msg('但是失败了……', 550);
        }
        return;
      }
      if (move.stat) {
        await this.applyStat(move.stat, attacker, defender, side, defenderSide);
        return;
      }
      if (move.seed) {
        if (defender.seeded) { await this.msg('但是失败了……', 550); return; }
        defender.seeded = true;
        await this.msg(`${this.label(defender, defenderSide)}被种下了寄生种子！`, 700);
        return;
      }
      if (move.confuse) {
        if (defender.confused > 0) { await this.msg('但是失败了……', 550); return; }
        defender.confused = 2 + Math.floor(Math.random() * 3);
        await this.msg(`${this.label(defender, defenderSide)}陷入了混乱！`, 700);
        return;
      }
      await this.msg('但是什么也没有发生……', 550);
    },

    async applyStat(stat, attacker, defender, side, defenderSide) {
      const target = stat.target === 'self' ? attacker : defender;
      const targetSide = stat.target === 'self' ? side : defenderSide;
      if ((stat.chance != null && Math.random() * 100 >= stat.chance)) {
        await this.msg('但是失败了……', 550);
        return;
      }
      const cur = target.stages[stat.stat] || 0;
      if (cur === 6 && stat.stages > 0 || cur === -6 && stat.stages < 0) {
        await this.msg(`${this.label(target, targetSide)}的${STAT_LABEL[stat.stat]}已经无法再${stat.stages > 0 ? '提高' : '降低'}了！`, 650);
        return;
      }
      target.stages[stat.stat] = Math.max(-6, Math.min(6, cur + stat.stages));
      this.updateInfo();
      await this.msg(`${this.label(target, targetSide)}的${STAT_LABEL[stat.stat]}${stat.stages > 0 ? '提高了' : '降低了'}${Math.abs(stat.stages) > 1 ? '很多' : ''}！`, 680);
    },

    async dealDamage(attacker, defender, move, side, defenderSide, eff) {
      const defenderTypes = D.SPECIES[defender.species].types;
      const effMul = G.effectiveness(move.type, defenderTypes);
      if (effMul === 0) {
        PKM.AUDIO.sfx('weakhit');
        await this.msg(`对${this.label(defender, defenderSide)}没有效果……`, 700);
        return;
      }
      const cat = move.cat;
      const power = eff && eff.power ? eff.power : move.power;
      const atkStage = cat === 'physical' ? attacker.stages.atk : attacker.stages.spa;
      const defStage = cat === 'physical' ? defender.stages.def : defender.stages.spd;
      let atk = (cat === 'physical' ? attacker.stats.atk : attacker.stats.spa) * this.stageMul(atkStage);
      const def = Math.max(1, (cat === 'physical' ? defender.stats.def : defender.stats.spd) * this.stageMul(defStage));
      if (cat === 'physical' && attacker.status === 'burn') atk *= .5;
      let base = Math.floor(((((2 * attacker.level / 5 + 2) * power * atk / def) / 50) + 2));
      const stab = D.SPECIES[attacker.species].types.includes(move.type) ? 1.5 : 1;
      const moveCrit = eff ? eff.crit : (move.crit || 0);
      const swift = (attacker.training && attacker.training.swift) || 0;
      const critChance = 1 / 16 + moveCrit / 16 + swift * .02;
      const crit = Math.random() < critChance;
      const rand = .85 + Math.random() * .15;
      let dmg = Math.floor(base * stab * effMul * (crit ? 1.5 : 1) * rand);
      dmg = Math.max(1, dmg);
      defender.hp = Math.max(0, defender.hp - dmg);
      this.hitAnim(defenderSide, move.type);
      this.updateInfo();
      PKM.AUDIO.sfx(effMul > 1 ? 'superhit' : effMul < 1 ? 'weakhit' : 'hit');
      await this.delay(260);
      if (crit) await this.msg('击中了要害！', 500);
      if (effMul > 1) await this.msg('效果拔群！', 600);
      else if (effMul < 1) await this.msg('效果不太理想……', 550);
    },

    async applyAfterEffects(attacker, defender, move, side, defenderSide) {
      if (move.drain && defender.hp < defender.maxHp) {
        const heal = Math.max(1, Math.floor(attacker.maxHp * .2));
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        this.updateInfo();
        await this.msg(`${this.label(attacker, side)}吸取了体力！`, 600);
      }
      if (move.recoil) {
        const r = Math.max(1, Math.floor(attacker.maxHp * move.recoil * .35));
        attacker.hp = Math.max(0, attacker.hp - r);
        this.updateInfo();
        this.hitAnim(side, 'normal');
        await this.msg(`${this.label(attacker, side)}受到了反作用力的伤害！`, 650);
      }
      if (defender.hp <= 0) return;
      if (move.status && !defender.status && Math.random() * 100 < move.status.chance) {
        defender.status = move.status.status;
        defender.statusTurns = move.status.status === 'sleep' ? 1 + Math.floor(Math.random() * 3) : 0;
        this.updateInfo();
        await this.msg(`${this.label(defender, defenderSide)}${move.status.status === 'burn' ? '被灼伤了' : move.status.status === 'par' ? '麻痹了' : move.status.status === 'poison' ? '中毒了' : '睡着了'}！`, 650);
      }
      if (move.stat && (!move.stat.chance || Math.random() * 100 < move.stat.chance)) {
        await this.applyStat(move.stat, attacker, defender, side, defenderSide);
      }
      if (move.confuse && defender.hp > 0 && defender.confused <= 0 && Math.random() * 100 < move.confuse.chance) {
        defender.confused = 2 + Math.floor(Math.random() * 3);
        await this.msg(`${this.label(defender, defenderSide)}陷入了混乱！`, 650);
      }
      if (move.flinch && Math.random() * 100 < move.flinch) {
        defender.flinch = true;
      }
      if (move.seed && !defender.seeded) {
        defender.seeded = true;
        await this.msg(`${this.label(defender, defenderSide)}被种下了寄生种子！`, 650);
      }
    },

    async endOfTurn() {
      for (const side of ['player', 'enemy']) {
        if (this.over) return;
        const mon = side === 'player' ? this.playerMon : this.enemyMon;
        if (!mon || mon.hp <= 0) continue;
        if (mon.status === 'burn') {
          const d = Math.max(1, Math.floor(mon.maxHp / 16));
          mon.hp = Math.max(0, mon.hp - d);
          this.updateInfo();
          this.hitAnim(side, 'fire');
          PKM.AUDIO.sfx('weakhit');
          await this.msg(`${this.label(mon, side)}受到了灼伤的伤害！`, 600);
        } else if (mon.status === 'poison') {
          const d = Math.max(1, Math.floor(mon.maxHp / 8));
          mon.hp = Math.max(0, mon.hp - d);
          this.updateInfo();
          this.hitAnim(side, 'poison');
          PKM.AUDIO.sfx('weakhit');
          await this.msg(`${this.label(mon, side)}受到了毒的伤害！`, 600);
        }
        if (mon.hp <= 0) continue;
        if (mon.seeded) {
          const d = Math.max(1, Math.floor(mon.maxHp / 8));
          mon.hp = Math.max(0, mon.hp - d);
          const foe = side === 'player' ? this.enemyMon : this.playerMon;
          if (foe.hp > 0) foe.hp = Math.min(foe.maxHp, foe.hp + d);
          this.updateInfo();
          PKM.AUDIO.sfx('weakhit');
          await this.msg(`${this.label(mon, side)}的体力被寄生种子吸走了！`, 620);
        }
        mon.flinch = false;
      }
      this.turns++;
    },

    async settleFaints() {
      if (this.enemyMon.hp <= 0) { await this.enemyFainted(); return; }
      if (this.playerMon.hp <= 0) { await this.playerFainted(); return; }
    },

    async enemyFainted() {
      this.busy = true;
      this.menu = null;
      this.hidePanels();
      this.el.enemyCombatant.classList.add('fainted');
      PKM.AUDIO.sfx('faint');
      await this.msg(`${this.label(this.enemyMon, 'enemy')}倒下了！`, 850);
      const exp = Math.max(1, Math.floor(D.SPECIES[this.enemyMon.species].exp * this.enemyMon.level / 6 * (this.kind === 'trainer' ? 1.5 : 1)));
      await this.gainExp(exp);
      if (this.over) return;
      if (this.playerMon.hp <= 0) {
        await this.playerFainted();
        return;
      }
      if (this.kind === 'trainer' && this.enemyIndex < this.enemyTeam.length - 1) {
        this.enemyIndex++;
        this.enemyMon = this.enemyTeam[this.enemyIndex];
        this.prepareNextEnemy();
        this.el.enemyCombatant.classList.remove('fainted');
        this.drawSprites();
        this.updateInfo();
        this.showTeamDots();
        this.sendout('enemy');
        await this.msg(`${this.trainer.name}派出了${G.nameOf(this.enemyMon)}！`, 750);
        this.busy = false;
        this.showMainMenu();
        return;
      }
      if (this.kind === 'trainer') {
        await this.trainerVictory();
      } else {
        PKM.AUDIO.sfx('victory');
        await this.msg('战斗胜利！', 650);
        this.finish('win');
      }
    },

    async gainExp(amount) {
      const mon = this.playerMon;
      const res = G.gainExperience(mon, amount);
      this.updateInfo();
      await this.msg(`${G.nameOf(mon)}获得了 ${amount} 点经验值！`, 700);
      for (const lv of res.levels) {
        PKM.AUDIO.sfx('level');
        this.updateInfo();
        await this.msg(`${G.nameOf(mon)}升到了 ${lv} 级！`, 750);
      }
      if (res.sp > 0) {
        await this.msg(`获得 ${res.sp} 点技能点，可以在旅人手记的「特训」页使用。`, 850);
      }
      for (const mid of res.moves) {
        await this.msg(`${G.nameOf(mon)}学会了${D.MOVES[mid].name}！`, 750);
      }
      if (res.evolution) {
        await this.evolveSequence(res.evolution);
      }
      G.autoSave();
    },

    async evolveSequence(evo) {
      const mon = evo.mon;
      const from = evo.from, to = evo.to;
      PKM.AUDIO.playMusic('ending');
      PKM.AUDIO.sfx('level');
      const overlay = document.createElement('div');
      overlay.className = 'evolution-overlay';
      overlay.innerHTML = `
        <div class="evo-flash"></div>
        <canvas class="evo-canvas" width="180" height="180"></canvas>
        <div class="evo-title">咦……？</div>
        <div class="evo-text">${G.nameOf(mon)}的样子……</div>`;
      this.el.layer.appendChild(overlay);
      const canvas = overlay.querySelector('canvas');
      PKM.ART.drawMonsterCanvas(canvas, from, 0, false);
      await this.delay(850);
      overlay.classList.add('flashing');
      PKM.AUDIO.sfx('sparkle');
      await this.delay(650);
      PKM.ART.drawMonsterCanvas(canvas, to, 0, false);
      overlay.classList.remove('flashing');
      overlay.classList.add('revealed');
      overlay.querySelector('.evo-title').textContent = '恭喜！';
      overlay.querySelector('.evo-text').textContent = `${G.nameOf(mon)}进化成了${D.SPECIES[to].name}！`;
      PKM.AUDIO.sfx('victory');
      await this.delay(1600);
      overlay.classList.add('fade');
      await this.delay(400);
      overlay.remove();
      const result = G.evolveMon(mon);
      this.playerMon = mon;
      this.drawSprites();
      this.updateInfo();
      PKM.AUDIO.playMusic('battle');
      if (result) {
        await this.msg(`${result.oldName}进化成了${result.newName}！`, 900);
      }
    },

    async trainerVictory() {
      this.busy = true;
      this.menu = null;
      this.hidePanels();
      const tr = this.trainer;
      G.state.flags[tr.flag] = true;
      G.state.trainerWins = (G.state.trainerWins || 0) + 1;
      if (tr.reward) G.state.money += tr.reward;
      PKM.AUDIO.sfx('victory');
      await this.msg(`战胜了${tr.klass} ${tr.name}！`, 850);
      for (const line of (tr.win || []).slice(0, 4)) {
        await this.msg(line, 950);
      }
      if (tr.reward) await this.msg(`获得了 ${tr.reward} 金币。`, 650);
      if (tr.badge) {
        if (!G.state.flags.badge) {
          G.state.flags.badge = true;
          G.state.flags.forestGateOpen = true;
          G.state.bag.badge = 1;
          if (!G.state.badges.includes('badge')) G.state.badges.push('badge');
          PKM.AUDIO.sfx('victory');
          await this.msg('获得了森语徽章！北边萤火森林的结界解开了。', 1100);
        }
      }
      G.autoSave();
      this.finish('win');
    },

    /* ---------- 换人 ---------- */
    async chooseSwitch(index) {
      if (index === this.playerIndex) return;
      const mon = G.state.party[index];
      if (!mon || mon.hp <= 0) return;
      if (this.forcedSwitch) {
        this.forcedSwitch = false;
        this.playerIndex = index;
        this.playerMon = mon;
        this.playerMon.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        this.playerMon.confused = 0;
        this.playerMon.flinch = false;
        this.el.playerCombatant.classList.remove('fainted');
        this.drawSprites();
        this.updateInfo();
        this.sendout('player');
        await this.msg(`上吧，${G.nameOf(this.playerMon)}！`, 650);
        this.busy = false;
        this.showMainMenu();
        return;
      }
      if (this.busy) return;
      this.busy = true;
      this.menu = null;
      this.hidePanels();
      await this.msg(`回来吧，${G.nameOf(this.playerMon)}！`, 600);
      this.playerIndex = index;
      this.playerMon = mon;
      this.playerMon.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      this.playerMon.confused = 0;
      this.playerMon.flinch = false;
      this.drawSprites();
      this.updateInfo();
      this.sendout('player');
      await this.msg(`上吧，${G.nameOf(this.playerMon)}！`, 600);
      // enemy free attack
      const enemyMove = this.chooseEnemyMove();
      if (enemyMove && this.enemyMon.hp > 0) {
        await this.performMove(this.enemyMon, this.playerMon, enemyMove, 'enemy');
      }
      if (this.over) return;
      await this.endOfTurn();
      await this.settleFaints();
      if (this.over) return;
      this.busy = false;
      this.showMainMenu();
    },

    async playerFainted() {
      this.busy = true;
      this.menu = null;
      this.hidePanels();
      this.playerMon.hp = 0;
      this.el.playerCombatant.classList.add('fainted');
      PKM.AUDIO.sfx('faint');
      this.updateInfo();
      await this.msg(`${G.nameOf(this.playerMon)}倒下了！`, 850);
      const alive = G.state.party.some(m => m.hp > 0);
      if (alive) {
        await this.msg('选择下一只上场的宝可梦。', 650);
        this.busy = false;
        this.showParty(true);
      } else {
        await this.msg('眼前一黑……', 900);
        this.finish('lose');
      }
    },

    /* ---------- 道具 ---------- */
    async useItem(id) {
      if (this.busy) return;
      const item = D.ITEMS[id];
      if (!item) return;
      if (item.cat === 'ball') {
        if (this.kind === 'trainer') {
          PKM.AUDIO.sfx('cancel');
          await this.msg('不可以对训练家的宝可梦扔精灵球！', 700);
          return;
        }
        this.busy = true;
        this.menu = null;
        this.hidePanels();
        await this.throwBall(id);
        return;
      }
      this.busy = true;
      this.menu = null;
      this.hidePanels();
      const res = G.useMedicine(this.playerIndex, id);
      if (!res.ok) {
        await this.msg(res.msg, 700);
        this.busy = false;
        this.showMainMenu();
        return;
      }
      this.updateInfo();
      PKM.AUDIO.sfx('heal');
      await this.msg(res.msg, 750);
      const enemyMove = this.chooseEnemyMove();
      if (enemyMove && this.enemyMon.hp > 0) {
        await this.performMove(this.enemyMon, this.playerMon, enemyMove, 'enemy');
      }
      if (this.over) return;
      await this.endOfTurn();
      await this.settleFaints();
      if (this.over) return;
      this.busy = false;
      this.showMainMenu();
    },

    async throwBall(itemId) {
      const item = D.ITEMS[itemId];
      if (!G.removeItem(itemId, 1)) { this.busy = false; this.showMainMenu(); return; }
      PKM.AUDIO.sfx('ball');
      await this.msg(`扔出了${item.name}！`, 500);
      this.ballAnim();
      await this.delay(600);
      const e = this.enemyMon;
      const hpFactor = (3 * e.maxHp - 2 * e.hp) / (3 * e.maxHp);
      const statusBonus = e.status === 'sleep' ? 2.5 : e.status ? 1.5 : 1;
      const rateFactor = Math.pow(D.SPECIES[e.species].rate / 255, .65);
      let p = (.12 + .88 * hpFactor) * rateFactor * (item.ball || 1) * statusBonus;
      p = Math.max(.02, Math.min(.96, p));
      const success = Math.random() < p;
      const shakes = success ? 3 : p > .55 ? 2 : p > .25 ? 1 : 0;
      for (let i = 0; i < shakes; i++) {
        PKM.AUDIO.sfx('shake');
        this.shakeBall();
        await this.delay(600);
      }
      if (success) {
        PKM.AUDIO.sfx('catch');
        this.el.enemyCombatant.classList.add('captured');
        const mon = G.createMon(e.species, e.level, { met: G.state.map, metLevel: e.level });
        G.markCaught(e.species);
        G.state.catches++;
        const res = G.addMon(mon);
        this.updateInfo();
        await this.msg(`太好了！捕获了${G.nameOf(mon)}！`, 950);
        if (res.toPC) await this.msg(`${G.nameOf(mon)}被传送到了电脑箱。`, 800);
        await this.msg(`图鉴数据已记录：${D.SPECIES[e.species].name}`, 700);
        G.autoSave();
        this.finish('caught', { species: e.species, mon });
      } else {
        this.ballBreakAnim();
        await this.msg(`可恶！${G.nameOf(e)}挣脱了！`, 750);
        const enemyMove = this.chooseEnemyMove();
        if (enemyMove) await this.performMove(this.enemyMon, this.playerMon, enemyMove, 'enemy');
        if (this.over) return;
        await this.endOfTurn();
        await this.settleFaints();
        if (this.over) return;
        this.busy = false;
        this.showMainMenu();
      }
    },

    async attemptRun() {
      if (this.busy) return;
      if (this.kind === 'trainer') {
        await this.msg('不能从训练家对战中逃跑！', 700);
        this.showMainMenu();
        return;
      }
      this.busy = true;
      this.menu = null;
      this.hidePanels();
      const chance = Math.max(.3, Math.min(.95, .55 + (this.effSpeed(this.playerMon) - this.effSpeed(this.enemyMon)) / 180));
      if (Math.random() < chance) {
        PKM.AUDIO.sfx('run');
        await this.msg('成功逃走了！', 650);
        this.finish('fled');
        return;
      }
      await this.msg('没能逃掉！', 650);
      const enemyMove = this.chooseEnemyMove();
      if (enemyMove) await this.performMove(this.enemyMon, this.playerMon, enemyMove, 'enemy');
      if (this.over) return;
      await this.endOfTurn();
      await this.settleFaints();
      if (this.over) return;
      this.busy = false;
      this.showMainMenu();
    },

    /* ---------- 动画 ---------- */
    attackAnim(side) {
      const el = side === 'player' ? this.el.playerCombatant : this.el.enemyCombatant;
      el.classList.remove('lunge-left', 'lunge-right');
      void el.offsetWidth;
      el.classList.add(side === 'player' ? 'lunge-right' : 'lunge-left');
      setTimeout(() => el.classList.remove('lunge-right', 'lunge-left'), 380);
    },

    hitAnim(side, type) {
      const el = side === 'player' ? this.el.playerCombatant : this.el.enemyCombatant;
      el.classList.remove('hit-shake', 'hit-flash');
      void el.offsetWidth;
      el.classList.add('hit-shake');
      this.spawnParticles(side, type);
      this.el.layer.classList.remove('battle-shake');
      void this.el.layer.offsetWidth;
      this.el.layer.classList.add('battle-shake');
      setTimeout(() => {
        el.classList.remove('hit-shake', 'hit-flash');
        this.el.layer.classList.remove('battle-shake');
      }, 460);
    },

    spawnParticles(side, type) {
      if (!this.el.fx) return;
      const target = side === 'player' ? this.el.playerCombatant : this.el.enemyCombatant;
      const layerRect = this.el.layer.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      const cx = (r.left - layerRect.left + r.width / 2) / layerRect.width * 100;
      const cy = (r.top - layerRect.top + r.height / 2) / layerRect.height * 100;
      const color = (D.TYPES[type] || D.TYPES.normal).color;
      for (let i = 0; i < 12; i++) {
        const dot = document.createElement('i');
        dot.className = 'battle-particle';
        const ang = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 95;
        dot.style.left = cx + '%';
        dot.style.top = cy + '%';
        dot.style.background = i % 3 === 0 ? '#fff6d8' : color;
        dot.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
        dot.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
        dot.style.width = dot.style.height = (2 + Math.random() * 4) + 'px';
        this.el.fx.appendChild(dot);
        setTimeout(() => dot.remove(), 650);
      }
    },

    ballAnim() {
      const ball = document.createElement('div');
      ball.className = 'battle-ball throw';
      this.el.layer.appendChild(ball);
      setTimeout(() => { ball.classList.remove('throw'); ball.classList.add('at-target'); }, 500);
      setTimeout(() => ball.remove(), 3200);
      this.ballEl = ball;
    },
    shakeBall() {
      if (!this.ballEl) return;
      this.ballEl.classList.remove('shake1', 'shake2', 'shake3');
      void this.ballEl.offsetWidth;
      const n = Math.floor(Math.random() * 3) + 1;
      this.ballEl.classList.add('shake' + n);
    },
    ballBreakAnim() {
      if (this.ballEl) {
        this.ballEl.classList.add('break');
        const el = this.ballEl;
        setTimeout(() => el.remove(), 500);
        this.ballEl = null;
      }
    },

    hidePanels() {
      this.el.actions.classList.add('hidden');
      this.el.submenu.classList.add('hidden');
    },

    /* ---------- 结束 ---------- */
    finish(result, data) {
      if (this.over) return;
      this.over = true;
      this.active = false;
      this.busy = true;
      this.menu = null;
      if (this.msgTimer) clearTimeout(this.msgTimer);
      this.msgTimer = null;
      this.msgResolve = null;
      this.lastResult = { result, kind: this.kind, trainerId: this.trainerId, data: data || {} };
      this.el.layer.querySelectorAll('.battle-ball').forEach(el => el.remove());
      this.ballEl = null;
      this.el.layer.classList.add('battle-exit');
      const map = G.currentMap();
      setTimeout(() => {
        this.el.layer.classList.add('hidden');
        this.el.layer.classList.remove('battle-enter', 'battle-exit');
        this.el.fx.innerHTML = '';
        G.paused = false;
        if (map && map.music) PKM.AUDIO.playMusic(map.music);
        if (PKM.UI) {
          if (result === 'lose') G.respawnAtHeal();
          PKM.UI.afterBattle(this.lastResult);
        }
      }, 420);
      G.autoSave();
    }
  };

  PKM.BATTLE = B;
})();
