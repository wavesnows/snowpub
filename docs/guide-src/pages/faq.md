# 常见问题

按「连接 → 发布 → AI → 同步 → 数据」的使用顺序排列，问题标题就是你会搜的原句。没找到答案？文末有求助渠道。

## 「测试连接」失败怎么排查？

按从易到难的顺序过一遍，绝大多数问题出在前两步：

1. **AppID / AppSecret 抄错了。** 从公众号后台复制时多带了空格、或 Secret 粘贴成了旧值，逐字核对一遍再试。
2. **AppSecret 重置过，Snowpub 里还是旧值。** 微信侧重置后旧 Secret **立即失效**，回 设置 → 公众号 更新为新值。
3. **本机公网 IP 不在白名单。** 换网络环境（家里 → 咖啡馆 → 公司）IP 就会变。浏览器打开 [ipip.net](https://www.ipip.net) 或百度搜「IP」查当前 IP，加进公众号后台的 IP 白名单。
4. **白名单刚改还没生效。** 微信侧有短暂延迟，等一两分钟再点「测试连接」。
5. **公司网络 NAT 出口 IP 不固定。** 每次请求可能从不同出口 IP 发出，需要把出口 IP 段都加白，联系网络管理员要出口 IP 列表。

各项配置的位置见[公众号接入](wechat.html)。

## 发布时提示 48001 错误怎么办？

48001 表示个人订阅号没有 API 发布权限——这是微信对个人号的限制，不是你的配置出了问题。Snowpub 的对策是**先存草稿、再手动发布**：

- Snowpub 检测到 48001 后会记住这个状态，之后默认引导你存草稿
- 存草稿不受 48001 限制——草稿接口个人号可以正常使用
- 草稿存好后在公众号后台 → 草稿箱发布，或在手机上用「订阅号助手」App 发布

各主体类型的能力边界见[公众号接入](wechat.html)。

## AI 助手检测不到我装好的 CLI 怎么办？

侧边栏「AI 助手」页签会自动检测本机已装的 agent CLI（Claude Code / OpenCode / OpenClaw），检测不到通常是三种情况：

1. **没装。** 切到该 CLI 时面板会显示对应的安装命令，例如 Claude Code 是 `npm install -g @anthropic-ai/claude-code`，在终端执行即可。
2. **装了，但 Snowpub 看不到。** GUI 应用不继承终端 shell 的 PATH——终端里能跑、Snowpub 检测不到，基本就是这个原因。先在终端执行 `which claude` 确认装到了哪里，再回 Snowpub 重试第 3 步。
3. **装完没有重新检测。** 检测在启动时和面板打开时执行，装完新 CLI 点 AI 助手页签右上角的「重新检测」按钮，或重启 Snowpub。

## AI 助手收费吗？API key 填在哪里？

不用在 Snowpub 里填任何 key。AI 助手是 **BYOA**（Bring Your Own Agent）模式：Snowpub 不内置模型、不代管 API key，调用的是你本机已登录的 agent CLI——**token 走你自己 CLI 的账号，费用自付**。

预设动作四个：润色（选中文字或全文）、起标题（5 个备选）、写摘要（120 字以内）、生成主题（AI 产出整套 `theme.json`）。回复点「插入光标处」即可一键回插编辑器。

## Git 同步的 Token 需要什么权限？会被上传吗？

在 设置 → 同步 配置 GitHub 或 Gitee 的用户名 + Token：

- **GitHub**：Personal Access Token（classic）勾选 `repo` 权限
- **Gitee**：私人令牌

::: tip
Token 只存在本地（electron-store），除了你自己的 GitHub / Gitee 仓库不经过任何服务器。添加远程笔记本时既可以克隆已有仓库，也可以让 Snowpub 新建一个。
:::

## 我的笔记存在哪里？会被上传吗？

笔记是磁盘上的**普通 Markdown 文件**，笔记本目录由你自己选择——任何时候都能用任何编辑器打开，卸载 Snowpub 数据也还在。

写作全程本地，不上传任何服务器。只有两类操作出网：发布时调用微信官方 API（草稿 / 素材 / 发布），以及 Git 同步时连接你自己的仓库。AppID / AppSecret / Token 等凭据同样只存本地。

## 还有问题没解决？

到 [GitHub Issues](https://github.com/wavesnows/snowpub/issues) 提一个 issue，附上错误提示和复现步骤，方便快速定位。
