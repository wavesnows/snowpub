// 主题装饰器：把 CompiledTheme 的样式内联到 markdown-it token 流
// 纯 Node 环境，无 DOM 依赖；渲染器覆盖 + core ruler 装饰双管齐下
import MarkdownIt from 'markdown-it'
import path from 'path'
import type { CompiledTheme, ElementKey } from './types'
import { installFootnoteRule, renderFootnoteBlock, type WxFootnote } from './footnotes'

export interface RenderOptions {
  /** 预览场景专用：相对图片路径基于此目录解析为 file:// 绝对路径。
   *  发布场景不传——本地图已在渲染前批量上传并替换为 CDN URL。 */
  imageBaseDir?: string
}

// markdown-it token.tag → 主题元素键
// h1..h6 由 compile 合并 heading；s/del 都映射到 del；hr/img 默认渲染器走 renderToken
const TAG_TO_KEY: Record<string, ElementKey> = {
  h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6',
  p: 'p', strong: 'strong', em: 'em', s: 'del', del: 'del', sup: 'sup',
  a: 'a', blockquote: 'blockquote', ul: 'ul', ol: 'ol', li: 'li',
  table: 'table', th: 'th', td: 'td',
  hr: 'hr', img: 'img',
}

// 给 token 流（block + inline 两层）注入 style 属性
function decorateTokens(tokens: MarkdownIt.Token[], theme: CompiledTheme): void {
  for (const t of tokens) {
    // inline 子 token 藏在 t.children；递归装饰
    if (t.type === 'inline' && t.children) decorateTokens(t.children, theme)
    // 跳过闭合标签：markdown-it renderToken 对 closing tag 也会 renderAttrs，
    // 给闭合标签加 style 会产出 </h2 style="..."> 非法 HTML
    if (t.nesting === -1) continue
    const key = t.tag && TAG_TO_KEY[t.tag]
    if (key) {
      const s = theme.styleFor(key)
      // 空样式跳过，绝不输出 style=""
      if (s) t.attrJoin('style', s)
    }
  }
}

/** 创建带主题装饰的 MarkdownIt 实例。 */
export function createThemedMd(theme: CompiledTheme, footnotes: WxFootnote[], opts: RenderOptions = {}): MarkdownIt {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true })
  installFootnoteRule(md, footnotes, theme)

  // 图片相对路径解析为 file:// 绝对路径（预览可见）。
  // 必须在渲染层改写 token 的 src，而非改写 markdown 源文本：
  // markdown-it 的 validateLink 在解析期拦截 file: 协议，
  // ![alt](file://…) 不会生成 image token，会被整体渲染成纯文本。
  if (opts.imageBaseDir) {
    const baseDir = opts.imageBaseDir
    const defaultImage: MarkdownIt.Renderer.RenderRule = md.renderer.rules.image
      ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
    md.renderer.rules.image = (tokens, idx, options, env, self) => {
      const token = tokens[idx]
      const srcIndex = token.attrIndex('src')
      if (srcIndex >= 0 && token.attrs) {
        const src = token.attrs[srcIndex][1] as string
        if (src && !src.startsWith('http') && !src.startsWith('file://') && !src.startsWith('data:')) {
          token.attrs[srcIndex][1] = 'file://' + path.resolve(baseDir, src)
        }
      }
      return defaultImage(tokens, idx, options, env, self)
    }
  }

  // 1. token 流装饰：block + inline 两层注入 style
  md.core.ruler.push('theme_decorate', (state) => {
    decorateTokens(state.tokens, theme)
    return true
  })

  // 2. 默认渲染器直接吐 HTML 的 token，装饰触达不到，单独覆盖
  // fence / code_block：输出 <pre><code>，info 串忽略（与旧管线一致，无高亮插件）
  const renderPre: MarkdownIt.Renderer.RenderRule = (tokens, idx) => {
    const t = tokens[idx]
    const escaped = md.utils.escapeHtml(t.content)
    const preStyle = theme.styleFor('pre')
    const codeStyle = theme.styleFor('preCode')
    return `<pre${preStyle ? ` style="${preStyle}"` : ''}><code${codeStyle ? ` style="${codeStyle}"` : ''}>${escaped}</code></pre>\n`
  }
  md.renderer.rules.fence = renderPre
  md.renderer.rules.code_block = renderPre

  // code_inline：输出 <code>
  md.renderer.rules.code_inline = (tokens, idx) => {
    const codeStyle = theme.styleFor('code')
    return `<code${codeStyle ? ` style="${codeStyle}"` : ''}>${md.utils.escapeHtml(tokens[idx].content)}</code>`
  }

  return md
}

/** 顶层渲染入口：编译后的主题 + markdown → 完整带内联样式的 HTML。 */
export function renderThemedArticle(
  markdown: string,
  theme: CompiledTheme,
  referencesTitle: string,
  opts: RenderOptions = {},
): string {
  const footnotes: WxFootnote[] = []
  const md = createThemedMd(theme, footnotes, opts)
  const body = md.render(markdown)
  const baseStyle = theme.styleFor('base')
  return `<section${baseStyle ? ` style="${baseStyle}"` : ''}>${body}${renderFootnoteBlock(footnotes, theme, referencesTitle)}</section>`
}
