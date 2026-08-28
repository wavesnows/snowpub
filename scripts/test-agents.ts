// 自动化行为测试：AI 助手相关纯函数与适配器。
// 执行方式：node -r esbuild-register scripts/test-agents.ts 或走 esbuild 打包后跑
import assert from 'assert'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { AGENT_CLIS, stripAnsi, isAgentAvailable } from '../src/libs/aiAgents'
import {
  buildPolishPrompt,
  buildTitlePrompt,
  buildDigestPrompt,
  buildThemePrompt,
  extractJsonBlock,
} from '../src/libs/aiPrompts'
import { saveUserTheme, loadUserThemes, getWechatTheme, wechatThemes } from '../src/libs/wechatThemes'

let total = 0
let passed = 0

function test(name: string, fn: () => void | Promise<void>) {
  total++
  try {
    const res = fn()
    if (res instanceof Promise) {
      return res.then(
        () => {
          passed++
          console.log(`  ✓ ${name}`)
        },
        (e) => {
          console.error(`  ✗ ${name}:`, e)
        }
      )
    }
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}:`, e)
  }
}

async function run() {
  console.log('\n--- 1. CLI 适配器配置规范 ---')
  test('配置了 3 家且 ID 唯一', () => {
    assert.strictEqual(AGENT_CLIS.length, 3)
    const ids = AGENT_CLIS.map((c) => c.id)
    assert.deepStrictEqual(ids, ['claude', 'opencode', 'openclaw'])
  })

  test('各 CLI 均配置了安装指引与文档 URL', () => {
    for (const c of AGENT_CLIS) {
      assert.ok(c.install.command.length > 0, `${c.id} 缺少 install.command`)
      assert.ok(c.install.url.startsWith('http'), `${c.id} url 格式不对`)
      assert.ok(c.binNames.length > 0, `${c.id} 缺少 binNames`)
    }
  })

  test('claude 和 opencode 走 stdin，openclaw 走 argv', () => {
    const claude = AGENT_CLIS.find((c) => c.id === 'claude')!
    const opencode = AGENT_CLIS.find((c) => c.id === 'opencode')!
    const openclaw = AGENT_CLIS.find((c) => c.id === 'openclaw')!
    assert.strictEqual(claude.promptVia, 'stdin')
    assert.strictEqual(opencode.promptVia, 'stdin')
    assert.strictEqual(openclaw.promptVia, 'argv')
    assert.ok(openclaw.args('hello').includes('hello'))
  })

  test('本机至少能探测到一个可用 CLI（通常 claude 或 opencode 在 PATH）', () => {
    const anyAvail = AGENT_CLIS.some((c) => isAgentAvailable(c))
    assert.ok(anyAvail, '开发机未检测到任何 CLI')
  })

  console.log('\n--- 2. 输出清洗 ---')
  test('stripAnsi 剥除 CSI ANSI 颜色码，保留普通文本', () => {
    const colored = '[32mhello[0m [1mworld[0m'
    assert.strictEqual(stripAnsi(colored), 'hello world')
  })

  test('stripAnsi 不会破坏正常文章中的方括号文本', () => {
    const normal = '参考 [1] 和 [100m 标记测试'
    // 普通正文里若有 '[100m' 但前面没有 ESC 字符，不能被误删
    assert.ok(stripAnsi(normal).includes('[1]'))
  })

  console.log('\n--- 3. Prompt 构造器 ---')
  test('buildPolishPrompt 优先选区', () => {
    const p1 = buildPolishPrompt('选中内容', '全文内容')
    assert.ok(p1.includes('选中内容'))
    assert.ok(!p1.includes('全文内容'))
  })

  test('buildPolishPrompt 无选区时润色全文', () => {
    const p2 = buildPolishPrompt('', '全文内容')
    assert.ok(p2.includes('全文内容'))
  })

  test('buildTitlePrompt 包含 20 字与 5 个标题要求', () => {
    const p = buildTitlePrompt('测试文章')
    assert.ok(p.includes('5 个标题'))
    assert.ok(p.includes('20 字'))
  })

  test('buildDigestPrompt 包含 120 字限制', () => {
    const p = buildDigestPrompt('测试文章')
    assert.ok(p.includes('120 字'))
  })

  test('buildThemePrompt 注入了 theme.json 规范与白名单属性', () => {
    const p = buildThemePrompt('极简黑白')
    assert.ok(p.includes('Snowpub 公众号主题'))
    assert.ok(p.includes('theme.json'))
    assert.ok(p.includes('极简黑白'))
    assert.ok(p.includes('```json'))
  })

  console.log('\n--- 4. JSON 代码块提取 ---')
  test('从带 ```json 的 Markdown 中提取', () => {
    const md = '这是说明：\n```json\n{\n  "meta": {"name": "test"}\n}\n```\n希望你喜欢'
    const json = extractJsonBlock(md)
    assert.ok(json)
    assert.strictEqual(JSON.parse(json!).meta.name, 'test')
  })

  test('从裸 JSON 文本（无 fence）中提取', () => {
    const bare = '这里是主题：\n{"meta": {"name": "bare"}}\n以上就是全部'
    const json = extractJsonBlock(bare)
    assert.ok(json)
    assert.strictEqual(JSON.parse(json!).meta.name, 'bare')
  })

  test('无 JSON 时返回 null', () => {
    assert.strictEqual(extractJsonBlock('纯文字没有大括号'), null)
  })

  console.log('\n--- 5. 用户主题落盘与动态加载 ---')
  const tmpDir = path.join(os.tmpdir(), `snowpub-agent-test-${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  const validTheme = {
    meta: {
      name: 'wechat-custom-test',
      displayName: '自定义测试主题',
      author: 'tester',
      version: '1.0.0',
      specVersion: '1',
      dark: false,
    },
    vars: { primary: '#123456' },
    base: { 'font-size': '16px', 'line-height': '1.8', color: '#333' },
    elements: {
      h1: { 'font-size': '20px', color: '${primary}' },
      p: { margin: '1em 0' },
      img: { 'max-width': '100%' },
    },
  }

  test('saveUserTheme 校验并写入 themes/*.json 并合入注册表', () => {
    const res = saveUserTheme(tmpDir, validTheme)
    assert.strictEqual(res.name, 'wechat-custom-test')
    assert.strictEqual(res.displayName, '自定义测试主题')
    assert.ok(fs.existsSync(path.join(tmpDir, 'themes', 'wechat-custom-test.json')))
    assert.ok(wechatThemes.has('wechat-custom-test'))
    const compiled = getWechatTheme('wechat-custom-test')
    assert.strictEqual(compiled.meta.displayName, '自定义测试主题')
  })

  test('saveUserTheme 拒绝覆盖内置主题名', () => {
    assert.throws(() => {
      saveUserTheme(tmpDir, { ...validTheme, meta: { ...validTheme.meta, name: 'wechat-green' } })
    }, /内置主题名/)
  })

  test('loadUserThemes 重新扫描目录并加载合法主题', () => {
    // 先手动清掉注册表里的项，测试从文件恢复
    wechatThemes.delete('wechat-custom-test')
    const loaded = loadUserThemes(tmpDir)
    assert.strictEqual(loaded.length, 1)
    assert.strictEqual(loaded[0].name, 'wechat-custom-test')
    assert.ok(wechatThemes.has('wechat-custom-test'))
  })

  // 清理临时目录
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {}

  console.log(`\n结果: ${passed}/${total} 通过`)
  if (passed !== total) process.exit(1)
}

run()
