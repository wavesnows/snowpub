<template>
  <el-dialog
    v-model="visible"
    :title="t('wechat.publishTitle')"
    width="540px"
    :close-on-click-modal="false"
    @open="onOpen"
  >
    <el-form label-position="top" v-loading="ttsStore.wechatPublish.publishStatus === 'uploading'">
      <el-alert
        v-if="ttsStore.config.wechat.publishBlocked"
        type="warning"
        :title="t('wechat.publishBlockedHint')"
        :closable="false"
        show-icon
        class="blocked-alert"
      />
      <el-form-item :label="t('wechat.publishType')">
        <el-radio-group v-model="form.type">
          <el-radio-button label="news">{{ t('wechat.typeArticle') }}</el-radio-button>
          <el-radio-button label="newspic">{{ t('wechat.typeImagePost') }}</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item :label="t('wechat.articleTitle')">
        <el-input v-model="form.title" :placeholder="t('wechat.articleTitle')" maxlength="64" show-word-limit />
      </el-form-item>
      <!-- 长文（news）：封面 / 作者 / 摘要（封面紧跟标题：分享卡片三要素连着填） -->
      <template v-if="form.type === 'news'">
        <el-form-item :label="t('wechat.coverImage')">
          <CoverPicker
            v-model="form.thumb_media_id"
            v-model:url="form.coverUrl"
          />
        </el-form-item>
        <el-form-item :label="t('wechat.draftAuthor')">
          <el-input v-model="form.author" :placeholder="t('wechat.draftAuthor')" maxlength="32" />
        </el-form-item>
        <el-form-item :label="t('wechat.digest')">
          <el-input
            v-model="form.digest"
            type="textarea"
            :rows="2"
            :placeholder="t('wechat.digestPlaceholder')"
            maxlength="120"
            show-word-limit
          />
        </el-form-item>
        <el-form-item :label="t('wechat.sourceUrl')">
          <el-input v-model="form.sourceUrl" :placeholder="t('wechat.sourceUrlPlaceholder')" />
        </el-form-item>
        <el-form-item>
          <div class="comment-switches">
            <el-checkbox v-model="form.needOpenComment" :true-label="1" :false-label="0">
              {{ t('wechat.needOpenComment') }}
            </el-checkbox>
            <el-checkbox v-model="form.onlyFansCanComment" :true-label="1" :false-label="0" :disabled="!form.needOpenComment">
              {{ t('wechat.onlyFansComment') }}
            </el-checkbox>
            <span class="comment-hint">{{ t('wechat.commentHint') }}</span>
          </div>
        </el-form-item>
      </template>
      <!-- 图文（newspic）：纯文本描述 + 图片列表（首图即封面） -->
      <template v-else>
        <el-form-item :label="t('wechat.imageContent')">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="4"
            :placeholder="t('wechat.imageContentPlaceholder')"
            maxlength="1000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item :label="t('wechat.imageList')">
          <div class="imgpost-editor">
            <div class="imgpost-grid" v-if="form.images.length">
              <div v-for="(img, i) in form.images" :key="img.media_id" class="imgpost-item">
                <img :src="img.url" loading="lazy" />
                <span class="imgpost-idx">{{ i + 1 }}</span>
                <el-button class="imgpost-del" circle size="small" :icon="Delete" @click="form.images.splice(i, 1)" />
              </div>
            </div>
            <div class="imgpost-toolbar">
              <el-button size="small" @click="uploadImage" :loading="imgUploading">{{ t('wechat.uploadImage') }}</el-button>
              <el-button size="small" @click="imgLibVisible = true">{{ t('wechat.materialTitle') }}</el-button>
              <el-button size="small" @click="collectFromNote" :loading="collecting">{{ t('wechat.collectFromNote') }}</el-button>
              <span class="imgpost-count">{{ form.images.length }}/20</span>
            </div>
          </div>
        </el-form-item>
      </template>
    </el-form>

    <div class="status-banner" :class="statusClass" v-if="statusText">
      {{ statusText }}
    </div>

    <div class="original-hint">
      {{ t('wechat.originalHint') }}
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="openDraftList">{{ t('wechat.draftListTitle') }}</el-button>
        <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
        <el-button
          type="primary"
          @click="saveDraft"
          :loading="ttsStore.wechatPublish.publishStatus === 'uploading'"
          :disabled="!canSave"
        >
          {{ t('wechat.saveDraftBtn') }}
        </el-button>
        <el-button
          type="success"
          @click="publish"
          :loading="ttsStore.wechatPublish.publishStatus === 'publishing'"
          :disabled="!ttsStore.wechatPublish.currentMediaId || ttsStore.config.wechat.publishBlocked"
        >
          {{ t('wechat.publishDraftBtn') }}
        </el-button>
      </div>
    </template>

    <DraftList v-model="draftListVisible" />
    <!-- 图文模式的素材库（多选追加） -->
    <MaterialLibrary v-model="imgLibVisible" @select="onPickImage" />
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import path from 'path'
import fs from 'fs'
import { ipcRenderer } from 'electron'
import { useTtsStore } from '@/store/store'
import { useI18n } from 'vue-i18n'
import { parseFrontMatter, stripFrontMatter } from '@/libs/frontMatter'
import { generateDigest } from '@/libs/digest'
import { extractArticle } from '@/libs/articleStructure'
import { renderThemedArticle } from '@/libs/theme/decorate'
import { getWechatTheme } from '@/libs/wechatThemes'
import CoverPicker from './CoverPicker.vue'
import DraftList from './DraftList.vue'
import MaterialLibrary from './MaterialLibrary.vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const { t } = useI18n()
const ttsStore = useTtsStore()
const visible = ref(props.modelValue)
const draftListVisible = ref(false)

