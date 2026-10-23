#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tools/build-dict.py —— 本地拼音词库构建脚本（大容量分片版）
==================================================================
数据来源（全部在本机离线完成后固化，运行时不联网）：
  1. soft-keyboard/data/dict.json      —— 既有 6.5 万条人工调权词（保留其权重，优先级最高）
  2. tools/cache/jieba_dict.txt        —— jieba 通用词表（约 35 万条，用作扩容主体）
  3. tools/cache/Unihan_*.txt          —— Unicode Unihan：通用规范汉字表 8105 字、总笔画数
  4. pypinyin                          —— 逐字读音（含多音字）与词语拼音消歧

产物：
  soft-keyboard/data/dict.js           —— 核心分片（常用字 + 高频词，首屏同步加载）
  soft-keyboard/data/dict-ext-1.js     —— 扩展分片 1
  soft-keyboard/data/dict-ext-2.js     —— 扩展分片 2
  soft-keyboard/data/dict-ext-3.js     —— 扩展分片 3
  soft-keyboard/data/dict-meta.json    —— 构建统计信息

用法：
  python tools/build-dict.py
"""

import json
import math
import os
import re
import sys
import urllib.request
import zipfile
from collections import Counter, defaultdict

from pypinyin import lazy_pinyin, pinyin, Style

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, 'soft-keyboard', 'data')
CACHE_DIR = os.path.join(ROOT, 'tools', 'cache')

# 合法普通话音节（与 modules/pinyin-parser.js 保持一致）
SYLLABLES = set("""
a o e ai ei ao ou an en ang eng er
ba bo bai bei bao ban ben bang beng bi bie biao bian bin bing bu
pa po pai pei pao pou pan pen pang peng pi pie piao pian pin ping pu
ma mo me mai mei mao mou man men mang meng mi mie miao miu mian min ming mu
fa fo fei fou fan fen fang feng fu
da de dai dei dao dou dan den dang deng di dia die diao diu dian ding dong du duo dui duan dun
ta te tai tao tou tan tang teng ti tie tiao tian ting tong tu tuo tui tuan tun
na ne nai nei nao nou nan nen nang neng ni nie niao niu nian nin niang ning nong nu nuo nuan nun nv nve
la lo le lai lei lao lou lan lang leng li lia lie liao liu lian lin liang ling long lu luo luan lun lv lve
ga ge gai gei gao gou gan gen gang geng gong gu gua guo guai gui guan gun guang
ka ke kai kei kao kou kan ken kang keng kong ku kua kuo kuai kui kuan kun kuang
ha he hai hei hao hou han hen hang heng hong hu hua huo huai hui huan hun huang
ji jia jie jiao jiu jian jin jiang jing jiong ju jue juan jun
qi qia qie qiao qiu qian qin qiang qing qiong qu que quan qun
xi xia xie xiao xiu xian xin xiang xing xiong xu xue xuan xun
zha zhe zhi zhai zhei zhao zhou zhan zhen zhang zheng zhong zhu zhua zhuo zhuai zhui zhuan zhun zhuang
cha che chi chai chao chou chan chen chang cheng chong chu chua chuo chuai chui chuan chun chuang
sha she shi shai shei shao shou shan shen shang sheng shu shua shuo shuai shui shuan shun shuang
re ri rao rou ran ren rang reng rong ru rua ruo rui ruan run
za ze zi zai zei zao zou zan zen zang zeng zong zu zuo zui zuan zun
ca ce ci cai cao cou can cen cang ceng cong cu cuo cui cuan cun
sa se si sai sao sou san sen sang seng song su suo sui suan sun
ya yo ye yao you yan yang yong yi yin ying yu yue yuan yun
wa wo wai wei wan wen wang weng wu
""".split())

# pypinyin 的口语读音 → 输入法习惯音节
READING_ALIAS = {
    'n': 'en', 'ng': 'eng', 'hm': 'hen', 'hng': 'heng',
    'm': 'mu', 'r': 'er', 'ê': 'e', 'ei': 'ei',
}

CJK_RE = re.compile(r'^[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]{1,8}$')


def norm_reading(r):
    r = (r or '').strip().lower()
    if not r:
        return None
    r = r.replace('ü', 'v').replace('u:', 'v')
    if r in SYLLABLES:
        return r
    if r in READING_ALIAS and READING_ALIAS[r] in SYLLABLES:
        return READING_ALIAS[r]
    return None


def ensure_cache():
    """数据源缺失时自动下载（只在构建阶段联网，产物完全离线）"""
    os.makedirs(CACHE_DIR, exist_ok=True)
    need_unihan = not (os.path.exists(os.path.join(CACHE_DIR, 'Unihan_Readings.txt'))
                       and os.path.exists(os.path.join(CACHE_DIR, 'Unihan_IRGSources.txt')))
    if need_unihan:
        zpath = os.path.join(CACHE_DIR, 'Unihan.zip')
        if not os.path.exists(zpath):
            print('[0/6] 下载 Unihan 汉字数据库 …')
            urllib.request.urlretrieve('https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip', zpath)
        with zipfile.ZipFile(zpath) as z:
            z.extractall(CACHE_DIR)
    jpath = os.path.join(CACHE_DIR, 'jieba_dict.txt')
    if not os.path.exists(jpath):
        print('[0/6] 下载 jieba 通用词表 …')
        urls = [
            'https://cdn.jsdelivr.net/gh/fxsjy/jieba@master/jieba/dict.txt',
            'https://raw.githubusercontent.com/fxsjy/jieba/master/jieba/dict.txt',
        ]
        for u in urls:
            try:
                req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
                data = urllib.request.urlopen(req, timeout=60).read()
                if len(data) > 1000000:
                    with open(jpath, 'wb') as f:
                        f.write(data)
                    break
            except Exception as err:
                print('   下载失败：%s（%s）' % (u, err))


def load_legacy():
    path = os.path.join(DATA_DIR, 'dict.json')
    if not os.path.exists(path):
        return {}, [], {}
    with open(path, encoding='utf-8') as f:
        raw = json.load(f)
    chars = raw.get('chars') or {}
    words = raw.get('words') or []
    strokes = raw.get('strokes') or {}
    return chars, words, strokes


def load_jieba():
    path = os.path.join(CACHE_DIR, 'jieba_dict.txt')
    out = []
    if not os.path.exists(path):
        return out
    with open(path, encoding='utf-8', errors='ignore') as f:
        for line in f:
            parts = line.split()
            if len(parts) < 2:
                continue
            word = parts[0].strip()
            try:
                freq = int(parts[1])
            except ValueError:
                continue
            if not CJK_RE.match(word):
                continue
            out.append((word, freq))
    return out


def load_tghz():
    """通用规范汉字表 8105 字（Unihan kTGHZ2013 字段）"""
    path = os.path.join(CACHE_DIR, 'Unihan_Readings.txt')
    chars = []
    if not os.path.exists(path):
        return chars
    with open(path, encoding='utf-8') as f:
        for line in f:
            if line.startswith('#') or '\t' not in line:
                continue
            cp, field, _val = line.rstrip('\n').split('\t', 2)
            if field == 'kTGHZ2013':
                try:
                    chars.append(chr(int(cp[2:], 16)))
                except ValueError:
                    pass
    return chars


def load_strokes():
    """Unihan 总笔画数：字符 → 笔画数"""
    path = os.path.join(CACHE_DIR, 'Unihan_IRGSources.txt')
    strokes = {}
    if not os.path.exists(path):
        return strokes
    with open(path, encoding='utf-8') as f:
        for line in f:
            if line.startswith('#') or '\t' not in line:
                continue
            cp, field, val = line.rstrip('\n').split('\t', 2)
            if field != 'kTotalStrokes':
                continue
            try:
                ch = chr(int(cp[2:], 16))
                strokes[ch] = int(val.split()[0])
            except (ValueError, IndexError):
                pass
    return strokes


def jieba_weight(freq, fmax):
    """jieba 词频 → 0~9000 的权重（对数压缩，保持单调）"""
    lo = math.log(5)
    hi = math.log(max(fmax, 10))
    if hi <= lo:
        return 300
    ratio = (math.log(max(freq, 5)) - lo) / (hi - lo)
    return int(300 + 8600 * (ratio ** 0.92))


def char_readings(ch):
    """返回字符的全部合法读音（去重、保持常用度顺序）"""
    try:
        groups = pinyin(ch, style=Style.NORMAL, heteronym=True)
    except Exception:
        return []
    out = []
    seen = set()
    for r in (groups[0] if groups else []):
        nr = norm_reading(r)
        if nr and nr not in seen:
            seen.add(nr)
            out.append(nr)
    if not out:
        try:
            fallback = lazy_pinyin(ch, style=Style.NORMAL, errors='ignore')
        except Exception:
            fallback = []
        for r in fallback:
            nr = norm_reading(r)
            if nr and nr not in seen:
                seen.add(nr)
                out.append(nr)
    return out


def main():
    ensure_cache()
    legacy_chars, legacy_words, legacy_strokes = load_legacy()
    jieba_words = load_jieba()
    tghz = load_tghz()
    unihan_strokes = load_strokes()

    print(f'[1/6] 既有词 {len(legacy_words)} 条 / jieba {len(jieba_words)} 条 / '
          f'通用规范汉字 {len(tghz)} 字 / 笔画表 {len(unihan_strokes)} 字')

    fmax = max((f for _, f in jieba_words), default=10)

    # ---- 词语合并：既有词权重优先保留，jieba 补充 ----
    words = {}
    for w, f in legacy_words:
        w = w.strip()
        if not CJK_RE.match(w):
            continue
        words[w] = max(words.get(w, 0), int(f))

    added = 0
    for w, f in jieba_words:
        # 长尾过滤：1~4 字词保留 freq>=3；5 字以上长词组要求 freq>=8（避免长尾噪声挤占候选）
        if len(w) < 2:      # 单字只走 singles 表，避免同一字符重复入库、打分口径不一致
            continue
        if len(w) <= 4:
            if f < 3:
                continue
        elif f < 8:
            continue
        weight = jieba_weight(f, fmax)
        if w in words:
            words[w] = max(words[w], weight)
        else:
            words[w] = weight
            added += 1
    print(f'[2/6] 合并后词条 {len(words)} 条（jieba 新增 {added} 条）')

    # ---- 字符集合：既有字 + 通用规范汉字 + 词中出现过的字 ----
    char_set = []
    seen = set()

    def add_char(ch):
        if ch and ch not in seen:
            seen.add(ch)
            char_set.append(ch)

    for ch in legacy_chars_order(legacy_chars):
        add_char(ch)
    for ch in tghz:
        add_char(ch)
    for w in words:
        for ch in w:
            add_char(ch)

    print(f'[3/6] 字符集合 {len(char_set)} 字')

    # ---- 逐字读音 ----
    char_py = {}
    missing = []
    for ch in char_set:
        rs = char_readings(ch)
        if not rs:
            missing.append(ch)
            continue
        char_py[ch] = rs
    for ch in missing:
        # 兜底：沿用既有表或丢弃
        for py, s in legacy_chars.items():
            if ch in s:
                char_py[ch] = [py]
                break
    print(f'[4/6] 有读音字符 {len(char_py)} 字（无读音 {len(missing)} 字）')

    # ---- 字符频率：优先用 jieba 单字词频（真实语料字频），其余字用词表反推 ----
    single_freq = {}
    for w, f in jieba_words:
        if len(w) == 1:
            single_freq[w] = max(single_freq.get(w, 0), f)

    char_freq = Counter()
    for w, f in words.items():
        n = len(w)
        share = f / (n ** 0.65)
        for ch in w:
            char_freq[ch] += share

    max_cf = max(char_freq.values()) if char_freq else 1
    ranked = []
    for ch in char_set:
        if ch not in char_py:
            continue
        sf = single_freq.get(ch, 0)
        if sf > 0:
            score = math.log1p(sf) * 10.0
        else:
            # 只出现在词组里的字：按词组贡献度打分，并轻微降权
            score = math.log1p(char_freq.get(ch, 0)) * 3.2
        ranked.append((ch, score))
    ranked.sort(key=lambda x: -x[1])
    char_rank = {ch: i for i, (ch, _s) in enumerate(ranked)}
    print(f'[5/6] 字符频率排序完成，Top10 = {"".join(ch for ch, _ in ranked[:10])}')

    # ---- 单字条目：按拼音分组，组内按频率降序 ----
    by_py = defaultdict(list)
    for ch, _s in ranked:
        for py in char_py.get(ch, []):
            by_py[py].append(ch)

    singles = []
    py_keys = sorted(by_py.keys())
    for py in py_keys:
        lst = by_py[py]
        n = len(lst)
        for i, ch in enumerate(lst):
            # 拼音组内按位置衰减，首位 3600 → 尾部 300
            freq = int(3600 - (3300 * i / max(1, n - 1))) if n > 1 else 3600
            singles.append([ch, py, max(280, freq)])

    chars_grouped = {py: ''.join(lst) for py, lst in by_py.items()}

    # ---- 词语拼音：pypinyin 消歧，与逐字主读音对比，必要时显式记录 ----
    word_items = []
    poly_corrected = 0
    for w, f in words.items():
        if any(ch not in char_py for ch in w):
            continue
        try:
            syls = lazy_pinyin(w, style=Style.NORMAL, errors='ignore')
        except Exception:
            syls = []
        syls = [norm_reading(s) for s in syls]
        if len(syls) != len(w) or any(s is None for s in syls):
            syls = [char_py[ch][0] for ch in w]
        else:
            naive = [char_py[ch][0] for ch in w]
            if syls != naive:
                poly_corrected += 1
        word_items.append((w, ' '.join(syls), int(f)))

    word_items.sort(key=lambda x: (-x[2], x[0]))
    print(f'[6/6] 词条拼音消歧 {poly_corrected} 条；最终词条 {len(word_items)} 条')

    # ---- 笔画表（Unihan 优先，既有表覆盖校正） ----
    stroke_map = defaultdict(list)
    for ch, cnt in unihan_strokes.items():
        if 1 <= cnt <= 32:
            stroke_map[cnt].append(ch)
    for k, s in legacy_strokes.items():
        for ch in s:
            cnt = int(k)
            stroke_map[cnt] = [c for c in stroke_map[cnt] if c != ch] + [ch]
    strokes_out = {}
    for cnt in sorted(stroke_map):
        chars = stroke_map[cnt]
        # 桶内按字频降序，保证手写按笔画筛选时常用字优先
        chars.sort(key=lambda c: char_rank.get(c, 99999))
        strokes_out[str(cnt)] = ''.join(chars)

    # ---- 分片：核心（高频词）+ 3 个扩展分片 ----
    CORE_WORDS = 60000
    SHARD = 62000
    core = word_items[:CORE_WORDS]
    rest = word_items[CORE_WORDS:]
    shards = [rest[i:i + SHARD] for i in range(0, len(rest), SHARD)]

    meta = {
        'name': '本地拼音词库（大容量分片版 · 通用规范汉字 + 20 万级词条）',
        'version': '4.0.0',
        'singleCount': len(singles),
        'charCount': len(char_rank),
        'wordCount': len(word_items),
        'total': len(singles) + len(word_items),
        'shards': len(shards),
        'isFallback': False,
    }

    os.makedirs(DATA_DIR, exist_ok=True)

    def dump_words(items):
        return ',\n'.join(
            '["%s","%s",%d]' % (w, py, f) for w, py, f in items
        )

    def dump_singles(items):
        rows = []
        line = []
        for ch, py, f in items:
            line.append('["%s","%s",%d]' % (ch, py, f))
            if len(line) >= 14:
                rows.append(','.join(line))
                line = []
        if line:
            rows.append(','.join(line))
        return ',\n    '.join(rows)

    def dump_strokes(obj):
        parts = []
        for k in sorted(obj, key=lambda x: int(x)):
            parts.append('"%s":"%s"' % (k, obj[k]))
        return ','.join(parts)

    header = ('/* 本文件由 tools/build-dict.py 自动生成，请勿手工修改；'
              '重新构建：python tools/build-dict.py */\n')

    core_js = header + 'window.SK_DICT_DATA = {\n'
    core_js += '  "meta": %s,\n' % json.dumps(meta, ensure_ascii=False)
    core_js += '  "strokes": {%s},\n' % dump_strokes(strokes_out)
    core_js += '  "chars": %s,\n' % json.dumps(chars_grouped, ensure_ascii=False)
    core_js += '  "singles": [\n    %s\n  ],\n' % dump_singles(singles)
    core_js += '  "words": [\n    %s\n  ]\n};\n' % dump_words(core)
    with open(os.path.join(DATA_DIR, 'dict.js'), 'w', encoding='utf-8') as f:
        f.write(core_js)
    print(f'  → dict.js  {len(core_js) / 1024:.0f} KB（词 {len(core)}）')

    for i, items in enumerate(shards, start=1):
        js = header + 'window.SK_DICT_SHARDS = window.SK_DICT_SHARDS || {};\n'
        js += 'window.SK_DICT_SHARDS["%d"] = {"words": [\n  %s\n]};\n' % (i, dump_words(items))
        path = os.path.join(DATA_DIR, 'dict-ext-%d.js' % i)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(js)
        print(f'  → dict-ext-{i}.js  {len(js) / 1024:.0f} KB（词 {len(items)}）')

    with open(os.path.join(DATA_DIR, 'dict-meta.json'), 'w', encoding='utf-8') as f:
        json.dump({
            'meta': meta,
            'shards': [len(s) for s in shards],
            'polyCorrected': poly_corrected,
        }, f, ensure_ascii=False, indent=2)

    # ---- 回写各模块内置兜底表（保证未加载 dict.js 时排序同样正确） ----
    ranked_str = ''.join(ch for ch, _ in ranked[:4520])
    builtin_stroke_limit = 6500
    top_chars = set(ch for ch, _ in ranked[:builtin_stroke_limit])
    bucket_map = defaultdict(list)
    for cnt, chars in stroke_map.items():
        for ch in chars:
            if ch in top_chars:
                bucket_map[cnt].append(ch)
    builtin_strokes = {}
    for cnt in sorted(bucket_map):
        bucket_map[cnt].sort(key=lambda c: char_rank.get(c, 99999))
        builtin_strokes[str(cnt)] = ''.join(bucket_map[cnt])

    patch_builtin(os.path.join(ROOT, 'soft-keyboard', 'modules', 'dict-store.js'), ranked_str, builtin_strokes)
    patch_builtin(os.path.join(ROOT, 'soft-keyboard', 'modules', 'handwriting.js'), ranked_str, builtin_strokes)

    print('\n完成：单字条目 %d、字符 %d、词条 %d，共 %d 项'
          % (len(singles), len(char_rank), len(word_items), len(singles) + len(word_items)))


def patch_builtin(path, ranked_str, builtin_strokes):
    """把最新的内置字频排序串 / 笔画表写回模块文件（只替换对应那一行）"""
    if not os.path.exists(path):
        return
    with open(path, encoding='utf-8') as f:
        lines = f.read().split('\n')
    strokes_val = '{' + ','.join('"%s":"%s"' % (k, v) for k, v in builtin_strokes.items()) + '}'
    changed = 0
    for i, line in enumerate(lines):
        st = line.strip()
        if st.startswith('var BUILTIN_STROKES = '):
            lines[i] = '  var BUILTIN_STROKES = ' + strokes_val + ';'
            changed += 1
        elif st.startswith('var BUILTIN_RANKED_CHARS = '):
            lines[i] = '  var BUILTIN_RANKED_CHARS = "' + ranked_str + '";'
            changed += 1
    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
    print('  → 内置兜底表回写：%s（%d 行）' % (os.path.basename(path), changed))


def legacy_chars_order(legacy_chars):
    """把既有 chars 表按原有顺序摊平成字符序列"""
    out = []
    seen = set()
    for py in sorted(legacy_chars):
        for ch in legacy_chars[py]:
            if ch not in seen:
                seen.add(ch)
                out.append(ch)
    return out


if __name__ == '__main__':
    sys.exit(main())
