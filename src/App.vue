<script setup lang="ts">
import { onMounted, onUnmounted, h } from 'vue';
import { useTtsStore } from "@/store/store";
import Header from "./components/header/Header.vue";
import Aside from "./components/aside/Aside.vue";
import Bside from "./components/aside/Bside.vue";
import HomeMain from "./components/note/HomeMain.vue";
import Footer from "./components/footer/NoteFooter.vue";
import HistoryViewer from "./components/history/HistoryViewer.vue";
import KeyboardShortcuts from "./components/help/KeyboardShortcuts.vue";
import TerminalPanel from "./components/terminal/TerminalPanel.vue";
import { autoPull } from '@/libs/github';
import { ElNotification, ElButton, ElProgress } from 'element-plus';
import { useI18n } from 'vue-i18n';

const { ipcRenderer } = require('electron');
const ttsStore = useTtsStore();
const { t } = useI18n();

// Handle global keyboard shortcuts
const handleKeyDown = (event: KeyboardEvent) => {
  // Cmd/Ctrl + ? for help
  if ((event.metaKey || event.ctrlKey) && event.key === '?' && !event.shiftKey) {
    event.preventDefault();
    ttsStore.openHelpDialog();
  }
  // Ctrl+` to toggle terminal
  if (event.ctrlKey && event.key === '`') {
    event.preventDefault();
    ttsStore.toggleTerminal();
  }
  // Alt+↑/↓ to navigate between files
  if (event.altKey && event.key === 'ArrowDown') {
    event.preventDefault();
    ttsStore.navigateNote('next');
  }
  if (event.altKey && event.key === 'ArrowUp') {
    event.preventDefault();
    ttsStore.navigateNote('prev');
  }
};

const handleFocus = () => {
  ttsStore.scheduleTreeRefresh();
};

const flushPreferences = () => {
  ttsStore.setLastEditNote();
  ttsStore.flushPendingPreferences();
};

// ── Auto-update notifications ──────────────────────────────────────────────
let progressNotif: any = null;

function onUpdateAvailable(_: any, info: any) {
  ElNotification({
    title: t('update.available', { version: info.version }),
    message: h('div', { style: 'display:flex;gap:8px;margin-top:8px' }, [
      h(ElButton, {
        type: 'primary', size: 'small',
        onClick: async () => {
          progressNotif = ElNotification({
            title: t('update.downloading', { percent: 0 }),
            message: h(ElProgress, { percentage: 0, strokeWidth: 6 }),
            duration: 0,
          });
          await ipcRenderer.invoke('updater:download');
        }
      }, () => t('update.download')),
      h(ElButton, { size: 'small' }, () => t('update.later')),
    ]),
    duration: 0,
    position: 'bottom-right',
  });
}

function onUpdateProgress(_: any, progress: any) {
  const pct = Math.floor(progress.percent);
  if (progressNotif) {
    progressNotif.close();
    progressNotif = ElNotification({
      title: t('update.downloading', { percent: pct }),
      message: h(ElProgress, { percentage: pct, strokeWidth: 6 }),
      duration: 0,
      position: 'bottom-right',
    });
  }
}

function onUpdateDownloaded() {
  if (progressNotif) { progressNotif.close(); progressNotif = null; }
  ElNotification({
    title: t('update.downloaded'),
    message: h('div', { style: 'margin-top:8px' },
      h(ElButton, {
        type: 'primary', size: 'small',
        onClick: () => ipcRenderer.invoke('updater:install'),
      }, () => t('update.restart'))
    ),
    duration: 0,
    position: 'bottom-right',
    type: 'success',
  });
}

const AUTO_PULL_INTERVAL = 30 * 60 * 1000 // 30 分钟
let autoPullTimer: ReturnType<typeof setInterval> | null = null

function canAutoPull(): boolean {
  const c = ttsStore.config
  return ttsStore.gitAvailable &&
    !!(c.githubUsername || c.giteeUsername) &&
    !!(c.githubToken || c.giteeToken) &&
    !!c.githubRepoName
}

async function runAutoPull() {
  if (!canAutoPull()) return
  const { success, backedUp } = await autoPull(t, ttsStore.notebook.currentPath)
  if (success && backedUp.length > 0) {
    ElNotification({
      title: t('github.conflictBackupTitle'),
      message: t('github.conflictBackupDesc') + '\n' + backedUp.join('\n'),
      type: 'warning',
      duration: 8000,
      position: 'bottom-right',
    })
  }
}

