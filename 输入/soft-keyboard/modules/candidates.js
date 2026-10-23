/**
 * modules/candidates.js —— 候选词渲染模块（单行翻页 + 「更多 ▾」多行大面板版）
 * ------------------------------------------------------------------
 * 功能：
 *   1. 顶部单行候选栏：支持 ‹ 上一页 / 下一页 ›、页码展示与点击上屏。
 *   2. 新增「更多 ▾ / 收起 ▴」展开按钮：点击后在键盘主体区展开多行网格大面板，
 *      一页可同时查看 24~32 个汉字/词组（单字 8列×4行=32字/页，词组自适应多列），
 *      并支持大页翻页、滚轮/触控滑动、一键退格、一键清空输入与返回键盘。
 *   3. 全程保持软键盘总高度恒定，展开/收起零高度跳动。
 *
 * 挂载到 window.SK.Candidates。
 */
(function (global) {
  'use strict';

  var BADGE_TEXT = {
    lianxiang: '联',
    prefix: '联',
    completion: '联',
    fuzzy: '纠',
    abbrev: '简',
    hand: '手',
  };

  var BADGE_TITLE = {
    lianxiang: '智能联想候选',
    prefix: '拼音前缀联想候选',
    completion: '词尾延伸联想候选',
    fuzzy: '模糊纠错命中',
    abbrev: '简拼（声母缩写）命中',
    hand: '手写识别候选',
  };

  var DEFAULT_PAGE_SIZE = 6;
  var MORE_SINGLE_PAGE_SIZE = 32; // 单字模式（如手写/单字拼音）：8列 × 4行 = 一页 32 个文字
  var MORE_WORD_PAGE_SIZE = 24;   // 词组模式：一页 24 个词组

  var bindPress = (global.SK && global.SK.KeyboardRender && global.SK.KeyboardRender.bindPress) ||
    function (node, handler) {
      node.addEventListener('click', function (ev) { handler(ev); });
    };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function create(host, options) {
    var opts = options || {};
    var pageSize = opts.pageSize || DEFAULT_PAGE_SIZE;

    var items = [];
    var page = 1;
    var morePage = 1;
    var expanded = false;

    /* ---- 1. 顶部单行候选栏 ---- */
    var wrap = el('div', 'sk-cand-bar');

    var prevBtn = el('button', 'sk-cand-nav', '‹');
    prevBtn.type = 'button';
    prevBtn.title = '上一页';
    bindPress(prevBtn, function () { turn(-1); });

    var list = el('div', 'sk-cand-list');
    var info = el('span', 'sk-cand-info', '0/0');

    var nextBtn = el('button', 'sk-cand-nav', '›');
    nextBtn.type = 'button';
    nextBtn.title = '下一页';
    bindPress(nextBtn, function () { turn(1); });

    var moreBtn = el('button', 'sk-cand-more', '更多 ▾');
    moreBtn.type = 'button';
    moreBtn.title = '展开多行面板，一页查看更多候选文字';
    bindPress(moreBtn, function () {
      if (!items.length) return;
      setExpanded(!expanded);
    });

    wrap.appendChild(prevBtn);
    wrap.appendChild(list);
    wrap.appendChild(info);
    wrap.appendChild(nextBtn);
    wrap.appendChild(moreBtn);
    host.appendChild(wrap);

    /* ---- 2. 多行展开大面板（挂载在键盘主体区 drawerHost 内，保持总高度不变） ---- */
    var drawer = el('div', 'sk-more-panel');
    var drawerGrid = el('div', 'sk-more-grid');
    var drawerBar = el('div', 'sk-more-bar');

    var morePrevBtn = el('button', 'sk-more-btn', '‹ 上一页');
    morePrevBtn.type = 'button';
    bindPress(morePrevBtn, function () { turnMore(-1); });

    var moreInfo = el('span', 'sk-more-info', '第 1/1 页');

    var moreNextBtn = el('button', 'sk-more-btn', '下一页 ›');
    moreNextBtn.type = 'button';
    bindPress(moreNextBtn, function () { turnMore(1); });

    var moreBackBtn = el('button', 'sk-more-btn', '⌫ 退格');
    moreBackBtn.type = 'button';
    bindPress(moreBackBtn, function () {
      if (typeof opts.onBackspace === 'function') opts.onBackspace();
    });

    var moreClearBtn = el('button', 'sk-more-btn sk-more-btn-danger', '清空输入');
    moreClearBtn.type = 'button';
    bindPress(moreClearBtn, function () {
      setExpanded(false);
      if (typeof opts.onClearInput === 'function') opts.onClearInput();
    });

    var moreCloseBtn = el('button', 'sk-more-btn sk-more-btn-primary', '收起 ▴');
    moreCloseBtn.type = 'button';
    bindPress(moreCloseBtn, function () { setExpanded(false); });

    drawerBar.appendChild(morePrevBtn);
    drawerBar.appendChild(moreInfo);
    drawerBar.appendChild(moreNextBtn);
    drawerBar.appendChild(moreBackBtn);
    drawerBar.appendChild(moreClearBtn);
    drawerBar.appendChild(moreCloseBtn);

    drawer.appendChild(drawerGrid);
    drawer.appendChild(drawerBar);

    if (opts.drawerHost) {
      opts.drawerHost.appendChild(drawer);
    }

    function isSingleCharDominant() {
      if (!items.length) return false;
      var sample = Math.min(items.length, 24);
      var singleCnt = 0;
      for (var i = 0; i < sample; i++) {
        if (items[i] && items[i].word && items[i].word.length === 1) singleCnt++;
      }
      return singleCnt >= sample * 0.75;
    }

    function getMorePageSize() {
      return isSingleCharDominant() ? MORE_SINGLE_PAGE_SIZE : MORE_WORD_PAGE_SIZE;
    }

    function totalPages() {
      return Math.max(1, Math.ceil(items.length / pageSize));
    }

    function totalMorePages() {
      var mSize = getMorePageSize();
      return Math.max(1, Math.ceil(items.length / mSize));
    }

    function pageItems() {
      var start = (page - 1) * pageSize;
      return items.slice(start, start + pageSize);
    }

    function turn(delta) {
      var next = page + delta;
      if (next < 1 || next > totalPages()) return;
      page = next;
      renderBar();
      if (typeof opts.onPageChange === 'function') opts.onPageChange(page, totalPages());
    }

    function turnMore(delta) {
      var pages = totalMorePages();
      var next = morePage + delta;
      if (next < 1 || next > pages) return;
      morePage = next;
      renderDrawer();
    }

    function setExpanded(nextState) {
      var next = !!(nextState && items.length > 0);
      if (expanded === next) return;
      expanded = next;
      drawer.classList.toggle('is-open', expanded);
      moreBtn.classList.toggle('is-active', expanded);
      moreBtn.textContent = expanded ? '收起 ▴' : '更多 ▾';
      if (expanded) {
        // 将大面板页码同步到当前单行所在位置对应的页
        var curOffset = (page - 1) * pageSize;
        morePage = Math.floor(curOffset / getMorePageSize()) + 1;
        renderDrawer();
      }
      if (typeof opts.onExpandChange === 'function') opts.onExpandChange(expanded);
    }

    function createCandidateButton(item, i, curList, isMoreGrid) {
      var btn = el('button', isMoreGrid ? 'sk-more-item' : 'sk-cand-item', '');
      btn.type = 'button';
      btn.dataset.index = String(i);
      if (i === 0 && ((isMoreGrid && morePage === 1) || (!isMoreGrid && page === 1))) {
        btn.classList.add('is-first');
      }
      if (isMoreGrid && item.word && item.word.length >= 4) {
        btn.classList.add('is-wide');
      }
      if (item.flag && BADGE_TEXT[item.flag]) {
        var badge = el('span', 'sk-cand-badge', BADGE_TEXT[item.flag]);
        badge.title = BADGE_TITLE[item.flag] || '';
        btn.appendChild(badge);
      }
      btn.appendChild(el('span', 'sk-cand-word', item.word));
      if (item.pinyin) btn.title = item.word + ' (' + item.pinyin + ')';
      bindPress(btn, function () {
        if (isMoreGrid) setExpanded(false);
        if (typeof opts.onSelect === 'function') opts.onSelect(item, i, curList);
      });
      return btn;
    }

    function renderBar() {
      var pages = totalPages();
      if (page > pages) page = pages;
      var cur = pageItems();

      list.textContent = '';
      if (!cur.length) {
        var ph = el(
          'div',
          'sk-cand-placeholder',
          opts.emptyTip || '候选词区域 · 支持全拼 / 简拼（如 wmd→我们的） / 手写识别 / 展开更多'
        );
        list.appendChild(ph);
      } else {
        cur.forEach(function (item, i) {
          list.appendChild(createCandidateButton(item, i, cur, false));
        });
      }

      var isEmpty = items.length === 0;
      wrap.classList.toggle('is-empty', isEmpty);
      prevBtn.disabled = isEmpty || page <= 1;
      nextBtn.disabled = isEmpty || page >= pages;
      moreBtn.disabled = isEmpty;
      moreBtn.textContent = expanded ? '收起 ▴' : (isEmpty ? '更多 ▾' : '更多(' + items.length + ') ▾');
      info.textContent = isEmpty ? '0/0' : page + '/' + pages;
    }

    function renderDrawer() {
      if (!expanded) return;
      var mSize = getMorePageSize();
      var pages = totalMorePages();
      if (morePage > pages) morePage = pages;
      var start = (morePage - 1) * mSize;
      var slice = items.slice(start, start + mSize);

      drawerGrid.textContent = '';
      drawerGrid.classList.toggle('is-single-char', isSingleCharDominant());

      slice.forEach(function (item, i) {
        drawerGrid.appendChild(createCandidateButton(item, i, slice, true));
      });
      drawerGrid.scrollTop = 0;

      morePrevBtn.disabled = morePage <= 1;
      moreNextBtn.disabled = morePage >= pages;
      moreInfo.textContent = '第 ' + morePage + '/' + pages + ' 页 · 共 ' + items.length + ' 项（每页 ' + mSize + ' 项）';
    }

    function render() {
      if (!items.length && expanded) {
        expanded = false;
        drawer.classList.remove('is-open');
      }
      renderBar();
      if (expanded) renderDrawer();
    }

    var api = {
      update: function (nextItems, resetPage) {
        items = nextItems || [];
        if (resetPage !== false) {
          page = 1;
          morePage = 1;
        }
        render();
      },
      clear: function () {
        setExpanded(false);
        api.update([], true);
      },
      setExpanded: setExpanded,
      toggleExpanded: function () {
        if (!items.length) return;
        setExpanded(!expanded);
      },
      isExpanded: function () { return expanded; },
      setPageSize: function (n) {
        pageSize = Math.max(3, Math.min(12, Number(n) || DEFAULT_PAGE_SIZE));
        page = 1;
        morePage = 1;
        render();
      },
      currentPageItems: pageItems,
      firstItem: function () {
        var cur = pageItems();
        return cur.length ? cur[0] : null;
      },
      turnPage: turn,
      el: wrap,
      drawerEl: drawer,
      destroy: function () {
        wrap.remove();
        drawer.remove();
      },
    };

    render();
    return api;
  }

  global.SK = global.SK || {};
  global.SK.Candidates = { create: create, BADGE_TEXT: BADGE_TEXT };
})(window);
