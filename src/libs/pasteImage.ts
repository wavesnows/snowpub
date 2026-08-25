// 编辑器粘贴/拖拽图片落盘：File → 内容哈希命名 → 笔记目录 imgs/ 下的相对路径。
// 与发布链路的关系：这里只落本地文件并插入相对路径，发布时由
// PublishDialog.renderWechatHtml 统一扫描上传 CDN，两条路径互不干扰。
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export const PASTE_IMAGE_DIR = 'imgs'

// 微信正文支持的格式；svg 不在内（公众号不支持）
const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export function imageExtForMime(mime: string): string | null {
  return MIME_TO_EXT[mime] ?? null
}

/**
 * 把粘贴/拖入的图片 File 写入 noteDir/imgs/，返回相对笔记目录的路径（imgs/<hash16>.<ext>）。
 * 文件名取内容 md5 前 16 位：同一张图重复粘贴得到同名文件，已存在则跳过写入（天然去重）。
 * 不支持的类型返回 null，由调用方走默认行为。
 */
export async function saveClipboardImage(file: File, noteDir: string): Promise<string | null> {
  const ext = imageExtForMime(file.type)
  if (!ext) return null

  const buf = Buffer.from(await file.arrayBuffer())
  if (buf.length === 0) return null

  const hash = crypto.createHash('md5').update(buf).digest('hex').slice(0, 16)
  const fileName = `${hash}.${ext}`
  const imgDir = path.join(noteDir, PASTE_IMAGE_DIR)
  const abs = path.join(imgDir, fileName)

  if (!fs.existsSync(abs)) {
    fs.mkdirSync(imgDir, { recursive: true })
    fs.writeFileSync(abs, buf)
  }
  return `${PASTE_IMAGE_DIR}/${fileName}`
}
