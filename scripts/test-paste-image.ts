// saveClipboardImage 行为验证：落盘 / 去重 / 目录创建 / 类型过滤
// 运行: npx esbuild scripts/test-paste-image.ts --bundle --format=esm --platform=node --outfile=node_modules/.cache/test-paste-image.mjs && node node_modules/.cache/test-paste-image.mjs
import { File } from 'node:buffer'
import { mkdtempSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveClipboardImage } from '../src/libs/pasteImage'

const dir = mkdtempSync(join(tmpdir(), 'paste-img-'))
const pngA = new File([Buffer.from('fake-png-bytes-A')], 'a.png', { type: 'image/png' })
const pngACopy = new File([Buffer.from('fake-png-bytes-A')], 'a2.png', { type: 'image/png' })
const pngB = new File([Buffer.from('fake-png-bytes-B')], 'b.png', { type: 'image/png' })
const svg = new File([Buffer.from('<svg/>')], 'c.svg', { type: 'image/svg+xml' })

let pass = 0, fail = 0
function check(name: string, cond: boolean) {
  console.log(`${cond ? '✓' : '✗'} ${name}`)
  cond ? pass++ : fail++
}

const rel1 = await saveClipboardImage(pngA, dir)
check('返回 imgs/<hash>.png 相对路径', !!rel1 && rel1.startsWith('imgs/') && rel1.endsWith('.png'))
check('文件落盘且 imgs/ 目录自动创建', !!rel1 && existsSync(join(dir, rel1)))

const rel2 = await saveClipboardImage(pngACopy, dir)
check('同内容重复粘贴 → 同一路径（去重）', rel1 === rel2)
check('去重后目录里仍只有 1 个文件', readdirSync(join(dir, 'imgs')).length === 1)

const rel3 = await saveClipboardImage(pngB, dir)
check('不同内容 → 不同路径', rel3 !== rel1 && readdirSync(join(dir, 'imgs')).length === 2)

const relSvg = await saveClipboardImage(svg, dir)
check('svg 不支持 → 返回 null', relSvg === null)

rmSync(dir, { recursive: true, force: true })
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
