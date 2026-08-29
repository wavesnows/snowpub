# snowpub

A local-first WeChat Official Account writing & publishing tool built with Electron and Vue 3. Write in Markdown, preview in WeChat style, sync with Git, and publish to your Official Account — all without leaving your desktop.

[官网](https://snowpub.wavesnows.com) · [Download](../../releases) · [Guide](docs/guide.md) · [中文说明](README_CN.md)

---

![snowpub](docs/Screenshot.png)

## Features

- **Dual-pane editor** — Markdown (CodeMirror) on the left, WeChat-styled preview on the right
- **WeChat themes** — 12 built-in styles (Green / Black / Orange / Blue / Red / Serif / Cream / Morandi / Pink / Night / Bamboo / Plain), switchable anytime
- **Publish to WeChat** — Via Official Account API: save drafts, publish, query status
- **Image library** — Upload local images to WeChat material library, pick cover for articles
- **Draft sync** — Fetch / delete / publish existing drafts from your OA draft box
- **Footnote references** — External links auto-converted to bottom citations (WeChat-friendly)
- **Git sync** — Push/pull to GitHub or Gitee with one click
- **Version history** — Browse git commit history, preview and restore any version
- **Full-text search** — Search across all notes instantly
- **Built-in terminal** — Quick access terminal panel (`Ctrl+\``), auto-navigates to current note's directory
- **Favorites & Recent** — Pin, star, and quickly revisit notes
- **i18n** — English and Chinese UI

## Themes

12 built-in WeChat themes — one click to switch:

<table>
  <tr>
    <td align="center"><img src="docs/theme-samples/png/wechat-green.png" width="180" alt="WeChat Green"/><br/><sub><b>微信绿</b></sub></td>
    <td align="center"><img src="docs/theme-samples/png/wechat-black.png" width="180" alt="Tech Black"/><br/><sub><b>科技黑</b></sub></td>
    <td align="center"><img src="docs/theme-samples/png/wechat-morandi.png" width="180" alt="Morandi"/><br/><sub><b>莫兰迪</b></sub></td>
    <td align="center"><img src="docs/theme-samples/png/wechat-serif.png" width="180" alt="Ink Serif"/><br/><sub><b>墨色衬线</b></sub></td>
  </tr>
</table>

Plus 8 more: Plain White / Zhihu Blue / Vibrant Orange / Chinese Red / Warm Cream / Sakura Pink / Night / Bamboo.

## Installation

Download the latest installer from [Releases](../../releases):

- macOS: `snowpub_x.x.x_arm64.dmg` (Apple Silicon) · `snowpub_x.x.x_x64.dmg` (Intel)
- Windows: `snowpub_x.x.x.exe`

> **macOS note:** The app is not code-signed. If macOS says the app is damaged, run this in Terminal and try again:
> ```bash
> xattr -cr /Applications/snowpub.app
> ```

## Build from Source

```bash
# Requires Node.js >= 14.17.0
npm install
npm run dev      # development
npm run build    # production build
```

## WeChat Publishing Setup

1. Open **Settings → WeChat OA**
2. Enter your AppID and AppSecret (from OA console → Settings → Development → Basic Config)
3. Add your machine's IP to the OA IP whitelist
4. Click **Test Connection** to verify
5. Open a `.md` note → click the WeChat preview icon in toolbar → write
6. Click the publish icon → fill in title / author / digest / cover → **Save Draft** → **Publish**

> Local images in your Markdown are auto-uploaded to WeChat and `src` replaced with OA URLs during publish.

See [User Guide](docs/guide.md) for details.

## Git Sync Setup

1. Open **Settings → Sync**
2. Select GitHub or Gitee
3. Enter your username, repository name, and personal access token
4. Use the git button in the toolbar or configure auto-sync in **Scheduler**

## Donate

If snowpub is useful to you, consider buying me a coffee ☕

<div align="center">
  <table>
    <tr>
      <td align="center">
        <img src="src/assets/wx.jpg" width="200" alt="WeChat Pay" /><br/>
        <sub><b>WeChat Pay</b></sub>
      </td>
      <td width="40"></td>
      <td align="center">
        <img src="src/assets/zfb.jpg" width="200" alt="Alipay" /><br/>
        <sub><b>Alipay</b></sub>
      </td>
    </tr>
  </table>
</div>

## Customization Services

Want a signature theme for your brand, or a feature built on top of snowpub? I take custom work:

- **Theme customization** — your colors, typography, and layout, delivered as a drop-in theme
- **Feature development** — batch publishing, asset workflows, and more, built as private modules on the open-source core
- **Private deployment & maintenance** — annual plan with updates and priority support

Scan the WeChat code below and mention **"custom"** in your note:

<div align="center">
  <img src="src/assets/wx-contact.png" width="160" alt="WeChat" /><br/>
  <sub><b>WeChat</b> · note "custom" when adding</sub>
</div>

## License

MIT © [wavesnows](LICENSE)
