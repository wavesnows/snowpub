<template>
  <el-dialog
    v-model="visible"
    :title="t('help.title')"
    width="80%"
    top="5vh"
    @close="handleClose"
  >
    <div class="help-layout">
      <!-- Left nav -->
      <div class="help-nav">
        <div
          v-for="section in sections"
          :key="section.id"
          class="nav-item"
          :class="{ active: activeSection === section.id }"
          @click="activeSection = section.id"
        >
          {{ section.label }}
        </div>
      </div>

      <!-- Right content -->
      <div class="help-content" ref="contentEl">
        <!-- Getting Started -->
        <template v-if="activeSection === 'start'">
          <h2>{{ t('help.gettingStarted') }}</h2>
          <p>{{ t('help.startDesc') }}</p>
          <h3>{{ t('help.notebookStructure') }}</h3>
          <ul>
            <li>{{ t('help.structureItem1') }}</li>
            <li>{{ t('help.structureItem2') }}</li>
            <li>{{ t('help.structureItem3') }}</li>
          </ul>
          <h3>{{ t('help.noteTypes') }}</h3>
          <ul>
            <li><strong>.md</strong> — {{ t('help.mdNoteDesc') }}</li>
            <li><strong>.json</strong> — {{ t('help.jsonLegacyDesc') }}</li>
          </ul>
        </template>

        <!-- Notebooks -->
        <template v-if="activeSection === 'notebook'">
          <h2>{{ t('help.notebookMgmt') }}</h2>
          <h3>{{ t('help.rootDir') }}</h3>
          <p>{{ t('help.rootDirDesc') }}</p>
          <h3>{{ t('help.multiMode') }}</h3>
          <p>{{ t('help.multiModeDesc') }}</p>
          <h3>{{ t('help.directMode') }}</h3>
          <p>{{ t('help.directModeDesc') }}</p>
          <h3>{{ t('help.switchNotebook') }}</h3>
          <p>{{ t('help.switchNotebookDesc') }}</p>
        </template>

        <!-- Editor -->
        <template v-if="activeSection === 'editor'">
          <h2>{{ t('help.editorTitle') }}</h2>
          <h3>{{ t('help.mdEditor') }}</h3>
          <p>{{ t('help.mdEditorDesc') }}</p>
          <ul>
            <li>{{ t('help.mdFeature1') }}</li>
            <li>{{ t('help.mdFeature2') }}</li>
            <li>{{ t('help.mdFeature3') }}</li>
            <li>{{ t('help.mdFeature4') }}</li>
            <li>{{ t('help.mdFeature5') }}</li>
            <li>{{ t('help.mdFeature6') }}</li>
          </ul>
        </template>

        <!-- Git Sync -->
        <template v-if="activeSection === 'git'">
          <h2>{{ t('help.gitSync') }}</h2>
          <p>{{ t('help.gitSyncDesc') }}</p>
          <h3>{{ t('help.gitSetup') }}</h3>
          <ol>
            <li>{{ t('help.gitSetupStep1') }}</li>
            <li>{{ t('help.gitSetupStep2') }}</li>
            <li>{{ t('help.gitSetupStep3') }}</li>
          </ol>
          <h3>{{ t('help.gitOperations') }}</h3>
          <ul>
            <li><strong>Push</strong> — {{ t('help.gitPushDesc') }}</li>
            <li><strong>Pull</strong> — {{ t('help.gitPullDesc') }}</li>
            <li><strong>{{ t('help.gitHistory') }}</strong> — {{ t('help.gitHistoryDesc') }}</li>
          </ul>
        </template>

        <!-- Terminal -->
        <template v-if="activeSection === 'terminal'">
          <h2>{{ t('help.terminalTitle') }}</h2>
          <p>{{ t('help.terminalDesc') }}</p>
          <ul>
            <li>{{ t('help.terminalFeature1') }}</li>
            <li>{{ t('help.terminalFeature2') }}</li>
            <li>{{ t('help.terminalFeature3') }}</li>
          </ul>
        </template>

        <!-- Shortcuts -->
        <template v-if="activeSection === 'shortcuts'">
          <h2>{{ t('help.keyboardShortcuts') }}</h2>
          <div class="shortcut-section">
            <h3>{{ t('help.general') }}</h3>
            <div class="shortcut-item">
              <span class="keys"><kbd>{{ isMac ? 'Cmd' : 'Ctrl' }}</kbd>+<kbd>?</kbd></span>
              <span class="description">{{ t('help.showHelp') }}</span>
            </div>
            <div class="shortcut-item">
              <span class="keys"><kbd>{{ isMac ? 'Cmd' : 'Ctrl' }}</kbd>+<kbd>S</kbd></span>
              <span class="description">{{ t('help.saveNote') }}</span>
            </div>
            <div class="shortcut-item">
              <span class="keys"><kbd>Ctrl</kbd>+<kbd>`</kbd></span>
              <span class="description">{{ t('help.toggleTerminal') }}</span>
            </div>
          </div>
          <div class="shortcut-section">
            <h3>{{ t('help.git') }}</h3>
            <div class="shortcut-item">
              <span class="keys"><kbd>{{ isMac ? 'Cmd' : 'Ctrl' }}</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd></span>
              <span class="description">{{ t('help.gitPush') }}</span>
            </div>
          </div>
          <div class="shortcut-section">
            <h3>{{ t('help.editor') }}</h3>
            <div class="shortcut-item">
              <span class="keys"><kbd>{{ isMac ? 'Cmd' : 'Ctrl' }}</kbd>+<kbd>B</kbd></span>
              <span class="description">{{ t('help.bold') }}</span>
            </div>
            <div class="shortcut-item">
              <span class="keys"><kbd>{{ isMac ? 'Cmd' : 'Ctrl' }}</kbd>+<kbd>I</kbd></span>
              <span class="description">{{ t('help.italic') }}</span>
            </div>
            <div class="shortcut-item">
              <span class="keys"><kbd>{{ isMac ? 'Cmd' : 'Ctrl' }}</kbd>+<kbd>K</kbd></span>
              <span class="description">{{ t('help.link') }}</span>
            </div>
          </div>
          <div class="shortcut-section">
            <h3>File Tree</h3>
            <div class="shortcut-item">
              <span class="keys"><kbd>↑</kbd> / <kbd>↓</kbd></span>
              <span class="description">Move to previous/next node (opens file automatically)</span>
            </div>
            <div class="shortcut-item">
              <span class="keys"><kbd>→</kbd></span>
              <span class="description">Expand folder</span>
            </div>
            <div class="shortcut-item">
              <span class="keys"><kbd>←</kbd></span>
              <span class="description">Collapse folder</span>
            </div>
          </div>
          <div class="shortcut-section">
            <h3>Global Navigation</h3>
            <div class="shortcut-item">
              <span class="keys"><kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>↓</kbd></span>
              <span class="description">Switch to previous/next file</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">{{ t('common.ok') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useTtsStore } from '@/store/store';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
const { ipcRenderer } = require('electron');
const { t } = useI18n();
const ttsStore = useTtsStore();
const { helpDialog } = storeToRefs(ttsStore);

const visible = computed({
  get: () => helpDialog.value.show,
  set: (val) => { helpDialog.value.show = val; }
});

const isMac = computed(() => navigator.platform.toUpperCase().indexOf('MAC') >= 0);
const activeSection = ref('start');
const contentEl = ref<HTMLElement | null>(null);

const sections = computed(() => [
  { id: 'start', label: t('help.gettingStarted') },
  { id: 'notebook', label: t('help.notebookMgmt') },
  { id: 'editor', label: t('help.editorTitle') },
  { id: 'git', label: t('help.gitSync') },
  { id: 'terminal', label: t('help.terminalTitle') },
  { id: 'shortcuts', label: t('help.keyboardShortcuts') },
]);

function handleClose() {
  ttsStore.closeHelpDialog();
}
</script>

<style scoped>
.help-layout {
  display: flex;
  height: 65vh;
  gap: 0;
}

.help-nav {
  width: 160px;
  flex-shrink: 0;
  border-right: 1px solid #e4e7ed;
  padding: 8px 0;
  overflow-y: auto;
}

.nav-item {
  padding: 10px 16px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  border-radius: 0 20px 20px 0;
  margin-right: 8px;
  transition: all 0.15s;
}

.nav-item:hover {
  background: #f5f7fa;
  color: #303133;
}

.nav-item.active {
  background: #ecf5ff;
  color: #409eff;
  font-weight: 600;
}

.help-content {
  flex: 1;
  padding: 0 24px;
  overflow-y: auto;
  line-height: 1.8;
  font-size: 14px;
  color: #606266;
}

.help-content h2 {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}

.help-content h3 {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin: 20px 0 8px 0;
}

.help-content p {
  margin: 0 0 12px 0;
}

.help-content ul, .help-content ol {
  padding-left: 20px;
  margin: 0 0 12px 0;
}

.help-content li {
  margin-bottom: 6px;
}

.shortcut-section {
  margin-bottom: 24px;
}

.shortcut-section h3 {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f5f7fa;
}

.keys {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 13px;
}

.keys kbd {
  display: inline-block;
  padding: 3px 7px;
  font-size: 12px;
  font-family: monospace;
  color: #303133;
  background-color: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.description {
  font-size: 13px;
  color: #606266;
}

</style>
