// 内置默认封面：将打包进应用的默认封面 PNG 写入临时目录，供微信素材上传使用
import fs from 'fs'
import os from 'os'
import path from 'path'
import { DEFAULT_COVER_BASE64 } from '@/assets/brand/defaultCoverBase64'

let cachedPath = ''

export function ensureDefaultCoverFile(): string {
  if (cachedPath && fs.existsSync(cachedPath) && fs.statSync(cachedPath).size > 0) return cachedPath
  const dir = path.join(os.tmpdir(), 'snowpub-brand')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'default-cover.png')
  fs.writeFileSync(file, Buffer.from(DEFAULT_COVER_BASE64, 'base64'))
  cachedPath = file
  return file
}
