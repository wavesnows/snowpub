// 摘要自动生成：markdown 正文 → 纯文本 → 截取。
// 用于发布对话框 digest 为空时的预填（用户可改），与微信自己的默认摘要（前 54 字）无关。
import { stripFrontMatter } from './frontMatter'
import { extractArticle } from './articleStructure'

/** 去掉 markdown 标记，提取可读纯文本（图片整块丢弃，链接保留文字）。 */
export function markdownToPlainText(markdown: string): string {
  return (markdown || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接 → 文字
    .replace(/<[^>]+>/g, ' ') // HTML 标签
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // 标题记号
    .replace(/^\s{0,3}>\s?/gm, '') // 引用记号
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '') // 任务列表
    .replace(/^\s*[-*+]\s+/gm, '') // 无序列表
    .replace(/^\s*\d+\.\s+/gm, '') // 有序列表
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ') // 分隔线
    .replace(/`{3}[\s\S]*?`{3}/g, ' ') // 代码块
    .replace(/`([^`]*)`/g, '$1') // 行内代码
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // 粗体
    .replace(/(\*|_)(.*?)\1/g, '$2') // 斜体
    .replace(/~~(.*?)~~/g, '$1') // 删除线
    .replace(/\s+/g, ' ') // 合并空白
    .trim()
}

/** 生成摘要：剥 front matter、按 `# 标题`/`## 内容` 约定取正文，纯文本前 maxLen 字，截断补省略号。 */
export function generateDigest(markdown: string, maxLen = 120): string {
  let body = stripFrontMatter(markdown || '')
  const art = extractArticle(body)
  if (art.matched) body = art.body
  const text = markdownToPlainText(body)
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '…'
}
