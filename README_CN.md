# snowpub

一款本地优先的微信公众号写作与发布工具，基于 Electron + Vue 3 构建。用 Markdown 写作，实时预览微信样式，一键发布到公众号。

[官网](https://snowpub.wavesnows.com) · [下载](../../releases) · [使用说明](docs/guide.md) · [English](README.md)

---

![snowpub](docs/Screenshot.png)

## 功能特性

- **双栏编辑** — 左侧 Markdown（CodeMirror）编辑，右侧微信样式实时预览
- **微信主题** — 微信绿 / 科技黑 / 活力橙 / 默认白，随时切换
- **公众号发布** — 通过公众号官方 API：保存草稿、发布、查询发布状态
- **图片素材库** — 本地图片上传到公众号素材库，文章封面图选择
- **草稿箱同步** — 拉取 / 删除 / 直接发布公众号已有草稿
- **外链转底部引用** — 自动将外链转为微信友好的底部脚注
- **Git 同步** — 一键推送/拉取到 GitHub 或 Gitee
- **版本历史** — 浏览 Git 提交记录，预览并恢复任意版本
- **全文搜索** — 跨所有笔记即时搜索
- **内置终端** — 快速终端面板（`Ctrl+\``），自动定位到当前笔记所在目录
- **收藏与最近** — 置顶、星标，快速访问常用笔记
- **中英双语** — 界面支持中文和英文切换

## 安装

从 [Releases](../../releases) 下载最新安装包：

- macOS：`snowpub_x.x.x_arm64.dmg`（Apple Silicon）· `snowpub_x.x.x_x64.dmg`（Intel）
- Windows：`snowpub_x.x.x.exe`

> **macOS 提示：** 应用暂未签名。如果 macOS 提示「已损坏」，在终端执行以下命令后重新打开：
> ```bash
> xattr -cr /Applications/snowpub.app
> ```

## 从源码构建

```bash
# 需要 Node.js >= 14.17.0
npm install
npm run dev      # 开发模式
npm run build    # 生产构建
```

## 公众号发布配置

1. 打开 **设置 → 公众号**
2. 填入 AppID 和 AppSecret（公众号后台 → 设置 → 开发 → 基本配置 获取）
3. 将本机 IP 加入公众号后台 IP 白名单
4. 点击 **测试连接** 验证
5. 打开 `.md` 笔记 → 工具栏点微信预览图标 → 开始写作
6. 点发布图标 → 填标题 / 作者 / 摘要 / 选封面图 → **保存草稿** → **发布**

> 发布时 Markdown 中的本地图片会自动上传到公众号并替换为公众号 URL。

## Git 同步配置

1. 打开 **设置 → 同步**
2. 选择 GitHub 或 Gitee
3. 填入用户名、仓库名和 Personal Access Token
4. 使用工具栏 Git 按钮手动同步，或在 **调度器** 中配置自动同步

## 捐赠

如果 snowpub 对你有帮助，欢迎请我喝杯咖啡 ☕

<div align="center">
  <table>
    <tr>
      <td align="center">
        <img src="src/assets/wx.jpg" width="200" alt="微信支付" /><br/>
        <sub><b>微信支付</b></sub>
      </td>
      <td width="40"></td>
      <td align="center">
        <img src="src/assets/zfb.jpg" width="200" alt="支付宝" /><br/>
        <sub><b>支付宝</b></sub>
      </td>
    </tr>
  </table>
</div>

## 定制服务

需要品牌专属排版主题，或基于 snowpub 定制功能？我接定制：

- **主题定制**——配色、字体、版式按你的品牌调性交付为可直接使用的主题
- **功能定制**——批量发布、素材管理等，基于开源主干做私有模块，不 fork
- **私有部署 + 年费维护**——含版本更新与优先支持

扫下方微信码，添加时请备注「定制」：

<div align="center">
  <img src="src/assets/wx.jpg" width="160" alt="微信" /><br/>
  <sub><b>微信</b> · 添加备注「定制」</sub>
</div>

## 协议

MIT © [wavesnows](LICENSE)
