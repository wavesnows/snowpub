// textSanitize 行为验证：emoji/特殊符号检测与移除，常用字符不误杀
// 运行: npx esbuild scripts/test-sanitize.ts --bundle --format=esm --platform=node --outfile=node_modules/.cache/test-sanitize.mjs && node node_modules/.cache/test-sanitize.mjs
import { findUnsupportedChars, stripUnsupportedChars } from '../src/libs/textSanitize'

let pass = 0, fail = 0
function check(name: string, cond: boolean) {
  console.log(`${cond ? '✓' : '✗'} ${name}`)
  cond ? pass++ : fail++
}

// ── findUnsupportedChars ──
check('纯文本 → 空', findUnsupportedChars('普通中文 English 123，。！？').length === 0)
check('检出代理对 emoji', findUnsupportedChars('标题 😊 完成').join('') === '😊')
check('检出 Dingbats emoji（✅ BMP 内）', findUnsupportedChars('完成 ✅').length === 1)
check('检出 ⭐（U+2B50）', findUnsupportedChars('推荐 ⭐ 必读').length === 1)
check('多种字符去重', findUnsupportedChars('😊😊🔥a😊').length === 2)
check('检出私用区字符', findUnsupportedChars('icon \uE000 end').length === 1)
check('变体选择符 FE0F 检出', findUnsupportedChars('心 ❤️ 形').length >= 1)
check('BMP 老符号不误杀（© ™ → ← ★）', findUnsupportedChars('版权 © 商标 ™ 箭头 → 强调 ★').length === 0)
check('空输入 → 空', findUnsupportedChars('').length === 0)

// ── stripUnsupportedChars ──
check('移除 emoji 保留文字', stripUnsupportedChars('发布 ✅ 成功 🎉🎉') === '发布  成功 ')
check('中英文标点保留', stripUnsupportedChars('你好，world！"引号"（括号）【书名号】') === '你好，world！"引号"（括号）【书名号】')
check('无高风险字符时原样返回', stripUnsupportedChars('abc 123') === 'abc 123')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
