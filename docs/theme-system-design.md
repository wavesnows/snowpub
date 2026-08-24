# 主题系统设计：theme.json + 样式内联渲染管线

> 状态：**待评审** ｜ 2026-08-24
> 依据：`pc/knowledge/what/snowpub-roadmap.md` 架构决策 1（主题 = JSON spec，不是 CSS 代码）
> 目标读者：项目维护者；v1.0 落地后公开英文版给主题作者

---

## 1. 背景与目标

路线图把主题系统定为阶段 0 最高优先级，因为它是整个定制商业模式的技术地基：

1. 定制主题从「写一套 CSS」变成「填一份 JSON」，交付从 2 天缩到 2 小时
2. 用户能自己做主题，社区可贡献
3. 未来主题市场有了标准提交格式

**本文档定义两件事：`theme.json` 的格式规范（spec），以及 Markdown → 内联样式 HTML 的渲染管线架构。** 评审通过后才进入实现。

## 2. 现状盘点

当前管线（`src/libs/wechatRender.ts` + `src/assets/wechat-preview.css`）：

```
markdown → markdown-it → 裸 HTML → 塞进带 theme-* class 的离屏 DOM
        → getComputedStyle 逐元素计算 → 内联进 style 属性 → 发布
```

主题是 CSS 类（green/black/orange/default 四套），内联靠浏览器引擎完成。这套管线能工作，但有四个痛点：

| 痛点 | 后果 |
|---|---|
| 主题 = CSS 代码 | 定制要写样式表，无法「填配置」；用户无法贡献 |
| 依赖 DOM | 无法脱离渲染进程测试；`INLINE_PROPS` 白名单要手工维护，漏一个属性就丢样式 |
| 预览/发布两条路径 | 预览靠 scoped/全局 CSS，发布靠计算样式内联，理论上会漂移（深色主题背景 bug 就是这么来的） |
| 伪元素/优先级坑 | scoped `[data-v]` 选择器优先级事故已发生一次 |

## 3. theme.json Spec（v1）

### 3.1 顶层结构

```jsonc
{
  "meta": {
    "name": "wechat-green",        // 机器名,小写 kebab,唯一
    "displayName": "微信绿",         // UI 展示名
    "author": "snowpub",
    "version": "1.0.0",
    "description": "微信官方绿主题",
    "dark": false                   // 预留:供 UI 判断预览底色
  },
  "vars": {                         // 变量表,一级替换
    "primary": "#07c160",
    "text": "#333"
  },
  "base": { /* 根容器样式,见 3.3 */ },
  "elements": { /* 逐元素样式,见 3.4 */ }
}
```

### 3.2 变量

- `${name}` 语法引用 `vars` 中的键，**仅一级替换**，禁止嵌套（`${a}` 的值里不能再有 `${b}`）
- 编译期解析；未定义的引用 → 校验报错
- 这是「填配置做主题」的关键：改一个 `primary`，全主题联动

### 3.3 base（根容器）

作用于渲染输出的根 `<section>`：

```jsonc
"base": {
  "font-size": "16px",
  "line-height": "1.75",
  "color": "${text}",
  "background": "#fff",
  "padding": "16px 18px",
  "font-family": "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
  "word-break": "break-word"
}
```

### 3.4 elements（逐元素覆盖）

键 = 元素名，值 = 该元素的样式对象。解析规则：**`base` 的文本属性自动继承，element 只写差异**；不存在元素间互相继承（行为可预测）。

