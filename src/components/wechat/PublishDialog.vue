<template>
  <el-dialog
    v-model="visible"
    :title="t('wechat.publishTitle')"
    width="540px"
    :close-on-click-modal="false"
    @open="onOpen"
  >
    <el-form label-position="top" v-loading="ttsStore.wechatPublish.publishStatus === 'uploading'">
      <el-form-item :label="t('wechat.articleTitle')">
        <el-input v-model="form.title" :placeholder="t('wechat.articleTitle')" maxlength="64" show-word-limit />
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
      <el-form-item :label="t('wechat.coverImage')">
        <CoverPicker
          v-model="form.thumb_media_id"
          v-model:url="form.coverUrl"
        />
      </el-form-item>
    </el-form>

    <div class="status-banner" :class="statusClass" v-if="statusText">
      {{ statusText }}
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
          :disabled="!ttsStore.wechatPublish.currentMediaId"
        >
          {{ t('wechat.publishDraftBtn') }}
        </el-button>
      </div>
    </template>

    <DraftList v-model="draftListVisible" />
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import path from 'path'
import fs from 'fs'
import { useTtsStore } from '@/store/store'
import { useI18n } from 'vue-i18n'
import { parseFrontMatter, stripFrontMatter } from '@/libs/frontMatter'
import { extractArticle } from '@/libs/articleStructure'
import { createWechatMd, buildStyledWechatHtml, type WxFootnote } from '@/libs/wechatRender'
import CoverPicker from './CoverPicker.vue'
import DraftList from './DraftList.vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const { t } = useI18n()
const ttsStore = useTtsStore()
const visible = ref(props.modelValue)
const draftListVisible = ref(false)

watch(() => props.modelValue, v => { visible.value = v })
watch(visible, v => emit('update:modelValue', v))

const form = ref({
  title: '',
  author: '',
  digest: '',
  thumb_media_id: '',
  coverUrl: '',
})

const canSave = computed(() => !!form.value.title && !!form.value.thumb_media_id)

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

  // 恢复当前笔记之前已保存的封面/作者/摘要
  if (ttsStore.wechatPublish.currentMediaId) {
    form.value.thumb_media_id = ttsStore.wechatPublish.coverMediaId
    form.value.coverUrl = ttsStore.wechatPublish.coverUrl
    form.value.author = ttsStore.wechatPublish.author
    form.value.digest = ttsStore.wechatPublish.digest
  }
  // front matter 显式声明的元信息优先；其次 `# 标题` 结构约定；兜底文件名。
  // 每次打开都按当前笔记重算，避免残留上一篇笔记的标题
  const art = extractArticle(stripFrontMatter(markdown))
  form.value.title = fm.title || art.title || ttsStore.cnote.title || ''
  if (fm.author) form.value.author = fm.author
  if (fm.digest) form.value.digest = fm.digest
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
  // Step 4: render to HTML — 与预览一致的外链脚注转换 + 计算样式内联（微信只保留内联样式）
  const footnotes: WxFootnote[] = []
  const md = createWechatMd(footnotes)
  const bodyHtml = md.render(processed)
  return buildStyledWechatHtml(bodyHtml, footnotes, ttsStore.wechatTheme, t('wechat.references'))
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
  if (!form.value.thumb_media_id) {
    ElMessage.warning(t('wechat.needCover'))
    return
  }
  const markdown = readCurrentMarkdown()
  if (!markdown) {
    ElMessage.warning(t('wechat.needContent'))
    return
  }

  ttsStore.setPublishStatus('uploading')
  try {
    const content = await renderWechatHtml(markdown)
    const article = {
      title: form.value.title,
      author: form.value.author || '',
      digest: form.value.digest || '',
      content,
      content_source_url: '',
      thumb_media_id: form.value.thumb_media_id,
      need_open_comment: 0 as const,
      only_fans_can_comment: 0 as const,
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
      // Persist cover/author/digest for this note
      ttsStore.wechatPublish.coverMediaId = form.value.thumb_media_id
      ttsStore.wechatPublish.coverUrl = form.value.coverUrl
      ttsStore.wechatPublish.author = form.value.author
      ttsStore.wechatPublish.digest = form.value.digest
    }
  } catch (e: any) {
    ElMessage.error(t('wechat.publishFail', { msg: e.message }))
    ttsStore.setPublishStatus('error', e.message)
  }
}

async function publish() {
  const mediaId = ttsStore.wechatPublish.currentMediaId
  if (!mediaId) {
    ElMessage.warning(t('wechat.needCover'))
    return
  }
  ttsStore.setPublishStatus('publishing')
  try {
    const result = await ttsStore.publishWechatDraft(mediaId)
    // 无权限(48001)或接口异常时 errmsg 有值但 errcode 可能为空，必须一起检查
    if (result && (result.errcode || result.errmsg)) {
      const msg = String(result.errmsg || result.errcode)
      const friendly = msg.includes('48001') ? t('wechat.publishUnauthorized') : t('wechat.publishFail', { msg })
      ElMessage.error(friendly)
      ttsStore.setPublishStatus('error', friendly)
      return
    }
    if (!result || !result.publish_id) {
      ElMessage.error(t('wechat.publishNotAccepted'))
      ttsStore.setPublishStatus('error', t('wechat.publishNotAccepted'))
      return
    }
    ttsStore.wechatPublish.publishId = result.publish_id
    ElMessage.success(t('wechat.publishingHint'))
    ttsStore.setPublishStatus('success')
    // Poll status (best-effort, 3 attempts with delay)
    setTimeout(() => pollPublishStatus(), 5000)
  } catch (e: any) {
    // 48001 = 公众号未认证，无 API 发布权限，只能去 mp 后台/订阅号助手手动发布
    const msg = String(e?.message || '')
    const friendly = msg.includes('48001') ? t('wechat.publishUnauthorized') : msg
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
</style>