onMounted(() => {
  ttsStore.buildFlatFileList();
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('focus', handleFocus);
  window.addEventListener('beforeunload', flushPreferences);

  // Get git availability from main process
  ipcRenderer.invoke('get-git-available').then((available: boolean) => {
    ttsStore.gitAvailable = available;
    // 启动后延迟 5 秒自动拉取一次
    setTimeout(runAutoPull, 5000)
  });
  ipcRenderer.on('git-available', (_: any, available: boolean) => {
    ttsStore.gitAvailable = available;
  });

  // 每 30 分钟自动拉取
  autoPullTimer = setInterval(runAutoPull, AUTO_PULL_INTERVAL)

  ipcRenderer.on('updater:available', onUpdateAvailable);
  ipcRenderer.on('updater:progress', onUpdateProgress);
  ipcRenderer.on('updater:downloaded', onUpdateDownloaded);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('focus', handleFocus);
  window.removeEventListener('beforeunload', flushPreferences);
  flushPreferences();
  if (autoPullTimer) clearInterval(autoPullTimer)
  ipcRenderer.removeListener('updater:available', onUpdateAvailable);
  ipcRenderer.removeListener('updater:progress', onUpdateProgress);
  ipcRenderer.removeListener('updater:downloaded', onUpdateDownloaded);
});

</script>

<template>
  <div class="app">
    <el-container>
      <el-header><Header /></el-header>
      <el-container class="container">
        <el-aside><Aside /></el-aside>
        <el-aside><Bside /></el-aside>
        <el-container class="main-footer">
          <div id="result"></div>
          <el-main><HomeMain /></el-main>
          <el-footer><Footer /></el-footer>
        </el-container>
      </el-container>
    </el-container>
    <TerminalPanel v-show="ttsStore.terminal.show" />
    <HistoryViewer />
    <KeyboardShortcuts />
  </div>
</template>

<style>

* {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

:root{
    --note-foot-bgcolor: #eee;
    --note-side-bgcolor: #DDD;
}

body {
  margin: 0;
  /* height: 570px; */
}

.app {
  background-color: #f2f3f5;
  border-radius: 10px;
}
.el-header {
  border: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  height: auto !important;
  -webkit-app-region: drag;
}
.el-aside {
  width: auto !important;
  overflow: hidden !important;
}
.container {
  height: calc(100vh - 36px);
}
.el-main,
.el-footer {
  border: 0 !important;
  padding: 0 !important;
  margin-left: 0;
  height:auto  !important;
}
.main-footer {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.el-button {
  -webkit-app-region: no-drag;
}

.el-drawer,
.el-drawer * {
  -webkit-app-region: no-drag;
}

/* Allow tab content to scroll in drawers */
.el-drawer .el-tabs--left {
  overflow: visible !important;
}
.el-drawer .el-tabs--left .el-tabs__content {
  overflow-y: auto !important;
  height: 100%;
}

.el-dialog,
.el-dialog * {
  -webkit-app-region: no-drag;
}

/* Global override for EditorJS width constraints */
.ce-block__content,
.ce-toolbar__content {
  max-width: 100% !important;
}

.ce-block {
  max-width: 100% !important;
}

/* Git dropdown menu light style */
.git-dropdown.el-dropdown-menu {
  background-color: #fff !important;
  border: none !important;
  border-radius: 6px !important;
  padding: 4px !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12) !important;
}

.git-dropdown .el-dropdown-menu__item {
  color: #303133 !important;
  border-radius: 4px !important;
  font-size: 13px !important;
  transition: background-color 0.15s;
}

.git-dropdown .el-dropdown-menu__item:hover {
  background-color: #f0f7ff !important;
  color: #409eff !important;
}

.git-dropdown .el-dropdown-menu__item .el-icon {
  color: #606266 !important;
}

.git-dropdown .el-dropdown-menu__item:hover .el-icon {
  color: #409eff !important;
}

/* Tree context menu light style */
.tree-context-menu.el-dropdown-menu {
  background-color: #fff !important;
  border: none !important;
  border-radius: 6px !important;
  padding: 4px !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12) !important;
}

.tree-context-menu .el-dropdown-menu__item {
  color: #303133 !important;
  border-radius: 4px !important;
  margin: 1px 0 !important;
  transition: background-color 0.15s;
  font-size: 13px !important;
}

.tree-context-menu .el-dropdown-menu__item:hover {
  background-color: #f0f7ff !important;
  color: #409eff !important;
}

.tree-context-menu .el-dropdown-menu__item .el-icon {
  color: #606266 !important;
}

.tree-context-menu .el-dropdown-menu__item:hover .el-icon {
  color: #409eff !important;
}

.tree-context-menu .el-dropdown-menu__item.is-divided {
  border-top: 1px solid #f0f0f0 !important;
  margin-top: 4px !important;
  padding-top: 4px !important;
}
</style>
