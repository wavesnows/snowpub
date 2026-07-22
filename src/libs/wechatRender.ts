// 公众号发布 HTML 构建：外链转脚注 + 计算样式内联。
// 样式唯一来源是全局 wechat-preview.css（非 scoped），通过离屏 DOM + getComputedStyle
// 把最终生效的样式内联到每个标签，保证发布到草稿的内容与应用内预览外观一致
// （微信会剥离 class/外部 CSS，只保留内联样式）。
import MarkdownIt from 'markdown-it'

export interface WxFootnote { url: string; text: string }

// 创建带"外链转脚注"规则的 MarkdownIt（脚注样式直接内联，因预览中的 sup 样式是 scoped 的）
export function createWechatMd(footnotes: WxFootnote[]): MarkdownIt {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true })
  let counter = 0
  const original = md.renderer.rules.link_open
    || ((tokens: any[], idx: number, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options))
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
        const sup = `<sup style="color:#576b95;font-size:0.8em;font-weight:400;margin:0 2px;">[${counter}]</sup>`
        return original(tokens, idx, options, env, self) + sup
      }
    }
    return original(tokens, idx, options, env, self)
  }
  return md
}

const INLINE_PROPS = [
  'color', 'background-color', 'font-size', 'font-weight', 'font-style',
  'font-family', 'line-height', 'letter-spacing', 'text-align',
  'border', 'border-left', 'border-bottom', 'border-top',
  'padding', 'margin', 'border-radius',
  'list-style-type', 'text-decoration',
]

// 把元素（含子树）当前生效的计算样式内联到 style 属性，返回克隆体
export function inlineComputedStyles(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement
  const sourceNodes = source.querySelectorAll('*')
  const cloneNodes = clone.querySelectorAll('*')
  sourceNodes.forEach((srcEl, i) => {
    const cloneEl = cloneNodes[i] as HTMLElement
    if (!cloneEl) return
    // 已手写内联样式的元素（如 sup 角标）不覆盖
    if ((srcEl as HTMLElement).hasAttribute('style')) return
    const computed = window.getComputedStyle(srcEl)
    const inlined = INLINE_PROPS
      .map(p => `${p}:${computed.getPropertyValue(p)}`)
      .join(';')
    cloneEl.setAttribute('style', inlined)
  })
  const rootComputed = window.getComputedStyle(source)
  const rootInlined = INLINE_PROPS
    .map(p => `${p}:${rootComputed.getPropertyValue(p)}`)
    .join(';')
  clone.setAttribute('style', rootInlined)
  return clone
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// 把正文 HTML 放入带主题的离屏容器，用计算样式内联后取出；
// 脚注块样式在 WechatPreview 中是 scoped 的，这里直接以等值内联样式生成。
export function buildStyledWechatHtml(bodyHtml: string, footnotes: WxFootnote[], theme: string, referencesTitle: string): string {
  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;left:-99999px;top:0;width:680px;'
  const root = document.createElement('div')
  root.className = `wechat-preview theme-${theme}`
  root.innerHTML = bodyHtml
  host.appendChild(root)
  document.body.appendChild(host)
  try {
    let out = inlineComputedStyles(root).outerHTML
    if (footnotes.length) {
      const items = footnotes.map((f, i) =>
        `<li style="margin:3px 0;word-break:break-all;"><span style="color:#576b95;margin-right:4px;">[${i + 1}]</span><a href="${escapeHtml(f.url)}" style="color:#576b95;text-decoration:none;">${escapeHtml(f.text)}</a></li>`
      ).join('')
      out += `<div style="max-width:640px;margin:16px auto 0;padding:12px 16px;background:#fff;border-radius:4px;font-size:12px;color:#888;">` +
        `<div style="font-weight:600;margin-bottom:6px;color:#606266;">${escapeHtml(referencesTitle)}</div>` +
        `<ol style="padding-left:1.4em;margin:0;">${items}</ol></div>`
    }
    return out
  } finally {
    document.body.removeChild(host)
  }
}