watch(() => props.modelValue, v => { visible.value = v })
watch(visible, v => emit('update:modelValue', v))

const form = ref({
  type: 'news' as 'news' | 'newspic',
  title: '',
  author: '',
  digest: '',
  sourceUrl: '',
  needOpenComment: 0 as 0 | 1,
  onlyFansCanComment: 0 as 0 | 1,
  thumb_media_id: '',
  coverUrl: '',
  // newspic 专属：纯文本描述 + 图片列表（首图即封面，最多 20 张）
  content: '',
  images: [] as Array<{ media_id: string; url: string }>,
})

const imgLibVisible = ref(false)
const imgUploading = ref(false)
const collecting = ref(false)

const canSave = computed(() => {
  if (!form.value.title) return false
  if (form.value.type === 'newspic') {
    return form.value.images.length > 0 && !!form.value.content.trim()
  }
  return !!form.value.thumb_media_id
})

const statusText = computed(() => {
  switch (ttsStore.wechatPublish.publishStatus) {
    case 'uploading': return t('wechat.uploading')
    case 'publishing': return t('wechat.publishing')
    case 'success': return t('wechat.statusSuccess')
    case 'error': return ttsStore.wechatPublish.publishMessage || t('wechat.statusFail')
    default: return ''
  }
})
const statusClass = computed(() => ({
  'status-loading': ['uploading', 'publishing'].includes(ttsStore.wechatPublish.publishStatus),
  'status-success': ttsStore.wechatPublish.publishStatus === 'success',
  'status-error': ttsStore.wechatPublish.publishStatus === 'error',
}))

