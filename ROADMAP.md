# Snowpub Roadmap · 发展路线

Public feature roadmap for Snowpub — a local-first WeChat Official Account writing & publishing tool.
Snowpub 的公开功能路线图。欢迎通过 Issue 讨论需求、提交 PR 参与共建。

> This document covers **features only**. It is updated as priorities shift.

---

## v1.0 — Core Writing & Publishing Experience · 核心写作与发布体验

The foundation: write in Markdown, see exactly what WeChat readers will see, publish in one click.
基础目标：用 Markdown 写作，所见即所得地预览微信效果，一键发布。

- [ ] **Theme system with inlined styles · 主题系统（样式内联）**
  Themes defined as portable `theme.json` specs; the renderer inlines all styles into HTML so WeChat preserves them. Ships with a gallery of built-in themes.
  主题以 `theme.json` 配置定义，渲染器将样式内联进 HTML（微信会剥离 `<style>` 标签）。内置主题库。
- [ ] **Paste/drag image upload · 图片粘贴上传**
  Paste or drop an image into the editor → auto-uploaded to WeChat CDN, URL inserted inline. No local paths ever reach the draft.
  编辑器内粘贴/拖拽图片 → 自动上传微信 CDN 并插入链接。
- [ ] **Pre-publish image sweep · 发布前图片扫描**
  Batch-upload any remaining local/base64 images before syncing the draft.
- [ ] **Complete publish dialog · 发布字段补全**
  Author, digest (auto-generated), source URL, original-content declaration.
  作者、摘要（自动生成）、原文链接、原创声明。
- [ ] **Smart cover · 智能封面**
  Suggest the first article image as cover; crop presets for headline (2.35:1) and secondary (1:1) slots.
  自动取首图为封面，头条 2.35:1 / 次条 1:1 裁剪预设。

## v1.x — Efficiency & Growth · 效率与进阶

- [ ] **Multi-account support · 多账号切换**
- [ ] **Local ↔ remote draft sync status · 草稿同步状态与冲突处理**
- [ ] **Snippet/template library · 片段与模板库**（开头结尾、关注卡片、往期回顾）
- [ ] **Link footnote conversion · 链接转脚注**（微信正文不支持外链）
- [ ] **Word count & reading time · 字数与阅读时长统计**
- [ ] **User-contributed themes · 用户自定义主题**（导入/导出 `theme.json`）

## Under Consideration · 观望中

- Article analytics dashboard · 阅读数据分析面板
- Batch publishing tools · 批量发布
- Theme marketplace · 主题市场

---

## Contributing · 参与

- Feature requests → [Issues](../../issues)
- Want to design a theme? The `theme.json` spec will be documented in `docs/` once v1.0 lands.
- 想设计主题？v1.0 落地后会在 `docs/` 公布 `theme.json` 规范。
