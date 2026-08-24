// 主题系统类型定义（theme.json spec v1）
// compile.ts 只依赖本文件，不引入 DOM / 第三方依赖

export interface ThemeMeta {
  name: string          // 机器名，小写 kebab，唯一
  displayName: string   // UI 展示名
  author: string
  version: string
  description?: string
  dark?: boolean
  specVersion: '1'
}

export type ElementKey =
  | 'heading' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'p' | 'strong' | 'em' | 'del' | 'sup'
  | 'a' | 'code' | 'img'
  | 'blockquote' | 'pre' | 'preCode' | 'ul' | 'ol' | 'li' | 'hr'
  | 'table' | 'th' | 'td'
  | 'footnoteRef' | 'footnoteBlock' | 'footnoteTitle' | 'footnoteItem' | 'footnoteLink'

// kebab-case CSS 属性 → 值
export type StyleProps = Record<string, string>

export interface ThemeJson {
  meta: ThemeMeta
  vars?: Record<string, string>
  base: StyleProps
  elements: Partial<Record<ElementKey, StyleProps>>
}

export interface CompiledTheme {
  meta: ThemeMeta
  /** 给定元素键的最终 style 字符串（kebab-case；'base' 为根 <section>）。已缓存。 */
  styleFor(key: ElementKey | 'base'): string
  /** 合并/白名单过滤后的每个键的 props（调试/黄金文件用） */
  readonly resolved: Readonly<Record<string, StyleProps>>
}