async function onOpen() {
  const markdown = readCurrentMarkdown()
  const { data: fm } = parseFrontMatter(markdown)

  // 恢复当前笔记之前已保存的封面/作者/摘要/原文链接/评论设置
  if (ttsStore.wechatPublish.currentMediaId) {
    form.value.thumb_media_id = ttsStore.wechatPublish.coverMediaId
    form.value.coverUrl = ttsStore.wechatPublish.coverUrl
    form.value.author = ttsStore.wechatPublish.author
    form.value.digest = ttsStore.wechatPublish.digest
    form.value.sourceUrl = ttsStore.wechatPublish.sourceUrl
    form.value.needOpenComment = ttsStore.wechatPublish.needOpenComment
    form.value.onlyFansCanComment = ttsStore.wechatPublish.onlyFansCanComment
  }
  // front matter 显式声明的元信息优先；其次 `# 标题` 结构约定；兜底文件名。
  // 每次打开都按当前笔记重算，避免残留上一篇笔记的标题
  const art = extractArticle(stripFrontMatter(markdown))
  form.value.title = fm.title || art.title || ttsStore.cnote.title || ''
  if (fm.author) form.value.author = fm.author
  if (fm.digest) form.value.digest = fm.digest
  if (fm.source) form.value.sourceUrl = fm.source
  // 摘要兜底：仍为空时从正文自动生成（纯文本前 120 字，用户可改）
  if (!form.value.digest) form.value.digest = generateDigest(markdown)
  // 作者兜底：系统默认作者
  if (!form.value.author && ttsStore.config.wechat.defaultAuthor) {
    form.value.author = ttsStore.config.wechat.defaultAuthor
  }
  // 封面：front matter cover > 已恢复封面 > 内置默认封面
  if (!form.value.thumb_media_id) {
    if (fm.cover) {
      await applyFrontMatterCover(fm.cover)
    }
    if (!form.value.thumb_media_id) {
      const def = await ttsStore.ensureDefaultCover()
      if (def) {
        form.value.thumb_media_id = def.media_id
        form.value.coverUrl = def.url
      }
    }
  }
  // 图文描述：每次打开按当前笔记重算纯文本，避免残留上一篇
  form.value.content = markdownToPlainText(markdown)
}

// markdown → 纯文本（newspic 的 content 只支持纯文本）
const plainTextMd = new MarkdownIt()
// `## 配图说明` 及之后是配图/生图用的工作备注，不进图文描述
const IMAGE_NOTES_H2_RE = /^##\s+配图说明\s*$/m
function markdownToPlainText(markdown: string): string {
  let body = stripFrontMatter(markdown || '')
  const art = extractArticle(body)
  if (art.matched) body = art.body
  const notesIdx = body.search(IMAGE_NOTES_H2_RE)
  if (notesIdx >= 0) body = body.slice(0, notesIdx)
  const div = document.createElement('div')
  div.innerHTML = plainTextMd.render(body)
  return (div.innerText || '').replace(/\n{3,}/g, '\n\n').trim()
}

// 上传 front matter 中指定的本地封面图（相对笔记目录）
async function applyFrontMatterCover(cover: string) {
  const notePath = ttsStore.cnote.lastPath
  const dir = notePath ? path.dirname(notePath) : process.cwd()
  const abs = path.resolve(dir, cover)
  if (!fs.existsSync(abs)) return
  const result = await ttsStore.addImageMaterial(abs)
  if (result && result.media_id) {
    form.value.thumb_media_id = result.media_id
    form.value.coverUrl = result.url || ''
  }
}

function readCurrentMarkdown(): string {
  const notePath = ttsStore.cnote.lastPath
  if (!notePath || !notePath.endsWith('.md')) return ''
  if (!fs.existsSync(notePath)) return ''
  return fs.readFileSync(notePath, 'utf-8')
}

// ── 图文（newspic）图片列表编辑 ─────────────────────────────────────────
const IMAGE_POST_MAX = 20

function appendImage(item: { media_id: string; url?: string }) {
  if (form.value.images.length >= IMAGE_POST_MAX) {
    ElMessage.warning(t('wechat.imageLimitReached'))
    return
  }
  if (form.value.images.some(i => i.media_id === item.media_id)) return
  form.value.images.push({ media_id: item.media_id, url: item.url || '' })
}

function onPickImage(item: { media_id: string; url: string }) {
  appendImage(item)
}

