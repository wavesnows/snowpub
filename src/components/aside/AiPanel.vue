<template>
  <div class="ai-panel">
    <!-- 头部：标题 + 操作图标 -->
    <div class="panel-header">
      <span class="panel-title">{{ t('ai.title') }}</span>
      <div class="header-actions">
        <el-tooltip :content="t('ai.refresh')" placement="top">
          <el-button size="small" circle :icon="Refresh" :loading="scanning" @click="refreshCliStatus" />
        </el-tooltip>
        <el-tooltip :content="t('ai.clear')" placement="top">
          <el-button size="small" circle :icon="Delete" @click="clearMessages" />
        </el-tooltip>
      </div>
    </div>

    <!-- CLI 选择器：展示全部 3 家，未安装标注并在切到时给安装引导 -->
    <div class="agent-bar">
      <span class="agent-label">{{ t('ai.agent') }}</span>
      <el-select
        v-model="selectedAgentId"
        size="small"
        class="agent-select"
        @change="handleAgentChange"
      >
        <el-option
          v-for="cli in agentList"
          :key="cli.id"
          :value="cli.id"
          :label="cli.available ? cli.name : `${cli.name} (未安装)`"
        >
          <div class="agent-option">
            <span>{{ cli.name }}</span>
            <el-tag v-if="!cli.available" size="small" type="info" effect="plain" class="unavail-tag">未安装</el-tag>
          </div>
        </el-option>
      </el-select>
    </div>

    <!-- 未安装提示条（选中的 CLI 不可用时吸顶展示） -->
    <div v-if="currentCli && !currentAvailable" class="install-banner">
      <div class="banner-title">{{ currentCli.name }} 未检测到</div>
      <div class="banner-code-box">
        <code class="banner-cmd">{{ currentCli.install.command }}</code>
        <el-button size="small" text type="primary" @click="copyText(currentCli.install.command)">
          {{ t('ai.copy') }}
        </el-button>
      </div>
      <div class="banner-actions">
        <el-link type="primary" :underline="false" @click="openUrl(currentCli.install.url)">
          {{ t('ai.openDoc') }} ↗
        </el-link>
        <span class="banner-sep">·</span>
        <el-link type="primary" :underline="false" @click="openBuiltinTerminal">
          {{ t('ai.openTerminal') }}
        </el-link>
      </div>
    </div>

    <!-- 预设动作快捷栏（起标题 / 润色 / 写摘要 / 生成主题） -->
    <div class="presets-row">
      <el-button
        size="small"
        round
        :disabled="busy"
        @click="runPreset('polish')"
      >
        {{ t('ai.presets.polish') }}
      </el-button>
      <el-button
        size="small"
        round
        :disabled="busy"
        @click="runPreset('title')"
      >
        {{ t('ai.presets.title') }}
      </el-button>
      <el-button
        size="small"
        round
        :disabled="busy"
        @click="runPreset('digest')"
      >
        {{ t('ai.presets.digest') }}
      </el-button>
      <el-button
        size="small"
        round
        :disabled="busy"
        @click="openThemePromptDialog"
      >
        {{ t('ai.presets.theme') }}
      </el-button>
    </div>

    <!-- 上下文提示（有选中提示选区字数，无选中提示全文） -->
    <div class="context-hint">
      <span v-if="selectionLength > 0">
        💡 {{ t('ai.selectedContext', { len: selectionLength }) }}
      </span>
      <span v-else-if="contentLength > 0">
        📄 {{ t('ai.fullContentContext', { len: contentLength }) }}
      </span>
      <span v-else class="text-muted">
        ⚠️ {{ t('ai.noNoteDesc') }}
      </span>
    </div>

    <!-- 消息流列表 -->
    <div ref="msgContainer" class="messages-container">
      <div v-if="messages.length === 0" class="empty-hint">
        <div class="empty-icon">✨</div>
        <div>选择预设操作或在下方输入开始对话</div>
        <div class="empty-sub">支持调用本地已安装的 Claude / OpenCode / OpenClaw</div>
      </div>

      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        class="message-row"
        :class="msg.role"
      >
        <div class="bubble">
          <div class="bubble-content">{{ msg.content }}</div>
          <div v-if="msg.error" class="bubble-error">
            ⚠️ {{ msg.error }}
          </div>
          <!-- Assistant 气泡底部的动作栏（复制 / 回插编辑器 / 应用主题） -->
          <div v-if="msg.role === 'assistant' && !msg.error" class="bubble-actions">
            <el-button
              size="small"
              text
              :icon="DocumentCopy"
              @click="copyText(msg.content)"
            >
              {{ t('ai.copy') }}
            </el-button>
            <el-button
              size="small"
              text
              :icon="EditPen"
              @click="insertIntoDoc(msg.content)"
            >
              {{ t('ai.insert') }}
            </el-button>
            <el-button
              v-if="msg.themeJson"
              size="small"
              type="success"
              text
              :icon="Brush"
              @click="applyTheme(msg.themeJson)"
            >
              保存并应用主题
            </el-button>
          </div>
        </div>
      </div>

      <div v-if="busy" class="message-row assistant">
        <div class="bubble thinking">
          <span class="dot-pulse">●</span> {{ t('ai.thinking') }}
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="input-box">
      <el-input
        v-model="inputQuery"
        type="textarea"
        :rows="2"
        :placeholder="t('ai.inputPlaceholder')"
        :disabled="busy"
        resize="none"
        @keydown.enter.prevent="handleEnter"
      />
      <div class="input-actions">
        <span class="enter-tip">Enter 发送 · Shift+Enter 换行</span>
        <el-button
          type="primary"
          size="small"
          :loading="busy"
          :disabled="!inputQuery.trim() || !currentAvailable"
          @click="sendQuery"
        >
          {{ t('ai.send') }}
        </el-button>
      </div>
    </div>

    <!-- 生成主题的需求输入弹窗 -->
    <el-dialog
      v-model="themeDialogVisible"
      title="生成自定义主题"
      width="340px"
      append-to-body
    >
      <div class="theme-dialog-body">
        <p class="dialog-tip">用自然语言描述您想要的公众号排版风格，AI 会生成一份可直接使用的 theme.json 并保存到当前笔记本的 themes/ 目录：</p>
        <el-input
          v-model="themePromptText"
          type="textarea"
          :rows="3"
          :placeholder="t('ai.themeDescPlaceholder')"
        />
      </div>
      <template #footer>
        <el-button @click="themeDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!themePromptText.trim()"
          @click="submitThemePrompt"
        >
          生成
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { shell } from 'electron'
import { ElMessage } from 'element-plus'
import {
  Refresh,
  Delete,
  DocumentCopy,
  EditPen,
  Brush,
} from '@element-plus/icons-vue'
import { useTtsStore } from '@/store/store'
import { store as defaultStore } from '@/global/initLocalStore'
import {
  AGENT_CLIS,
  type AgentCli,
  isAgentAvailable,
  callAgent,
  resetAgentCache,
} from '@/libs/aiAgents'
import {
  editorSelection,
  editorContent,
  insertAtCursor,
} from '@/libs/editorBridge'
import {
  buildPolishPrompt,
  buildTitlePrompt,
  buildDigestPrompt,
  buildThemePrompt,
  extractJsonBlock,
} from '@/libs/aiPrompts'
import { saveUserTheme } from '@/libs/wechatThemes'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  error?: string
  themeJson?: any
}

