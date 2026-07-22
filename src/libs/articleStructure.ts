// 公众号文章结构约定：笔记 = `# 标题` + 元信息区 + `## 内容` + 正文
// 命中约定时：标题取 H1 文本，正文取 `## 内容` 之后的部分（H1 与元信息区不进正文）

export interface ArticleStructure {
  /** H1 标题文本（无 H1 时为空串） */
  title: string
  /** `## 内容` 之后的正文（未命中约定时为整个文档） */
  body: string
  /** 是否命中 `# 标题 … ## 内容` 结构约定 */
  matched: boolean
}

const H1_RE = /^#\s+(.+?)\s*$/m
const CONTENT_H2_RE = /^##\s+内容\s*$/m

export function extractArticle(markdown: string): ArticleStructure {
  const h2 = markdown.match(CONTENT_H2_RE)
  if (!h2 || h2.index === undefined) {
    const h1 = markdown.match(H1_RE)
    return { title: h1?.[1]?.trim() || '', body: markdown, matched: false }
  }
  // 标题只从 `## 内容` 之前的部分取（避免把正文里的 H1 误当标题）
  const before = markdown.slice(0, h2.index)
  const h1 = before.match(H1_RE)
  const body = markdown.slice(h2.index + h2[0].length).replace(/^[ \t]*\r?\n/, '')
  return { title: h1?.[1]?.trim() || '', body, matched: true }
}
