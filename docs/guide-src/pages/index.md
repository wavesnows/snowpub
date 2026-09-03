# 快速开始

欢迎来到 Snowpub —— 本地优先的公众号写作与发布工具。5 分钟跑通全流程：

## 第一步：安装

从 [Releases](https://github.com/wavesnows/snowpub/releases) 下载对应系统的安装包（macOS Apple Silicon / Intel、Windows），拖入「应用程序」。macOS 首次打开如提示「无法验证开发者」，在终端执行：

```bash
xattr -cr /Applications/Snowpub.app
```

详见[安装与更新](install.html)。

## 第二步：选择笔记本文件夹

打开 Snowpub，侧边栏底部点击 ⚙ 齿轮打开设置 →「笔记本」标签页，选择一个文件夹作为笔记根目录。Snowpub 不会动你磁盘上的其他文件。

## 第三步：配置公众号

设置 →「公众号」标签页：

1. 填入 AppID / AppSecret（获取方式见[公众号接入](wechat.html)）
2. 将本机公网 IP 加入公众号后台 IP 白名单
3. 点击「测试连接」，看到成功提示即可

## 第四步：写第一篇文章

1. 侧边栏「+」新建 `.md` 笔记
2. 左侧写 Markdown，右侧自动渲染微信样式
3. 工具栏点微信预览图标，可切换 12 套主题

## 第五步：发布

工具栏点发布图标，填标题/作者/摘要/封面 →「存草稿」→「发布」。

::: tip
建议先用「存草稿」，到公众号后台确认排版无误后再发布。
:::

---

下一步：[公众号接入](wechat.html) 详细讲解 API 准备与白名单配置。