```jsonc
"elements": {
  "heading": {                     // h1~h6 共享,减少重复
    "font-weight": "700",
    "margin": "1.2em 0 0.6em",
    "line-height": "1.4"
  },
  "h1": { "font-size": "22px" },   // 合并于 heading 之上
  "h2": { "font-size": "20px", "color": "${primary}", "border-bottom": "1px solid #e8f5e9", "padding-bottom": "4px" },
  "p":  { "margin": "0.8em 0" },
  "a":  { "color": "#576b95", "text-decoration": "none", "border-bottom": "1px solid #576b95" },
  "blockquote": { "border-left": "3px solid ${primary}", "background": "#f0faf3", "color": "#5a7a66", "padding": "8px 12px", "margin": "1em 0" },
  "code": { "font-family": "Menlo, Consolas, monospace", "font-size": "13px", "background": "#fff5f5", "color": "#c7254e", "padding": "2px 4px", "border-radius": "3px" },
  "pre": { "background": "#f6f8fa", "padding": "12px", "border-radius": "4px", "font-size": "13px", "line-height": "1.5", "margin": "1em 0" },
  "preCode": { "background": "transparent", "padding": "0", "color": "inherit" },
  "img": { "border-radius": "4px", "margin": "8px 0" },
  "ul": { "padding-left": "1.6em", "margin": "0.8em 0" },
  "ol": { "padding-left": "1.6em", "margin": "0.8em 0" },
  "li": { "margin": "4px 0" },
  "table": { "width": "100%", "border-collapse": "collapse", "font-size": "14px", "margin": "1em 0" },
  "th": { "border": "1px solid #ddd", "padding": "6px 10px", "background": "#f0f0f0", "font-weight": "700" },
  "td": { "border": "1px solid #ddd", "padding": "6px 10px" },
  "hr": { "border": "none", "border-top": "1px solid #ddd", "margin": "1.6em 0" },
  "strong": {}, "em": {}, "del": {},
  "footnoteRef":   { "color": "#576b95", "font-size": "0.8em", "font-weight": "400", "margin": "0 2px" },
  "footnoteBlock": { "max-width": "640px", "margin": "16px auto 0", "padding": "12px 16px", "background": "#fff", "border-radius": "4px", "font-size": "12px", "color": "#888" },
  "footnoteTitle": { "font-weight": "600", "margin-bottom": "6px", "color": "#606266" },
  "footnoteItem":  { "margin": "3px 0", "word-break": "break-all" },
  "footnoteLink":  { "color": "#576b95", "text-decoration": "none" }
}
```

### 3.5 元素键清单（v1 全集）

| 类别 | 键 |
|---|---|
| 根 | `base`（顶层，不在 elements 内） |
| 标题 | `heading`（共享）、`h1`–`h6` |
| 文本 | `p`、`strong`、`em`、`del`、`sup` |
| 行内 | `a`、`code`、`img` |
| 块级 | `blockquote`、`pre`、`preCode`、`ul`、`ol`、`li`、`hr` |
| 表格 | `table`、`th`、`td` |
| 脚注 | `footnoteRef`、`footnoteBlock`、`footnoteTitle`、`footnoteItem`、`footnoteLink` |

未出现在清单中的键 → 校验时警告并忽略（向前兼容：新版加的键老版本应用不崩）。

### 3.6 属性白名单与值消毒

主题 JSON 是可导入的外部输入，必须限制攻击面：

- **属性白名单**：仅允许上表示例出现的排版类属性（color/background/font-*/line-height/letter-spacing/text-align/padding/margin/border*/border-radius/text-decoration/list-style-type/width/max-width/vertical-align）。**显式排除** `position`、`float`、`display: flex/grid`（微信不支持且易翻车）
- **值消毒**：任何值含 `url(`、`expression(`、`javascript:` → 拒绝整个主题
- 编译器对每个元素**强制补充**安全默认值，主题无法覆盖：`img` 永远有 `max-width:100%`

## 4. 渲染管线架构

### 4.1 核心决策：token 流装饰，而不是重写 renderer

markdown-it 渲染时每个标签都有对应 token（`heading_open`、`paragraph_open`……`.tag` 属性即标签名）。管线在 token 流上做一遍装饰，`attrJoin('style', ...)` 注入样式，比逐规则重写 renderer 少一个数量级的代码，且天然处理嵌套：

```
markdown ──► markdown-it parse ──► token 流装饰(按 .tag 查样式表注入 style)
    ──► 少数规则覆盖(fence / code_block / code_inline / image / hr / link)
    ──► 内联样式 HTML 字符串 ──► ┬─ 预览:v-html 直接渲染
                                 └─ 发布:同一字符串进草稿
```

**单一管线、两个出口**——预览和发布用的是同一个字符串，「所见即所得」由构造保证，不再依赖两条路径不漂移。

### 4.2 模块划分

