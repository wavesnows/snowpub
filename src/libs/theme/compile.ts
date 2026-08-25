// 主题编译器：theme.json（外部输入） → CompiledTheme
// 纯函数、无 DOM 依赖，Node 直跑；校验所有致命问题后一次性抛出
import type {
  CompiledTheme, ElementKey, StyleProps, ThemeJson, ThemeMeta
} from './types'

export class ThemeCompileError extends Error {}

export interface CompileResult {
  theme: CompiledTheme
  warnings: string[]   // 未知元素键 / 未知属性被丢弃
}

// 属性白名单（kebab-case；与 CSS 属性名一致）
const PROP_WHITELIST = new Set<string>([
  'color', 'background', 'background-color', 'font-size', 'font-weight', 'font-style', 'font-family',
  'line-height', 'letter-spacing', 'text-align', 'vertical-align',
  'padding', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom',
  'margin', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom',
  'border', 'border-left', 'border-right', 'border-top', 'border-bottom', 'border-radius', 'border-collapse',
  'text-decoration', 'list-style-type', 'width', 'max-width', 'word-break', 'white-space',
  'overflow-wrap', 'overflow-x',
])

// 元素键全集（运行时校验未知键用）
const ELEMENT_KEYS: ReadonlySet<ElementKey> = new Set<ElementKey>([
  'heading', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'strong', 'em', 'del', 'sup',
  'a', 'code', 'img',
  'blockquote', 'pre', 'preCode', 'ul', 'ol', 'li', 'hr',
  'table', 'th', 'td',
  'footnoteRef', 'footnoteBlock', 'footnoteTitle', 'footnoteItem', 'footnoteLink',
])

const H_LEVELS: ElementKey[] = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

