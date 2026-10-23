/**
 * soft-keyboard.js —— 软键盘主组件（8 模式 / 32.8 万词分片 / 上下文重排 / 本地持久化）
 * ------------------------------------------------------------------
 * 把「键盘渲染 / 拼音解析 / 本地词库 / 候选渲染 / 手写」五个模块组装起来，负责：
 *   · 拼音缓冲、全拼/简拼/混拼联想、模糊音纠错、上屏后连续联想
 *   · 英文字母直输 + 常用英文单词补全（内置词表）
 *   · 表情 / 短语 / 剪贴板 / 光标移动 / 自造词 / 设置 / 输入统计
 *   · 手写候选的「上文语境重排」（写完一个字后优先给出能与上文组词的候选）
 *   · 词库扩展分片在空闲时后台并入，首屏只加载核心分片
 *
 * 全程本地运行：不 fetch 任何外部资源，不调用任何网络接口，不上传用户输入。
 * （扩展词库分片通过 <script> 标签从本地目录加载，同样不产生网络请求。）
 *
 * 挂载到 window.SK.SoftKeyboard。
 */
(function (global) {
  'use strict';

  var DictStore = global.SK.DictStore;
  var Parser = global.SK.PinyinParser;
  var KeyboardRender = global.SK.KeyboardRender;
  var Candidates = global.SK.Candidates;
  var Handwriting = global.SK.Handwriting;

  var SHIFT_LOCK_INTERVAL = 350;
  var SETTINGS_KEY = 'soft-keyboard-settings-v1';
  var PHRASE_KEY = 'soft-keyboard-phrases-v1';

  /** 英文补全词表（高频词，纯本地） */
  var EN_WORDS = ('the be to of and a in that have i it for not on with he as you do at this but his by from '
    + 'they we say her she or an will my one all would there their what so up out if about who get which go me '
    + 'when make can like time no just him know take people into year your good some could them see other than '
    + 'then now look only come its over think also back after use two how our work first well way even new want '
    + 'because any these give day most us is are was were been being has had did does doing done am please thanks '
    + 'thank sorry hello hi bye yes ok okay great nice sure right wrong here there where why how what when who '
    + 'today tomorrow yesterday morning afternoon evening night week month year hour minute second '
    + 'name email phone address message question answer problem solution meeting project report team company '
    + 'office home school work job money price order product service support update version feature test '
    + 'need needs help support check confirm cancel delete save send receive open close start stop run '
    + 'big small long short high low fast slow easy hard important different same possible ready busy free '
    + 'happy sad angry tired hungry busy fine cool awesome perfect terrible better best worse worst '
    + 'computer keyboard mouse screen file folder document image video music phone call text mail '
    + 'please thanks regards sincerely best wish hope love like want need try keep let put set get')
    .split(' ');

  function defaultContainer() {
    return document.body;
  }

  function loadJSON(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try { global.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 忽略 */ }
  }

  function create(options) {
    var opts = options || {};

    if (!DictStore.ready) DictStore.init(global.SK_DICT_DATA);

    var settings = Object.assign({
      abbrev: true,
      fuzzy: true,
      smartAssoc: true,
      handAuto: true,
      dark: false,
      pageSize: opts.pageSize || 6,
      shards: opts.shards !== false,
    }, loadJSON(SETTINGS_KEY, {}));

    var phrases = loadJSON(PHRASE_KEY, null);
    if (!Array.isArray(phrases) || !phrases.length) {
      phrases = (KeyboardRender.DEFAULT_PHRASES || []).slice();
    }

    var state = {
      target: null,
      buffer: '',
      candidates: [],
      isFollowUp: false,
      isHandCands: false,
      lastWord: '',
      visible: false,
      lastShiftTime: 0,
      lang: 'zh',
      enPrefix: '',
      committed: 0,
      lastHandCost: 0,
      shardCursor: 0,
    };

    /* ---------------- 1. 键盘面板 ---------------- */
    var hand = null;
    var keyboard = KeyboardRender.create({
      pageSize: settings.pageSize,
      onKey: handleKey,
      onModeChange: function (mode) {
        if (!keyboard) return;
        state.lang = mode === 'en' ? 'en' : 'zh';
        if (mode === 'hand') {
          state.buffer = '';
          state.enPrefix = '';
          if (cands) cands.setExpanded(false);
          if (hand) hand.activate();
        } else if (mode === 'emoji' || mode === 'phrase' || mode === 'tools') {
          state.buffer = '';
          if (cands) cands.clear();
        }
        if (mode === 'tools') updateStats();
        if (mode === 'phrase') keyboard.setPhrases(phrases);
        renderBuffer();
        if (state.visible && opts.reserveSpace !== false) reserveBottomSpace(true);
      },
    });
    var root = keyboard.root;
    root.classList.add('sk-theme-light');
    root.classList.toggle('sk-theme-dark', !!settings.dark);
    var container = opts.container || defaultContainer();
    container.appendChild(root);

    /* ---------------- 2. 候选词 ---------------- */
    var cands = Candidates.create(keyboard.candidateHost, {
      pageSize: settings.pageSize,
      drawerHost: keyboard.body,
      emptyTip: '候选词区域 · 全拼 / 简拼 / 手写候选 · 点右侧「更多 ▾」一屏看多字',
      onSelect: function (item) {
        if (state.isHandCands && hand) hand.clear();
        commitCandidate(item);
      },
      onBackspace: function () { handleKey('backspace'); },
      onClearInput: function () { clearTargetInput(); },
    });

    /* ---------------- 3. 手写面板 ---------------- */
    var maxHandChars = Math.max(opts.handMaxChars || 0, 6500);
    hand = Handwriting.create(keyboard.handHost, {
      charList: DictStore.getCommonChars(maxHandChars).map(function (e) { return e.w; }),
      maxChars: maxHandChars,
      autoRecognize: settings.handAuto,
      onSelect: function (ch) {
        insertText(ch);
        state.committed++;
        if (settings.smartAssoc) showFollowUpAssociations(ch);
      },
      onRecognize: function (handResults, cost) {
        state.lastHandCost = cost || 0;
        if (!handResults || !handResults.length) {
          if (state.isHandCands) {
            state.isHandCands = false;
            state.candidates = [];
            keyboard.bufferHint.textContent = '';
            cands.clear();
            renderBuffer();
          }
          return;
        }
        var ranked = rerankByContext(handResults);
        state.isHandCands = true;
        state.isFollowUp = false;
        state.candidates = ranked.map(function (r) {
          var py = DictStore.getCharPinyin ? DictStore.getCharPinyin(r.char) : '';
          return {
            word: r.char,
            pinyin: py,
            key: py || r.char,
            flag: 'hand',
            score: r.score,
          };
        });
        keyboard.bufferHint.textContent = '手写 ' + ranked.length + ' 字 · ' + (cost || 0) + 'ms';
        renderBuffer();
        cands.update(state.candidates, true);
      },
      onClearInput: function () { clearTargetInput(); },
      onOpenMore: function () {
        if (state.candidates.length) cands.setExpanded(true);
      },
    });

    /**
     * 手写候选「上文语境重排」：优先给出能与上一个字组词的候选，
     * 例如上文是「重」时，「庆」会被提前到「要」前面。
     */
    function rerankByContext(results) {
      var el = state.target;
      var prev = '';
      if (el) {
        var pos = typeof el.selectionStart === 'number' ? el.selectionStart : 0;
        var text = typeof el.value === 'string' ? el.value : (el.textContent || '');
        prev = text.slice(Math.max(0, pos - 1), pos);
      }
      if (!prev || !/[\u4e00-\u9fff]/.test(prev)) return results;
      var top = results.slice(0, 48);
      var rest = results.slice(48);
      var scored = top.map(function (r) {
        var boost = DictStore.hasWord(prev + r.char) ? 4.6 : 0;
        return { r: r, s: r.score - boost, boost: boost };
      });
      scored.sort(function (a, b) { return a.s - b.s; });
      return scored.map(function (x) { return x.r; }).concat(rest);
    }

    /* ---------------- 4. 输入框绑定 ---------------- */
    var boundTargets = [];
    var docHandler = null;

    function resolveTargets(targets) {
      if (!targets) return [];
      if (typeof targets === 'string') {
        return Array.prototype.slice.call(document.querySelectorAll(targets));
      }
      if (targets.nodeType === 1) return [targets];
      return Array.prototype.slice.call(targets);
    }

    function bindTarget(el) {
      if (!el || boundTargets.indexOf(el) >= 0) return;
      boundTargets.push(el);
      el.addEventListener('focus', onTargetFocus);
      el.addEventListener('pointerdown', onTargetFocus);
    }

    function unbindAll() {
      boundTargets.forEach(function (el) {
        el.removeEventListener('focus', onTargetFocus);
        el.removeEventListener('pointerdown', onTargetFocus);
      });
      boundTargets = [];
    }

    function onTargetFocus(ev) {
      state.target = ev.currentTarget || ev.target;
      show();
    }

    function setTargets(targets) {
      unbindAll();
      resolveTargets(targets).forEach(bindTarget);
    }

    setTargets(opts.targets);
    cands.clear();
    renderBuffer();

    docHandler = function (ev) {
      var t = ev.target;
      if (root.contains(t)) return;
      var hit = boundTargets.find(function (el) { return el === t || el.contains(t); });
      if (hit) { state.target = hit; show(); return; }
      hide();
    };
    document.addEventListener('pointerdown', docHandler);
    root.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });

    /* ---------------- 5. 显示 / 隐藏 ---------------- */

    function show() {
      if (!state.target && boundTargets.length) state.target = boundTargets[0];
      if (state.visible) return;
      state.visible = true;
      root.classList.add('is-open');
      keyboard.setCollapsed(false);
      if (opts.reserveSpace !== false) reserveBottomSpace(true);
      if (typeof opts.onShow === 'function') opts.onShow();
    }

    function hide() {
      if (!state.visible) return;
      state.visible = false;
      root.classList.remove('is-open');
      if (opts.reserveSpace !== false) reserveBottomSpace(false);
      state.buffer = '';
      state.enPrefix = '';
      state.isFollowUp = false;
      state.isHandCands = false;
      state.lastWord = '';
      cands.clear();
      renderBuffer();
      if (typeof opts.onHide === 'function') opts.onHide();
    }

    function reserveBottomSpace(on) {
      var h = on ? root.getBoundingClientRect().height : 0;
      document.body.style.paddingBottom = h ? h + 'px' : '';
    }

    /* ---------------- 6. 缓冲与候选刷新 ---------------- */

    function renderBuffer() {
      if (!keyboard || !keyboard.bufferText) return;
      var box = keyboard.bufferText;
      var clearBtn = keyboard.bufferClearBtn;
      box.textContent = '';

      var mode = keyboard.getMode();
      if (mode === 'emoji') {
        box.textContent = '表情面板 · 点任意表情直接上屏';
        box.classList.add('is-placeholder');
        if (clearBtn) clearBtn.style.display = 'none';
        return;
      }
      if (mode === 'phrase') {
        box.textContent = '常用语 · 点击即上屏，「＋ 添加短语」可自建';
        box.classList.add('is-placeholder');
        if (clearBtn) clearBtn.style.display = 'none';
        return;
      }
      if (mode === 'tools') {
        box.textContent = '工具 · 剪贴板 / 光标 / 自造词 / 设置 / 统计';
        box.classList.add('is-placeholder');
        if (clearBtn) clearBtn.style.display = 'none';
        return;
      }

      if (!state.buffer) {
        if (clearBtn) clearBtn.style.display = 'none';
        if (state.isHandCands && state.candidates.length) {
          box.textContent = '手写识别已完成 · 可在下方或点「更多 ▾」翻页选字';
        } else if (state.isFollowUp && state.lastWord) {
          box.textContent = '已输入「' + state.lastWord + '」· 可继续点选联想词或点「更多 ▾」';
        } else if (mode === 'hand') {
          box.textContent = '手写模式 · 左侧写字自动识别，支持翻页与「更多 ▾」多字面板';
        } else if (mode === 'en') {
          box.textContent = '英文直输 · 首字母大写用 ⇧ · 输入中会给英文词补全';
        } else {
          box.textContent = '输入拼音（支持全拼/简拼如 wmd→我们的），点「更多 ▾」可一页看多词';
        }
        box.classList.add('is-placeholder');
        return;
      }
      box.classList.remove('is-placeholder');
      if (clearBtn) clearBtn.style.display = '';

      if (mode === 'en') {
        box.textContent = '英文中：' + state.buffer + '…';
        return;
      }

      var seg = Parser.segment(state.buffer);
      if (!seg.ok) {
        box.textContent = state.buffer;
        return;
      }
      seg.syllables.forEach(function (s, i) {
        if (i) box.appendChild(document.createTextNode(' '));
        box.appendChild(document.createTextNode(s));
      });
      if (seg.incomplete) {
        if (seg.syllables.length) box.appendChild(document.createTextNode(' '));
        var tail = document.createElement('span');
        tail.className = 'sk-buffer-tail';
        tail.textContent = seg.incomplete;
        box.appendChild(tail);
      }
    }

    function refreshCandidates() {
      var hint = keyboard.bufferHint;
      if (!state.buffer) {
        state.candidates = [];
        state.isFollowUp = false;
        state.isHandCands = false;
        hint.textContent = '';
        cands.clear();
        return;
      }
      if (keyboard.getMode() === 'en') {
        refreshEnglish();
        return;
      }
      state.isFollowUp = false;
      state.isHandCands = false;
      var res = DictStore.query(state.buffer, {
        abbrev: settings.abbrev,
        fuzzy: settings.fuzzy,
        limit: 240,
      });
      state.candidates = res.candidates;
      cands.update(res.candidates, true);
      if (res.abbrevUsed) hint.textContent = '简拼 · 共 ' + res.candidates.length + ' 项';
      else if (!res.segments || !res.segments.ok) hint.textContent = '智能匹配';
      else if (res.fuzzyUsed) hint.textContent = '已自动纠错';
      else hint.textContent = '共 ' + res.candidates.length + ' 项';
    }

    /** 英文补全：按前缀从内置词表里挑最多 6 个 */
    function refreshEnglish() {
      var prefix = state.enPrefix.toLowerCase();
      var out = [];
      if (prefix) {
        var seen = Object.create(null);
        for (var i = 0; i < EN_WORDS.length && out.length < 12; i++) {
          var w = EN_WORDS[i];
          if (w === prefix || seen[w]) continue;
          if (w.indexOf(prefix) === 0) {
            seen[w] = 1;
            out.push({ word: w, pinyin: '', key: 'en:' + w, flag: 'abbrev', score: 9000 - i, en: true });
          }
        }
      }
      state.candidates = out;
      cands.update(out, true);
      keyboard.bufferHint.textContent = out.length ? '英文补全 ' + out.length + ' 项' : '英文输入';
    }

    function showFollowUpAssociations(committedText) {
      if (!DictStore.associateAfter) return;
      var assoc = DictStore.associateAfter(committedText, 96);
      if (!assoc || !assoc.length) return;
      state.isFollowUp = true;
      state.isHandCands = false;
      state.lastWord = committedText;
      state.candidates = assoc;
      keyboard.bufferHint.textContent = '连续联想 ' + assoc.length + ' 项';
      renderBuffer();
      cands.update(assoc, true);
    }

    function pushLetter(ch) {
      state.isFollowUp = false;
      state.isHandCands = false;
      state.buffer += ch;
      if (keyboard.getMode() === 'en') state.enPrefix = state.enPrefix + ch;
      renderBuffer();
      refreshCandidates();
    }

    function popLetter() {
      if (!state.buffer) {
        if (state.isFollowUp || state.isHandCands) {
          state.isFollowUp = false;
          state.isHandCands = false;
          state.lastWord = '';
          renderBuffer();
          refreshCandidates();
        }
        return false;
      }
      state.buffer = state.buffer.replace(/ ?[a-zA-Z]$/, '');
      state.enPrefix = state.enPrefix.replace(/[a-zA-Z]$/, '');
      renderBuffer();
      refreshCandidates();
      return true;
    }

    function clearBufferOnly() {
      if (!state.buffer && !state.isFollowUp && !state.isHandCands) return;
      state.buffer = '';
      state.enPrefix = '';
      state.isFollowUp = false;
      state.isHandCands = false;
      state.lastWord = '';
      renderBuffer();
      refreshCandidates();
    }

    function clearTargetInput() {
      state.buffer = '';
      state.enPrefix = '';
      state.isFollowUp = false;
      state.isHandCands = false;
      state.lastWord = '';
      if (hand) hand.clear();
      cands.clear();
      renderBuffer();

      var el = state.target;
      if (!el && boundTargets.length) el = boundTargets[0];
      if (!el) return;
      if (typeof el.value === 'string') {
        el.value = '';
        if (typeof el.selectionStart === 'number') el.selectionStart = el.selectionEnd = 0;
      } else if (el.isContentEditable) {
        el.textContent = '';
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /* ---------------- 7. 上屏与光标 ---------------- */

    function getTarget() {
      var el = state.target;
      if (!el && boundTargets.length) el = boundTargets[0];
      return el;
    }

    function insertText(text) {
      var el = getTarget();
      if (!el) {
        try {
          var p = global.navigator.clipboard && global.navigator.clipboard.writeText(text);
          if (p && p.catch) p.catch(function () {});
        } catch (e) { /* 忽略 */ }
        return;
      }
      if (typeof el.selectionStart === 'number') {
        var start = el.selectionStart;
        var end = el.selectionEnd;
        var value = el.value;
        el.value = value.slice(0, start) + text + value.slice(end);
        var pos = start + text.length;
        el.selectionStart = el.selectionEnd = pos;
      } else if (el.isContentEditable) {
        document.execCommand('insertText', false, text);
      }
      state.committed += text.length;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      if (typeof opts.onCommit === 'function') opts.onCommit(text, null);
    }

    function moveCaret(delta) {
      var el = getTarget();
      if (!el || typeof el.selectionStart !== 'number') return;
      var pos = el.selectionStart + delta;
      pos = Math.max(0, Math.min(el.value.length, pos));
      el.selectionStart = el.selectionEnd = pos;
      el.focus();
    }

    function moveCaretTo(where) {
      var el = getTarget();
      if (!el || typeof el.selectionStart !== 'number') return;
      var pos = where === 'home' ? 0 : el.value.length;
      el.selectionStart = el.selectionEnd = pos;
      el.focus();
    }

    function selectAllText() {
      var el = getTarget();
      if (!el) return;
      if (typeof el.select === 'function') {
        el.select();
        try { el.setSelectionRange(0, el.value.length); } catch (e) { /* 忽略 */ }
      } else if (el.isContentEditable) {
        var range = document.createRange();
        range.selectNodeContents(el);
        var sel = global.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    function copySelection(cut) {
      var el = getTarget();
      if (!el) return;
      var text = '';
      if (typeof el.value === 'string') {
        text = el.value.slice(el.selectionStart, el.selectionEnd);
      } else {
        text = String(global.getSelection ? global.getSelection() : '');
      }
      if (!text) { toast('请先选中要' + (cut ? '剪切' : '复制') + '的文字'); return; }
      var done = function () {
        if (cut) {
          if (typeof el.value === 'string') {
            el.value = el.value.slice(0, el.selectionStart) + el.value.slice(el.selectionEnd);
            el.selectionStart = el.selectionEnd = el.selectionStart;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            document.execCommand('delete');
          }
        }
        toast((cut ? '已剪切 ' : '已复制 ') + text.length + ' 个字符');
      };
      try {
        if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
          global.navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(el, text, done); });
          return;
        }
      } catch (e) { /* 降级 */ }
      fallbackCopy(el, text, done);
    }

    function fallbackCopy(el, text, done) {
      try {
        var ok = document.execCommand('copy');
        if (ok) { done(); return; }
      } catch (e) { /* 忽略 */ }
      toast('浏览器不允许写入剪贴板，请用 Ctrl+C');
    }

    function pasteText() {
      var insert = function (text) {
        if (!text) return;
        insertText(text);
        toast('已粘贴 ' + text.length + ' 个字符');
      };
      try {
        if (global.navigator.clipboard && global.navigator.clipboard.readText) {
          global.navigator.clipboard.readText().then(insert, function () {
            toast('浏览器拒绝读取剪贴板，请用 Ctrl+V');
          });
          return;
        }
      } catch (e) { /* 降级 */ }
      toast('当前浏览器不支持读取剪贴板，请用 Ctrl+V');
    }

    function undoText() {
      var el = getTarget();
      if (!el) return;
      el.focus();
      try {
        var ok = document.execCommand('undo');
        if (!ok) toast('当前输入框不支持撤销');
      } catch (e) {
        toast('当前输入框不支持撤销');
      }
    }

    function commitCandidate(item) {
      if (!item) return;
      if (item.en) {
        // 英文补全：替换掉已输入的字母前缀
        var el = getTarget();
        if (el && typeof el.selectionStart === 'number') {
          var n = state.enPrefix.length;
          var start = Math.max(0, el.selectionStart - n);
          el.selectionStart = start;
          el.selectionEnd = el.selectionStart + n;
          insertText(item.word + ' ');
        } else {
          insertText(item.word + ' ');
        }
        state.buffer = '';
        state.enPrefix = '';
        renderBuffer();
        cands.clear();
        return;
      }
      DictStore.remember(item.key, item.word);
      insertText(item.word);
      state.buffer = '';
      state.enPrefix = '';
      state.isHandCands = false;
      renderBuffer();
      refreshCandidates();
      if (settings.smartAssoc) showFollowUpAssociations(item.word);
      if (typeof opts.onCommit === 'function') opts.onCommit(item.word, item);
    }

    /* ---------------- 8. 按键分发 ---------------- */

    function handleKey(action, value) {
      var mode = keyboard.getMode();

      switch (action) {
        case 'char':
          if (mode === 'en') {
            // 英文模式：字母立刻上屏，同时用前缀给出英文单词补全
            var upper = keyboard.isCaps();
            insertText(upper ? value.toUpperCase() : value);
            unlockCapsIfSingleUse();
            state.enPrefix = upper ? '' : (state.enPrefix + value);
            state.buffer = state.enPrefix;
            renderBuffer();
            refreshCandidates();
            return;
          }
          if (mode === 'zh' || mode === 'letter') {
            // 只有字母才进拼音缓冲；数字/符号（含长按扩展键）直接上屏
            var isLetter = /^[a-zA-Z]$/.test(value);
            if (keyboard.isCaps() || !isLetter) {
              state.isFollowUp = false;
              state.isHandCands = false;
              cands.clear();
              renderBuffer();
              insertText(keyboard.isCaps() ? value.toUpperCase() : value);
              unlockCapsIfSingleUse();
            } else {
              pushLetter(value);
            }
          } else {
            state.isFollowUp = false;
            state.isHandCands = false;
            cands.clear();
            renderBuffer();
            insertText(value);
          }
          return;

        case 'emoji':
          insertText(value);
          return;

        case 'phrase':
          insertText(value);
          toast('已输入短语');
          return;

        case 'addPhrase': {
          var text = global.prompt('新增常用语（点击即可上屏）：', '');
          if (text && text.trim()) {
            phrases.unshift(text.trim());
            if (phrases.length > 60) phrases.length = 60;
            saveJSON(PHRASE_KEY, phrases);
            keyboard.setPhrases(phrases);
            toast('已添加短语');
          }
          return;
        }

        case 'removePhrase': {
          var idx = Number(value);
          if (phrases[idx] != null) {
            phrases.splice(idx, 1);
            saveJSON(PHRASE_KEY, phrases);
            keyboard.setPhrases(phrases);
          }
          return;
        }

        case 'addWord': {
          var word = global.prompt('自造词（会立刻进入候选，支持 2~24 个汉字）：', '');
          if (!word || !word.trim()) return;
          var py = global.prompt('拼音（可留空，自动按单字读音拼合。多音字建议手填，用空格分隔）：', '');
          var entry = DictStore.addUserWord(word.trim(), py || '');
          if (entry) {
            toast('已加入用户词库：' + entry.w + ' (' + entry.p + ')');
            clearBufferOnly();
            refreshCandidates();
          } else {
            toast('添加失败：请检查拼音是否为合法音节');
          }
          return;
        }

        case 'clearPref':
          DictStore.clearPreference();
          toast('选词记忆已清空');
          updateStats();
          return;

        case 'clearLearn':
          Handwriting.clearLearn();
          toast('手写学习记录已清空');
          return;

        case 'copy': copySelection(false); return;
        case 'cut': copySelection(true); return;
        case 'paste': pasteText(); return;
        case 'selectAll': selectAllText(); return;
        case 'undo': undoText(); return;
        case 'cursorLeft': moveCaret(-1); return;
        case 'cursorRight': moveCaret(1); return;
        case 'cursorHome': moveCaretTo('home'); return;
        case 'cursorEnd': moveCaretTo('end'); return;

        case 'toggleSetting': {
          var parts = String(value).split(':');
          var key = parts[0];
          var on = parts[1] === '1';
          settings[key] = on;
          saveJSON(SETTINGS_KEY, settings);
          if (key === 'dark') root.classList.toggle('sk-theme-dark', on);
          if (key === 'handAuto' && hand && hand.setAutoRecognize) hand.setAutoRecognize(on);
          if (key === 'abbrev' || key === 'fuzzy') refreshCandidates();
          return;
        }

        case 'setPageSize': {
          var n = Number(value) || 6;
          settings.pageSize = n;
          saveJSON(SETTINGS_KEY, settings);
          cands.setPageSize(n);
          refreshCandidates();
          return;
        }

        case 'shift': {
          var now = Date.now();
          var locked = now - state.lastShiftTime < SHIFT_LOCK_INTERVAL && keyboard.isCaps();
          state.lastShiftTime = now;
          keyboard.setCaps(locked ? true : !keyboard.isCaps());
          root.dataset.capsLock = keyboard.isCaps() ? (locked ? 'lock' : 'once') : '';
          return;
        }

        case 'backspace':
          if (!popLetter()) {
            var el2 = getTarget();
            if (el2 && typeof el2.selectionStart === 'number') {
              var start = el2.selectionStart;
              var end = el2.selectionEnd;
              if (start === end && start > 0) {
                el2.value = el2.value.slice(0, start - 1) + el2.value.slice(end);
                el2.selectionStart = el2.selectionEnd = start - 1;
                el2.dispatchEvent(new Event('input', { bubbles: true }));
              } else if (start !== end) {
                el2.value = el2.value.slice(0, start) + el2.value.slice(end);
                el2.selectionStart = el2.selectionEnd = start;
                el2.dispatchEvent(new Event('input', { bubbles: true }));
              }
            } else if (el2 && el2.isContentEditable) {
              document.execCommand('delete');
            }
          }
          return;

        case 'clearBuffer':
          clearBufferOnly();
          return;

        case 'clearInput':
          clearTargetInput();
          return;

        case 'space':
          if (keyboard.getMode() === 'en') {
            state.buffer = '';
            state.enPrefix = '';
            cands.clear();
            renderBuffer();
            insertText(' ');
            return;
          }
          if (state.buffer) {
            var first = cands.firstItem();
            if (first) { commitCandidate(first); return; }
            pushLetter(' ');
          } else {
            state.isFollowUp = false;
            state.isHandCands = false;
            cands.clear();
            renderBuffer();
            insertText(' ');
            state.enPrefix = '';
          }
          return;

        case 'enter': {
          var firstItem = cands.firstItem();
          if (state.buffer && firstItem) { commitCandidate(firstItem); return; }
          if (state.buffer && keyboard.getMode() !== 'en') { commitRaw(); return; }
          state.isFollowUp = false;
          state.isHandCands = false;
          cands.clear();
          renderBuffer();
          var el3 = getTarget();
          if (el3 && el3.tagName === 'TEXTAREA') insertText('\n');
          else if (el3) el3.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }

        case 'mode':
          keyboard.setMode(value);
          return;

        case 'hide':
          hide();
          return;

        case 'clear':
          if (hand) hand.clear();
          return;

        case 'recognize':
          if (hand) hand.recognize();
          return;
      }
    }

    function commitRaw() {
      var raw = state.buffer.replace(/\s+/g, '');
      insertText(raw);
      state.buffer = '';
      renderBuffer();
      refreshCandidates();
    }

    function unlockCapsIfSingleUse() {
      if (root.dataset.capsLock === 'once') {
        keyboard.setCaps(false);
        root.dataset.capsLock = '';
      }
    }

    /* ---------------- 9. 轻提示 ---------------- */

    var toastNode = null;
    var toastTimer = null;
    function toast(message) {
      if (!toastNode) {
        toastNode = document.createElement('div');
        toastNode.className = 'sk-toast';
        root.appendChild(toastNode);
      }
      toastNode.textContent = message;
      toastNode.classList.add('is-show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toastNode.classList.remove('is-show');
      }, 1800);
    }

    /* ---------------- 10. 统计 ---------------- */

    function updateStats() {
      var st = DictStore.stats ? DictStore.stats() : {};
      var text = '词库 ' + (st.wordCount || 0).toLocaleString() + ' 词 · 单字 ' +
        (st.charCount || 0) + ' 个 · 自造词 ' + (st.userWords || 0) + ' 条\n' +
        '本次已上屏 ' + state.committed + ' 个字符 · 手写识别 ' +
        (state.lastHandCost ? state.lastHandCost + 'ms' : '—') +
        ' · 扩展分片已并入 ' + (DictStore.shardLoaded || 0) + ' 个';
      if (typeof keyboard.setStats === 'function') keyboard.setStats(text);
    }

    /* ---------------- 11. 词库扩展分片后台加载 ---------------- */

    var shardFiles = opts.shardFiles || global.SK_DICT_SHARD_FILES || [
      'dict-ext-1.js', 'dict-ext-2.js', 'dict-ext-3.js', 'dict-ext-4.js', 'dict-ext-5.js',
    ];
    var shardBase = opts.shardBase || global.SK_DICT_SHARD_BASE || 'soft-keyboard/data/';

    function ingestAvailable() {
      var pool = global.SK_DICT_SHARDS;
      if (!pool) return 0;
      var added = 0;
      Object.keys(pool).forEach(function (id) {
        if (pool[id] && !pool[id].__loaded) {
          added += DictStore.ingest(pool[id]);
          pool[id].__loaded = true;
          DictStore.shardLoaded = (DictStore.shardLoaded || 0) + 1;
        }
      });
      return added;
    }

    function loadNextShard() {
      if (!settings.shards) return;
      if (state.shardCursor >= shardFiles.length) {
        if (state.buffer) refreshCandidates();
        updateStats();
        return;
      }
      var file = shardFiles[state.shardCursor++];
      var script = document.createElement('script');
      script.src = shardBase + file;
      script.async = true;
      script.onload = function () {
        var added = ingestAvailable();
        if (state.buffer && added) refreshCandidates();
        updateStats();
        scheduleShard();
      };
      script.onerror = function () {
        // 分片缺失时静默跳过，保持核心词库可用
        scheduleShard();
      };
      document.head.appendChild(script);
    }

    function scheduleShard() {
      if (global.requestIdleCallback) {
        global.requestIdleCallback(function () { loadNextShard(); }, { timeout: 1500 });
      } else {
        setTimeout(loadNextShard, 800);
      }
    }

    /* ---------------- 12. 物理键盘快捷交互 ---------------- */

    function onDocKeyDown(ev) {
      if (!state.visible) return;
      var t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        // 用户直接在输入框打字时，让浏览器原生行为生效，只同步状态
        if (ev.key === 'Escape') hide();
        return;
      }
      if (ev.key === 'Escape') {
        if (cands.isExpanded()) { cands.setExpanded(false); return; }
        hide();
        return;
      }
      if (ev.key === 'Backspace' && state.buffer) {
        state.buffer = state.buffer.replace(/ ?[a-zA-Z]$/, '');
        state.enPrefix = state.enPrefix.replace(/[a-zA-Z]$/, '');
        renderBuffer();
        refreshCandidates();
        ev.preventDefault();
        return;
      }
      if (/^[a-zA-Z]$/.test(ev.key) && !ev.ctrlKey && !ev.metaKey) {
        pushLetter(ev.key.toLowerCase());
        ev.preventDefault();
        return;
      }
      if (/^[1-9]$/.test(ev.key) && state.candidates.length) {
        var idx = Number(ev.key) - 1;
        var page = cands.currentPageItems();
        if (page[idx]) commitCandidate(page[idx]);
        ev.preventDefault();
        return;
      }
      if (ev.key === ' ') {
        var first = cands.firstItem();
        if (state.buffer && first) { commitCandidate(first); ev.preventDefault(); }
      }
    }
    document.addEventListener('keydown', onDocKeyDown);

    /* ---------------- 13. 对外接口 ---------------- */
    setTimeout(function () {
      var added = ingestAvailable();
      if (added) updateStats();
      scheduleShard();
      updateStats();
    }, 120);

    return {
      root: root,
      show: show,
      hide: hide,
      isVisible: function () { return state.visible; },
      setTargets: setTargets,
      setMode: function (mode) { keyboard.setMode(mode); },
      setTheme: function (dark) {
        settings.dark = !!dark;
        saveJSON(SETTINGS_KEY, settings);
        keyboard.setTheme(settings.dark);
      },
      insertText: insertText,
      commit: insertText,
      clearInput: clearTargetInput,
      clearBuffer: clearBufferOnly,
      expandCandidates: function (open) { cands.setExpanded(open !== false); },
      getBuffer: function () { return state.buffer; },
      getSettings: function () { return Object.assign({}, settings); },
      setSetting: function (key, on) {
        handleKey('toggleSetting', key + ':' + (on ? '1' : '0'));
        keyboard.setSetting(key, on);
      },
      setPhrases: function (list) {
        phrases = (list || []).slice();
        saveJSON(PHRASE_KEY, phrases);
        keyboard.setPhrases(phrases);
      },
      getPhrases: function () { return phrases.slice(); },
      addWord: function (w, p) { return DictStore.addUserWord(w, p); },
      loadShards: function () { scheduleShard(); },
      stats: function () {
        var s = DictStore.stats ? DictStore.stats() : {};
        s.committed = state.committed;
        s.handCost = state.lastHandCost;
        return s;
      },
      toast: toast,
      dict: DictStore,
      destroy: function () {
        hide();
        document.removeEventListener('pointerdown', docHandler);
        document.removeEventListener('keydown', onDocKeyDown);
        unbindAll();
        hand.destroy();
        cands.destroy();
        root.remove();
      },
    };
  }

  global.SK = global.SK || {};
  global.SK.SoftKeyboard = {
    create: create,
    version: '3.0.0',
    DictStore: DictStore,
    PinyinParser: Parser,
    Candidates: Candidates,
    Handwriting: Handwriting,
    KeyboardRender: KeyboardRender,
  };
  global.SoftKeyboard = global.SK.SoftKeyboard;
})(window);
