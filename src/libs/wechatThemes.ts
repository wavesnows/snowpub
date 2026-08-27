// 内置公众号主题：模块加载时编译一次，供预览 / 发布共用。
// 内置 JSON 编译失败视为构建期 bug，直接抛出（builtin 不应出错）。
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

export const wechatThemes: Map<string, CompiledTheme> = new Map()
for (const json of [
  greenJson, blackJson, orangeJson, defaultJson,
  blueJson, redJson, serifJson, warmJson,
  morandiJson, pinkJson, nightJson, bambooJson,
]) {
  const { theme } = compileTheme(json)
  wechatThemes.set(theme.meta.name, theme)
}

/** 按机器名取已编译主题；未命中时回退到 wechat-green。 */
export function getWechatTheme(name: string): CompiledTheme {
  return wechatThemes.get(name) ?? wechatThemes.get('wechat-green')!
}
