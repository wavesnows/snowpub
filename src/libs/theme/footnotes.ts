// 外链转脚注规则 + 脚注引用块构建
// 样式由 CompiledTheme 提供；空样式不输出 style 属性
import type MarkdownIt from 'markdown-it'
import type { CompiledTheme } from './types'

export interface WxFootnote { url: string; text: string }

// HTML 转义（脚注 url / 文本 / 标题）
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// 空样式不输出 style 属性，避免 style=""
function styleAttr(s: string): string {
  return s ? ` style="${s}"` : ''
}

/** 安装 link_open 规则：把 http(s) 外链转为脚注引用。计数器每次渲染从 1 起算。 */
export function installFootnoteRule(md: MarkdownIt, footnotes: WxFootnote[], theme: CompiledTheme): void {
  let counter = 0
  // link_open 默认走 renderToken；被覆盖时保留原行为
  const fallback: MarkdownIt.Renderer.RenderRule = (tokens, idx, options, _env, self) =>
    self.renderToken(tokens, idx, options)
  const original: MarkdownIt.Renderer.RenderRule = md.renderer.rules.link_open || fallback
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const hrefIndex = token.attrIndex('href')
    if (hrefIndex >= 0 && token.attrs) {
      const href = token.attrs[hrefIndex][1] as string
      // 只对 http(s) 外链做脚注处理，跳过锚点
      if (href.startsWith('http')) {
        const next = tokens[idx + 1]
        const text = next && next.content ? next.content : href
        footnotes.push({ url: href, text })
        counter++
        const sup = `<sup${styleAttr(theme.styleFor('footnoteRef'))}>[${counter}]</sup>`
        return original(tokens, idx, options, env, self) + sup
      }
    }
    return original(tokens, idx, options, env, self)
  }
}

/** 渲染收集到的脚注为底部引用块；空时返回 ''。 */
export function renderFootnoteBlock(footnotes: WxFootnote[], theme: CompiledTheme, referencesTitle: string): string {
  if (!footnotes.length) return ''
  const items = footnotes.map((f, i) =>
    `<li${styleAttr(theme.styleFor('footnoteItem'))}>` +
    `<span${styleAttr(theme.styleFor('footnoteRef'))}>[${i + 1}]</span>` +
    `<a href="${escapeHtml(f.url)}"${styleAttr(theme.styleFor('footnoteLink'))}>${escapeHtml(f.text)}</a>` +
    `</li>`
  ).join('')
  return `<div${styleAttr(theme.styleFor('footnoteBlock'))}>` +
    `<div${styleAttr(theme.styleFor('footnoteTitle'))}>${escapeHtml(referencesTitle)}</div>` +
    `<ol style="padding-left:1.4em;margin:0;">${items}</ol>` +
    `</div>`
}
