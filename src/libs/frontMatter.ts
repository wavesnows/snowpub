// 公众号笔记 front matter 解析
// 笔记文件头部支持如下格式：
//   ---
//   title: 文章标题
//   author: 作者名
//   digest: 摘要（可选）
//   cover: ./images/cover.png  （可选，相对笔记所在目录）
//   ---
// 发布时自动读取这些字段作为默认值。

export interface FrontMatterData {
  title?: string
  author?: string
  digest?: string
  cover?: string
}

export interface ParsedMarkdown {
  data: FrontMatterData
  body: string
}

const FM_RE = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/

function unquote(v: string): string {
  const s = v.trim()
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    return s.slice(1, -1)
  }
  return s
}

export function parseFrontMatter(markdown: string): ParsedMarkdown {
  const empty: ParsedMarkdown = { data: {}, body: markdown || '' }
  if (!markdown) return empty
  const m = markdown.match(FM_RE)
  if (!m) return empty

  const data: FrontMatterData = {}
  for (const rawLine of m[1].split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/)
    if (!kv) continue
    const key = kv[1].toLowerCase()
    // 行内注释：值之后的 "  #" 或 '  #' 截断
    let value = kv[2].replace(/\s+#.*$/, '').trim()
    value = unquote(value)
    if (!value) continue
    if (key === 'title') data.title = value
    else if (key === 'author') data.author = value
    else if (key === 'digest') data.digest = value
    else if (key === 'cover') data.cover = value
  }
  return { data, body: markdown.slice(m[0].length) }
}

// 渲染前剥离 front matter，避免泄露到预览/HTML
export function stripFrontMatter(markdown: string): string {
  if (!markdown) return ''
  const m = markdown.match(FM_RE)
  return m ? markdown.slice(m[0].length) : markdown
}
