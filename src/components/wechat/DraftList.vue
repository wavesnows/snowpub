<template>
  <el-dialog
    v-model="visible"
    :title="t('wechat.draftListTitle')"
    width="640px"
    :close-on-click-modal="false"
    @open="onOpen"
  >
    <div class="draft-toolbar">
      <el-button size="small" @click="refresh" :loading="ttsStore.wechatPublish.draftLoading">
        {{ t('wechat.loadDrafts') }}
      </el-button>
    </div>
    <div v-loading="ttsStore.wechatPublish.draftLoading" class="draft-list">
      <div v-if="!ttsStore.wechatPublish.drafts.length && !ttsStore.wechatPublish.draftLoading" class="empty-tip">
        {{ t('wechat.noDrafts') }}
      </div>
      <div
        v-for="draft in ttsStore.wechatPublish.drafts"
        :key="draft.media_id"
        class="draft-card"
      >
        <div class="draft-main">
          <img
            v-if="firstArticle(draft)?.thumb_url"
            :src="firstArticle(draft)?.thumb_url"
            class="draft-thumb"
            alt="cover"
          />
          <div class="draft-info">
            <div class="draft-title">
              {{ firstArticle(draft)?.title || '(no title)' }}
            </div>
            <div class="draft-meta">
              <span v-if="firstArticle(draft)?.author">
                {{ firstArticle(draft)?.author }} ·
              </span>
              {{ formatTime(draft.update_time) }}
            </div>
            <div v-if="firstArticle(draft)?.digest" class="draft-digest">
              {{ firstArticle(draft)?.digest }}
            </div>
          </div>
        </div>
        <div class="draft-actions">
          <el-button
            size="small"
            @click="viewContent(draft)"
            :loading="viewingId === draft.media_id"
          >
            {{ t('wechat.viewContent') }}
          </el-button>
          <el-button
            type="primary"
            size="small"
            @click="publishDraft(draft)"
            :loading="publishingId === draft.media_id"
          >
            {{ t('wechat.publishDraftBtn') }}
          </el-button>
          <el-button
            type="danger"
            size="small"
            link
            @click="onDelete(draft)"
          >
            {{ t('wechat.deleteDraft') }}
          </el-button>
        </div>
      </div>
    </div>

    <!-- 草稿内容预览 -->
    <el-dialog
      v-model="contentVisible"
      :title="previewArticle?.title || t('wechat.viewContent')"
      width="640px"
      append-to-body
    >
      <div class="draft-content-preview">
        <img v-if="previewArticle?.thumb_url" :src="previewArticle.thumb_url" class="preview-cover" alt="cover" />
        <div v-if="previewArticle?.digest" class="preview-digest">{{ previewArticle.digest }}</div>
        <div v-if="previewArticle?.content" class="preview-html" v-html="previewArticle.content"></div>
        <div v-else class="empty-tip">{{ t('wechat.noContent') }}</div>
      </div>
    </el-dialog>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTtsStore } from '@/store/store'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const { t } = useI18n()
const ttsStore = useTtsStore()
const visible = ref(props.modelValue)
const publishingId = ref('')
const viewingId = ref('')
const contentVisible = ref(false)
const previewArticle = ref<any>(null)

// batchget 返回结构为 draft.content.news_item[]
function firstArticle(draft: any): any {
  return draft?.content?.news_item?.[0] || null
}

watch(() => props.modelValue, v => { visible.value = v })
watch(visible, v => emit('update:modelValue', v))

function onOpen() { refresh() }

async function refresh() {
  if (!ttsStore.config.wechat.appId) {
    ElMessage.warning(t('wechat.configMissing'))
    return
  }
  await ttsStore.loadWechatDrafts(0, 20)
}

function formatTime(ts: number) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function pad(n: number) { return n < 10 ? '0' + n : '' + n }

async function onDelete(draft: any) {
  try {
    await ElMessageBox.confirm(t('wechat.deleteDraft') + '?', t('common.confirm'), {
      type: 'warning',
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
    })
  } catch { return }
  const result = await ttsStore.deleteWechatDraft(draft.media_id)
  if (result && result.errcode) {
    ElMessage.error(`${result.errmsg || result.errcode}`)
  } else {
    ElMessage.success(t('wechat.materialDeleted'))
    await refresh()
  }
}

async function viewContent(draft: any) {
  viewingId.value = draft.media_id
  try {
    const result = await ttsStore.getWechatDraft(draft.media_id)
    if (result && (result.errcode || result.errmsg)) {
      ElMessage.error(`${result.errmsg || result.errcode}`)
      return
    }
    // draft/get 响应为 { news_item: [...] }
    previewArticle.value = result?.news_item?.[0] || null
    contentVisible.value = true
  } finally {
    viewingId.value = ''
  }
}

async function publishDraft(draft: any) {
  publishingId.value = draft.media_id
  try {
    const result = await ttsStore.publishWechatDraft(draft.media_id)
    // 注意：无权限(48001)或接口异常时 errmsg 有值但 errcode 可能为空，必须一起检查
    if (result && (result.errcode || result.errmsg)) {
      const msg = String(result.errmsg || result.errcode)
      ElMessage.error(msg.includes('48001') ? t('wechat.publishUnauthorized') : t('wechat.publishFail', { msg }))
      return
    }
    if (!result || !result.publish_id) {
      ElMessage.error(t('wechat.publishNotAccepted'))
      return
    }
    ElMessage.success(t('wechat.publishingHint'))
    visible.value = false
  } finally {
    publishingId.value = ''
  }
}
</script>

<style scoped>
.draft-toolbar {
  margin-bottom: 12px;
}

.draft-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 60vh;
  overflow-y: auto;
  min-height: 200px;
}

.empty-tip {
  text-align: center;
  color: #909399;
  padding: 40px 0;
  font-size: 13px;
}

.draft-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 10px;
  background: #fff;
}

.draft-main {
  display: flex;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.draft-thumb {
  width: 64px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
  background: #f5f7fa;
}

.draft-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.draft-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.draft-meta {
  font-size: 12px;
  color: #909399;
}

.draft-digest {
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.draft-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 10px;
}

.draft-actions .el-button + .el-button {
  margin-left: 0;
}

.preview-cover {
  max-width: 100%;
  border-radius: 4px;
  margin-bottom: 10px;
}

.preview-digest {
  font-size: 13px;
  color: #888;
  margin-bottom: 10px;
}

.preview-html {
  max-height: 55vh;
  overflow-y: auto;
  font-size: 15px;
  line-height: 1.75;
}

.preview-html :deep(img) {
  max-width: 100%;
}
</style>
