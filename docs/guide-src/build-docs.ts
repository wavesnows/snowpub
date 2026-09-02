// 文档站渲染:guide-src/pages/*.md → docs/guide/*.html
// 模式沿用 theme:samples:esbuild bundle 后由 node 执行
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import MarkdownIt from 'markdown-it'
import container from 'markdown-it-container'
import { buildPage, type NavLink } from './template'

export type PageDef = { file: string; title: string; desc: string }
export const PAGES: PageDef[] = [
  { file: 'index',   title: '快速开始', desc: '5 分钟跑通安装、配置、发布全流程' },
  { file: 'install', title: '安装与更新', desc: '下载、系统要求、install.sh 与自动更新' },
  { file: 'wechat',  title: '公众号接入', desc: 'AppID/AppSecret、IP 白名单、测试连接' },
  { file: 'publish', title: '写作与发布', desc: '双栏编辑、微信预览、发布对话框、草稿箱' },
  { file: 'cover',   title: '图片与封面', desc: '粘贴传图、素材库、智能封面三档比例' },
  { file: 'faq',     title: '常见问题', desc: '48001、连接失败、AI 助手、Git 同步' },
]

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

const md = new MarkdownIt({ html: false, linkify: true, breaks: false })
  .use(container, 'tip', {
    // ::: tip → <div class="admonition tip">
    render(tokens, idx) {
      return tokens[idx].nesting === 1 ? '<div class="admonition tip">\n' : '</div>\n'
    },
  })
  .use(container, 'warning', {
    // ::: warning → <div class="admonition warning">
    render(tokens, idx) {
      return tokens[idx].nesting === 1 ? '<div class="admonition warning">\n' : '</div>\n'
    },
  })

export function renderMarkdown(src: string): string {
  return md.render(src)
}

async function main(): Promise<void> {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const REPO_ROOT = findRepoRoot(__dirname)
  const PAGES_DIR = join(REPO_ROOT, 'docs/guide-src/pages')
  const OUT_DIR = join(REPO_ROOT, 'docs/guide')
  const IMG_SRC = join(REPO_ROOT, 'docs/guide-src/img')

  await mkdir(OUT_DIR, { recursive: true })

  // 侧边栏与上一页/下一页共用同一份 nav，按清单顺序
  const nav: NavLink[] = PAGES.map((p) => ({ href: `${p.file}.html`, label: p.title, desc: p.desc }))

  for (let i = 0; i < PAGES.length; i++) {
    const p = PAGES[i]
    const srcPath = join(PAGES_DIR, `${p.file}.md`)
    if (!existsSync(srcPath)) {
      console.warn(`skip ${p.file}.md (not yet written)`)
      continue
    }
    const raw = await readFile(srcPath, 'utf8')
    const html = buildPage({
      title: p.title,
      desc: p.desc,
      body: renderMarkdown(raw),
      nav,
      prev: i > 0 ? nav[i - 1] : undefined,
      next: i < nav.length - 1 ? nav[i + 1] : undefined,
    })
    await writeFile(join(OUT_DIR, `${p.file}.html`), html, 'utf8')
    console.log(`✓ ${p.file} → docs/guide/${p.file}.html`)
  }

  // 截图等静态资源:guide-src/img/ 整目录拷到 docs/guide/img/（cp -r 语义）
  if (existsSync(IMG_SRC)) {
    await cp(IMG_SRC, join(OUT_DIR, 'img'), { recursive: true })
    console.log('✓ img → docs/guide/img')
  }
}

// import-guard：仅作为入口脚本执行时构建。esbuild 打包后 import.meta.url 恒指向产物文件——
// 测试文件把本模块内联进 test-docs-build.mjs 时，URL 等值判断（import.meta.url ===
// pathToFileURL(process.argv[1]).href）对入口与被导入同样为真，无法阻止 import 触发构建；
// 故按入口文件名判断（docs:build 与测试命令的 outfile 均为 build-docs.mjs）
const isEntry = /build-docs\.(mjs|ts)$/.test(process.argv[1] ?? '')
if (isEntry) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
