<template>
  <div class="favorites-container">
    <div class="favorites-header">
      <h3>{{ t('favorites.title') }}</h3>
      <span class="count">{{ starredNotes.length }}</span>
    </div>

    <el-scrollbar height="100%" width="100%">
      <div v-if="starredNotes.length === 0" class="empty-state">
        <el-icon class="empty-icon" :size="48"><StarFilled /></el-icon>
        <p>{{ t('favorites.empty') }}</p>
        <p class="hint">{{ t('favorites.hint') }}</p>
      </div>

      <div v-else class="favorites-list">
        <div
          v-for="note in starredNotes"
          :key="note.path"
          class="favorite-item"
          @click="openNote(note)">
          <div class="item-content">
            <el-icon class="star-icon" color="#f7ba2a"><StarFilled /></el-icon>
            <span class="note-name">{{ note.label }}</span>
            <el-icon
              class="pin-icon"
              v-if="ttsStore.isPinned(note.path)">
              📌
            </el-icon>
          </div>
          <div class="item-actions">
            <el-button
              size="small"
              text
              @click.stop="removeStar(note.path)"
              :title="t('favorites.removeStar')">
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
import { useTtsStore } from "@/store/store"
import { StarFilled, Close } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import fs from 'fs'
import { basename } from 'path'

const { t } = useI18n()
const ttsStore = useTtsStore()

// 获取当前笔记本的星标笔记
const starredNotes = computed(() => {
  const starred = ttsStore.favorites.starred
  const currentNotebookPath = ttsStore.notebook.currentPath
  const notes: Array<{path: string, label: string}> = []

  starred.forEach((path: string) => {
    // 只显示当前笔记本中的星标笔记
    if (path.startsWith(currentNotebookPath) && fs.existsSync(path)) {
      const label = basename(path).replace('.json', '')
      notes.push({ path, label })
    }
  })

  return notes
})

// 打开笔记
const openNote = (note: {path: string, label: string}) => {
  if (!fs.existsSync(note.path)) return
  ttsStore.inputs.notePath = note.path
  ttsStore.cnote.title = note.label
  ttsStore.cnote.destTitle = note.label
  ttsStore.cnote.lastPath = note.path
  ttsStore.addRecentFile(note.path, note.label)
  ttsStore.setLastEditNote()
  // 文件内容由 MarkdownEditor 的 notePath watcher 加载
}

// 移除星标
const removeStar = (path: string) => {
  ttsStore.toggleStar(path)
}
</script>

<style scoped>
.favorites-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 10px;
}

.favorites-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 0 5px;
}

.favorites-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.count {
  background-color: #f7ba2a;
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

.hint {
  font-size: 12px;
  opacity: 0.7;
}

.favorites-list {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 50px; /* Add padding to avoid being covered by AConfig buttons */
}

.favorite-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.favorite-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.item-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.star-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.note-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.pin-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.item-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

.favorite-item:hover .item-actions {
  opacity: 1;
}

.item-actions .el-button {
  padding: 4px;
  min-height: auto;
}
</style>
