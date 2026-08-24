import https from 'https'
import { IncomingMessage } from 'http'
import fs from 'fs'
import path from 'path'
import logger from './log'

const API_HOST = 'api.weixin.qq.com'
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000 // 提前 5 分钟刷新

export interface WechatConfig {
  appId: string
  appSecret: string
}

export interface WechatError extends Error {
  errcode?: number
  errmsg?: string
}

// ── access_token 缓存（按 appId 隔离）──────────────────────────────────────
interface TokenCache {
  appId: string
  token: string
  expiresAt: number // 毫秒时间戳
}
let tokenCache: TokenCache | null = null
let tokenFetchPromise: Promise<string> | null = null

function isTokenFresh(appId: string): boolean {
  return !!tokenCache && tokenCache.appId === appId && Date.now() < tokenCache.expiresAt
}

/**
 * 获取 access_token，带缓存与并发去重。
 */
export async function getAccessToken(cfg: WechatConfig): Promise<string> {
  if (!cfg.appId || !cfg.appSecret) {
    throw makeError('missing appId or appSecret')
  }
  if (isTokenFresh(cfg.appId)) {
    return tokenCache!.token
  }
  // 并发请求去重
  if (tokenFetchPromise && tokenCache?.appId === cfg.appId) {
    return tokenFetchPromise
  }
  tokenFetchPromise = fetchAccessToken(cfg)
    .finally(() => { tokenFetchPromise = null })
  return tokenFetchPromise
}

async function fetchAccessToken(cfg: WechatConfig): Promise<string> {
  const path = `/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(cfg.appId)}&secret=${encodeURIComponent(cfg.appSecret)}`
  const data = await requestGet(path)
  if (data.errcode) {
    throw makeError(`get access_token failed: ${data.errcode} ${data.errmsg}`, data.errcode, data.errmsg)
  }
  const token = data.access_token as string
  const expiresIn = (data.expires_in as number) || 7200
  tokenCache = {
    appId: cfg.appId,
    token,
    expiresAt: Date.now() + expiresIn * 1000 - TOKEN_REFRESH_MARGIN_MS,
  }
  logger.info(`[wechat] access_token refreshed, valid for ${expiresIn}s`)
  return token
}

/**
 * 强制清空 access_token 缓存（测试连接、切换账号时使用）。
 */
export function invalidateToken(appId?: string) {
  if (!appId || !tokenCache || tokenCache.appId === appId) {
    tokenCache = null
    tokenFetchPromise = null
  }
}

// ── 素材 ────────────────────────────────────────────────────────────────

export interface WechatMaterial {
  media_id: string
  url?: string
  name?: string
  update_time?: number
}

/**
 * 上传图片作为图文消息内的图片（返回 URL，仅用于正文，不占素材数）。
 * 文档：/cgi-bin/media/uploadimg
 */
export async function uploadArticleImage(cfg: WechatConfig, filePath: string): Promise<{ url: string }> {
  const token = await getAccessToken(cfg)
  const result = await uploadFile(`/cgi-bin/media/uploadimg?access_token=${token}`, filePath)
  if (result.errcode) {
    throw makeError(`uploadArticleImage failed: ${result.errcode} ${result.errmsg}`, result.errcode, result.errmsg)
  }
  return { url: result.url as string }
}

/**
 * 新增永久素材（图片，返回 media_id，可用于封面图 thumb_media_id）。
 * 文档：/cgi-bin/material/add_material?type=image
 */
export async function addImageMaterial(cfg: WechatConfig, filePath: string): Promise<{ media_id: string; url: string }> {
  const token = await getAccessToken(cfg)
  const result = await uploadFile(`/cgi-bin/material/add_material?access_token=${token}&type=image`, filePath)
  if (result.errcode) {
    throw makeError(`addImageMaterial failed: ${result.errcode} ${result.errmsg}`, result.errcode, result.errmsg)
  }
  return { media_id: result.media_id as string, url: result.url as string }
}

/**
 * 新增临时素材（3 天有效）。
 * 文档：/cgi-bin/media/upload?type=image
 */
export async function addTempMedia(cfg: WechatConfig, filePath: string, type: 'image' | 'voice' | 'video' | 'thumb' = 'image'): Promise<{ media_id: string; type: string }> {
  const token = await getAccessToken(cfg)
  const result = await uploadFile(`/cgi-bin/media/upload?access_token=${token}&type=${type}`, filePath)
  if (result.errcode) {
    throw makeError(`addTempMedia failed: ${result.errcode} ${result.errmsg}`, result.errcode, result.errmsg)
  }
  return { media_id: result.media_id as string, type: result.type as string }
}

