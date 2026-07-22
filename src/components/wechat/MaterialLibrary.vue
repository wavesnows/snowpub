<template>
  <el-dialog
    v-model="visible"
    :title="t('wechat.materialTitle')"
    width="680px"
    :close-on-click-modal="false"
    @open="onOpen"
  >
    <div class="material-toolbar">
      <el-button type="primary" size="small" @click="pickAndUpload" :loading="uploading">
        {{ t('wechat.uploadImage') }}
      </el-button>
      <el-button size="small" @click="refresh" :loading="ttsStore.wechatPublish.materialLoading">
        {{ t('wechat.loadMaterials') }}
      </el-button>
      <span class="material-count" v-if="ttsStore.wechatPublish.materialTotal">
        {{ ttsStore.wechatPublish.materials.length }} / {{ ttsStore.wechatPublish.materialTotal }}
      </span>
    </div>
    <div v-loading="ttsStore.wechatPublish.materialLoading" class="material-grid">
      <div v-if="!ttsStore.wechatPublish.materials.length && !ttsStore.wechatPublish.materialLoading" class="empty-tip">
        {{ t('wechat.noMaterials') }}
      </div>
      <div
        v-for="item in ttsStore.wechatPublish.materials"
        :key="item.media_id"
        class="material-card"
        :class="{ selected: selectedId === item.media_id }"
        @click="onSelect(item)"
      >
        <img :src="item.url" :alt="item.name" loading="lazy" />
        <div class="material-footer">
          <span class="material-name" :title="item.name">{{ item.name }}</span>
          <el-button
            link
            type="danger"
            size="small"
            @click.stop="onDelete(item)"
            :icon="Delete"
          />
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { useTtsStore } from '@/store/store'
import { useI18n } from 'vue-i18n'
import { ipcRenderer } from 'electron'

const props = defineProps<{ modelValue: boolean; selectedId?: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', item: { media_id: string; url: string; name?: string }): void
}>()

const { t } = useI18n()
const ttsStore = useTtsStore()
const uploading = ref(false)
const visible = ref(props.modelValue)

// Sync visible prop (so close button inside el-dialog works)
watch(() => props.modelValue, v => { visible.value = v })
watch(visible, v => emit('update:modelValue', v))

function onOpen() {
  refresh()
}

async function refresh() {
  if (!ttsStore.config.wechat.appId) {
    ElMessage.warning(t('wechat.configMissing'))
    return
  }
  await ttsStore.loadImageMaterials(0, 20)
}

async function pickAndUpload() {
  if (!ttsStore.config.wechat.appId) {
    ElMessage.warning(t('wechat.configMissing'))
    return
  }
  const filePath = await ipcRenderer.invoke('dialog:openFile', {
    title: t('wechat.uploadImage'),
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
  })
  if (!filePath) return

  uploading.value = true
  try {
    const result = await ttsStore.addImageMaterial(filePath)
    if (result && result.errcode) {
      ElMessage.error(`${t('wechat.materialUploadFail')}: ${result.errmsg || result.errcode}`)
    } else {
      ElMessage.success(t('wechat.materialUploaded'))
      await refresh()
    }
  } finally {
    uploading.value = false
  }
}

async function onDelete(item: any) {
  try {
    await ElMessageBox.confirm(t('wechat.confirmDeleteMaterial'), t('common.confirm'), {
      type: 'warning',
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
    })
  } catch { return }
  const result = await ttsStore.deleteImageMaterial(item.media_id)
  if (result && result.errcode) {
    ElMessage.error(`${result.errmsg || result.errcode}`)
  } else {
    ElMessage.success(t('wechat.materialDeleted'))
    await refresh()
  }
}

function onSelect(item: any) {
  emit('select', { media_id: item.media_id, url: item.url, name: item.name })
  visible.value = false
}
</script>

<style scoped>
.material-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.material-count {
  margin-left: auto;
  font-size: 12px;
  color: #909399;
}

.material-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  min-height: 240px;
  max-height: 60vh;
  overflow-y: auto;
}

.empty-tip {
  grid-column: 1 / -1;
  text-align: center;
  color: #909399;
  padding: 40px 0;
  font-size: 13px;
}

.material-card {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.material-card:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.15);
}

.material-card.selected {
  border-color: #409eff;
  box-shadow: 0 0 0 2px #409eff inset;
}

.material-card img {
  width: 100%;
  height: 110px;
  object-fit: cover;
  display: block;
  background: #f5f7fa;
}

.material-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 6px;
  font-size: 12px;
}

.material-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #606266;
}
</style>
