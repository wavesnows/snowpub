<template>
  <el-drawer
    v-model="visible"
    :title="t('history.title')"
    direction="rtl"
    size="500px"
  >
    <!-- File name header -->
    <div class="history-header">
      <el-icon><Clock /></el-icon>
      <span class="file-name">{{ fileName }}</span>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="loading-container">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>{{ t('history.loading') }}</span>
    </div>

    <!-- Empty state: not in git -->
    <el-empty v-else-if="!isInGitRepo" :description="t('history.notInGitDesc')">
      <el-button type="primary" @click="goToSettings">
        {{ t('history.enableSync') }}
      </el-button>
    </el-empty>

    <!-- Empty state: no commits -->
    <el-empty v-else-if="commits.length === 0" :description="t('history.noHistory')" />

    <!-- 多选对比工具栏 -->
    <div v-if="selectedHashes.length > 0" class="diff-toolbar">
      <span class="diff-hint">{{ selectedHashes.length === 1 ? '再选一个版本对比' : '已选 2 个版本' }}</span>
      <el-button v-if="selectedHashes.length === 2" size="small" type="primary" @click="diffSelected">对比所选</el-button>
      <el-button size="small" @click="selectedHashes = []">取消</el-button>
    </div>

    <!-- Timeline of commits -->
    <el-scrollbar height="calc(100vh - 150px)">
      <el-timeline>
        <el-timeline-item
          v-for="commit in commits"
          :key="commit.hash"
          :timestamp="formatDate(commit.date)"
          placement="top"
        >
          <el-card class="commit-card" :class="{ 'is-selected': selectedHashes.includes(commit.hash) }" shadow="hover">
            <div class="commit-content">
              <div class="commit-message">{{ commit.message }}</div>
              <div class="commit-meta">
                <span class="commit-date">
                  <el-icon><Clock /></el-icon>
                  {{ formatDate(commit.date) }}
                </span>
                <span class="author">
                  <el-icon><User /></el-icon>
                  {{ commit.author_name }}
                </span>
                <span class="hash">
                  <el-icon><DocumentCopy /></el-icon>
                  {{ shortHash(commit.hash) }}
                </span>
              </div>
            </div>
            <div class="commit-actions">
              <span v-show="commit.hash === commits[0].hash" class="current-badge">当前</span>
              <el-button v-show="commit.hash !== commits[0].hash" size="small" @click="previewCommit(commit)">预览</el-button>
              <el-button v-show="commit.hash !== commits[0].hash" size="small" @click="diffWithCurrent(commit)">对比</el-button>
              <el-button v-show="commit.hash !== commits[0].hash" size="small" @click="toggleSelect(commit)">
                {{ selectedHashes.includes(commit.hash) ? '✕' : '选' }}
              </el-button>
              <el-button v-show="commit.hash !== commits[0].hash" size="small" type="primary" @click="confirmRestore(commit)">恢复</el-button>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </el-scrollbar>
  </el-drawer>

  <!-- Diff dialog -->
  <el-dialog
    v-model="diffVisible"
    :title="diffTitle"
    width="80%"
    top="4vh"
  >
    <div v-if="diffLoading" class="preview-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
    </div>
    <div v-else-if="!diffLines.length" class="preview-empty">
      <el-icon><Document /></el-icon>
      <p>两个版本内容相同</p>
    </div>
    <div v-else class="diff-content">
      <div
        v-for="(line, i) in diffLines"
        :key="i"
        class="diff-line"
        :class="line.type"
      ><span class="diff-sign">{{ line.sign }}</span><span class="diff-text">{{ line.text }}</span></div>
    </div>
    <template #footer>
      <el-button @click="diffVisible = false">{{ t('common.cancel') }}</el-button>
    </template>
  </el-dialog>

  <!-- Preview dialog -->
  <el-dialog
    v-model="previewVisible"
    :title="t('history.previewTitle')"
    width="70%"
    top="5vh"
  >
    <div class="preview-header">
      <span>{{ formatDate(selectedCommit?.date) }}</span>
      <span>{{ selectedCommit?.author_name }}</span>
    </div>
    <el-divider />
    <div class="preview-content">
      <div v-if="previewLoading" class="preview-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
      </div>
      <div v-else-if="previewError" class="preview-error">
        <el-icon><WarningFilled /></el-icon>
        <p>{{ t('history.previewFailed') }}</p>
        <p style="font-size: 12px; color: #909399;">This file may not exist in the selected commit</p>
      </div>
      <div v-else-if="!history.previewData" class="preview-error">
        No preview data available
      </div>
      <!-- 所有文件统一按纯文本预览 -->
      <div v-else-if="history.previewData._markdown" class="preview-markdown">
        <pre class="md-raw">{{ history.previewData._markdown }}</pre>
      </div>
      <div v-else class="preview-empty">
        <el-icon><Document /></el-icon>
        <p>This file was empty in this version</p>
      </div>
    </div>
    <template #footer>
      <el-button @click="previewVisible = false">
        {{ t('common.cancel') }}
      </el-button>
      <el-button type="primary" @click="confirmRestore(selectedCommit)">
        {{ t('history.restore') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTtsStore } from '@/store/store';
import { storeToRefs } from 'pinia';
import { ElMessageBox, ElMessage } from 'element-plus';
import { Clock, Loading, User, DocumentCopy, WarningFilled, Document } from '@element-plus/icons-vue';
import { basename } from 'path';
import { log } from '@/libs/logger'
const { ipcRenderer } = require('electron');

const { t } = useI18n();
const ttsStore = useTtsStore();
const { history, cnote } = storeToRefs(ttsStore);

const visible = computed({
  get: () => history.value.showDrawer,
  set: (val) => { history.value.showDrawer = val; }
});

const isLoading = computed(() => history.value.isLoading);
const isInGitRepo = computed(() => history.value.isInGitRepo);
const commits = computed(() => history.value.commits);
const fileName = computed(() => {
  const path = cnote.value.lastPath;
  return path ? basename(path).replace('.json', '') : '';
});

const previewVisible = ref(false);
const previewLoading = ref(false);

// ── Diff 状态 ──────────────────────────────────────────────
const selectedHashes = ref<string[]>([])
const diffVisible = ref(false)
const diffLoading = ref(false)
const diffTitle = ref('')
interface DiffLine { type: 'add' | 'del' | 'hunk' | 'normal'; sign: string; text: string }
const diffLines = ref<DiffLine[]>([])

function toggleSelect(commit: any) {
  const h = commit.hash
  if (selectedHashes.value.includes(h)) {
    selectedHashes.value = selectedHashes.value.filter(x => x !== h)
  } else if (selectedHashes.value.length < 2) {
    selectedHashes.value = [...selectedHashes.value, h]
  }
}

async function runDiff(hashA: string, hashB: string | null, title: string) {
  const filePath = ttsStore.cnote.lastPath
  const { getRepoPath } = await import('@/libs/gitHistory')
  const repoPath = getRepoPath(filePath)
  if (!repoPath) { ElMessage({ type: 'warning', message: '文件不在 git 仓库中' }); return }
  diffTitle.value = title
  diffVisible.value = true
  diffLoading.value = true
  diffLines.value = []
  try {
    const { diff } = await ipcRenderer.invoke('git:diff', { repoPath, hashA, hashB, filePath })
    diffLines.value = parseDiff(diff)
  } finally {
    diffLoading.value = false
  }
}

function parseDiff(raw: string): DiffLine[] {
  const lines: DiffLine[] = []
  for (const line of raw.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ')) continue
    if (line.startsWith('@@')) {
      lines.push({ type: 'hunk', sign: '', text: line })
    } else if (line.startsWith('+')) {
      lines.push({ type: 'add', sign: '+', text: line.slice(1) })
    } else if (line.startsWith('-')) {
      lines.push({ type: 'del', sign: '-', text: line.slice(1) })
    } else {
      lines.push({ type: 'normal', sign: ' ', text: line.slice(1) })
    }
  }
  return lines
}

async function diffWithCurrent(commit: any) {
  await runDiff(commit.hash, null, `${shortHash(commit.hash)} vs 当前版本`)
}

async function diffSelected() {
  const [a, b] = selectedHashes.value
  await runDiff(a, b, `${shortHash(a)} vs ${shortHash(b)}`)
  selectedHashes.value = []
}
const previewError = ref(false);
const selectedCommit = ref<any>(null);

// Format date for display — show absolute date + relative time
function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = Date.now();
  const diff = now - date.getTime();

  const pad = (n: number) => String(n).padStart(2, '0');
  const absolute = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`

  let relative = '';
  if (diff < 60000) relative = '刚刚';
  else if (diff < 3600000) relative = `${Math.floor(diff/60000)} 分钟前`;
  else if (diff < 86400000) relative = `${Math.floor(diff/3600000)} 小时前`;
  else if (diff < 86400000 * 7) relative = `${Math.floor(diff/86400000)} 天前`;

  return relative ? `${absolute}（${relative}）` : absolute;
}

// Shorten commit hash
function shortHash(hash: string): string {
  return hash.substring(0, 7);
}

// Preview commit
async function previewCommit(commit: any) {
  log('Preview button clicked for commit:', commit.hash);
  selectedCommit.value = commit;
  previewVisible.value = true;
  previewLoading.value = true;
  previewError.value = false;

  try {
    log('Calling ttsStore.previewCommit...');
    await ttsStore.previewCommit(commit);
    log('Preview data loaded successfully');
    previewLoading.value = false;
  } catch (error: any) {
    console.error('Preview error:', error);
    console.error('Error message:', error?.message);
    previewError.value = true;
    previewLoading.value = false;
  }
}

// Confirm restore
async function confirmRestore(commit: any) {
  if (!commit) return;

  const date = formatDate(commit.date);

  try {
    await ElMessageBox.confirm(
      t('history.restoreConfirmDesc'),
      t('history.restoreConfirm', { date }),
      {
        confirmButtonText: t('common.ok'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    );

    await ttsStore.restoreToCommit(commit);

    ElMessage({
      type: 'success',
      message: t('history.restoreSuccess', { date }),
    });

    visible.value = false;
    previewVisible.value = false;
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage({
        type: 'error',
        message: t('history.restoreFailed'),
      });
    }
  }
}

// Navigate to settings
function goToSettings() {
  visible.value = false;
  ttsStore.config.drawer = true;
}
</script>

<style scoped>
.history-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 16px;
}

.file-name {
  font-weight: 500;
  font-size: 14px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
}

.commit-card {
  cursor: pointer;
  margin-bottom: 12px;
}

.commit-content {
  margin-bottom: 12px;
}

.commit-message {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #303133;
}

.commit-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #909399;
}

.commit-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.commit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #606266;
}

.preview-content {
  min-height: 400px;
  max-height: 60vh;
  overflow-y: auto;
}

.preview-editor {
  padding: 20px;
}

.preview-loading,
.preview-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 12px;
}

.preview-error {
  color: #f56c6c;
}

.preview-error .el-icon {
  font-size: 48px;
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 12px;
  color: #909399;
}

.preview-empty .el-icon {
  font-size: 48px;
}

.diff-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--el-color-primary-light-9, #ecf5ff);
  border-bottom: 1px solid var(--el-border-color, #ddd);
  font-size: 13px;
}
.diff-hint { flex: 1; color: #606266; }

.commit-card.is-selected {
  border-color: var(--el-color-primary, #409eff);
  box-shadow: 0 0 0 1px var(--el-color-primary, #409eff);
}

.diff-content {
  max-height: 65vh;
  overflow-y: auto;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
}

.diff-line {
  display: flex;
  padding: 1px 8px;
  white-space: pre-wrap;
  word-break: break-all;
}
.diff-line.add { background: #f0fff4; color: #1a7f37; }
.diff-line.del { background: #fff5f5; color: #cf222e; }
.diff-line.hunk { background: #f6f8fa; color: #57606a; font-style: italic; }
.diff-line.normal { color: #303133; }
.diff-sign { width: 16px; flex-shrink: 0; user-select: none; }

.current-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 3px;
  background: var(--el-color-success-light-9, #f0f9eb);
  color: var(--el-color-success, #67c23a);
  border: 1px solid var(--el-color-success-light-5, #b3e19d);
}

.preview-markdown {
  max-height: 60vh;
  overflow-y: auto;
}

.md-raw {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: #303133;
  margin: 0;
}
</style>