// 上传本地图片为永久素材（newspic 的 image_media_id 必须是永久 MediaID）
async function uploadImage() {
  if (!ttsStore.config.wechat.appId) {
    ElMessage.warning(t('wechat.configMissing'))
    return
  }
  const filePath = await ipcRenderer.invoke('dialog:openFile', {
    title: t('wechat.uploadImage'),
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
  })
  if (!filePath) return
  imgUploading.value = true
  try {
    const result = await ttsStore.addImageMaterial(filePath)
    if (result && result.errcode) {
      ElMessage.error(`${t('wechat.materialUploadFail')}: ${result.errmsg || result.errcode}`)
      return
    }
    appendImage(result)
  } finally {
    imgUploading.value = false
  }
}

// 扫描笔记中的本地图片，逐个上传为永久素材后追加到图片列表
async function collectFromNote() {
  const markdown = readCurrentMarkdown()
  if (!markdown) {
    ElMessage.warning(t('wechat.needContent'))
    return
  }
  const body = stripFrontMatter(markdown)
  const notePath = ttsStore.cnote.lastPath
  const dir = notePath ? path.dirname(notePath) : process.cwd()
  const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g
  const seenPaths = new Set<string>()
  let match: RegExpExecArray | null
  collecting.value = true
  try {
    while ((match = imgRegex.exec(body)) !== null) {
      if (form.value.images.length >= IMAGE_POST_MAX) {
        ElMessage.warning(t('wechat.imageLimitReached'))
        break
      }
      const src = match[1]
      // 远程 URL 无法直接得到永久 media_id，跳过；只处理本地图片
      if (!src || src.startsWith('http') || src.startsWith('data:')) continue
      const abs = path.resolve(dir, src)
      if (seenPaths.has(abs) || !fs.existsSync(abs)) continue
      seenPaths.add(abs)
      const result = await ttsStore.addImageMaterial(abs)
      if (result && result.errcode) {
        ElMessage.error(`${t('wechat.materialUploadFail')}: ${result.errmsg || result.errcode}`)
        continue
      }
      appendImage(result)
    }
  } finally {
    collecting.value = false
  }
}

/**
 * Render markdown → wechat HTML, uploading local images to WeChat and replacing src.
 */
async function renderWechatHtml(markdown: string): Promise<string> {
  if (!markdown) return ''
  // 剥离 front matter，元信息不进入正文
  markdown = stripFrontMatter(markdown)
  // 命中 `# 标题 … ## 内容` 约定：标题进标题字段（onOpen），正文只取 `## 内容` 之后
  const art = extractArticle(markdown)
  if (art.matched) markdown = art.body
  // Step 1: find all relative image paths
  const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g
  const localPaths: string[] = []
  let match: RegExpExecArray | null
  while ((match = imgRegex.exec(markdown)) !== null) {
    const src = match[1]
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      localPaths.push(src)
    }
  }
  // Step 2: upload each local image and build a map of original → uploaded URL
  const urlMap = new Map<string, string>()
  const notePath = ttsStore.cnote.lastPath
  const dir = notePath ? path.dirname(notePath) : process.cwd()
  for (const rel of localPaths) {
    const abs = path.resolve(dir, rel)
    if (!fs.existsSync(abs)) continue
    const result = await ttsStore.uploadArticleImage(abs)
    if (result && result.url) {
      urlMap.set(rel, result.url)
    }
  }
  // Step 3: replace local src in markdown with uploaded URLs
  let processed = markdown
  if (urlMap.size) {
    processed = processed.replace(imgRegex, (full, src: string) => {
      const newUrl = urlMap.get(src)
      return newUrl ? full.replace(src, newUrl) : full
    })
  }
  // Step 4: render to HTML — 与预览共用 renderThemedArticle，主题样式已内联（微信只保留内联样式）
  const theme = getWechatTheme(ttsStore.wechatTheme)
  return renderThemedArticle(processed, theme, t('wechat.references'))
}

