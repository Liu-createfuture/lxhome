<template>
  <!-- 面板本身是 position: fixed，容器只是挂载点，不占页面空间 -->
  <div class="soft-keyboard-host" ref="hostRef"></div>
</template>

<script>
/**
 * SoftKeyboard.vue —— 软键盘的 Vue3 包装组件（Options API，无 TS）
 * ==================================================================
 * 把 soft-keyboard 目录下的纯 JS 模块按顺序加载进来，再创建 window.SK.SoftKeyboard 实例。
 * 若 /data/dict.js 暂未放置，会自动降级使用内置的 4520 字库与基础词库，放回后自动加载完整大词库。
 */
const SCRIPTS = [
  { file: '/data/dict.js', optional: true },   // 本地大词库数据（可选，未放置时自动用内置 4520 字兜底）
  { file: '/modules/pinyin-parser.js' },       // 拼音解析 + 模糊纠错
  { file: '/modules/dict-store.js' },          // 词库检索与智能联想
  { file: '/modules/keyboard-render.js' },     // 键盘渲染
  { file: '/modules/candidates.js' },          // 候选词渲染（含「更多 ▾」大面板）
  { file: '/modules/handwriting.js' },         // 手写面板 + 六维混合识别 + 翻页
  { file: '/soft-keyboard.js' },               // 主组件
];

function loadScript(src, optional) {
  return new Promise((resolve, reject) => {
    const exists = document.querySelector('script[data-sk-asset="' + src + '"]');
    if (exists) return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.dataset.skAsset = src;
    el.onload = () => resolve();
    el.onerror = () => {
      if (optional) {
        console.warn('[SoftKeyboard.vue] 未检测到外部词库 ' + src + '，已启用内置 4520 字兜底词库');
        return resolve();
      }
      reject(new Error('软键盘资源加载失败：' + src));
    };
    document.head.appendChild(el);
  });
}

function loadStyle(href) {
  if (document.querySelector('link[data-sk-asset="' + href + '"]')) return;
  const el = document.createElement('link');
  el.rel = 'stylesheet';
  el.href = href;
  el.dataset.skAsset = href;
  document.head.appendChild(el);
}

export default {
  name: 'SoftKeyboard',
  props: {
    target: { type: [String, Object, Array], default: '' },
    assetsBase: { type: String, default: '/soft-keyboard' },
    pageSize: { type: Number, default: 6 },
    handMaxChars: { type: Number, default: 6500 },
    reserveSpace: { type: Boolean, default: true },
  },
  emits: ['commit', 'show', 'hide', 'ready', 'error'],

  data() {
    return { instance: null };
  },

  mounted() {
    this.init();
  },

  beforeUnmount() {
    if (this.instance) {
      this.instance.destroy();
      this.instance = null;
    }
  },

  watch: {
    target() {
      if (this.instance) this.instance.setTargets(this.normalizeTarget());
    },
  },

  methods: {
    async init() {
      try {
        if (!window.SK || !window.SK.SoftKeyboard) {
          loadStyle(this.assetsBase + '/soft-keyboard.css');
          for (const item of SCRIPTS) {
            // eslint-disable-next-line no-await-in-loop
            await loadScript(this.assetsBase + item.file, item.optional);
          }
        }
        this.instance = window.SK.SoftKeyboard.create({
          container: this.$refs.hostRef,
          targets: this.normalizeTarget(),
          pageSize: this.pageSize,
          handMaxChars: this.handMaxChars,
          reserveSpace: this.reserveSpace,
          shardBase: this.assetsBase + '/data/',
          shardFiles: ['dict-ext-1.js', 'dict-ext-2.js', 'dict-ext-3.js', 'dict-ext-4.js', 'dict-ext-5.js'],
          onCommit: (text, item) => this.$emit('commit', text, item),
          onShow: () => this.$emit('show'),
          onHide: () => this.$emit('hide'),
        });
        this.$emit('ready', this.instance);
      } catch (err) {
        console.error('[SoftKeyboard.vue] 初始化失败', err);
        this.$emit('error', err);
      }
    },

    normalizeTarget() {
      const t = this.target;
      if (!t) return null;
      const pick = (v) => (v && v.$el ? v.$el : (v && v.value !== undefined ? v.value : v));
      if (Array.isArray(t)) return t.map(pick).filter(Boolean);
      return pick(t);
    },

    show() { this.instance && this.instance.show(); },
    hide() { this.instance && this.instance.hide(); },
    setMode(mode) { this.instance && this.instance.setMode(mode); },
    insertText(text) { this.instance && this.instance.insertText(text); },
    clearInput() { this.instance && this.instance.clearInput(); },
    clearBuffer() { this.instance && this.instance.clearBuffer(); },
    expandCandidates(open = true) { this.instance && this.instance.expandCandidates(open); },
    clearPreference() { this.instance && this.instance.dict.clearPreference(); },
    setTheme(dark) { this.instance && this.instance.setTheme(dark); },
    getSettings() { return this.instance ? this.instance.getSettings() : {}; },
    setSetting(key, on) { this.instance && this.instance.setSetting(key, on); },
    getPhrases() { return this.instance ? this.instance.getPhrases() : []; },
    setPhrases(list) { this.instance && this.instance.setPhrases(list); },
    addWord(word, pinyin) { return this.instance ? this.instance.addWord(word, pinyin) : null; },
    stats() { return this.instance ? this.instance.stats() : {}; },
  },
};
</script>

<style scoped>
.soft-keyboard-host {
  display: contents;
}
</style>
