<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('search.results', { count: ttsStore.search.results.length })"
    width="700px"
    :close-on-click-modal="true"
    @close="handleClose"
  >
    <div class="search-results" ref="listEl" @scroll="handleScroll">
      <!-- Empty state -->
      <el-empty
        v-if="!ttsStore.search.isSearching && ttsStore.search.results.length === 0"
        :description="t('search.noResults')"
      />

      <!-- Loading state -->
      <div v-if="ttsStore.search.isSearching" class="loading-container">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>{{ t('search.searching') }}</span>
      </div>

      <!-- Results list -->
      <div v-else class="results-list">
        <div
          v-for="(result, index) in ttsStore.search.results"
          :key="index"
          class="result-item"
          @click="handleResultClick(result)"
        >
          <div class="result-header">
            <el-icon class="file-icon"><Document /></el-icon>
            <span class="file-name">{{ result.fileName }}</span>
            <el-tag size="small" type="info" class="block-type">{{ result.blockType }}</el-tag>
          </div>
          <div class="result-context" v-html="highlightedContext(result)"></div>
          <div class="result-path">{{ result.filePath }}</div>
        </div>
        <!-- Load more indicator -->
        <div v-if="ttsStore.search.isLoadingMore" class="load-more-indicator">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>加载更多...</span>
        </div>
        <div v-else-if="ttsStore.search.session?.done && ttsStore.search.results.length > 0" class="all-loaded">
          共 {{ ttsStore.search.results.length }} 条结果
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Document, Loading } from '@element-plus/icons-vue';
import { useTtsStore } from '@/store/store';
import { highlightMatches, type SearchResult } from '@/libs/searchUtil';
import { useI18n } from 'vue-i18n';
import fs from 'fs';

const { t } = useI18n();
const ttsStore = useTtsStore();
const listEl = ref<HTMLElement | null>(null);

function handleScroll() {
  const el = listEl.value;
  if (!el) return;
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 60;
  if (nearBottom && !ttsStore.search.isLoadingMore && !ttsStore.search.session?.done) {
    ttsStore.loadMoreSearchResults();
  }
}

const dialogVisible = computed({
  get: () => ttsStore.search.showResults,
  set: (val) => {
    if (!val) {
      ttsStore.clearSearch();
    }
  }
});

const highlightedContext = (result: SearchResult) => {
  return highlightMatches(result.context, ttsStore.search.query);
};

const handleResultClick = (result: SearchResult) => {
  try {
    if (!fs.existsSync(result.filePath)) return;

    ttsStore.cnote.title = result.fileName;
    ttsStore.cnote.lastPath = result.filePath;
    ttsStore.inputs.notePath = result.filePath;
    ttsStore.setLastEditNote();

    // 所有文件内容由 MarkdownEditor 的 notePath watcher 加载
    ttsStore.clearSearch();
  } catch (error) {
    console.error('Error loading note:', error);
  }
};

const handleClose = () => {
  ttsStore.clearSearch();
};
</script>

<style scoped>
.search-results {
  max-height: 600px;
  overflow-y: auto;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 10px;
}

.is-loading {
  font-size: 32px;
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item {
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.result-item:hover {
  background-color: #f5f7fa;
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.file-icon {
  color: #409eff;
  font-size: 16px;
}

.file-name {
  font-weight: 600;
  color: #303133;
  flex: 1;
}

.block-type {
  text-transform: capitalize;
}

.result-context {
  color: #606266;
  line-height: 1.6;
  margin-bottom: 8px;
  word-break: break-word;
}

.result-context :deep(mark) {
  background-color: #ffd04b;
  color: #303133;
  padding: 2px 4px;
  border-radius: 2px;
  font-weight: 600;
}

.result-path {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.load-more-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: #909399;
  font-size: 13px;
}

.all-loaded {
  text-align: center;
  padding: 12px;
  color: #c0c4cc;
  font-size: 12px;
}
</style>
