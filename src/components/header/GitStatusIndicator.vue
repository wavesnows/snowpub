<template>
  <div v-if="showIndicator" class="git-status-indicator">
    <el-button
      size="small"
      circle
      :type="buttonType"
      @click="handleClick"
      :loading="gitStatus.isChecking"
      :disabled="!hasChanges"
      :title="tooltipContent"
    >
      <el-icon>
        <Upload />
      </el-icon>
    </el-button>
    <span v-if="showBadge" class="badge-text">{{ badgeValue }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTtsStore } from '@/store/store';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { Upload } from '@element-plus/icons-vue';
import { gitHubPush } from '@/libs/github';
import fs from 'fs';
import { join } from 'path';

const { t } = useI18n();
const ttsStore = useTtsStore();
const { gitStatus } = storeToRefs(ttsStore);


// 仅当当前笔记本本身是 git 仓库且 git 可用时显示（与侧栏 git 同步按钮同一口径）
const showIndicator = computed(() => {
  if (!ttsStore.gitAvailable) return false;
  return fs.existsSync(join(ttsStore.notebook.currentPath, '.git'));
});

// Check if there are any changes
const hasChanges = computed(() => {
  return gitStatus.value.hasUnpushed || gitStatus.value.hasUncommitted;
});

// Show badge if there are unpushed commits or uncommitted changes
const showBadge = computed(() => {
  return hasChanges.value;
});

// Badge value shows number of commits ahead or files changed
const badgeValue = computed(() => {
  if (gitStatus.value.hasUnpushed) {
    return gitStatus.value.ahead;
  }
  if (gitStatus.value.hasUncommitted) {
    return gitStatus.value.filesChanged;
  }
  return 0;
});

// Button type changes based on status
const buttonType = computed(() => {
  return (gitStatus.value.hasUnpushed || gitStatus.value.hasUncommitted) ? 'warning' : 'default';
});

// Tooltip content
const tooltipContent = computed(() => {
  if (gitStatus.value.isChecking) {
    return t('git.checking');
  }

  const parts = [];

  if (gitStatus.value.hasUncommitted) {
    parts.push(t('git.uncommittedChanges', { count: gitStatus.value.filesChanged }));
    if (gitStatus.value.changedFiles?.length > 0) {
      gitStatus.value.changedFiles.forEach((f: string) => parts.push(`  ${f}`));
    }
  }

  if (gitStatus.value.hasUnpushed) {
    parts.push(t('git.unpushedCommits', { count: gitStatus.value.ahead }));
  }

  if (gitStatus.value.behind > 0) {
    parts.push(t('git.behindRemote', { count: gitStatus.value.behind }));
  }

  if (parts.length === 0) {
    return t('git.upToDate');
  }

  return parts.join('\n');
});

async function handleClick() {
  try {
    await gitHubPush(t);
    // Git status will be checked automatically by gitHubPush
  } catch (error) {
    console.error('Push failed:', error);
  }
}
</script>

<style scoped>
.git-status-indicator {
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;
  position: relative;
  transform: scale(0.8);
}

.badge-text {
  position: absolute;
  top: -3px;
  right: -3px;
  background: #f56c6c;
  color: white;
  border-radius: 8px;
  padding: 0 4px;
  font-size: 10px;
  line-height: 14px;
  min-width: 14px;
  text-align: center;
  -webkit-app-region: no-drag;
  pointer-events: none;
  font-weight: bold;
}

.status-badge {
  -webkit-app-region: no-drag;
}

.status-btn {
  -webkit-app-region: no-drag;
}

.is-loading {
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
</style>
