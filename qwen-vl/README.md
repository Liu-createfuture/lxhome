# Qwen VL · 本地多模态助手（Cloudflare Pages 部署版）

这是一个**前端静态页面**，部署到 Cloudflare Pages 后，通过绝对地址调用本地隧道的 API 来对话。

## 架构
```
用户浏览器 -> 本页面(Cloudflare Pages) -> https://ai.lxhome.asia (cloudflared 隧道) -> 本地 Flask(5055) -> Ollama
```

## 前提
- 本地电脑必须开机，且 `cloudflared` 隧道、Ollama、Flask 服务(5055) 都在运行
- 本地 Flask 已配置 CORS，允许本站点跨域（含 `*.pages.dev` 与 `*.lxhome.asia`）

## 联网搜索
输入框左侧有「联网搜索」开关，打开后这一轮对话会先检索网页再回答。

- 检索在**服务端**（本地那台机器）完成，不是浏览器直连搜索引擎，
  所以国内网络、手机流量访问时同样可用，不依赖访客能否连上外网搜索。
- 引擎按语种自动编排，一个拿不到就换下一个：
  - 中文：DuckDuckGo（走代理）→ **百度** → **360 搜索** → Bing
  - 英文：DuckDuckGo → Bing
  - （Bing 的中文分词较差，所以只在中文链路的最后兜底）
- 口语化问题会先改写成关键词再检索，例如
  「帮我查一下 Python 3.13 有什么新特性，用三点概括」→「Python 3.13 有什么新特性」。
- 某个引擎一旦甩人机验证/风控页，会冷却 5 分钟并从链路里暂时摘掉，避免每次白等超时。
- 同一个问题 10 分钟内走本地缓存，不重复打搜索引擎。
- 回答上方的卡片会标明这次走的引擎、耗时和来源链接。

## 目录结构
- index.html           前端页面（**自动生成，不要手改**；接口指向 ai.lxhome.asia）
- manifest.webmanifest PWA 清单
- icon-180.png/512.png 应用图标

## 怎么改这个页面
前端真身在本机项目的 `app.py`（`PAGE` 常量）里，改完后重新导出：

```bash
cd E:/ai本地/qwen-vl-chat
python build_static.py          # 写入本目录的 index.html
```

> 之前出现过一次「把整个 app.py 直接粘进 index.html」的事故，页面被 Python 源码和一个超大图标盖住。
> 现在这个文件一律由脚本生成，文件顶部也加了提示注释。
