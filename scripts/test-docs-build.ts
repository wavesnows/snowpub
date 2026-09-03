// build-docs 渲染管线验证：清单驱动、模板套壳、提示框、幂等
// 运行: npx esbuild scripts/test-docs-build.ts --bundle --format=esm --platform=node --outfile=node_modules/.cache/test-docs-build.mjs && node node_modules/.cache/test-docs-build.mjs
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

let pass = 0, fail = 0
function check(name: string, cond: boolean) {
  console.log(`${cond ? '✓' : '✗'} ${name}`)
  cond ? pass++ : fail++
}

function findRepoRoot(start: string): string {
  let dir = start
  while (true) {
    if (existsSync(join(dir, 'src/themes'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`repo root not found from ${start}`)
    dir = parent
  }
}
const REPO_ROOT = findRepoRoot(dirname(fileURLToPath(import.meta.url)))
const GUIDE_OUT = join(REPO_ROOT, 'docs/guide')

// 0) 渲染脚本先跑一遍（幂等前提：产物已存在）
execSync('npx esbuild docs/guide-src/build-docs.ts --bundle --format=esm --platform=node --outfile=node_modules/.cache/build-docs.mjs && node node_modules/.cache/build-docs.mjs', { cwd: REPO_ROOT, stdio: 'pipe' })

// 1) 清单里每个已写源文件的页面都有产物（清单先行，未写的页面由后续任务补齐）
import { PAGES } from '../docs/guide-src/build-docs'
for (const p of PAGES) {
  if (!existsSync(join(REPO_ROOT, 'docs/guide-src/pages', p.file + '.md'))) continue
  check(`产物存在: guide/${p.file}.html`, existsSync(join(GUIDE_OUT, p.file + '.html')))
}

// 2) 模板套壳:首尾结构完整
const idx = readFileSync(join(GUIDE_OUT, 'index.html'), 'utf8')
check('index.html 有 doctype', idx.startsWith('<!DOCTYPE html>') || idx.startsWith('<!doctype html>'))
check('index.html 有侧边栏', idx.includes('class="sidebar"'))
check('index.html 有上一页/下一页', idx.includes('class="pager"'))
check('index.html lang=zh-CN', idx.includes('lang="zh-CN"'))

// 3) 提示框 container 渲染
check('container: 有页面用到 tip/warning', PAGES.some(p =>
  existsSync(join(GUIDE_OUT, p.file + '.html')) &&
  readFileSync(join(GUIDE_OUT, p.file + '.html'), 'utf8').includes('class="admonition')))

// 4) 幂等:连跑两遍，git 状态与产物内容均无变化
// （porcelain 对全新未跟踪目录折叠成 ?? docs/guide/，内容漂移抓不到，故补内容快照比对）
const snapshot = () => readdirSync(GUIDE_OUT).filter((f) => f.endsWith('.html'))
  .map((f) => f + '\n' + readFileSync(join(GUIDE_OUT, f), 'utf8')).join('\n===\n')
const before = execSync('git status --porcelain docs/guide', { cwd: REPO_ROOT }).toString()
const beforeSnap = snapshot()
execSync('npx esbuild docs/guide-src/build-docs.ts --bundle --format=esm --platform=node --outfile=node_modules/.cache/build-docs.mjs && node node_modules/.cache/build-docs.mjs', { cwd: REPO_ROOT, stdio: 'pipe' })
const after = execSync('git status --porcelain docs/guide', { cwd: REPO_ROOT }).toString()
check('幂等:重跑后 git 状态无新变化', before === after)
check('幂等:重跑后产物内容逐字节一致', beforeSnap === snapshot())

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
