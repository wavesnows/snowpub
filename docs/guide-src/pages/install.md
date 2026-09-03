# 安装与更新

## 系统要求

- **macOS** 12（Monterey）及以上，Apple Silicon 与 Intel 芯片均可
- **Windows** 10 及以上

## 下载安装包

到 [GitHub Releases](https://github.com/wavesnows/snowpub/releases) 下载对应系统的安装包：

| 安装包 | 适用系统 |
|---|---|
| `snowpub_x.x.x_arm64.dmg` | macOS Apple Silicon（M1 / M2 / M3） |
| `snowpub_x.x.x_x64.dmg` | macOS Intel |
| `snowpub_x.x.x.exe` | Windows 10 及以上 |

不确定自己的 Mac 是哪种芯片？点屏幕左上角的苹果菜单 →「关于本机」：「芯片」一栏显示 Apple M 系列就选 arm64 版，显示 Intel 就选 x64 版。

## macOS 安装

双击挂载 DMG，把 Snowpub 拖入右侧的「Applications」文件夹，然后从「应用程序」（或 Launchpad）里启动。

应用目前没有签名，首次打开若提示「已损坏，无法打开」或「无法验证开发者」，在终端执行一次：

```bash
xattr -cr /Applications/Snowpub.app
```

然后重新双击打开即可。这是移除 macOS 对未签名应用的隔离标记，只需执行一次。

## Windows 安装

双击 `.exe` 即完成安装（默认安装到用户目录），卸载时不会删除你的笔记数据。

## `install.sh` 一键安装（可选）

如果你克隆了仓库并在本地构建过，可以用根目录的 `install.sh` 一键完成安装：脚本自动检测芯片类型（Apple Silicon / Intel），挂载 `release/` 目录下对应的 DMG，把应用复制到 `/Applications`，并顺手移除隔离属性。

```bash
./install.sh
```

普通用户直接从 Releases 下载安装包更省事，不需要这个脚本。

::: tip
`install.sh` 头部的 `VERSION` 硬编码为 `1.0.0`，可能滞后于最新版本——最新版本号请以 [Releases](https://github.com/wavesnows/snowpub/releases) 页为准。
:::

## 自动更新

Snowpub 的更新基于 GitHub Releases：

1. 应用启动后自动检测新版本
2. 有新版时右下角弹出「发现新版本」通知，点「立即下载」开始下载（通知里有进度条）
3. 下载完成后点「立即重启」安装新版；当时不重启也没关系，下次退出应用时会自动安装

也可以随时从 [Releases](https://github.com/wavesnows/snowpub/releases) 手动下载新版安装包，覆盖安装即可。

更新只替换应用本身：你的笔记是磁盘上的普通文件，和应用程序分开存放，升级或覆盖安装都不会影响笔记数据。

---

下一步：[公众号接入](wechat.html)——准备 AppID、AppSecret 和 IP 白名单。
