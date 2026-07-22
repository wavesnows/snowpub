<template>
  <div class="cover-picker">
    <div v-if="modelValue" class="cover-preview">
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

const props = defineProps<{ modelValue: string; url?: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'update:url', v: string): void
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
    const result = await ttsStore.addImageMaterial(filePath)
    if (result && result.errcode) {
      ElMessage.error(`${t('wechat.materialUploadFail')}: ${result.errmsg || result.errcode}`)
      return
    }
    emit('update:modelValue', result.media_id)
    emit('update:url', result.url)
    ElMessage.success(t('wechat.materialUploaded'))
  } finally {
    uploading.value = false
  }
}

function openLibrary() {
  libVisible.value = true
}

function onPickFromLibrary(item: { media_id: string; url: string }) {
  emit('update:modelValue', item.media_id)
  emit('update:url', item.url)
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
</style>
