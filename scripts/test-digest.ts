// generateDigest / markdownToPlainText 行为验证：front matter 剥离、结构约定取正文、markdown 标记清理、长度截断
// 运行: npx esbuild scripts/test-digest.ts --bundle --format=esm --platform=node --outfile=node_modules/.cache/test-digest.mjs && node node_modules/.cache/test-digest.mjs
import { generateDigest, markdownToPlainText } from '../src/libs/digest'

let pass = 0, fail = 0
function check(name: string, cond: boolean) {
  console.log(`${cond ? '✓' : '✗'} ${name}`)
  cond ? pass++ : fail++
}

// 1. 纯文本提取：标记清理
const plain = markdownToPlainText('# 标题\n\n**粗体** 和 *斜体*、`code`，[链接文字](https://a.com)，![图](x.png)\n\n> 引用内容\n- 列表项')
check('图片整块丢弃', !plain.includes('x.png') && !plain.includes('!['))
check('链接保留文字', plain.includes('链接文字') && !plain.includes('https://a.com'))
check('粗斜体/代码记号去除', plain.includes('粗体') && plain.includes('斜体') && plain.includes('code') && !plain.includes('**') && !plain.includes('`'))
check('标题/引用/列表记号去除', !plain.includes('#') && !plain.includes('>'))

// 2. 完整 markdown → 摘要（含 front matter + 结构约定）
const note = `---
title: 测试文章
author: 小明
---

# 测试文章

## 内容

这是正文第一段，用来验证摘要提取是否正常工作。

第二段有 **加粗** 和 [链接](https://example.com)。
`
const digest = generateDigest(note)
check('剥离 front matter（不含 title/author）', !digest.includes('测试文章') || digest.startsWith('这是正文'))
check('摘要从正文开始', digest.startsWith('这是正文第一段'))
check('不含 markdown 标记', !digest.includes('**') && !digest.includes('##'))

// 3. 超长截断
const long = '# t\n\n## 内容\n\n' + '很长的段落。'.repeat(50)
const dLong = generateDigest(long)
check('超长截断到 120 字 + 省略号', dLong.length === 121 && dLong.endsWith('…'))

// 4. 边界：空内容
check('空 markdown → 空串', generateDigest('') === '')
check('只有 front matter → 空串', generateDigest('---\ntitle: x\n---\n') === '')

// 5. 短文不补省略号
const short = generateDigest('# t\n\n## 内容\n\n很短')
check('短文原样返回无省略号', short === '很短')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
