<template>
  <div class="cover-picker">
    <div v-if="modelValue" class="cover-preview" :class="`ratio-${ratioClass}`" :style="previewStyle">
      <img :src="previewUrl" alt="cover" />
      <div class="cover-actions">
        <el-button link type="primary" size="small" @click="pickLocal">{{ t('wechat.uploadImage') }}</el-button>
        <el-button link type="primary" size="small" @click="openLibrary">{{ t('wechat.materialTitle') }}</el-button>
        <el-button link type="danger" size="small" @click="clear">{{ t('common.delete') }}</el-button>
      </div>
    </div>
    <div v-else class="cover-empty">
      <el-button @click="pickLocal" :loading="uploading" size="small">{{ t('wechat.uploadImage') }}</el-button>
      <el-button @click="openLibrary" size="small">{{ t('wechat.materialTitle') }}</el-button>
    </div>
    <!-- 裁剪比例：保存草稿时写入 cover_info 坐标，切换即生效，无需重新上传 -->
    <div class="cover-ratio">
      <span class="cover-ratio-label">{{ t('wechat.coverRatio') }}</span>
      <el-radio-group :model-value="ttsStore.wechatPublish.coverRatio" size="small" @change="onRatioChange">
        <el-radio-button v-for="opt in COVER_RATIO_OPTIONS" :key="opt.value" :label="opt.value">
          {{ t(opt.labelKey) }}
        </el-radio-button>
      </el-radio-group>
    </div>
    <MaterialLibrary
      v-model="libVisible"
      :selected-id="modelValue"
      @select="onPickFromLibrary"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useTtsStore } from '@/store/store'
import { useI18n } from 'vue-i18n'
import { ipcRenderer } from 'electron'
import MaterialLibrary from './MaterialLibrary.vue'
import { COVER_RATIO_OPTIONS, imageSizeFromUrl, type CoverRatio } from '@/libs/coverCrop'

const props = defineProps<{ modelValue: string; url?: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'update:url', v: string): void
  // 封面图原始尺寸（保存草稿算 cover_info 裁剪坐标用）
  (e: 'meta', v: { width: number; height: number }): void
}>()

const { t } = useI18n()
const ttsStore = useTtsStore()
const uploading = ref(false)
const libVisible = ref(false)

// 优先使用外部传入的 url；否则从 store.materials 中查找该 media_id 对应的 url
const previewUrl = computed(() => {
  if (props.url) return props.url
  if (!props.modelValue) return ''
  const found = ttsStore.wechatPublish.materials.find((m: any) => m.media_id === props.modelValue)
  return found?.url || ''
})

// 预览按所选比例裁切显示：所见即微信 center-crop 所得
const previewStyle = computed(() => {
  const ratio = ttsStore.wechatPublish.coverRatio
  if (ratio === '2.35') return { aspectRatio: '2.35 / 1' }
  if (ratio === '1:1') return { aspectRatio: '1 / 1', maxWidth: '180px' }
  return {}
})

const ratioClass = computed(() => {
  const ratio = ttsStore.wechatPublish.coverRatio
  return ratio === '2.35' ? 'headline' : ratio === '1:1' ? 'square' : 'original'
})

function onRatioChange(val: string | number | boolean) {
  ttsStore.setCoverRatio(val as CoverRatio)
}

async function pickLocal() {
  if (!ttsStore.config.wechat.appId) {
    ElMessage.warning(t('wechat.configMissing'))
    return
  }
  const filePath = await ipcRenderer.invoke('dialog:openFile', {
    title: t('wechat.pickCover'),
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }],
  })
  if (!filePath) return

  uploading.value = true
  try {
    // 统一走 uploadCoverSource：上传原图 + 去重缓存；裁剪由保存草稿时的 cover_info 完成
    const result = await ttsStore.uploadCoverSource(filePath, '')
    if (!result || result.errcode) {
      ElMessage.error(`${t('wechat.materialUploadFail')}: ${result?.errmsg || ''}`)
      return
    }
    emit('update:modelValue', result.media_id)
    emit('update:url', result.url)
    emit('meta', { width: result.width || 0, height: result.height || 0 })
    ElMessage.success(t('wechat.materialUploaded'))
  } finally {
    uploading.value = false
  }
}

function openLibrary() {
  libVisible.value = true
}

async function onPickFromLibrary(item: { media_id: string; url: string }) {
  emit('update:modelValue', item.media_id)
  emit('update:url', item.url)
  // 素材库直选同样要尺寸（cover_info 对它也生效）；读不到则 0，保存时退化为不裁剪
  const size = await imageSizeFromUrl(item.url)
  emit('meta', { width: size?.width || 0, height: size?.height || 0 })
}

function clear() {
  emit('update:modelValue', '')
  emit('update:url', '')
}
</script>

<style scoped>
.cover-picker {
  width: 100%;
}

.cover-preview {
  position: relative;
  width: 100%;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  overflow: hidden;
  background: #f5f7fa;
}

.cover-preview img {
  width: 100%;
  max-height: 160px;
  object-fit: cover;
  display: block;
}

/* 比例模式下容器有 aspect-ratio，图片填满容器并裁切 */
.cover-preview.ratio-headline img,
.cover-preview.ratio-square img {
  height: 100%;
  max-height: none;
}

.cover-actions {
  display: flex;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.92);
  border-top: 1px solid #ebeef5;
}

.cover-empty {
  display: flex;
  gap: 8px;
}

.cover-ratio {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.cover-ratio-label {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}
</style>
