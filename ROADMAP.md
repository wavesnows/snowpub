# Snowpub Roadmap · 发展路线

Public feature roadmap for Snowpub — a local-first WeChat Official Account writing & publishing tool.
Snowpub 的公开功能路线图。欢迎通过 Issue 讨论需求、提交 PR 参与共建。

> This document covers **features only**. It is updated as priorities shift.

---

## Already Built · 已有能力

- Draft CRUD, publish + status polling · 草稿增删改查、发布与状态轮询
- Material library · 素材库管理
- Local images auto-uploaded on publish · 发布时本地图片自动上传微信 CDN
- Style-inlined rendering · 样式内联渲染（微信只保留内联样式）
- 12 built-in themes · 12 套内置主题
- User themes as `theme.json` · 用户主题（`<notebook>/themes/*.json` 自动加载）
- External links → footnotes · 外链自动转脚注
- Image posts (newspic) · 图片消息发布
- Paste/drop image upload in editor · 编辑器粘贴/拖拽传图（内容哈希去重）
- Smart cover via `cover_info` · 智能封面（三档比例免重传）
- AI assistant (BYOA) · AI 助手——调度本机 agent CLI（Claude Code / OpenCode / OpenClaw），润色/起标题/写摘要/生成主题

## v1.0 — Core Writing & Publishing Experience · 核心写作与发布体验

- [x] **Theme system v2: themes as `theme.json` · 主题系统 v2（主题即配置）**
  Portable `theme.json` specs (colors, typography, spacing, per-element overrides) — custom themes become data, not code. Built-in gallery expanded to 12 with structural variety (serif body, centered banners, color-band headings, dark mode, density spread); a built-in demo article showcases all elements for side-by-side comparison.
  可移植 `theme.json`（配色、字体、间距、元素覆盖），定制主题 = 填配置。内置库扩到 12 套且结构各异（衬线正文、居中通栏、色带标题、暗夜、密度梯度）；内置演示文章一篇看全所有元素差异。
- [x] **Paste/drag image upload in editor · 编辑器图片粘贴上传**
  Paste or drop an image while writing → saved to the note's `imgs/` folder (content-hash named, deduplicated) and inserted as a relative path. Local images are uploaded to WeChat CDN in one sweep at publish time.
  写作时粘贴/拖拽图片 → 存入笔记 `imgs/` 目录（内容哈希命名、自动去重）并插入相对路径；发布时统一上传微信 CDN。
- [x] **Publish dialog finishing touches · 发布字段收尾**
  Source URL (front matter `source:`), comment switches, auto-generated digest, originality-declaration guidance (save draft → enable in mp console), and personal-account publish guidance with a persisted 48001 marker.
  原文链接（front matter `source:`）、评论开关、摘要自动生成、原创声明引导（先存草稿→后台开启）、个人号发布引导（48001 持久化标记）。
- [x] **Smart cover · 智能封面**
  First article image suggested as cover; original image uploaded once with crop coordinates passed via WeChat's `cover_info` — headline (2.35:1) / secondary (1:1) / original presets, ratio switching without re-upload, re-framable in the mp console.
  自动取首图为封面；原图上传一次、裁剪坐标走微信 `cover_info`——头条 2.35:1 / 次条 1:1 / 原始三档预设，切比例免重传，公众号后台可重框选。

## v1.x — Efficiency & Growth · 效率与进阶

- [ ] **Multi-account support · 多账号切换**
- [ ] **Local ↔ remote draft sync status · 草稿同步状态与冲突处理**
- [ ] **Snippet/template library · 片段与模板库**（开头结尾、关注卡片、往期回顾）
- [ ] **Word count & reading time · 字数与阅读时长统计**
- [x] **User-contributed themes · 用户自定义主题**
  Drop a `theme.json` into `<notebook>/themes/` and it appears in the preview theme dropdown (bad files skipped silently, built-in names protected); the AI assistant can also generate one from a text description and save it there. Sharing a theme = sharing one JSON file.
  把 `theme.json` 放进 `<笔记本>/themes/` 即出现在预览主题下拉中（坏文件静默跳过、内置名防撞）；AI 助手也可按描述生成主题并落盘于此。分享主题 = 分享一个 JSON 文件。

## Under Consideration · 观望中

- Article analytics dashboard · 阅读数据分析面板
- Batch publishing tools · 批量发布
- Theme marketplace · 主题市场
- Preview consolidation: WeChat preview as the single view · 视图收敛（普通预览并入微信预览，待编辑器文内搜索覆盖渲染文本场景后）

---

## Contributing · 参与

- Feature requests → [Issues](../../issues)
- Want to design a theme? The `theme.json` spec lives in [docs/theme-system-design.md](docs/theme-system-design.md).
- 想设计主题？`theme.json` 规范见 [docs/theme-system-design.md](docs/theme-system-design.md)。
