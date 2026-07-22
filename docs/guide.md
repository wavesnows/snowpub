# snowpub 使用与开发文档

[English](#quick-start) · [中文](#快速开始)

---

## Quick Start

1. Download the latest installer from [Releases](https://github.com/wavesnows/snowpub/releases)
2. Install and open snowpub
3. Open **Settings → WeChat OA**, enter AppID/AppSecret, click **Test Connection**
4. Open **Settings → Notebook**, choose a folder as your notes root directory
5. Open a `.md` note → click the WeChat preview icon in toolbar → start writing
6. Click the publish icon → fill title/author/cover → **Save Draft** → **Publish**

![snowpub welcome screen](./Screenshot.png)

## Features

- **Dual-pane editor** — Markdown (CodeMirror) on the left, WeChat-styled preview on the right
- **WeChat themes** — Green / Black / Orange / Plain, switchable anytime
- **Publish to WeChat** — Save drafts, publish, query status via OA API
- **Image library** — Upload local images to OA material library, pick cover
- **Draft sync** — Fetch / delete / publish existing OA drafts
- **Footnote references** — External links auto-converted to bottom citations
- **Git sync** — Push/pull to GitHub or Gitee with one click
- **Version history** — Browse commit history, preview and restore any version
- **Full-text search** — Search across all notes instantly
- **Terminal** — Built-in terminal panel, auto-opens to current note's directory

## WeChat Publishing Setup

1. Get AppID and AppSecret from OA console → Settings → Development → Basic Config
2. Add your machine's IP to the OA IP whitelist
3. Open **Settings → WeChat OA** in snowpub, enter AppID/AppSecret
4. Click **Test Connection** to verify
5. Open a `.md` note → click WeChat preview icon → write
6. Click publish icon → fill title / author / digest / cover → **Save Draft** → **Publish**

> Local images in your Markdown are auto-uploaded to WeChat and `src` replaced with OA URLs during publish.

## Git Sync Setup

1. Open **Settings → Sync**
2. Select GitHub or Gitee
3. Enter your username and Personal Access Token (requires `repo` permission)
4. Add a remote notebook — snowpub will clone an existing repo or create a new one

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+\`` | Toggle terminal |
| `Cmd/Ctrl+S` | Save note |
| `Cmd/Ctrl+Shift+P` | Git push |
| `Alt+↑/↓` | Navigate between notes |
| `Cmd/Ctrl+?` | Show help |

---

## 快速开始

1. 从 [Releases](https://github.com/wavesnows/snowpub/releases) 下载最新安装包
2. 安装并打开 snowpub
3. 打开**设置 → 公众号**，填入 AppID/AppSecret，点击**测试连接**
4. 打开**设置 → 笔记本**，选择一个文件夹作为笔记根目录
5. 打开 `.md` 笔记 → 工具栏点微信预览图标 → 开始写作
6. 点发布图标 → 填标题/作者/封面 → **保存草稿** → **发布**

![snowpub 欢迎页面](./Screenshot.png)

## 功能特性

- **双栏编辑** — 左侧 Markdown（CodeMirror），右侧微信样式实时预览
- **微信主题** — 微信绿 / 科技黑 / 活力橙 / 默认白，随时切换
- **公众号发布** — 通过官方 API 保存草稿、发布、查询发布状态
- **图片素材库** — 本地图片上传到公众号素材库，文章封面图选择
- **草稿箱同步** — 拉取 / 删除 / 直接发布公众号已有草稿
- **外链转底部引用** — 自动将外链转为微信友好的底部脚注
- **Git 同步** — 一键推送/拉取到 GitHub 或 Gitee
- **版本历史** — 浏览提交记录，预览并恢复任意版本
- **全文搜索** — 跨所有笔记即时搜索
- **内置终端** — 自动定位到当前笔记所在目录

## 公众号发布配置

1. 在公众号后台 → 设置 → 开发 → 基本配置 获取 AppID 和 AppSecret
2. 将本机 IP 加入公众号后台 IP 白名单
3. 在 snowpub 打开**设置 → 公众号**，填入 AppID/AppSecret
4. 点击**测试连接**验证
5. 打开 `.md` 笔记 → 点微信预览图标 → 写作
6. 点发布图标 → 填标题 / 作者 / 摘要 / 选封面图 → **保存草稿** → **发布**

> 发布时 Markdown 中的本地图片会自动上传到公众号并替换为公众号 URL。

## 键盘快捷键

| 快捷键 | 操作 |
|---|---|
| `Ctrl+\`` | 切换终端 |
| `Cmd/Ctrl+S` | 保存笔记 |
| `Cmd/Ctrl+Shift+P` | Git 推送 |
| `Alt+↑/↓` | 切换笔记 |
| `Cmd/Ctrl+?` | 显示帮助 |

---

## Development

### Prerequisites

- Node.js >= 14.17.0
- npm

### Setup

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

Outputs to `release/{version}/`.

### Tech Stack

- Electron 24 · Vue 3 · TypeScript · Vite
- Element Plus · CodeMirror 6 · EditorJS
- simple-git · electron-updater
