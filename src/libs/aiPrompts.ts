// AI 助手的预设 prompt 构造与回复解析。
// 纯函数、零副作用 —— 便于脚本测试。

// ── 内容截断：避免超长文章撑爆 stdin / token ──
const MAX_CONTENT_LEN = 3000

function clip(content: string): string {
  return content.length > MAX_CONTENT_LEN
    ? content.slice(0, MAX_CONTENT_LEN) + '\n…（已截断）'
    : content
}

/** 润色：优先用选区，无选区用全文。 */
export function buildPolishPrompt(sel: string, full: string): string {
  if (sel) {
    return `请润色下面这段公众号文章的文字（保持原意，提升表达流畅度，不要改变 Markdown 结构）。直接输出润色后的正文，不要解释：\n\n${clip(sel)}`
  }
  return `请润色下面这篇公众号文章（保持原意，提升表达流畅度，不要改变 Markdown 结构）。直接输出润色后的全文，不要解释：\n\n${clip(full)}`
}

/** 起 5 个备选标题（符合微信图文标题 20 字内最优的常识）。 */
export function buildTitlePrompt(content: string): string {
  return `为下面这篇公众号文章起 5 个标题，每行一个，不带序号和解释。要求：有吸引力但不做标题党，尽量在 20 字以内：\n\n${clip(content)}`
}

/** 写摘要（公众号 digest 上限 120 字）。 */
export function buildDigestPrompt(content: string): string {
  return `为下面这篇公众号文章写一段摘要，120 字以内，直接输出摘要正文，不要解释：\n\n${clip(content)}`
}

// ── 主题生成：注入精简版 spec，让任意 CLI 都能产出可编译的 theme.json ──
const THEME_SPEC = `Snowpub 公众号主题 theme.json 规范：
- 顶层结构：{ "meta": {...}, "vars": {...}, "base": {...}, "elements": {...} }
- meta：{ "name": "wechat-xxx"（必填，英文 kebab-case）, "displayName": "中文展示名"（必填）, "author": "作者名（必填，非空字符串）", "version": "1.0.0", "specVersion": "1", "dark": false }
- vars：颜色变量表，如 { "primary": "#07c160" }，样式里用 "\${primary}" 引用
- base：根容器样式（font-size、line-height、color、background、padding）
- elements：元素样式覆盖。可用键：heading（所有标题的公共样式）、h1、h2、h3、h4、h5、h6、p、strong、em、del、a、code、pre、preCode、img、blockquote、ul、ol、li、hr、table、th、td、footnoteRef、footnoteBlock、footnoteTitle、footnoteItem、footnoteLink
- 允许的 CSS 属性（微信只保留内联样式）：color、background、background-color、font-size、font-weight、font-style、font-family、line-height、letter-spacing、text-align、vertical-align、padding 系列、margin 系列、border 系列、border-radius、border-collapse、text-decoration、list-style-type、width、max-width、word-break、white-space、overflow-wrap、overflow-x
- 禁止：display、flex/grid、伪类伪元素、position
- 注意 img 必须包含 "max-width": "100%"`

const THEME_EXAMPLE = JSON.stringify({
  meta: { name: 'wechat-example', displayName: '示例', author: 'snowpub', version: '1.0.0', specVersion: '1', dark: false },
  vars: { primary: '#07c160', text: '#3f536e' },
  base: { 'font-size': '16px', 'line-height': '1.8', color: '${text}', background: '#fff', padding: '16px 18px' },
  elements: {
    heading: { 'font-weight': '700', margin: '1.2em 0 0.6em', color: '${primary}' },
    h2: { 'font-size': '19px', 'border-left': '4px solid ${primary}', 'padding-left': '10px' },
    p: { margin: '0.9em 0' },
    img: { 'max-width': '100%', margin: '8px 0', 'border-radius': '6px' },
    blockquote: { margin: '1em 0', padding: '10px 14px', 'border-left': '3px solid ${primary}', color: '#666' },
  },
}, null, 2)

/** 让 AI 按描述产出一套可直接保存使用的 theme.json。 */
export function buildThemePrompt(desc: string): string {
  return `${THEME_SPEC}\n\n参考示例（精简版）：\n${THEME_EXAMPLE}\n\n请按下面这条需求生成一套完整的 theme.json（把所有常用元素键都配齐，不要省略 meta 字段）：\n${desc}\n\n只输出 JSON 本体，放在 \`\`\`json 代码块里，不要解释。`
}

/**
 * 从 AI 回复里提取第一个 ```json ... ``` 代码块；没有 fenced block 时
 * 尝试截取首个 { 到最后一个 }。找不到返回 null。
 */
export function extractJsonBlock(text: string): string | null {
  const fence = /```(?:json)?\s*\n([\s\S]*?)```/i.exec(text)
  if (fence) return fence[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return null
}
