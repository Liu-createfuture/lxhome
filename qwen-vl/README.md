# Qwen VL · 本地多模态助手（Cloudflare Pages 部署版）

这是一个**前端静态页面**，部署到 Cloudflare Pages 后，通过绝对地址调用本地隧道的 API 来对话。

## 架构
```
用户浏览器 -> 本页面(Cloudflare Pages) -> https://ai.lxhome.asia/chat (cloudflared 隧道) -> 本地 Ollama
```

## 前提
- 本地电脑必须开机，且 `cloudflared` 隧道、Ollama、Flask 服务(5055) 都在运行
- 本地 Flask 已配置 CORS，允许本站点跨域

## 目录结构
- index.html           前端页面（API 指向 ai.lxhome.asia）
- manifest.webmanifest PWA 清单
- icon-180.png/512.png 应用图标
