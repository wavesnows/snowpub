<template>
  <div class="recent-container">
    <div class="recent-header">
      <h3>{{ t('recent.title') }}</h3>
      <span class="count" v-if="recentInNotebook.length > 0">{{ recentInNotebook.length }}</span>
    </div>

    <el-scrollbar height="100%" width="100%">
      <div v-if="recentInNotebook.length === 0" class="empty-state">
        <el-icon class="empty-icon" :size="48"><Clock /></el-icon>
        <p>{{ t('recent.empty') }}</p>
      </div>

      <div v-else class="recent-list">
        <div
          v-for="file in recentInNotebook"
          :key="file.path"
          class="recent-item"
          @click="openFile(file)"
        >
          <div class="item-content">
            <span class="file-icon">{{ file.path.endsWith('.md') ? '📝' : '📄' }}</span>
            <div class="file-info">
              <span class="file-name">{{ file.label }}</span>
              <span class="file-time">{{ formatTime(file.time) }}</span>
            </div>
          </div>
          <div class="item-actions">
            <el-button size="small" text @click.stop="removeRecent(file.path)" title="移除">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTtsStore } from '@/store/store'
import { Clock, Close } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import fs from 'fs'

const { t } = useI18n()
const ttsStore = useTtsStore()

// Only show files in current notebook
const recentInNotebook = computed(() => {
  const notebookPath = ttsStore.notebook.currentPath
  return ttsStore.recentFiles.filter((f: any) =>
    f.path.startsWith(notebookPath) && fs.existsSync(f.path)
  )
})

function openFile(file: { path: string; label: string; time: number }) {
  ttsStore.inputs.notePath = file.path
  ttsStore.cnote.title = file.label
  ttsStore.cnote.destTitle = file.label
  ttsStore.cnote.lastPath = file.path
  ttsStore.addRecentFile(file.path, file.label)
  ttsStore.setLastEditNote()
  // 文件内容由 MarkdownEditor 的 notePath watcher 加载
}

function removeRecent(path: string) {
  ttsStore.recentFiles = ttsStore.recentFiles.filter((f: any) => f.path !== path)
  const { store } = require('@/global/initLocalStore')
  store.set('recentFiles', ttsStore.recentFiles)
}

function formatTime(time: number): string {
  const now = Date.now()
  const diff = now - time
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return t('statusBar.justNow')
  if (minutes < 60) return t('statusBar.minutesAgo', { count: minutes })
  if (hours < 24) return t('statusBar.hoursAgo', { count: hours })
  if (days < 7) return t('statusBar.daysAgo', { count: days })
  return new Date(time).toLocaleDateString()
}
</script>

<style scoped>
.recent-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 10px;
}

.recent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 0 5px;
}

.recent-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.count {
  background-color: #909399;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #909399;
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 4px 0;
  font-size: 14px;
}

.recent-list {
  flex: 1;
  padding-bottom: 50px;
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.recent-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.item-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.file-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #303133;
}

.file-time {
  font-size: 11px;
  color: #909399;
}

.item-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

.recent-item:hover .item-actions {
  opacity: 1;
}

.item-actions .el-button {
  padding: 4px;
  min-height: auto;
}
</style>
