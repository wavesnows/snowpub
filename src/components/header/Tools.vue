<template>
  <!-- MD 文件专属：视图模式切换 + 编辑辅助 + 发布 -->
  <template v-if="isMdFile">
    <!-- 组1：视图模式 -->
    <el-tooltip :content="t('tools.modeEdit')" class="tool-tooltip">
      <el-button size="small" circle class="tool-btn" :type="mdViewMode === 'edit' ? 'primary' : ''" @click="mdViewMode = 'edit'">
        <el-icon><EditPen /></el-icon>
      </el-button>
    </el-tooltip>
    <el-tooltip :content="t('tools.modePreview')" class="tool-tooltip">
      <el-button size="small" circle class="tool-btn" :type="mdViewMode === 'preview' ? 'primary' : ''" @click="mdViewMode = 'preview'">
        <el-icon><View /></el-icon>
      </el-button>
    </el-tooltip>
    <el-tooltip :content="t('tools.modeWechat')" class="tool-tooltip">
      <el-button size="small" circle class="tool-btn" :type="mdViewMode === 'wechat' ? 'primary' : ''" @click="mdViewMode = 'wechat'">
        <el-icon><Iphone /></el-icon>
      </el-button>
    </el-tooltip>
    <span class="tool-divider"></span>
    <!-- 组2：输出（复制 / 发布） -->
    <el-tooltip v-if="mdViewMode === 'preview'" :content="t('tools.copyAll')" class="tool-tooltip">
      <el-button size="small" circle class="tool-btn" @click="copyAll">
        <el-icon><CopyDocument /></el-icon>
      </el-button>
    </el-tooltip>
    <el-tooltip :content="hasWechatConfig ? t('wechat.publishBtn') : t('wechat.needConfig')" class="tool-tooltip">
      <el-button
        size="small"
        circle
        class="tool-btn"
        @click="handlePublishClick"
      >
        <el-icon><Promotion /></el-icon>
      </el-button>
    </el-tooltip>
    <span class="tool-divider"></span>
  </template>
  <!-- 组4：文件操作 -->
  <el-tooltip :content="t('tools.deleteFile')" class="tool-tooltip">
    <el-button size="small" circle class="tool-btn" @click="removeHandle">
      <el-icon><Delete /></el-icon>
    </el-button>
  </el-tooltip>
  <el-tooltip :content="t('tools.lockEditMode')" class="tool-tooltip">
    <el-button size="small" circle class="tool-btn" @click="editHandle">
      <el-icon v-show="readOnly == false"><Lock /></el-icon>
      <el-icon v-show="readOnly == true"><Edit /></el-icon>
    </el-button>
  </el-tooltip>
  <el-tooltip :content="t('history.viewHistory')" class="tool-tooltip">
    <el-button size="small" circle class="tool-btn" @click="openHistory">
      <el-icon><Clock /></el-icon>
    </el-button>
  </el-tooltip>
  <PublishDialog v-model="publishVisible" />
</template>
<script setup lang="ts">

import { computed, ref } from 'vue'
import { useTtsStore } from "@/store/store";
import { storeToRefs } from "pinia";
import {removeFile} from '@/libs/fileHandler'
import {ElMessageBox, ElMessage} from 'element-plus'
import { useI18n } from 'vue-i18n'
import { Clock, CopyDocument, Promotion } from '@element-plus/icons-vue'
import PublishDialog from '@/components/wechat/PublishDialog.vue'
import { log } from '@/libs/logger'

const { t } = useI18n()
const ttsStore = useTtsStore();
var { readOnly, inputs } = storeToRefs(ttsStore);

const isMdFile = computed(() => inputs.value.notePath?.endsWith('.md') ?? false)
const hasWechatConfig = computed(() => !!ttsStore.config.wechat.appId && !!ttsStore.config.wechat.appSecret)
const publishVisible = ref(false)

// 统一视图模式：edit（源码）| preview（预览）| wechat（公众号双栏）
// 桥接 store 的 mdMode / mdPreviewSplit 两个标志，保证三种状态两两互斥、均可直达
const mdViewMode = computed<'edit' | 'preview' | 'wechat'>({
  get: () => {
    if (ttsStore.mdPreviewSplit === 'wechat') return 'wechat'
    return ttsStore.mdMode === 'preview' ? 'preview' : 'edit'
  },
  set: (v) => {
    if (v === 'wechat') {
      ttsStore.setMdPreviewSplit('wechat')
      ttsStore.mdMode = 'edit'
    } else {
      ttsStore.setMdPreviewSplit('single')
      ttsStore.mdMode = v
    }
  }
})

function copyAll() {
  ttsStore.triggerMdCopy()
  ElMessage({ message: t('tools.copyAll'), type: 'success', duration: 2000 })
}

// 未配置公众号时引导到设置 → 微信，而不是静默禁用
function handlePublishClick() {
  if (hasWechatConfig.value) {
    publishVisible.value = true
  } else {
    ElMessage({ message: t('wechat.needConfig'), type: 'info', duration: 2500 })
    ttsStore.openSettings('wechat')
  }
}


function editHandle(){
  log("Edit Press")
  let v =ttsStore.readOnly
  readOnly.value = !v;
}

async function removeHandle(){
  ElMessageBox.confirm(
    t('tools.confirmDelete', { name: ttsStore.treeMenu.node.label }),
    t('common.delete'),
    {
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    }
  )
  .then(()=>{
    removeFile()
    })
  .catch(() => {
      // catch error
    })
  log("Remove Press")
}

function openHistory() {
  ttsStore.openHistoryViewer();
}

</script>

<style scoped>
  .button {
    -webkit-app-region: no-drag;
    display: flex;
    gap: 4px;
  }

  .tool-tooltip {
    display: inline-flex;
    margin: 0;
  }

  .tool-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    min-width: 24px;
    margin: 0 !important;
  }

  .tool-btn .el-icon {
    font-size: 14px;
  }

  .tool-divider {
    width: 1px;
    height: 16px;
    background: #dcdfe6;
    margin: 0 4px;
    display: inline-block;
  }

  :deep(.el-tooltip__trigger) {
    display: inline-flex;
    margin: 0;
  }

  :deep(.el-button) {
    margin: 0 !important;
  }
</style>