const { t } = useI18n()
const ttsStore = useTtsStore()

const savedAgent = (defaultStore.get('aiSelectedAgent') as string) || 'claude'
const selectedAgentId = ref(savedAgent)
const inputQuery = ref('')
const busy = ref(false)
const scanning = ref(false)
const messages = ref<ChatMessage[]>([])
const msgContainer = ref<HTMLElement | null>(null)

// 主题生成弹窗
const themeDialogVisible = ref(false)
const themePromptText = ref('')

// 探测各 CLI 可用状态
const availMap = ref<Record<string, boolean>>({})

function refreshCliStatus() {
  scanning.value = true
  resetAgentCache()
  const map: Record<string, boolean> = {}
  for (const cli of AGENT_CLIS) {
    map[cli.id] = isAgentAvailable(cli)
  }
  availMap.value = map
  scanning.value = false
}

onMounted(() => {
  refreshCliStatus()
  // 如果首选未安装，自动回退到第一个可用的
  if (!availMap.value[selectedAgentId.value]) {
    const firstAvail = AGENT_CLIS.find((c) => availMap.value[c.id])
    if (firstAvail) {
      selectedAgentId.value = firstAvail.id
      defaultStore.set('aiSelectedAgent', firstAvail.id)
    }
  }
})

const agentList = computed(() =>
  AGENT_CLIS.map((cli) => ({
    ...cli,
    available: !!availMap.value[cli.id],
  }))
)

const currentCli = computed<AgentCli>(() =>
  AGENT_CLIS.find((c) => c.id === selectedAgentId.value) ?? AGENT_CLIS[0]
)

const currentAvailable = computed(() => !!availMap.value[selectedAgentId.value])

const selectionLength = computed(() => editorSelection().length)
const contentLength = computed(() => editorContent().length)

function handleAgentChange(id: string) {
  defaultStore.set('aiSelectedAgent', id)
}

function clearMessages() {
  messages.value = []
}

function scrollToBottom() {
  nextTick(() => {
    if (msgContainer.value) {
      msgContainer.value.scrollTop = msgContainer.value.scrollHeight
    }
  })
}

async function runPrompt(userLabel: string, promptText: string, isTheme = false) {
  if (!currentCli.value) return
  if (!currentAvailable.value) {
    ElMessage.warning(t('ai.notInstalled'))
    return
  }

  messages.value.push({ role: 'user', content: userLabel })
  busy.value = true
  scrollToBottom()

  const res = await callAgent(currentCli.value, promptText)
  busy.value = false

  let themeJson: any = null
  if (isTheme && res.text) {
    const raw = extractJsonBlock(res.text)
    if (raw) {
      try {
        themeJson = JSON.parse(raw)
      } catch { /* parse fail */ }
    }
  }

  messages.value.push({
    role: 'assistant',
    content: res.text || (res.error ? '' : '（无输出）'),
    error: res.error,
    themeJson,
  })
  scrollToBottom()

  // 若生成了合法主题，自动尝试保存并切换
  if (themeJson) {
    tryApplyTheme(themeJson)
  }
}

