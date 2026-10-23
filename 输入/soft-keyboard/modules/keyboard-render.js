/**
 * modules/keyboard-render.js —— 键盘渲染模块（8 模式 · 长按扩展 · 表情/短语/工具面板）
 * ------------------------------------------------------------------
 * 只负责「把键盘画出来」以及把按键动作抛给主组件（onKey / onModeChange）。
 * 模式：拼音(zh) 英文(en) 数字(number) 符号(symbol) 表情(emoji) 手写(hand) 短语(phrase) 工具(tools)
 *
 * 特色：
 *   - 字母键长按弹出「数字 + 常用符号」候选，一次少切一次键盘
 *   - 表情面板按分类浏览，短语面板支持增删（持久化在主组件）
 *   - 工具面板内置剪贴板（复制/剪切/粘贴/全选）、光标移动、设置开关与输入统计
 *   - 所有面板共用固定高度容器，切换零跳动
 *
 * 挂载到 window.SK.KeyboardRender。
 */
(function (global) {
  'use strict';

  /* ---------------- 面板布局数据 ---------------- */

  var LAYOUTS = {
    letter: [
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
      ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace'],
      ['mode:number', 'mode:symbol', 'cursorLeft', 'cursorRight', 'space', 'clearInput', 'enter'],
    ],
    number: [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['-', '/', ':', ';', '(', ')', '￥', '&', '@', '"'],
      ['+', '*', '=', '%', '$', '#', '_', '~', '<', '>'],
      ['mode:zh', 'mode:symbol', '.', 'cursorLeft', 'cursorRight', 'space', 'backspace', 'enter'],
    ],
    symbol: [
      ['，', '。', '？', '！', '、', '；', '：', '“', '”', '‘', '’'],
      ['（', '）', '《', '》', '【', '】', '…', '—', '～', '·', '￥'],
      ['$', '%', '#', '&', '*', '+', '-', '=', '/', '\\', '|'],
      ['<', '>', '_', '^', '{', '}', '[', ']', '@', '~', '`'],
      ['mode:zh', 'mode:number', 'space', 'backspace', 'enter'],
    ],
  };

  /** 长按字母弹出的扩展键（数字 + 常用符号） */
  var LONG_PRESS = {
    q: ['1', '!', '？'], w: ['2', '@', '、'], e: ['3', '#', '…'], r: ['4', '$', '：'],
    t: ['5', '%', '；'], y: ['6', '^', '“'], u: ['7', '&', '”'], i: ['8', '*', '（'],
    o: ['9', '(', '）'], p: ['0', ')', '—'],
    a: ['1', '-', '·'], s: ['2', '+', '／'], d: ['3', '=', '＼'], f: ['4', '/', '【'],
    g: ['5', '\\', '】'], h: ['6', '<', '《'], j: ['7', '>', '》'], k: ['8', '[', '～'],
    l: ['9', ']', '｜'],
    z: ['1', '{', '《'], x: ['2', '}', '》'], c: ['3', '~', '「'], v: ['4', '`', '」'],
    b: ['5', '€', '·'], n: ['6', '¥', '※'], m: ['7', '£', '§'],
  };

  var LABELS = {
    shift: '⇧',
    backspace: '⌫',
    space: '空格',
    enter: '确认',
    hide: '收起',
    clearInput: '清空',
    cursorLeft: '←',
    cursorRight: '→',
    clearBuffer: '清拼音',
  };

  var KEY_CLASS = {
    shift: 'sk-key-wide sk-key-fn',
    backspace: 'sk-key-fn',
    space: 'sk-key-space',
    enter: 'sk-key-enter',
    hide: 'sk-key-fn',
    clearInput: 'sk-key-fn sk-key-danger',
    cursorLeft: 'sk-key-narrow sk-key-fn',
    cursorRight: 'sk-key-narrow sk-key-fn',
  };

  var MODE_NAMES = [
    { mode: 'zh', label: '拼音', title: '中文拼音输入' },
    { mode: 'en', label: '英文', title: '英文直输（带单词候选）' },
    { mode: 'number', label: '数字', title: '数字与常用符号' },
    { mode: 'symbol', label: '符号', title: '全角/半角符号' },
    { mode: 'emoji', label: '表情', title: '表情符号' },
    { mode: 'hand', label: '手写', title: '手写识别' },
    { mode: 'phrase', label: '短语', title: '常用语 / 自定义短语' },
    { mode: 'tools', label: '工具', title: '剪贴板 · 光标 · 设置 · 统计' },
  ];

  /** 表情分类 */
  var EMOJI_GROUPS = [
    {
      name: '常用',
      items: ['😀', '😄', '😁', '😊', '🙂', '😉', '😍', '🥰', '😘', '😜', '🤪', '😎', '🤗', '🤔', '🙄', '😴',
        '😅', '😂', '🤣', '😭', '😢', '😡', '🥺', '😱', '😳', '🤯', '😇', '🤩', '😏', '😬', '🙃', '😌'],
    },
    {
      name: '手势',
      items: ['👍', '👎', '👌', '✌️', '🤝', '🙏', '👏', '🙌', '💪', '👋', '🤙', '👊', '✊', '🫶', '🤞', '☝️',
        '👆', '👇', '👈', '👉', '🖐️', '✋', '🤚', '🫰'],
    },
    {
      name: '爱心',
      items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
        '💘', '💝', '💟', '♥️'],
    },
    {
      name: '动物',
      items: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
        '🐧', '🐦', '🦄', '🐝', '🦋', '🐢', '🐬', '🐳'],
    },
    {
      name: '食物',
      items: ['🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🍑', '🍍', '🥝', '🍅', '🍔', '🍟', '🍕', '🌭', '🍜', '🍚',
        '🍣', '🍤', '🍰', '🍦', '🍩', '☕', '🍵', '🍺'],
    },
    {
      name: '活动',
      items: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎱', '🏓', '🏸', '🥊', '🎯', '🎮', '🎲', '🎸', '🎤', '🎧',
        '🎬', '🎨', '✈️', '🚗', '🚀', '🏠', '🌞', '🌙'],
    },
    {
      name: '符号',
      items: ['✅', '❌', '❗', '❓', '💯', '🔥', '✨', '🎉', '🎁', '⭐', '🌟', '⚡', '💡', '📌', '📎', '🔔',
        '⏰', '💰', '📱', '💻', '📷', '🔒', '🔑', '🚫'],
    },
  ];

  var DEFAULT_PHRASES = [
    '你好', '谢谢', '不客气', '好的', '收到', '稍等', '马上到', '辛苦了',
    '没问题', '麻烦你了', '请稍等一下', '我稍后回复你', '今天有事，改天再约',
    '地址发我一下', '手机号方便留一下吗', '这个方案我同意', '明天上午十点见',
    '邮件已发送，请查收', '好的，我马上处理', '不好意思，刚才没看到',
  ];

  /* ---------------- DOM 构建工具 ---------------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  var ACTION_KEYS = {
    shift: 1, backspace: 1, space: 1, enter: 1, hide: 1, clear: 1, recognize: 1,
    clearInput: 1, clearBuffer: 1, cursorLeft: 1, cursorRight: 1, cursorHome: 1, cursorEnd: 1,
    copy: 1, cut: 1, paste: 1, selectAll: 1, undo: 1, lang: 1, theme: 1, phrase: 1, emoji: 1,
    openPanel: 1, addPhrase: 1, removePhrase: 1, addWord: 1, clearPref: 1, clearLearn: 1,
    toggleSetting: 1, setPageSize: 1,
  };

  function parseKey(def) {
    var idx = def.indexOf(':');
    if (idx > 0) return { action: def.slice(0, idx), value: def.slice(idx + 1) };
    if (ACTION_KEYS[def]) return { action: def, value: def };
    return { action: 'char', value: def };
  }

  function bindPress(node, handler) {
    var handledByPointer = false;
    node.addEventListener('pointerdown', function (ev) {
      if (ev.button && ev.button !== 0) return;
      handledByPointer = true;
      ev.preventDefault();
      ev.stopPropagation();
      handler(ev);
    });
    node.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (handledByPointer) { handledByPointer = false; return; }
      handler(ev);
    });
  }

  /** 长按连续触发（退格、方向键） */
  function bindRepeatPress(node, handler) {
    var delayTimer = null;
    var repeatTimer = null;
    var handledByPointer = false;

    function stopRepeat() {
      if (delayTimer) { clearTimeout(delayTimer); delayTimer = null; }
      if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
    }

    node.addEventListener('pointerdown', function (ev) {
      if (ev.button && ev.button !== 0) return;
      handledByPointer = true;
      ev.preventDefault();
      ev.stopPropagation();
      stopRepeat();
      handler(ev);
      delayTimer = setTimeout(function () {
        repeatTimer = setInterval(function () { handler(ev); }, 65);
      }, 340);
    });
    node.addEventListener('pointerup', stopRepeat);
    node.addEventListener('pointercancel', stopRepeat);
    node.addEventListener('pointerleave', stopRepeat);
    node.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (handledByPointer) { handledByPointer = false; return; }
      handler(ev);
    });
  }

  function create(options) {
    var opts = options || {};
    var onKey = opts.onKey || function () {};

    var root = el('div', 'sk-panel');
    root.setAttribute('role', 'application');
    root.setAttribute('aria-label', '本地软键盘');

    /* ---- 顶部：模式 tabs + 清空输入 + 收起 ---- */
    var header = el('div', 'sk-header');
    var tabs = el('div', 'sk-tabs');
    var tabButtons = {};
    MODE_NAMES.forEach(function (item) {
      var btn = el('button', 'sk-tab', item.label);
      btn.type = 'button';
      btn.title = item.title;
      btn.dataset.mode = item.mode;
      btn.addEventListener('click', function () { api.setMode(item.mode); });
      tabs.appendChild(btn);
      tabButtons[item.mode] = btn;
    });
    header.appendChild(tabs);

    var headerActions = el('div', 'sk-header-actions');
    var clearInputTopBtn = el('button', 'sk-clear-btn', '清空输入');
    clearInputTopBtn.type = 'button';
    clearInputTopBtn.title = '一键清空当前输入框中的全部文字';
    bindPress(clearInputTopBtn, function () { onKey('clearInput', null); });

    var hideBtn = el('button', 'sk-collapse', '收起 ▾');
    hideBtn.type = 'button';
    hideBtn.addEventListener('click', function () { onKey('hide', null); });

    headerActions.appendChild(clearInputTopBtn);
    headerActions.appendChild(hideBtn);
    header.appendChild(headerActions);
    root.appendChild(header);

    /* ---- 中部：拼音缓冲 + 候选词 ---- */
    var preview = el('div', 'sk-preview');
    var bufferBox = el('div', 'sk-buffer');
    var bufferText = el('span', 'sk-buffer-text', '');
    var bufferHint = el('span', 'sk-buffer-hint', '');
    var bufferClearBtn = el('button', 'sk-buffer-clear', '× 清空拼音');
    bufferClearBtn.type = 'button';
    bufferClearBtn.title = '一键清除当前正在输入的拼音串';
    bufferClearBtn.style.display = 'none';
    bindPress(bufferClearBtn, function () { onKey('clearBuffer', null); });

    bufferBox.appendChild(bufferText);
    bufferBox.appendChild(bufferHint);
    bufferBox.appendChild(bufferClearBtn);
    var candHost = el('div', 'sk-candidates');
    preview.appendChild(bufferBox);
    preview.appendChild(candHost);
    root.appendChild(preview);

    /* ---- 下部：各模式面板 ---- */
    var body = el('div', 'sk-body');
    var pages = {};
    var keyElements = { letter: [] };

    ['letter', 'number', 'symbol'].forEach(function (mode) {
      var page = el('div', 'sk-page');
      page.dataset.mode = mode;
      LAYOUTS[mode].forEach(function (rowDefs, rowIndex) {
        var row = el('div', 'sk-row');
        row.dataset.row = String(rowIndex);
        rowDefs.forEach(function (def) {
          var key = parseKey(def);
          var label = KEY_CLASS[key.action] ? LABELS[key.action] : key.value;
          if (key.action === 'mode') {
            label = key.value === 'number' ? '123'
              : key.value === 'symbol' ? '符'
                : 'ABC';
          }
          var btn = el('button', 'sk-key', label);
          btn.type = 'button';
          btn.dataset.action = key.action;
          btn.dataset.value = key.value;
          if (key.action === 'mode') btn.classList.add('sk-key-fn');
          if (KEY_CLASS[key.action]) btn.classList.add.apply(btn.classList, KEY_CLASS[key.action].split(' '));
          if (key.action === 'backspace') {
            btn.title = '点击退格，长按连续快速删除';
            bindRepeatPress(btn, function (ev) { onKey(key.action, key.value, ev); });
          } else if (key.action === 'cursorLeft' || key.action === 'cursorRight') {
            btn.title = '移动光标，长按连续移动';
            bindRepeatPress(btn, function (ev) { onKey(key.action, key.value, ev); });
          } else if (key.action === 'char' && mode === 'letter' && LONG_PRESS[key.value]) {
            bindLongPressKey(btn, key.value);
          } else {
            if (key.action === 'clearInput') btn.title = '一键清空输入框全部文字';
            if (key.action === 'enter') btn.title = '上屏首选词 / 换行';
            bindPress(btn, function (ev) { onKey(key.action, key.value, ev); });
          }
          row.appendChild(btn);
          keyElements[mode === 'letter' ? 'letter' : mode] =
            keyElements[mode === 'letter' ? 'letter' : mode] || [];
          keyElements[mode === 'letter' ? 'letter' : mode].push(btn);
        });
        page.appendChild(row);
      });
      body.appendChild(page);
      pages[mode === 'letter' ? 'letter' : mode] = page;
    });

    /* ---- 手写页 ---- */
    var handPage = el('div', 'sk-page');
    handPage.dataset.mode = 'hand';
    var handHost = el('div', 'sk-hand-host');
    handPage.appendChild(handHost);
    body.appendChild(handPage);
    pages.hand = handPage;

    /* ---- 表情页 ---- */
    var emojiPage = el('div', 'sk-page sk-page-panel');
    emojiPage.dataset.mode = 'emoji';
    var emojiTabs = el('div', 'sk-chip-row');
    var emojiGrid = el('div', 'sk-emoji-grid');
    EMOJI_GROUPS.forEach(function (group, gi) {
      var chip = el('button', 'sk-chip' + (gi === 0 ? ' is-active' : ''), group.name);
      chip.type = 'button';
      bindPress(chip, function () {
        Array.prototype.forEach.call(emojiTabs.children, function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        renderEmoji(gi);
      });
      emojiTabs.appendChild(chip);
    });
    emojiPage.appendChild(emojiTabs);
    emojiPage.appendChild(emojiGrid);
    body.appendChild(emojiPage);
    pages.emoji = emojiPage;

    function renderEmoji(groupIndex) {
      emojiGrid.textContent = '';
      var group = EMOJI_GROUPS[groupIndex] || EMOJI_GROUPS[0];
      group.items.forEach(function (ch) {
        var btn = el('button', 'sk-emoji-item', ch);
        btn.type = 'button';
        bindPress(btn, function () { onKey('emoji', ch); });
        emojiGrid.appendChild(btn);
      });
    }
    renderEmoji(0);

    /* ---- 短语页 ---- */
    var phrasePage = el('div', 'sk-page sk-page-panel');
    phrasePage.dataset.mode = 'phrase';
    var phraseBar = el('div', 'sk-chip-row');
    var phraseAddBtn = el('button', 'sk-chip sk-chip-primary', '＋ 添加短语');
    phraseAddBtn.type = 'button';
    bindPress(phraseAddBtn, function () { onKey('addPhrase', null); });
    phraseBar.appendChild(phraseAddBtn);
    var phraseList = el('div', 'sk-phrase-list');
    phrasePage.appendChild(phraseBar);
    phrasePage.appendChild(phraseList);
    body.appendChild(phrasePage);
    pages.phrase = phrasePage;

    function renderPhrases(list) {
      phraseList.textContent = '';
      (list || []).forEach(function (text, idx) {
        var row = el('div', 'sk-phrase-row');
        var label = el('button', 'sk-phrase-item', text);
        label.type = 'button';
        bindPress(label, function () { onKey('phrase', text); });
        var del = el('button', 'sk-phrase-del', '✕');
        del.type = 'button';
        del.title = '删除该短语';
        bindPress(del, function () { onKey('removePhrase', String(idx)); });
        row.appendChild(label);
        row.appendChild(del);
        phraseList.appendChild(row);
      });
      if (!list || !list.length) {
        phraseList.appendChild(el('div', 'sk-panel-empty', '还没有短语，点上方「＋ 添加短语」新增常用语'));
      }
    }
    renderPhrases(DEFAULT_PHRASES);

    /* ---- 工具页（剪贴板 / 光标 / 自造词 / 设置 / 统计） ---- */
    var toolsPage = el('div', 'sk-page sk-page-panel');
    toolsPage.dataset.mode = 'tools';

    var toolsScroll = el('div', 'sk-tools-scroll');

    var clipTitle = el('div', 'sk-panel-title', '剪贴板');
    var clipRow = el('div', 'sk-tool-row');
    [['复制', 'copy'], ['剪切', 'cut'], ['粘贴', 'paste'], ['全选', 'selectAll']].forEach(function (item) {
      var b = el('button', 'sk-tool-btn', item[0]);
      b.type = 'button';
      bindPress(b, function () { onKey(item[1], null); });
      clipRow.appendChild(b);
    });

    var cursorTitle = el('div', 'sk-panel-title', '光标与撤销');
    var cursorRow = el('div', 'sk-tool-row');
    [['← 左移', 'cursorLeft'], ['右移 →', 'cursorRight'], ['行首', 'cursorHome'], ['行尾', 'cursorEnd'], ['撤销', 'undo']].forEach(function (item) {
      var b = el('button', 'sk-tool-btn', item[0]);
      b.type = 'button';
      bindPress(b, function () { onKey(item[1], null); });
      cursorRow.appendChild(b);
    });

    var dictTitle = el('div', 'sk-panel-title', '自造词与记忆');
    var dictRow = el('div', 'sk-tool-row');
    [['＋ 自造词', 'addWord'], ['清空选词记忆', 'clearPref'], ['清空手写学习', 'clearLearn']].forEach(function (item) {
      var b = el('button', 'sk-tool-btn', item[0]);
      b.type = 'button';
      bindPress(b, function () { onKey(item[1], null); });
      dictRow.appendChild(b);
    });

    var setTitle = el('div', 'sk-panel-title', '输入设置');
    var setBox = el('div', 'sk-settings');
    var settingRowDefs = [
      { key: 'abbrev', label: '简拼（wmd→我们的）', def: true },
      { key: 'fuzzy', label: '模糊音纠错', def: true },
      { key: 'smartAssoc', label: '上屏后连续联想', def: true },
      { key: 'handAuto', label: '手写停笔自动识别', def: true },
      { key: 'dark', label: '深色键盘主题', def: false },
    ];
    var settingSwitches = {};
    settingRowDefs.forEach(function (item) {
      var row = el('label', 'sk-setting-row');
      var span = el('span', 'sk-setting-label', item.label);
      var sw = el('span', 'sk-switch');
      var knob = el('span', 'sk-switch-knob');
      sw.appendChild(knob);
      row.appendChild(span);
      row.appendChild(sw);
      row.dataset.key = item.key;
      row.dataset.on = item.def ? '1' : '0';
      if (item.def) sw.classList.add('is-on');
      row.addEventListener('click', function (ev) {
        ev.preventDefault();
        var next = row.dataset.on !== '1';
        row.dataset.on = next ? '1' : '0';
        sw.classList.toggle('is-on', next);
        onKey('toggleSetting', item.key + ':' + (next ? '1' : '0'));
      });
      settingSwitches[item.key] = row;
      setBox.appendChild(row);
    });

    var sizeRow = el('div', 'sk-setting-row');
    sizeRow.appendChild(el('span', 'sk-setting-label', '候选每页数量'));
    var sizeBtns = el('span', 'sk-seg');
    var pageSizeButtons = {};
    [6, 8, 10].forEach(function (n) {
      var b = el('button', 'sk-seg-btn' + (n === (opts.pageSize || 6) ? ' is-active' : ''), String(n));
      b.type = 'button';
      bindPress(b, function () {
        Object.keys(pageSizeButtons).forEach(function (k) {
          pageSizeButtons[k].classList.toggle('is-active', Number(k) === n);
        });
        onKey('setPageSize', String(n));
      });
      sizeBtns.appendChild(b);
      pageSizeButtons[n] = b;
    });
    sizeRow.appendChild(sizeBtns);
    setBox.appendChild(sizeRow);

    var statBox = el('div', 'sk-stat-box', '');

    toolsScroll.appendChild(clipTitle);
    toolsScroll.appendChild(clipRow);
    toolsScroll.appendChild(cursorTitle);
    toolsScroll.appendChild(cursorRow);
    toolsScroll.appendChild(dictTitle);
    toolsScroll.appendChild(dictRow);
    toolsScroll.appendChild(setTitle);
    toolsScroll.appendChild(setBox);
    toolsScroll.appendChild(statBox);
    toolsPage.appendChild(toolsScroll);
    body.appendChild(toolsPage);
    pages.tools = toolsPage;

    root.appendChild(body);

    /* ---- 长按扩展键弹层 ---- */
    var popup = null;
    function hidePopup() {
      if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
      popup = null;
    }
    function showPopup(btn, letter) {
      hidePopup();
      var items = LONG_PRESS[letter];
      if (!items) return;
      popup = el('div', 'sk-longpress-pop');
      items.forEach(function (ch) {
        var b = el('button', 'sk-longpress-item', ch);
        b.type = 'button';
        b.addEventListener('pointerdown', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          onKey('char', ch);
          hidePopup();
        });
        popup.appendChild(b);
      });
      root.appendChild(popup);
      var r = btn.getBoundingClientRect();
      var rootRect = root.getBoundingClientRect();
      popup.style.left = Math.max(6, Math.min(rootRect.width - 130, r.left - rootRect.left + r.width / 2 - 60)) + 'px';
      popup.style.bottom = (rootRect.bottom - r.top + 8) + 'px';
    }

    function bindLongPressKey(btn, letter) {
      var timer = null;
      var longFired = false;
      var handledByPointer = false;

      function cancel() {
        if (timer) { clearTimeout(timer); timer = null; }
      }

      btn.addEventListener('pointerdown', function (ev) {
        if (ev.button && ev.button !== 0) return;
        handledByPointer = true;
        longFired = false;
        ev.preventDefault();
        ev.stopPropagation();
        cancel();
        timer = setTimeout(function () {
          longFired = true;
          showPopup(btn, letter);
        }, 380);
      });
      btn.addEventListener('pointerup', function (ev) {
        cancel();
        if (longFired) { ev.stopPropagation(); return; }
        onKey('char', letter);
      });
      btn.addEventListener('pointercancel', function () { cancel(); longFired = false; });
      btn.addEventListener('pointerleave', function () { cancel(); });
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (handledByPointer) { handledByPointer = false; return; }
        onKey('char', letter);
      });
    }

    document.addEventListener('pointerdown', function (ev) {
      if (popup && !popup.contains(ev.target)) hidePopup();
    }, true);

    /* ---- 状态 ---- */
    var currentMode = 'zh';
    var caps = false;

    var api = {
      root: root,
      body: body,
      candidateHost: candHost,
      handHost: handHost,
      bufferText: bufferText,
      bufferHint: bufferHint,
      bufferClearBtn: bufferClearBtn,
      setMode: setMode,
      getMode: function () { return currentMode; },
      setCaps: setCaps,
      isCaps: function () { return caps; },
      setCollapsed: function (collapsed) {
        root.classList.toggle('sk-collapsed', !!collapsed);
        preview.style.display = collapsed ? 'none' : '';
      },
      setTheme: function (dark) {
        root.classList.toggle('sk-theme-dark', !!dark);
        root.classList.toggle('sk-theme-light', !dark);
        if (settingSwitches.dark) {
          settingSwitches.dark.dataset.on = dark ? '1' : '0';
          settingSwitches.dark.querySelector('.sk-switch').classList.toggle('is-on', !!dark);
        }
      },
      setSetting: function (key, on) {
        var row = settingSwitches[key];
        if (!row) return;
        row.dataset.on = on ? '1' : '0';
        row.querySelector('.sk-switch').classList.toggle('is-on', !!on);
      },
      setPhrases: renderPhrases,
      setStats: function (text) { statBox.textContent = text; },
      togglePopup: hidePopup,
      destroy: function () { hidePopup(); root.remove(); },
    };

    function setMode(mode) {
      var target = mode;
      if (mode === 'en') target = 'letter';
      if (!pages[target]) target = 'letter';
      currentMode = mode;
      root.dataset.mode = mode;
      root.classList.toggle('is-panel-mode', mode === 'emoji' || mode === 'phrase' || mode === 'tools');
      Object.keys(pages).forEach(function (m) {
        var active = (m === target) || (m === 'letter' && (mode === 'zh' || mode === 'en'));
        pages[m].classList.toggle('is-active', active);
      });
      Object.keys(tabButtons).forEach(function (m) {
        tabButtons[m].classList.toggle('is-active', m === mode);
        tabButtons[m].setAttribute('aria-selected', m === mode ? 'true' : 'false');
      });
      if (typeof opts.onModeChange === 'function') opts.onModeChange(mode);
      return target;
    }

    function setCaps(next) {
      caps = !!next;
      (keyElements.letter || []).forEach(function (btn) {
        if (btn.dataset.action !== 'char') return;
        var v = btn.dataset.value;
        btn.textContent = caps ? v.toUpperCase() : v;
      });
      var shiftBtn = (keyElements.letter || []).find(function (b) { return b.dataset.action === 'shift'; });
      if (shiftBtn) shiftBtn.classList.toggle('is-active', caps);
    }

    setMode('zh');
    return api;
  }

  global.SK = global.SK || {};
  global.SK.KeyboardRender = {
    create: create,
    bindPress: bindPress,
    bindRepeatPress: bindRepeatPress,
    MODE_NAMES: MODE_NAMES,
    DEFAULT_PHRASES: DEFAULT_PHRASES,
  };
})(window);