export interface MaterialListResult {
  total_count: number
  item_count: number
  item: Array<{
    media_id: string
    name: string
    update_time: number
    url: string
  }>
}

/**
 * 获取永久素材列表（图片）。
 */
export async function getImageMaterialList(cfg: WechatConfig, offset = 0, count = 20): Promise<MaterialListResult> {
  const token = await getAccessToken(cfg)
  const result = await requestPost(
    `/cgi-bin/material/batchget_material?access_token=${token}`,
    { type: 'image', offset, count }
  )
  if (result.errcode) {
    throw makeError(`getImageMaterialList failed: ${result.errcode} ${result.errmsg}`, result.errcode, result.errmsg)
  }
  return result as MaterialListResult
}

/**
 * 删除永久素材。
 */
export async function deleteMaterial(cfg: WechatConfig, mediaId: string): Promise<void> {
  const token = await getAccessToken(cfg)
  const result = await requestPost(
    `/cgi-bin/material/del_material?access_token=${token}`,
    { media_id: mediaId }
  )
  if (result.errcode) {
    throw makeError(`deleteMaterial failed: ${result.errcode} ${result.errmsg}`, result.errcode, result.errmsg)
  }
}

// ── 草稿 ────────────────────────────────────────────────────────────────

export interface WechatArticle {
  article_type?: 'news' | 'newspic' // 图文消息（默认）/ 图片消息
  title: string
  author?: string
  digest?: string // 摘要，不填则默认取正文前 54 字（仅 news）
  content: string // news: HTML 正文；newspic: 纯文本描述
  content_source_url?: string // 原文链接（仅 news）
  thumb_media_id?: string // 封面图 media_id（news 必填，必须是永久素材；newspic 首图即封面）
  need_open_comment?: 0 | 1
  only_fans_can_comment?: 0 | 1
  // newspic 必填：图片列表（最多 20 张，均为永久素材 media_id）
  image_info?: { image_list: Array<{ image_media_id: string }> }
  // newspic 可选：封面裁剪
  cover_info?: { crop_percent_list?: Array<{ ratio?: string; x1?: string; y1?: string; x2?: string; y2?: string }> }
}

/**
 * 新增草稿，返回草稿 media_id（即后续发布的 media_id）。
 */
export async function addDraft(cfg: WechatConfig, article: WechatArticle): Promise<string> {
  const token = await getAccessToken(cfg)
  const result = await requestPost(
    `/cgi-bin/draft/add?access_token=${token}`,
    { articles: [article] }
  )
  if (result.errcode) {
    throw makeError(`addDraft failed: ${result.errcode} ${result.errmsg}`, result.errcode, result.errmsg)
  }
  return result.media_id as string
}

/**
 * 修改草稿。
 */
export async function updateDraft(cfg: WechatConfig, mediaId: string, index: number, article: WechatArticle): Promise<void> {
  const token = await getAccessToken(cfg)
  const result = await requestPost(
    `/cgi-bin/draft/update?access_token=${token}`,
    { media_id: mediaId, index, articles: article }
  )
  if (result.errcode) {
    throw makeError(`updateDraft failed: ${result.errcode} ${result.errmsg}`, result.errcode, result.errmsg)
  }
}

export interface DraftArticle {
  title: string
  author: string
  digest: string
  content?: string // batchget no_content=1 时不返回
  content_source_url: string
  thumb_media_id: string
  thumb_url: string
  url: string // 已发布后的文章 URL
}

export interface DraftItem {
  media_id: string
  content: {
    news_item: DraftArticle[]
  }
  update_time: number
}

export interface DraftListResult {
  total_count: number
  item_count: number
  item: DraftItem[]
}

/**
 * 获取草稿列表。
 */
export async function getDraftList(cfg: WechatConfig, offset = 0, count = 20): Promise<DraftListResult> {
  const token = await getAccessToken(cfg)
  const result = await requestPost(
    `/cgi-bin/draft/batchget?access_token=${token}`,
    { offset, count, no_content: 1 }
  )
  if (result.errcode) {
    throw makeError(`getDraftList failed: ${result.errcode} ${result.errmsg}`, result.errcode, result.errmsg)
  }
  return result as DraftListResult
}

/**
 * 获取单篇草稿的完整内容（含正文 HTML）。响应为 { news_item: [...] }。
 */
