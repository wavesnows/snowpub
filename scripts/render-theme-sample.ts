// 黄金文件生成器：固定 markdown fixture × 4 主题 → docs/theme-samples/<name>.html
// Node 直跑，无 DOM 依赖；esbuild 打包后由 node 执行
import { readdirSync, existsSync } from 'node:fs'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileTheme } from '../src/libs/theme/compile'
import { renderThemedArticle } from '../src/libs/theme/decorate'

// esbuild 把脚本打包到 node_modules/.cache/，import.meta.url 指向缓存文件而非源文件；
// 从缓存位置向上查找包含 src/themes/ 的目录作为仓库根，对任意 cwd 都稳定
function findRepoRoot(start: string): string {
  let dir = start
  while (true) {
    if (existsSync(join(dir, 'src/themes'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`repo root not found from ${start}`)
    dir = parent
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = findRepoRoot(__dirname)
const THEMES_DIR = join(REPO_ROOT, 'src/themes')
const FIXTURE = join(REPO_ROOT, 'scripts/theme-sample-fixture.md')
const OUT_DIR = join(REPO_ROOT, 'docs/theme-samples')

async function main(): Promise<void> {
  const markdown = await readFile(FIXTURE, 'utf8')
  const files = readdirSync(THEMES_DIR).filter((f) => f.endsWith('.json'))

  await mkdir(OUT_DIR, { recursive: true })

  for (const file of files) {
    const path = join(THEMES_DIR, file)
    const raw = JSON.parse(await readFile(path, 'utf8')) as unknown
    const { theme, warnings } = compileTheme(raw)
    const html = renderThemedArticle(markdown, theme, 'References')
    const outPath = join(OUT_DIR, `${theme.meta.name}.html`)
    const doc =
      `<!doctype html><meta charset="utf-8">` +
      `<title>snowpub theme: ${theme.meta.name}</title>` +
      `<body style="margin:0;background:#f5f5f5;">` +
      html +
      `</body>`
    await writeFile(outPath, doc, 'utf8')
    const rel = outPath.slice(REPO_ROOT.length + 1)
    console.log(`✓ ${theme.meta.name} → ${rel}`)
    for (const w of warnings) console.log(`  ⚠ ${w}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