```
src/libs/theme/
  types.ts       — ThemeJson / CompiledTheme 类型
  compile.ts     — JSON → CompiledTheme:校验、vars 替换、base 继承合并、
                   白名单过滤、值消毒、styleFor(key) 缓存为字符串
  decorate.ts    — token 流装饰 + fence/code_inline/image/hr 规则覆盖
  footnotes.ts   — 现有外链转脚注逻辑迁入,样式改用 footnote* 键
src/themes/*.json — 4 套内置主题(从 wechat-preview.css 1:1 移植)
```

`compileTheme()` 是纯函数、无 DOM 依赖——可以在 Node 里跑，为单测/黄金文件敞开大门（现在 `inlineComputedStyles` 离开浏览器就死）。

### 4.3 需要特殊处理的点

| 情况 | 处理 |
|---|---|
| `fence`/`code_block` 一次吐出整块 `<pre><code>` HTML | 覆盖该规则，用 `pre`/`preCode` 样式手工拼 |
| `img` 的 src/alt 已有属性 | 覆盖规则只追加 style |
| 外链脚注（现有功能） | 保留逻辑，`sup` 及脚注块样式移到 `footnote*` 键，消灭硬编码 `#576b95` |
| `th`/`td` | token `.tag` 天然区分，装饰即可 |
| 根容器 | 输出包一层 `<section style="base…">`；预览侧的 `max-width:640px` 属于布局，留在预览组件 wrapper，不进主题 |

### 4.4 迁移与切换

1. 4 套内置 CSS 主题 1:1 移植为 `src/themes/*.json`
2. `WechatPreview` 改用新管线渲染；`wechat-preview.css` 中主题规则删除，只留布局（滚动容器、toolbar）
3. `buildStyledWechatHtml` / `inlineComputedStyles` 删除
4. 验证：同一篇测试文章（含标题/引用/代码/表格/图片/外链）分别用 4 主题渲染，与旧管线截图逐张对比；再走一遍「保存草稿」确认微信侧外观
5. 不设运行时开关：pre-1.0，出问题 git 回滚

### 4.5 验证策略

- `vue-tsc --noEmit` 必过
- 黄金文件：`scripts/render-theme-sample.ts`（Node 直跑，无 DOM）对固定 fixture markdown × 4 主题输出 HTML 到 `docs/theme-samples/`，肉眼 + git diff 审查每次改动
- 真机：保存草稿到公众号后台检查样式（不发布）

## 5. 为 v1.x 预留（本次不做）

- **用户主题导入/导出**：文件选择器 → 校验 → 复制到 `<savePath>/themes/`，主题下拉出现。spec 的校验/消毒已按外部输入设计，届时无需改 spec
- **自定义块**（关注卡片、分割线、往期回顾）：预留顶层 `blocks` 键，对应 markdown-it container 插件。等 spec 稳定后再定
- **主题市场**：提交格式即本 spec + 封面截图约定

## 6. 开放问题（评审时请拍板）

| # | 问题 | 建议 |
|---|---|---|
| 1 | JSON 属性名 kebab-case 还是 camelCase？ | **kebab-case**：主题作者是设计师，长得越像 CSS 越好；且白名单/消毒直接对 CSS 属性名工作 |
| 2 | 变量只支持一级 `${var}`，够用吗？ | 够。二级嵌套带来的复杂度远大于收益，真需要时向后兼容地加 |
| 3 | 要不要引入 vitest 给 compile/decorate 写单测？ | 建议**暂不加依赖**，先用黄金文件脚本；等 v1.x 用户主题开放导入时再补 |
| 4 | 旧 CSS 管线直接删还是保留一期？ | **直接删**。pre-1.0 用户量小，保留双管线等于保留漂移源 |
| 5 | `newspic` 图文模式是否走主题？ | **不走**。图文只有纯文本描述，无样式可言；主题选择器在 newspic 下置灰 |

## 7. 与路线图的对照

- 决策 1（主题 = JSON spec）→ 本文档第 3 节
- 「内置 10+ 主题」（阶段 1）→ spec 落地后，每套主题 = 一个 JSON 文件 + 一张示例截图，边际成本极低
- 「主题市场前提：spec 已稳定」（阶段 3）→ 稳定标志 = 变量语法、元素键清单、白名单三个版本号化（meta.specVersion，v1 固定为 `"1"`，本文档从略，实现时加入）
