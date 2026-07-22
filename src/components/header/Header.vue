<template>
  <div class="header">
    <div class="win-tools">
      <el-button
        type="danger"
        size="small"
        circle
        class="circle-btn"
        @click="ipcRenderer.send('close')"
        @mouseenter="currShow = 1"
        @mouseleave="currShow = 0"
      >
        <el-icon v-show="currShow == 1"><Close /></el-icon>
      </el-button>
      <el-button
        type="warning"
        size="small"
        circle
        class="circle-btn"
        @click="ipcRenderer.send('min')"
        @mouseenter="currShow = 2"
        @mouseleave="currShow = 0"
      >
        <el-icon v-show="currShow == 2"><Minus /></el-icon>
      </el-button>
      <el-button
        type="success"
        size="small"
        circle
        class="circle-btn"
        @click="ipcRenderer.send('window-maximize')"
        @mouseenter="currShow = 3"
        @mouseleave="currShow = 0"
      >
        <el-icon v-show="currShow == 3"><FullScreen /></el-icon>
      </el-button>
      <el-tooltip :content="t('help.keyboardShortcuts')" placement="bottom">
        <el-button
          size="small"
          circle
          class="circle-btn"
          @click="ttsStore.openHelpDialog()"
        >
          <el-icon><QuestionFilled /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="GitHub" placement="bottom">
        <button class="circle-btn github-btn" @click="openGithub">
          <svg height="13" width="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </button>
      </el-tooltip>
    </div>
    <!-- <Title></Title> -->
   <!-- <Logo />-->
    <Breadcrumb />
    <div class="right-section">
      <SearchBar />
      <GitStatusIndicator />
      <div class="tools">
        <Tools />
      </div>
    </div>
    <SearchResults />
   

  </div>
</template>

<script lang="ts" setup>
import Logo from "./Logo.vue";
import Tools from "./Tools.vue";
import Title from "./HeadTitle.vue"
import SearchBar from "./SearchBar.vue"
import SearchResults from "../search/SearchResults.vue"
import GitStatusIndicator from "./GitStatusIndicator.vue"
import Breadcrumb from "../note/Breadcrumb.vue"
import { ref, onMounted, onUnmounted } from "vue";
import { useTtsStore } from "@/store/store";
import { ElMessage } from 'element-plus';
import { QuestionFilled } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { log } from '@/libs/logger'

const { ipcRenderer } = require("electron");
const { shell } = require("electron");
const { t } = useI18n();
const currShow = ref(0);
const ttsStore = useTtsStore();

// Handle keyboard shortcuts
const handleKeyDown = (event: KeyboardEvent) => {
  // CMD/Ctrl + Shift + P for push
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'P') {
    event.preventDefault();

    // Only trigger if there are changes to push
    const hasChanges = ttsStore.gitStatus.hasUnpushed || ttsStore.gitStatus.hasUncommitted;
    if (!hasChanges) {
      log('No changes to push, ignoring shortcut');
      return;
    }

    // Trigger push via GitStatusIndicator button
    const gitButton = document.querySelector('.git-status-indicator .el-button') as HTMLElement;
    if (gitButton && !gitButton.classList.contains('is-disabled')) {
      gitButton.click();
    }
  }
};

// Start Git status check on mount
onMounted(() => {
  ttsStore.startGitStatusCheck();
  // Add keyboard event listener
  window.addEventListener('keydown', handleKeyDown);
});

// Cleanup on unmount
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

function openGithub() {
  shell.openExternal('https://github.com/wavesnows/snowpub');
}
</script>

<style scoped>
.header {
  height: 36px;
  background: #eee;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  display: flex;
  align-items: center;
  justify-items: auto;
  justify-content: space-between;
  padding: 0 8px;
  -webkit-app-region: drag;
}

.win-tools {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.win-tools .circle-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  min-width: 20px;
  margin-right: 2px !important;
  margin-left: 0 !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  border: none;
  transition: opacity 0.2s;
}

.win-tools .circle-btn:last-child {
  margin-right: 0 !important;
}

.win-tools .circle-btn:hover {
  opacity: 0.8;
}

.github-btn {
  width: 20px;
  height: 20px;
  min-width: 20px;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: #606266;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: color 0.2s, background 0.2s;
}

.github-btn:hover {
  color: #303133;
  background: rgba(0,0,0,0.08);
  opacity: 1;
}

.win-tools .el-icon {
  font-size: 12px;
}

.right-section {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 4px;
  -webkit-app-region: no-drag;
}

.tools {
  display: flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.tools .tool-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  min-width: 24px;
}

.tools .el-icon {
  font-size: 14px;
}
</style>