async function saveDraft() {
  if (!ttsStore.config.wechat.appId) {
    ElMessage.warning(t('wechat.configMissing'))
    return
  }
  if (!form.value.title) {
    ElMessage.warning(t('wechat.needTitle'))
    return
  }
  const isImagePost = form.value.type === 'newspic'
  if (isImagePost) {
    if (!form.value.content.trim()) {
      ElMessage.warning(t('wechat.needContent'))
      return
    }
    if (!form.value.images.length) {
      ElMessage.warning(t('wechat.needImages'))
      return
    }
  } else if (!form.value.thumb_media_id) {
    ElMessage.warning(t('wechat.needCover'))
    return
  }
  // 原文链接校验：非空时必须是有效 http(s) 链接，否则微信会拒绝草稿且报错不直观
  const sourceUrl = form.value.sourceUrl.trim()
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
    ElMessage.error(t('wechat.sourceUrlInvalid'))
    return
  }
  const markdown = readCurrentMarkdown()
  if (!markdown && !isImagePost) {
    ElMessage.warning(t('wechat.needContent'))
    return
  }

  ttsStore.setPublishStatus('uploading')
  try {
    const article = isImagePost
      ? {
          article_type: 'newspic',
          title: form.value.title,
          content: form.value.content.trim(),
          need_open_comment: 0 as const,
          only_fans_can_comment: 0 as const,
          image_info: { image_list: form.value.images.map(i => ({ image_media_id: i.media_id })) },
        }
      : {
          title: form.value.title,
          author: form.value.author || '',
          digest: form.value.digest || '',
          content: await renderWechatHtml(markdown),
          content_source_url: sourceUrl,
          thumb_media_id: form.value.thumb_media_id,
          need_open_comment: form.value.needOpenComment,
          only_fans_can_comment: form.value.onlyFansCanComment,
        }

    let result: any
    if (ttsStore.wechatPublish.currentMediaId) {
      // Update existing draft
      result = await ttsStore.updateWechatDraft(ttsStore.wechatPublish.currentMediaId, 0, article)
    } else {
      // Add new draft
      result = await ttsStore.addWechatDraft(article)
      if (result && result.media_id) {
        ttsStore.wechatPublish.currentMediaId = result.media_id
      }
    }
    if (result && result.errcode) {
      ElMessage.error(t('wechat.publishFail', { msg: result.errmsg || result.errcode }))
      ttsStore.setPublishStatus('error', result.errmsg || String(result.errcode))
    } else {
      ElMessage.success(t('wechat.draftSaved'))
      ttsStore.setPublishStatus('idle')
      // Persist cover/author/digest/source/comment settings for this note
      ttsStore.wechatPublish.coverMediaId = form.value.thumb_media_id
      ttsStore.wechatPublish.coverUrl = form.value.coverUrl
      ttsStore.wechatPublish.author = form.value.author
      ttsStore.wechatPublish.digest = form.value.digest
      ttsStore.wechatPublish.sourceUrl = sourceUrl
      ttsStore.wechatPublish.needOpenComment = form.value.needOpenComment
      ttsStore.wechatPublish.onlyFansCanComment = form.value.onlyFansCanComment
    }
  } catch (e: any) {
    ElMessage.error(t('wechat.publishFail', { msg: e.message }))
    ttsStore.setPublishStatus('error', e.message)
  }
}

