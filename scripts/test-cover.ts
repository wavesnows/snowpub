// coverCrop 行为验证：首图提取、cover_info 裁剪坐标计算、比例映射
// 运行: npx esbuild scripts/test-cover.ts --bundle --format=esm --platform=node --outfile=node_modules/.cache/test-cover.mjs && node node_modules/.cache/test-cover.mjs
import { extractFirstImage, coverCropRect01, apiRatioFor, COVER_RATIO_OPTIONS } from '../src/libs/coverCrop'

let pass = 0, fail = 0
function check(name: string, cond: boolean) {
  console.log(`${cond ? '✓' : '✗'} ${name}`)
  cond ? pass++ : fail++
}

// ── extractFirstImage ──
const note = `---
title: t
cover: ./fm-cover.png
---

# 标题

## 内容

第一段。

![alt](imgs/first.png)

![第二张](imgs/second.jpg)
`
check('取正文第一张图', extractFirstImage(note) === 'imgs/first.png')
check('front matter 的 cover 不算正文图', extractFirstImage('---\ncover: ./a.png\n---\n\n# t\n\n## 内容\n\n无图') === null)
check('带 title 的图片语法', extractFirstImage('# t\n\n## 内容\n\n![a](imgs/x.png "标题")') === 'imgs/x.png')
check('尖括号包裹', extractFirstImage('# t\n\n## 内容\n\n![a](<imgs/x.png>)') === 'imgs/x.png')
check('无结构约定时扫全文', extractFirstImage('开头\n\n![](http://cdn.com/a.jpg)\n') === 'http://cdn.com/a.jpg')
check('无图 → null', extractFirstImage('# t\n\n## 内容\n\n纯文字') === null)
check('空输入 → null', extractFirstImage('') === null)

// ── coverCropRect01（cover_info 比例坐标）──
// 宽源 1000×250（4:1）→ 2.35:1：裁两侧
const wide = coverCropRect01(1000, 250, 2.35, 1)!
check('宽源：纵向全保留', wide.y1 === 0 && wide.y2 === 1)
check('宽源：x 居中对称', Math.abs(wide.x1 - (1 - 2.35 / 4) / 2) < 1e-9 && Math.abs(wide.x2 - (1 - wide.x1)) < 1e-9)
// 高源 500×1000（1:2）→ 2.35:1：裁上下
const tall = coverCropRect01(500, 1000, 2.35, 1)!
check('高源：横向全保留', tall.x1 === 0 && tall.x2 === 1)
check('高源：y 居中对称', Math.abs(tall.y1 - (1 - 0.5 / 2.35) / 2) < 1e-9 && Math.abs(tall.y2 - (1 - tall.y1)) < 1e-9)
// 2:1 → 1:1：x1=0.25
const sq = coverCropRect01(1000, 500, 1, 1)!
check('2:1 → 1:1：x1=0.25', Math.abs(sq.x1 - 0.25) < 1e-9 && Math.abs(sq.x2 - 0.75) < 1e-9)
// 比例已一致 → null（不传 cover_info，微信按原图）
check('比例一致 → null', coverCropRect01(940, 400, 2.35, 1) === null)
// 非法尺寸 → null
check('非法尺寸 → null', coverCropRect01(0, 100, 2.35, 1) === null)

// ── apiRatioFor ──
check('2.35 → 2.35_1', apiRatioFor('2.35') === '2.35_1')
check('1:1 → 1_1', apiRatioFor('1:1') === '1_1')
check('original → null', apiRatioFor('original') === null)

// ── COVER_RATIO_OPTIONS ──
check('比例预设三项齐全', COVER_RATIO_OPTIONS.length === 3 && COVER_RATIO_OPTIONS.some((o) => o.value === '2.35') && COVER_RATIO_OPTIONS.some((o) => o.value === '1:1'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