// 危险值模式：url(/expression(/javascript:
const DANGER_RE = /url\s*\(|expression\s*\(|javascript\s*:/i

// 变量引用：${name}，name = 字母开头 + 字母数字下划线连字符
const VAR_REF_RE = /\$\{([a-zA-Z][\w-]*)\}/g

// 合并 dst ← src，src 同名属性覆盖 dst（保持 dst 的插入顺序）
function mergeUnder(dst: StyleProps, src: StyleProps): StyleProps {
  const out: StyleProps = { ...dst }
  for (const k of Object.keys(src)) out[k] = src[k]
  return out
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isStringRecord(v: unknown): v is Record<string, string> {
  if (!isPlainObject(v)) return false
  for (const k of Object.keys(v)) {
    if (typeof (v as Record<string, unknown>)[k] !== 'string') return false
  }
  return true
}

export function compileTheme(input: unknown): CompileResult {
  const problems: string[] = []
  const warnings: string[] = []

  // 1. 顶层对象校验
  if (!isPlainObject(input)) {
    throw new ThemeCompileError('theme must be a plain object')
  }
  const root = input as Record<string, unknown>

  // 2. meta 校验
  if (!isPlainObject(root.meta)) {
    throw new ThemeCompileError('meta must be an object')
  }
  const m = root.meta as Record<string, unknown>
  const reqStr = ['name', 'displayName', 'author', 'version'] as const
  for (const k of reqStr) {
    const v = m[k]
    if (typeof v !== 'string' || v.trim() === '') {
      problems.push(`meta.${k} must be a non-empty string`)
    }
  }
  // specVersion：缺省 → '1'，不报错；存在但非 '1' → 致命
  if (m.specVersion !== undefined && m.specVersion !== null && m.specVersion !== '1') {
    problems.push(`meta.specVersion must be "1" (got ${JSON.stringify(m.specVersion)})`)
  }
  if (m.dark !== undefined && typeof m.dark !== 'boolean') {
    problems.push('meta.dark must be boolean if present')
  }
  if (m.description !== undefined && typeof m.description !== 'string') {
    problems.push('meta.description must be a string if present')
  }

  // 3. base 校验
  if (!isStringRecord(root.base)) {
    problems.push('base must be an object of string→string')
  }

  // 4. elements 校验（结构：键→字符串字典）
  if (!isPlainObject(root.elements)) {
    problems.push('elements must be an object')
  }

  // 5. vars 校验（结构：键→字符串）
  let vars: Record<string, string> = {}
  if (root.vars !== undefined) {
    if (isStringRecord(root.vars)) {
      vars = { ...(root.vars as Record<string, string>) }
    } else {
      problems.push('vars must be an object of string→string')
    }
  }

  if (problems.length) {
    throw new ThemeCompileError(problems.join('; '))
  }

  // 至此结构合法，做类型断言
  const theme = root as unknown as ThemeJson
  // 给 meta 填上 specVersion（缺省时已设为 '1'）
  const meta: ThemeMeta = {
    name: theme.meta.name,
    displayName: theme.meta.displayName,
    author: theme.meta.author,
    version: theme.meta.version,
    specVersion: '1',
    ...(theme.meta.description !== undefined ? { description: theme.meta.description } : {}),
    ...(theme.meta.dark !== undefined ? { dark: theme.meta.dark } : {}),
  }

  // 6. vars 自身迭代替换（最多 5 趟，仍残留 ${ 视为嵌套/未定义 → 致命）
  // 用内联字面量做 .test()，避免全局 regex 的 lastIndex 状态污染
  const hasVarRef = (s: string) => /\$\{([a-zA-Z][\w-]*)\}/.test(s)
  const resolveVars = (scope: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const k of Object.keys(scope)) {
      let val = scope[k]
      let passes = 0
      while (hasVarRef(val) && passes < 5) {
        val = val.replace(VAR_REF_RE, (_, name: string) => {
          if (Object.prototype.hasOwnProperty.call(scope, name)) return scope[name]
          // 未定义引用：先标记，外层收集为致命错误
          return `@@UNDEF:${name}@@`
        })
        passes++
      }
      out[k] = val
    }
    return out
  }

  const resolvedVars = resolveVars(vars)
  // 未定义引用检测
  for (const k of Object.keys(vars)) {
    const undefMatch = resolvedVars[k].match(/@@UNDEF:([a-zA-Z][\w-]*)@@/)
    if (undefMatch) {
      problems.push(`vars.${k} references undefined var "${undefMatch[1]}"`)
    }
    // 仍残留 ${ 视为嵌套（5 趟后还有），致命
    if (/\$\{/.test(resolvedVars[k])) {
      problems.push(`vars.${k} contains nested/recursive var reference (not resolved after 5 passes)`)
    }
    // 危险值
    if (DANGER_RE.test(resolvedVars[k])) {
      problems.push(`vars.${k} contains forbidden value pattern (url(/expression(/javascript:)`)
    }
    // 清除 UNDEF 标记后落回原值（致命已收集）
    resolvedVars[k] = resolvedVars[k].replace(/@@UNDEF:[a-zA-Z][\w-]*@@/g, '')
  }

  // 7. 对 base / elements 中每个值做变量替换 + 危险值 + 残留 ${
  const substituteValue = (srcKey: string, raw: string): string => {
    // 替换 vars
    let val = raw.replace(VAR_REF_RE, (_, name: string) => {
      if (Object.prototype.hasOwnProperty.call(resolvedVars, name)) return resolvedVars[name]
      problems.push(`${srcKey} references undefined var "${name}"`)
      return ''
    })
    // 残留 ${ → 嵌套/未定义，致命
    if (/\$\{/.test(val)) {
      problems.push(`${srcKey} contains nested/undefined var reference: "${raw}"`)
    }
    // 危险值
    if (DANGER_RE.test(val)) {
      problems.push(`${srcKey} contains forbidden value pattern (url(/expression(/javascript:)`)
    }
    return val
  }

  // 8. 合并并过滤：base 自身；heading 合并到 h1..h6；其余元素独立
  // 注：base 不继承到元素（渲染期根 <section> 的 CSS 继承负责）
  const filterProps = (srcKey: string, props: StyleProps): StyleProps => {
    const out: StyleProps = {}
    for (const k of Object.keys(props)) {
      if (!PROP_WHITELIST.has(k)) {
        warnings.push(`unknown property "${k}" in ${srcKey} dropped`)
        continue
      }
      out[k] = substituteValue(`${srcKey}.${k}`, props[k])
    }
    return out
  }

  const resolved: Record<string, StyleProps> = {}

  // base
  resolved['base'] = filterProps('base', theme.base)

  // heading 块本身（styleFor('heading') 返回这个）
  const headingProps = theme.elements.heading ?? {}
  const filteredHeading = filterProps('elements.heading', headingProps)
  resolved['heading'] = filteredHeading

  // h1..h6：默认继承 heading props；若定义了 h{n}，则 heading 合并 UNDER h{n}（h{n} 冲突时胜出）
  // 即使主题未定义某一级，styleFor(h{n}) 仍返回 heading 的样式
  for (const h of H_LEVELS) {
    const ep = theme.elements[h]
    resolved[h] = ep
      ? mergeUnder(filteredHeading, filterProps(`elements.${h}`, ep))
      : { ...filteredHeading }
  }

  // 其余元素：独立处理；未知键告警并忽略
  for (const k of Object.keys(theme.elements) as ElementKey[]) {
    if (k === 'heading' || H_LEVELS.includes(k)) continue
    if (!ELEMENT_KEYS.has(k)) {
      warnings.push(`unknown element key "${k}" ignored`)
      continue
    }
    const ep = theme.elements[k]!
    resolved[k] = filterProps(`elements.${k}`, ep)
  }

  // 若上面收集到致命问题，一次性抛出
  if (problems.length) {
    throw new ThemeCompileError(problems.join('; '))
  }

  // 9. 强制：img 永远带 max-width:100%，且追加在主题 props 之后（主题无法覆盖）
  // 先剥离主题自带的 max-width，再追加我们强制的值
  const imgBase: StyleProps = { ...(resolved['img'] ?? {}) }
  delete imgBase['max-width']
  imgBase['max-width'] = '100%'
  resolved['img'] = imgBase

  // 10. styleFor：拼接成 "prop:value;prop:value"，无尾分号，确定性顺序（插入序）
  const styleCache = new Map<ElementKey | 'base', string>()
  const styleFor = (key: ElementKey | 'base'): string => {
    const cached = styleCache.get(key)
    if (cached !== undefined) return cached
    const props = resolved[key] ?? {}
    const parts: string[] = []
    for (const k of Object.keys(props)) parts.push(`${k}:${props[k]}`)
    const s = parts.join(';')
    styleCache.set(key, s)
    return s
  }

  const compiled: CompiledTheme = {
    meta,
    styleFor,
    get resolved(): Readonly<Record<string, StyleProps>> {
      return resolved
    },
  }

  return { theme: compiled, warnings }
}
