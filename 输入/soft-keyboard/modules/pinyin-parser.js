/**
 * modules/pinyin-parser.js —— 拼音解析 & 模糊纠错模块
 * ------------------------------------------------------------------
 * 纯字符串算法，无任何网络依赖。提供：
 *   1. 合法拼音音节表（用于判断切分是否合理）
 *   2. segment(text)  把 "nihao" 这类字母串切分成 ["ni","hao"]，并提供备选切分方案（如 xian -> xi+an）
 *   3. matchSyllables(input, syllables, allowPrefix) 支持全拼、声母简拼、zh/ch/sh 及半音节混拼、前缀延伸匹配
 *   4. fuzzyVariants(letters)  生成「一次编辑」的近似拼音串，用于容错纠错
 *
 * 约定：ü 用字母 v 表示（lv / nve），ju/qu/xu/yu 直接按 u 书写，与主流输入法一致。
 * 依赖：无。挂载到 window.SK.PinyinParser。
 */
(function (global) {
  'use strict';

  /* ---------------- 1. 拼音音节表 ---------------- */
  var SYLLABLE_GROUPS = {
    '': 'a o e ai ei ao ou an en ang eng er',
    b: 'ba bo bai bei bao ban ben bang beng bi bie biao bian bin bing bu',
    p: 'pa po pai pei pao pou pan pen pang peng pi pie piao pian pin ping pu',
    m: 'ma mo me mai mei mao mou man men mang meng mi mie miao miu mian min ming mu',
    f: 'fa fo fei fou fan fen fang feng fu',
    d: 'da de dai dei dao dou dan den dang deng di dia die diao diu dian ding dong du duo dui duan dun',
    t: 'ta te tai tao tou tan tang teng ti tie tiao tian ting tong tu tuo tui tuan tun',
    n: 'na ne nai nei nao nou nan nen nang neng ni nie niao niu nian nin niang ning nong nu nuo nuan nun nv nve',
    l: 'la lo le lai lei lao lou lan lang leng li lia lie liao liu lian lin liang ling long lu luo luan lun lv lve',
    g: 'ga ge gai gei gao gou gan gen gang geng gong gu gua guo guai gui guan gun guang',
    k: 'ka ke kai kei kao kou kan ken kang keng kong ku kua kuo kuai kui kuan kun kuang',
    h: 'ha he hai hei hao hou han hen hang heng hong hu hua huo huai hui huan hun huang',
    j: 'ji jia jie jiao jiu jian jin jiang jing jiong ju jue juan jun',
    q: 'qi qia qie qiao qiu qian qin qiang qing qiong qu que quan qun',
    x: 'xi xia xie xiao xiu xian xin xiang xing xiong xu xue xuan xun',
    zh: 'zha zhe zhi zhai zhei zhao zhou zhan zhen zhang zheng zhong zhu zhua zhuo zhuai zhui zhuan zhun zhuang',
    ch: 'cha che chi chai chao chou chan chen chang cheng chong chu chua chuo chuai chui chuan chun chuang',
    sh: 'sha she shi shai shei shao shou shan shen shang sheng shu shua shuo shuai shui shuan shun shuang',
    r: 're ri rao rou ran ren rang reng rong ru rua ruo rui ruan run',
    z: 'za ze zi zai zei zao zou zan zen zang zeng zong zu zuo zui zuan zun',
    c: 'ca ce ci cai cao cou can cen cang ceng cong cu cuo cui cuan cun',
    s: 'sa se si sai sao sou san sen sang seng song su suo sui suan sun',
    y: 'ya yo ye yao you yan yang yong yi yin ying yu yue yuan yun',
    w: 'wa wo wai wei wan wen wang weng wu',
  };

  var SYLLABLES = new Set();
  var SYLLABLE_PREFIXES = new Set();
  var MAX_SYLLABLE_LEN = 0;

  Object.keys(SYLLABLE_GROUPS).forEach(function (initial) {
    SYLLABLE_GROUPS[initial].split(' ').forEach(function (s) {
      if (!s) return;
      SYLLABLES.add(s);
      if (s.length > MAX_SYLLABLE_LEN) MAX_SYLLABLE_LEN = s.length;
      for (var i = 1; i <= s.length; i++) SYLLABLE_PREFIXES.add(s.slice(0, i));
    });
  });

  var ALPHA = 'abcdefghijklmnopqrstuvwxyz';

  /* ---------------- 2. 基础工具 ---------------- */

  function normalize(text) {
    return String(text == null ? '' : text).toLowerCase().replace(/[^a-z]/g, '');
  }

  function normalizeDisplay(text) {
    return String(text == null ? '' : text)
      .toLowerCase()
      .replace(/['`]/g, ' ')
      .replace(/[^a-z ]/g, '');
  }

  function isSyllable(s) {
    return SYLLABLES.has(s);
  }

  function isSyllablePrefix(s) {
    return SYLLABLE_PREFIXES.has(s);
  }

  /* ---------------- 3. 切分（DP 求最少音节数方案 + 备选切分方案） ---------------- */

  /**
   * 把连续的字母串切分为拼音音节（同时支持备选切分路径，如 xian -> [xian] 与 [xi,an]，fangan -> [fang,an] 与 [fan,gan]）
   * @param {string} letters 形如 "nihao" 的纯字母串（或带空格的音节串）
   */
  function segment(letters) {
    var raw = normalizeDisplay(letters).trim();
    // 若用户显式用空格分隔了音节（如 "ni hao"），优先按空格分段解析
    if (raw.indexOf(' ') >= 0) {
      var parts = raw.split(/\s+/).filter(Boolean);
      var syls = [];
      for (var pIdx = 0; pIdx < parts.length; pIdx++) {
        var sub = segment(parts[pIdx]);
        if (!sub.ok) return { ok: false, syllables: [], incomplete: null, altSyllables: [], text: normalize(letters) };
        for (var k = 0; k < sub.syllables.length; k++) syls.push(sub.syllables[k]);
        if (sub.incomplete) {
          if (pIdx === parts.length - 1) {
            return { ok: true, syllables: syls, incomplete: sub.incomplete, altSyllables: [], text: normalize(letters) };
          }
          syls.push(sub.incomplete);
        }
      }
      return { ok: true, syllables: syls, incomplete: null, altSyllables: [], text: normalize(letters) };
    }

    var s = normalize(letters);
    var n = s.length;
    if (!n) return { ok: false, syllables: [], incomplete: null, altSyllables: [], text: s };

    // best[i] = 覆盖前 i 个字符时的最优解（音节数最少）
    // paths[i] = 覆盖前 i 个字符的最多前 4 种合法音节切分方案（用于歧义音节如 xian / fangan / minge）
    var best = new Array(n + 1);
    var paths = new Array(n + 1);
    best[0] = { count: 0, syllables: [] };
    paths[0] = [[]];

    for (var i = 1; i <= n; i++) {
      var curPaths = [];
      for (var len = MAX_SYLLABLE_LEN; len >= 1; len--) {
        if (len > i) continue;
        var prev = best[i - len];
        if (!prev) continue;
        var piece = s.slice(i - len, i);
        if (!SYLLABLES.has(piece)) continue;
        var cand = { count: prev.count + 1, syllables: prev.syllables.concat(piece) };
        if (!best[i] || cand.count < best[i].count) best[i] = cand;
        if (paths[i - len] && curPaths.length < 4) {
          for (var pi = 0; pi < paths[i - len].length && curPaths.length < 4; pi++) {
            curPaths.push(paths[i - len][pi].concat(piece));
          }
        }
      }
      if (curPaths.length) paths[i] = curPaths;
    }

    if (best[n]) {
      var primaryKey = best[n].syllables.join('|');
      var alts = [];
      if (paths[n]) {
        for (var a = 0; a < paths[n].length; a++) {
          if (paths[n][a].join('|') !== primaryKey) alts.push(paths[n][a]);
        }
      }
      // 同时计算如果末尾字符作为下一个音节的开头（例如 wom -> wo + m，或 niha -> ni + ha 同时也可能是 ni + hao 的前缀）
      return { ok: true, syllables: best[n].syllables, incomplete: null, altSyllables: alts, text: s };
    }

    // 完全切分失败：允许末尾留一个「没打完的音节前缀」，以便做前缀联想（如 nih -> 你好，womend -> 我们的）
    for (var p = n - 1; p >= 0; p--) {
      if (!best[p]) continue;
      var tail = s.slice(p);
      if (tail.length <= MAX_SYLLABLE_LEN && SYLLABLE_PREFIXES.has(tail)) {
        return { ok: true, syllables: best[p].syllables, incomplete: tail, altSyllables: [], text: s };
      }
    }

    return { ok: false, syllables: [], incomplete: null, altSyllables: [], text: s };
  }

  /* ---------------- 4. 简拼与混拼匹配 ---------------- */

  var _reach = new Uint8Array(1024);

  /**
   * 判断「一个词语的拼音音节序列」能否匹配用户输入的字母串：
   * 支持：
   *   a) 全拼匹配（wo -> wo）
   *   b) 声母/前缀匹配（w -> wo, zh -> zhi, wom -> women, me -> men）
   *   c) 前缀音节延伸（allowPrefix=true 时，输入 wm 可匹配三音节词 wo men de 的前两个音节）
   *
   * @param {string} input 用户输入的字母串
   * @param {string[]} syllables 词语的拼音音节数组，如 ['wo','men','de']
   * @param {boolean} [allowPrefix=false] 是否允许词语比输入多 1~2 个音节（前缀简拼联想）
   * @returns {{matched:boolean, pureFull:boolean, exactSyllables:boolean, matchedSyllables:number}}
   */
  function matchSyllables(input, syllables, allowPrefix) {
    var s = normalize(input);
    var n = s.length;
    var m = syllables.length;
    if (!n || !m || n < 1) return { matched: false, pureFull: false, exactSyllables: false, matchedSyllables: 0 };

    // 快速首字母剪枝：输入第一个字母必须等于第一个音节的首字母
    if (s.charCodeAt(0) !== syllables[0].charCodeAt(0)) {
      return { matched: false, pureFull: false, exactSyllables: false, matchedSyllables: 0 };
    }

    var stride = n + 1;
    var need = (m + 1) * stride;
    if (_reach.length < need) _reach = new Uint8Array(Math.max(need, _reach.length * 2));
    _reach.fill(0, 0, need);
    _reach[0] = 2; // 2: 全拼路径, 1: 含简拼/半音节路径

    for (var j = 0; j < m; j++) {
      var syl = syllables[j];
      var sLen = syl.length;
      var base = j * stride;
      var nextBase = base + stride;
      for (var i = 0; i < n; i++) {
        var cur = _reach[base + i];
        if (!cur) continue;
        // 尝试用 syl 的前缀 (长度 1 .. sLen) 匹配 s 从 i 开始的子串
        var maxL = Math.min(sLen, n - i);
        for (var l = 1; l <= maxL; l++) {
          if (s.charCodeAt(i + l - 1) !== syl.charCodeAt(l - 1)) break; // 前缀失配则更长也必失配
          var nextState = (l === sLen) ? cur : 1;
          var idx = nextBase + i + l;
          if (_reach[idx] < nextState) _reach[idx] = nextState;
        }
      }
    }

    var finalValue = _reach[m * stride + n];
    if (finalValue) {
      return { matched: true, pureFull: finalValue >= 2, exactSyllables: true, matchedSyllables: m };
    }

    if (allowPrefix && m > 1) {
      // 检查是否完整消费了输入 n 个字符，且匹配了前 k 个音节 (1 <= k < m)
      for (var k = m - 1; k >= 1; k--) {
        if (_reach[k * stride + n]) {
          return {
            matched: true,
            pureFull: false,
            exactSyllables: false,
            matchedSyllables: k,
          };
        }
      }
    }

    return { matched: false, pureFull: false, exactSyllables: false, matchedSyllables: 0 };
  }

  /* ---------------- 5. 模糊纠错（一次编辑的近似串） ---------------- */

  function fuzzyVariants(letters, limit) {
    var s = normalize(letters);
    var max = limit || 400;
    var out = [];
    var seen = Object.create(null);

    function push(v) {
      if (v === s || seen[v]) return;
      seen[v] = 1;
      out.push(v);
    }

    // 1) 插入一个字母（覆盖漏打，如 niho -> nihao）
    for (var i = 0; i <= s.length; i++) {
      for (var k = 0; k < 26; k++) push(s.slice(0, i) + ALPHA[k] + s.slice(i));
    }
    // 2) 相邻字母打反（如 niaho -> nihao）
    for (var i4 = 0; i4 + 1 < s.length; i4++) {
      push(s.slice(0, i4) + s[i4 + 1] + s[i4] + s.slice(i4 + 2));
    }
    // 3) 替换一个字母（覆盖误触邻键）
    for (var i2 = 0; i2 < s.length; i2++) {
      for (var k2 = 0; k2 < 26; k2++) {
        if (ALPHA[k2] === s[i2]) continue;
        push(s.slice(0, i2) + ALPHA[k2] + s.slice(i2 + 1));
      }
    }
    // 4) 多打一个字母
    for (var i3 = 0; i3 < s.length; i3++) push(s.slice(0, i3) + s.slice(i3 + 1));

    return out.length > max ? out.slice(0, max) : out;
  }

  global.SK = global.SK || {};
  global.SK.PinyinParser = {
    SYLLABLES: SYLLABLES,
    normalize: normalize,
    normalizeDisplay: normalizeDisplay,
    isSyllable: isSyllable,
    isSyllablePrefix: isSyllablePrefix,
    segment: segment,
    matchSyllables: matchSyllables,
    fuzzyVariants: fuzzyVariants,
  };
})(window);