async function publish() {
  const mediaId = ttsStore.wechatPublish.currentMediaId
  if (!mediaId) {
    ElMessage.warning(t('wechat.needSaveDraft'))
    return
  }
  ttsStore.setPublishStatus('publishing')
  try {
    const result = await ttsStore.publishWechatDraft(mediaId)
    // 无权限(48001)或接口异常时 errmsg 有值但 errcode 可能为空，必须一起检查
    if (result && (result.errcode || result.errmsg)) {
      const msg = String(result.errmsg || result.errcode)
      const is48001 = msg.includes('48001')
      // 学习一次：48001 持久化标记，之后对话框直接引导草稿流程、禁用发布按钮
      if (is48001) ttsStore.setWechatPublishBlocked(true)
      const friendly = is48001 ? t('wechat.publishUnauthorized') : t('wechat.publishFail', { msg })
      ElMessage.error(friendly)
      ttsStore.setPublishStatus('error', friendly)
      return
    }
    if (!result || !result.publish_id) {
      ElMessage.error(t('wechat.publishNotAccepted'))
      ttsStore.setPublishStatus('error', t('wechat.publishNotAccepted'))
      return
    }
    // 发布被受理：账号有权限，清除 48001 学习标记（如换绑了企业号）
    if (ttsStore.config.wechat.publishBlocked) ttsStore.setWechatPublishBlocked(false)
    ttsStore.wechatPublish.publishId = result.publish_id
    ElMessage.success(t('wechat.publishingHint'))
    ttsStore.setPublishStatus('success')
    // Poll status (best-effort, 3 attempts with delay)
    setTimeout(() => pollPublishStatus(), 5000)
  } catch (e: any) {
    // 48001 = 公众号未认证，无 API 发布权限，只能去 mp 后台/订阅号助手手动发布
    const msg = String(e?.message || '')
    const is48001 = msg.includes('48001')
    if (is48001) ttsStore.setWechatPublishBlocked(true)
    const friendly = is48001 ? t('wechat.publishUnauthorized') : msg
    ElMessage.error(friendly)
    ttsStore.setPublishStatus('error', friendly)
  }
}

async function pollPublishStatus() {
  const publishId = ttsStore.wechatPublish.publishId
  if (!publishId) return
  for (let i = 0; i < 5; i++) {
    const status = await ttsStore.getWechatPublishStatus(publishId)
    if (!status || status.errcode) return
    if (status.publish_status === 'publish_succ') {
      ttsStore.setPublishStatus('success', t('wechat.statusSuccess'))
      // Extract first article URL
      if (status.article_detail && status.article_detail[0]) {
        ttsStore.wechatPublish.articleUrl = status.article_detail[0].article_url
      }
      return
    }
    if (status.publish_status === 'publish_fail' || status.publish_status === 'publish_rejected') {
      ttsStore.setPublishStatus('error', status.publish_status === 'publish_rejected' ? t('wechat.statusRejected') : t('wechat.statusFail'))
      return
    }
    // Still publishing, wait and retry
    await new Promise(r => setTimeout(r, 10000))
  }
}

function openDraftList() {
  draftListVisible.value = true
}
</script>

<style scoped>
.blocked-alert {
  margin-bottom: 12px;
}

.comment-switches {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.comment-hint {
  font-size: 12px;
  color: #909399;
}

.original-hint {
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  background: #f4f4f5;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.status-banner {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
}

.status-banner.status-loading {
  background: #ecf5ff;
  color: #409eff;
}

.status-banner.status-success {
  background: #f0f9ff;
  color: #67c23a;
}

.status-banner.status-error {
  background: #fef0f0;
  color: #f56c6c;
}

/* 图文（newspic）图片列表编辑器 */
.imgpost-editor {
  width: 100%;
}

.imgpost-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.imgpost-item {
  position: relative;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  overflow: hidden;
  background: #f5f7fa;
}

.imgpost-item img {
  width: 100%;
  height: 72px;
  object-fit: cover;
  display: block;
}

.imgpost-idx {
  position: absolute;
  left: 4px;
  top: 4px;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  font-size: 11px;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 9px;
  padding: 0 4px;
}

.imgpost-del {
  position: absolute;
  right: 4px;
  top: 4px;
  width: 20px !important;
  height: 20px;
  min-width: 20px !important;
  padding: 0;
}

.imgpost-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.imgpost-count {
  margin-left: auto;
  font-size: 12px;
  color: #909399;
}
</style>
