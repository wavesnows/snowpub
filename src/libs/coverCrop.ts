// 智能封面：比例预设、cover_info 裁剪坐标计算、图片尺寸读取、正文首图提取、外链图下载。
// 裁剪走微信草稿 API 的 cover_info（crop_percent_list，0-1 比例坐标），本地上传原图不裁：
// 素材库不产生裁剪副本，素材库直选的图同样可裁，用户在公众号后台还能重新框选。
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { stripFrontMatter } from './frontMatter'
import { extractArticle } from './articleStructure'
import { imageExtForMime } from './pasteImage'

export type CoverRatio = 'original' | '2.35' | '1:1'

// 微信封面比例：头条 2.35:1（900×383）、次条 1:1；original = 不裁剪（不传 cover_info）
export const COVER_RATIO_OPTIONS: { value: CoverRatio; labelKey: string; w: number; h: number }[] = [
  { value: 'original', labelKey: 'wechat.ratioOriginal', w: 0, h: 0 },
  { value: '2.35', labelKey: 'wechat.ratioHeadline', w: 2.35, h: 1 },
  { value: '1:1', labelKey: 'wechat.ratioSquare', w: 1, h: 1 },
]

// cover_info 的 ratio 枚举值（微信 API：1_1 / 16_9 / 2.35_1）
const API_RATIO: Record<Exclude<CoverRatio, 'original'>, string> = {
  '2.35': '2.35_1',
  '1:1': '1_1',
}

export function apiRatioFor(ratio: CoverRatio): string | null {
  return ratio === 'original' ? null : API_RATIO[ratio]
}

/**
 * center-crop 的 cover_info 比例坐标（0-1 坐标系，纯函数）。
 * 源更宽裁两侧，源更高裁上下；源尺寸非法或比例已一致返回 null（无需 cover_info）。
 */
export function coverCropRect01(
  srcW: number,
  srcH: number,
  ratioW: number,
  ratioH: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  if (srcW <= 0 || srcH <= 0 || ratioW <= 0 || ratioH <= 0) return null
  const srcRatio = srcW / srcH
  const dstRatio = ratioW / ratioH
  if (Math.abs(srcRatio - dstRatio) < 1e-3) return null
  if (srcRatio > dstRatio) {
    const x1 = (1 - dstRatio / srcRatio) / 2
    return { x1, y1: 0, x2: 1 - x1, y2: 1 }
  }
  const y1 = (1 - srcRatio / dstRatio) / 2
  return { x1: 0, y1, x2: 1, y2: 1 - y1 }
}

// `![alt](src "title")` / `![alt](<src>)`：src 取第一个空白前的片段
const FIRST_IMAGE_RE = /!\[[^\]]*\]\(\s*<?([^\s)>]+)>?/

/** 提取正文第一张图片地址（剥 front matter、按 `# 标题`/`## 内容` 约定取正文）。 */
export function extractFirstImage(markdown: string): string | null {
  let body = stripFrontMatter(markdown || '')
  const art = extractArticle(body)
  if (art.matched) body = art.body
  const m = body.match(FIRST_IMAGE_RE)
  return m ? m[1] : null
}

const EXT_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`image decode failed: ${src.slice(0, 80)}`))
    img.src = src
  })
}

/** 读本地图片尺寸（Blob URL 加载，避开 file:// 加载限制）。 */
export async function imageSizeFromFile(srcPath: string): Promise<{ width: number; height: number }> {
  const buf = fs.readFileSync(srcPath)
  const mime = EXT_MIME[path.extname(srcPath).toLowerCase()] || 'application/octet-stream'
  const blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }))
  try {
    const img = await loadImage(blobUrl)
    return { width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

/** 读远程图片尺寸（mmbiz 等 CDN；session 层已剥离 Referer，不受防盗链影响）。失败返回 null。 */
export async function imageSizeFromUrl(url: string): Promise<{ width: number; height: number } | null> {
  try {
    const img = await loadImage(url)
    return { width: img.naturalWidth, height: img.naturalHeight }
  } catch {
    return null
  }
}

/** 外链图下载到 tmp（md5(url) 命名，重复下载复用文件）。非图片或失败返回 null。 */
export async function downloadImageToTmp(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0) return null
    // 优先按 content-type 定扩展名；服务返回 application/octet-stream 等时按 URL 扩展名兜底
    let ext = imageExtForMime(mime)
    if (!ext) {
      const urlExt = path.extname(new URL(url).pathname).toLowerCase()
      if (EXT_MIME[urlExt]) ext = urlExt.slice(1)
    }
    if (!ext) return null
    const dir = path.join(os.tmpdir(), 'snowpub-cover-dl')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `${crypto.createHash('md5').update(url).digest('hex').slice(0, 16)}.${ext}`)
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) fs.writeFileSync(file, buf)
    return file
  } catch {
    return null
  }
}