function runPreset(type: 'polish' | 'title' | 'digest') {
  const sel = editorSelection()
  const full = editorContent()
  if (!sel && !full) {
    ElMessage.warning(t('ai.noNoteDesc'))
    return
  }

  if (type === 'polish') {
    const label = sel ? t('ai.polishSel', { len: sel.length }) : t('ai.polishDoc')
    runPrompt(label, buildPolishPrompt(sel, full))
  } else if (type === 'title') {
    runPrompt(t('ai.titleLabel'), buildTitlePrompt(sel || full))
  } else if (type === 'digest') {
    runPrompt(t('ai.digestLabel'), buildDigestPrompt(sel || full))
  }
}

function openThemePromptDialog() {
  themePromptText.value = ''
  themeDialogVisible.value = true
}

function submitThemePrompt() {
  const desc = themePromptText.value.trim()
  if (!desc) return
  themeDialogVisible.value = false
  runPrompt(t('ai.themeLabel', { desc }), buildThemePrompt(desc), true)
}

function tryApplyTheme(json: any) {
  const notebook = ttsStore.notebook.currentPath
  if (!notebook) return
  try {
    const saved = saveUserTheme(notebook, json)
    ttsStore.setWechatTheme(saved.name)
    ElMessage.success(t('ai.themeSaved', { name: saved.displayName }))
  } catch (e: any) {
    ElMessage.warning(`${t('ai.themeInvalid')}：${e?.message || ''}`)
  }
}

function applyTheme(json: any) {
  tryApplyTheme(json)
}

function handleEnter(e: KeyboardEvent) {
  if (e.shiftKey) {
    inputQuery.value += '\n'
    return
  }
  sendQuery()
}

function sendQuery() {
  const q = inputQuery.value.trim()
  if (!q || busy.value) return
  inputQuery.value = ''
  runPrompt(q, q)
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(t('ai.copied'))
  } catch {
    ElMessage.error('复制失败')
  }
}

function insertIntoDoc(text: string) {
  const ok = insertAtCursor(text)
  if (ok) {
    ElMessage.success(t('ai.insertDone'))
  } else {
    ElMessage.warning(t('ai.noNoteDesc'))
  }
}

function openUrl(url: string) {
  if (url) shell.openExternal(url)
}

function openBuiltinTerminal() {
  ttsStore.openTerminal()
}
</script>

<style scoped>
.ai-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--note-side-bgcolor);
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.agent-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}

.agent-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.agent-select {
  flex: 1;
}

.agent-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.unavail-tag {
  margin-left: 6px;
  font-size: 11px;
}

.install-banner {
  margin: 6px 8px;
  padding: 8px 10px;
  background: #fef0f0;
  border: 1px solid #fde2e2;
  border-radius: 6px;
  font-size: 12px;
  color: #f56c6c;
  flex-shrink: 0;
}

.banner-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.banner-code-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  margin: 4px 0;
}

.banner-cmd {
  font-family: Menlo, Consolas, monospace;
  font-size: 11px;
  color: #333;
  word-break: break-all;
}

.banner-actions {
  margin-top: 4px;
  text-align: right;
  font-size: 11px;
}

.banner-sep {
  margin: 0 6px;
  color: #f89898;
}

.presets-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}

.context-hint {
  padding: 4px 10px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  background: rgba(0, 0, 0, 0.02);
  flex-shrink: 0;
}

.text-muted {
  color: var(--el-text-color-placeholder);
}

.messages-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--el-text-color-placeholder);
  text-align: center;
  padding: 20px 10px;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-sub {
  font-size: 11px;
  margin-top: 6px;
}

.message-row {
  display: flex;
  width: 100%;
}

.message-row.user {
  justify-content: flex-end;
}

.message-row.assistant {
  justify-content: flex-start;
}

.bubble {
  /* 面板放宽后（>400px）给长文一个可读上限，避免单行过长 */
  max-width: min(90%, 620px);
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.message-row.user .bubble {
  background-color: var(--el-color-primary-light-8);
  color: var(--el-text-color-primary);
  border-bottom-right-radius: 2px;
}

.message-row.assistant .bubble {
  background-color: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-bottom-left-radius: 2px;
}

.bubble-content {
  white-space: pre-wrap;
}

.bubble-error {
  margin-top: 4px;
  color: #f56c6c;
  font-size: 11px;
}

.bubble-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.bubble.thinking {
  color: var(--el-text-color-secondary);
}

.dot-pulse {
  color: var(--el-color-primary);
  animation: pulse 1s infinite alternate;
}

@keyframes pulse {
  from { opacity: 0.3; }
  to { opacity: 1; }
}

.input-box {
  padding: 8px 10px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--note-side-bgcolor);
  flex-shrink: 0;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.enter-tip {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.theme-dialog-body {
  font-size: 13px;
}

.dialog-tip {
  margin: 0 0 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}
</style>
