// 内置 + 用户自定义公众号主题。
// 启动时编译内置 12 套；通过 loadUserThemes() 动态扫描 <notebook>/themes/*.json 并合并入注册表。
// 用户主题以 spec.meta.displayName 作为展示名，未命中的 getWechatTheme 回退到 wechat-green。
import { reactive } from 'vue'
import fs from 'fs'
import path from 'path'
import greenJson from '@/themes/wechat-green.json'
import blackJson from '@/themes/wechat-black.json'
import orangeJson from '@/themes/wechat-orange.json'
import defaultJson from '@/themes/wechat-default.json'
import blueJson from '@/themes/wechat-blue.json'
import redJson from '@/themes/wechat-red.json'
import serifJson from '@/themes/wechat-serif.json'
import warmJson from '@/themes/wechat-warm.json'
import morandiJson from '@/themes/wechat-morandi.json'
import pinkJson from '@/themes/wechat-pink.json'
import nightJson from '@/themes/wechat-night.json'
import bambooJson from '@/themes/wechat-bamboo.json'
import { compileTheme } from '@/libs/theme/compile'
import type { CompiledTheme } from '@/libs/theme/types'
import { log } from '@/libs/logger'

// reactive：用户主题写入后预览下拉/渲染 computed 自动刷新，无需手动 bump
export const wechatThemes = reactive(new Map<string, CompiledTheme>())

const BUILTIN_JSONS = [
  greenJson, blackJson, orangeJson, defaultJson,
  blueJson, redJson, serifJson, warmJson,
  morandiJson, pinkJson, nightJson, bambooJson,
]

function initBuiltins(): void {
  for (const json of BUILTIN_JSONS) {
    const { theme } = compileTheme(json)
    wechatThemes.set(theme.meta.name, theme)
  }
}

initBuiltins()

/** 按机器名取已编译主题；未命中时回退到 wechat-green。 */
export function getWechatTheme(name: string): CompiledTheme {
  return wechatThemes.get(name) ?? wechatThemes.get('wechat-green')!
}

/** 是否为内置主题（不可被同名用户文件覆盖） */
export function isBuiltinTheme(name: string): boolean {
  return BUILTIN_JSONS.some((j) => (j as { meta?: { name?: string } }).meta?.name === name)
}

/**
 * 校验并把用户主题写入 <notebook>/themes/<name>.json，同时合入注册表。
 * raw 为任意来源（如 AI 输出的 JSON 块）；不合规抛 ThemeCompileError，交由调用方提示。
 * @returns 新主题的机器名与展示名
 */
export function saveUserTheme(notebookPath: string, raw: unknown): { name: string; displayName: string } {
  const { theme } = compileTheme(raw)
  const name = theme.meta.name
  if (isBuiltinTheme(name)) {
    throw new Error(`"${name}" 是内置主题名，请在 JSON 的 meta.name 里换一个`)
  }
  const dir = path.join(notebookPath, 'themes')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(raw, null, 2))
  wechatThemes.set(name, theme)
  return { name, displayName: theme.meta.displayName || name }
}

/**
 * 扫描指定笔记本目录下的 themes/*.json，编译并合入注册表。
 * 返回成功加载的用户主题列表（name + displayName）。
 * 文件损坏/不合规静默跳过（记录 debug log），保证应用稳定性。
 */
export function loadUserThemes(notebookPath: string): Array<{ name: string; displayName: string }> {
  if (!notebookPath) return []
  const dir = path.join(notebookPath, 'themes')
  if (!fs.existsSync(dir)) return []

  // 清除旧的用户主题（保留内置）
  const builtinNames = new Set(BUILTIN_JSONS.map((j) => (j as { meta: { name: string } }).meta.name))
  for (const k of [...wechatThemes.keys()]) {
    if (!builtinNames.has(k)) wechatThemes.delete(k)
  }

  const loaded: Array<{ name: string; displayName: string }> = []
  let files: string[] = []
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  } catch (e) {
    log('Failed to read user themes dir', e)
    return []
  }

  for (const file of files) {
    const full = path.join(dir, file)
    try {
      const raw = fs.readFileSync(full, 'utf-8')
      const json = JSON.parse(raw)
      const { theme } = compileTheme(json)
      const name = theme.meta.name
      // 避免与内置重名发生冲突
      if (builtinNames.has(name)) {
        log(`User theme ${file} uses reserved builtin name ${name}, ignored`)
        continue
      }
      wechatThemes.set(name, theme)
      loaded.push({ name, displayName: theme.meta.displayName || name })
    } catch (e) {
      log(`User theme ${file} skipped due to error:`, e)
    }
  }

  return loaded
}