export async function getDraft(cfg: WechatConfig, mediaId: string): Promise<any> {
  const token = await getAccessToken(cfg)
  const result = await requestPost(
    `/cgi-bin/draft/get?access_token=${token}`,
    { media_id: mediaId }
  )
  if (result.errcode) {
    throw makeError(`getDraft failed: ${result.errcode} ${result.errmsg}`, result.errcode, result.errmsg)
  }
  return result as DraftItem
}

/**
 * 删除草稿。
 */
export async function deleteDraft(cfg: WechatConfig, mediaId: string): Promise<void> {
  const token = await getAccessToken(cfg)
  const result = await requestPost(
    `/cgi-bin/draft/delete?access_token=${token}`,
    { media_id: mediaId }
  )
  if (result.errcode) {
    throw makeError(`deleteDraft failed: ${result.errcode} ${result.errmsg}`, result.errcode, result.errmsg)
  }
}

// ── 发布 ────────────────────────────────────────────────────────────────

/**
 * 发布草稿（freepublish），返回 publish_id。
 * 注意：仅已认证公众号可用；未认证号会返回 48001，只能去 mp 后台/订阅号助手手动发布。
 */
export async function publishDraft(cfg: WechatConfig, mediaId: string): Promise<string> {
  const token = await getAccessToken(cfg)
  const result = await requestPost(
    `/cgi-bin/freepublish/submit?access_token=${token}`,
    { media_id: mediaId }
  )
  if (result.errcode) {
    throw makeError(`publishDraft failed: ${result.errcode} ${result.errmsg}`, result.errcode, result.errmsg)
  }
  return result.publish_id as string
}

export interface PublishStatus {
  publish_status: string // publish_succ / publish_fail / publish_rejected / publish_publishing
  article_detail?: Array<{
    article_url: string
    idx: number
  }>
  fail_idx?: number[]
}

/**
 * 查询发布状态。
 */
export async function getPublishStatus(cfg: WechatConfig, publishId: string): Promise<PublishStatus> {
  const token = await getAccessToken(cfg)
  const result = await requestPost(
    `/cgi-bin/freepublish/get?access_token=${token}`,
    { publish_id: publishId }
  )
  if (result.errcode) {
    throw makeError(`getPublishStatus failed: ${result.errcode} ${result.errmsg}`, result.errcode, result.errmsg)
  }
  return {
    publish_status: result.publish_status,
    article_detail: result.article_detail,
    fail_idx: result.fail_idx,
  }
}

// ── 网络 ────────────────────────────────────────────────────────────────

// 统一响应处理：非 2xx（如接口路径错误返回 404 HTML）必须 reject，
// 避免错误被吞、上层误报成功
function handleResponse(apiPath: string, res: IncomingMessage, chunks: Buffer[], resolve: (v: any) => void, reject: (e: any) => void) {
  if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
    reject(makeError(`HTTP ${res.statusCode} from ${apiPath.split('?')[0]}`))
    return
  }
  try {
    resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
  } catch (e) {
    reject(makeError(`invalid JSON response: ${(e as Error).message}`))
  }
}

function requestGet(apiPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: API_HOST,
      path: apiPath,
      method: 'GET',
    }, (res: IncomingMessage) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => handleResponse(apiPath, res, chunks, resolve, reject))
    })
    req.on('error', (e) => reject(makeError(`network error: ${e.message}`)))
    req.end()
  })
}

function requestPost(apiPath: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body), 'utf8')
    const req = https.request({
      hostname: API_HOST,
      path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res: IncomingMessage) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => handleResponse(apiPath, res, chunks, resolve, reject))
    })
    req.on('error', (e) => reject(makeError(`network error: ${e.message}`)))
    req.write(data)
    req.end()
  })
}

function uploadFile(apiPath: string, filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(makeError(`file not found: ${filePath}`))
    }
    const boundary = '----wechatboundary' + Math.random().toString(16).slice(2)
    const filename = path.basename(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    const pre = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="media"; filename="${filename}"\r\n` +
      `Content-Type: ${mime}\r\n\r\n`,
      'utf8'
    )
    const post = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
    const fileBuf = fs.readFileSync(filePath)
    const total = Buffer.concat([pre, fileBuf, post])

    const req = https.request({
      hostname: API_HOST,
      path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': total.length,
      },
    }, (res: IncomingMessage) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => handleResponse(apiPath, res, chunks, resolve, reject))
    })
    req.on('error', (e) => reject(makeError(`network error: ${e.message}`)))
    req.write(total)
    req.end()
  })
}

function makeError(message: string, errcode?: number, errmsg?: string): WechatError {
  const err = new Error(message) as WechatError
  err.errcode = errcode
  err.errmsg = errmsg
  logger.error(`[wechat] ${message}`)
  return err
}
