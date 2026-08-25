<template>
  <div
    class="md-editor-container"
    :class="{ 'md-split-layout': isWechatSplit }"
    @keydown="handleContainerKeydown"
  >
    <!-- editorEl 必须常驻 DOM：CodeMirror 挂载后不能随布局切换被销毁 -->
    <div
      v-show="ttsStore.mdMode === 'edit'"
      ref="editorEl"
      class="md-codemirror"
      :class="{ 'md-split-left': isWechatSplit }"
    ></div>
    <div v-if="isWechatSplit" class="md-split-right">
      <WechatPreview :content="content" />
    </div>
    <div v-show="ttsStore.mdMode === 'preview'" class="md-preview-wrapper">
      <div v-show="searchVisible" class="md-search-bar">
        <input
          ref="searchInputRef"
          v-model="query"
          class="md-search-input"
          placeholder="Search..."
          @keydown="handleSearchKeydown"
        />
        <span class="md-search-count">{{ searchCountText }}</span>
        <button class="md-search-btn" @click="prevMatch" title="Previous (Shift+Enter)">↑</button>
        <button class="md-search-btn" @click="nextMatch" title="Next (Enter)">↓</button>
        <button class="md-search-btn md-search-close" @click="closeSearch" title="Close (Esc)">✕</button>
      </div>
      <div
        ref="previewEl"
        class="md-preview"
        :class="ttsStore.mdTheme !== 'default' ? `theme-${ttsStore.mdTheme}` : ''"
        tabindex="-1"
        v-html="renderedHtml"
        @click="handlePreviewClick"
        @scroll="handlePreviewScroll"
      ></div>
      <button
        v-show="showBackToTop"
        class="md-back-to-top"
        @click="scrollToTop"
        title="Back to top"
      >↑</button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { Compartment, EditorState } from '@codemirror/state'
import MarkdownIt from 'markdown-it'
import Mark from 'mark.js'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useTtsStore } from '@/store/store'
import WechatPreview from '@/components/wechat/WechatPreview.vue'
import { stripFrontMatter } from '@/libs/frontMatter'
import { saveClipboardImage, imageExtForMime } from '@/libs/pasteImage'
import '@/assets/md-preview.css'

const fs = require('fs')

const { t } = useI18n()
const ttsStore = useTtsStore()
const editorEl = ref<HTMLElement | null>(null)
const previewEl = ref<HTMLElement | null>(null)
const content = ref('')
// 公众号双栏模式：左编辑 + 右微信预览
const isWechatSplit = computed(() => ttsStore.mdPreviewSplit === 'wechat' && ttsStore.mdMode === 'edit')
let cmView: EditorView | null = null
let saveStatusTimer: ReturnType<typeof setTimeout> | null = null
const searchVisible = ref(false)
const query = ref('')
const matches = ref<HTMLElement[]>([])
const currentIndex = ref(0)
const searchInputRef = ref<HTMLInputElement | null>(null)
let marker: Mark | null = null
const showBackToTop = ref(false)
const lineWrapCompartment = new Compartment()
const readOnlyCompartment = new Compartment()

const md = new MarkdownIt({ html: false, linkify: true, typographer: true })

// Resolve relative image paths to absolute file:// URLs based on current file location
const defaultImageRenderer = md.renderer.rules.image || ((tokens: any[], idx: number, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options))
md.renderer.rules.image = (tokens: any[], idx: number, options: any, env: any, self: any) => {
  const token = tokens[idx]
  const srcIndex = token.attrIndex('src')
  if (srcIndex >= 0) {
    const src = token.attrs[srcIndex][1] as string
    if (src && !src.startsWith('http') && !src.startsWith('file://') && !src.startsWith('data:')) {
      const currentPath = ttsStore.inputs.notePath
      if (currentPath) {
        const dir = require('path').dirname(currentPath)
        const absPath = require('path').resolve(dir, src)
        token.attrs[srcIndex][1] = 'file://' + absPath
      }
    }
  }
  return defaultImageRenderer(tokens, idx, options, env, self)
}

// Give headings id attributes for anchor link navigation
const defaultHeadingRenderer = md.renderer.rules.heading_open || ((tokens: any[], idx: number, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options))
md.renderer.rules.heading_open = (tokens: any[], idx: number, options: any, env: any, self: any) => {
  const token = tokens[idx]
  const inlineToken = tokens[idx + 1]
  if (inlineToken && inlineToken.children) {
    const text = inlineToken.children.map((t: any) => t.content).join('')
    const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '')
    token.attrSet('id', id)
  }
  return defaultHeadingRenderer(tokens, idx, options, env, self)
}

const renderedHtml = computed(() => md.render(stripFrontMatter(content.value)))

const searchCountText = computed(() => {
  if (!query.value) return ''
  if (matches.value.length === 0) return 'No results'
  return `${currentIndex.value + 1} / ${matches.value.length}`
})

function loadFile(filePath: string) {
  if (!filePath || !fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  content.value = text
  if (cmView) {
    cmView.dispatch({
      changes: { from: 0, to: cmView.state.doc.length, insert: text }
    })
  }
}

function saveFile() {
  const filePath = ttsStore.inputs.notePath
  if (!filePath) return
  try {
    fs.writeFileSync(filePath, content.value, 'utf8')
    // Throttle save status update to avoid flickering on every keystroke
    if (saveStatusTimer) clearTimeout(saveStatusTimer)
    saveStatusTimer = setTimeout(() => {
      ttsStore.setSaveStatus('saved', 'Saved')
      ttsStore.scheduleGitStatusCheck()
    }, 1000)
  } catch (e: any) {
    ttsStore.setSaveStatus('error', e.message)
  }
}

function openSearch() {
  if (ttsStore.mdMode !== 'preview') return
  searchVisible.value = true
  nextTick(() => {
    searchInputRef.value?.focus()
    searchInputRef.value?.select()
    if (query.value) runSearch()
  })
}

function closeSearch() {
  marker?.unmark()
  matches.value = []
  currentIndex.value = 0
  query.value = ''
  searchVisible.value = false
  nextTick(() => previewEl.value?.focus())
}

function runSearch() {
  if (!marker) return
  marker.unmark({
    done: () => {
      if (!query.value) {
        matches.value = []
        currentIndex.value = 0
        return
      }
      marker!.mark(query.value, {
        caseSensitive: false,
        separateWordSearch: false,
        done: () => {
          matches.value = Array.from(previewEl.value?.querySelectorAll('mark') ?? []) as HTMLElement[]
          currentIndex.value = 0
          goToMatch(0)
        }
      })
    }
  })
}

function goToMatch(index: number) {
  if (matches.value.length === 0) return
  matches.value.forEach(el => el.classList.remove('active'))
  const target = matches.value[index]
  if (!target) return
  target.classList.add('active')
  target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  currentIndex.value = index
}

function nextMatch() {
  if (matches.value.length === 0) return
  goToMatch((currentIndex.value + 1) % matches.value.length)
}

function prevMatch() {
  if (matches.value.length === 0) return
  goToMatch((currentIndex.value - 1 + matches.value.length) % matches.value.length)
}

function handlePreviewClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const anchor = target.closest('a') as HTMLAnchorElement | null
  if (!anchor) return
  const href = anchor.getAttribute('href')
  if (!href?.startsWith('#')) return
  event.preventDefault()
  const id = decodeURIComponent(href.slice(1))
  const container = previewEl.value
  if (!container) return
  const el = Array.from(container.querySelectorAll('[id]')).find(
    e => e.getAttribute('id') === id
  ) as HTMLElement | undefined
  if (el) {
    const elRect = el.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const offset = elRect.top - containerRect.top + container.scrollTop - 16
    container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' })
  }
}

function handlePreviewScroll() {
  showBackToTop.value = (previewEl.value?.scrollTop ?? 0) > 300
}

function scrollToTop() {
  previewEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

function handleContainerKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
    if (ttsStore.mdMode === 'preview') {
      event.preventDefault()
      openSearch()
    }
  }
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeSearch()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (event.shiftKey) {
      prevMatch()
    } else {
      nextMatch()
    }
  }
}

// 粘贴/拖拽图片：落盘到笔记目录 imgs/ 并在插入点写入相对路径。
// 这里只写本地文件，发布时由 PublishDialog 统一扫描上传 CDN；
// 预览走渲染层 file:// 规则（WechatPreview / 上方 md.renderer.rules.image）。
async function insertImages(files: File[], pos: number | null) {
  const notePath = ttsStore.inputs.notePath
  if (!notePath || !cmView) return
  const noteDir = require('path').dirname(notePath)
  const insertions: string[] = []
  let failed = false
  for (const file of files) {
    try {
      const rel = await saveClipboardImage(file, noteDir)
      if (rel) insertions.push(`![](${rel})`)
    } catch {
      failed = true
    }
  }
  if (failed) ElMessage.error(t('tools.imageSaveFailed'))
  if (!insertions.length) return
  const at = pos ?? cmView.state.selection.main.head
  const text = insertions.join('\n')
  cmView.dispatch({
    changes: { from: at, insert: text },
    selection: { anchor: at + text.length },
  })
  cmView.focus()
}

// 只拦截含可支持图片（png/jpg/gif/webp）的粘贴/拖放；其余走编辑器默认行为
function pickSupportedImages(fileList: FileList | undefined): File[] {
  return [...(fileList ?? [])].filter((f) => imageExtForMime(f.type) !== null)
}

const imageDropHandlers = EditorView.domEventHandlers({
  paste(event) {
    const files = pickSupportedImages(event.clipboardData?.files)
    if (!files.length || !ttsStore.inputs.notePath) return false
    event.preventDefault()
    void insertImages(files, null)
    return true
  },
  drop(event, view) {
    const files = pickSupportedImages(event.dataTransfer?.files)
    if (!files.length || !ttsStore.inputs.notePath) return false
    event.preventDefault()
    void insertImages(files, view.posAtCoords({ x: event.clientX, y: event.clientY }))
    return true
  },
})

onMounted(() => {
  cmView = new EditorView({
    doc: content.value,
    extensions: [
      basicSetup,
      markdown(),
      oneDark,
      lineWrapCompartment.of(ttsStore.mdEditor.lineWrap ? EditorView.lineWrapping : []),
      readOnlyCompartment.of(EditorState.readOnly.of(ttsStore.readOnly)),
      imageDropHandlers,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          content.value = update.state.doc.toString()
          saveFile()
        }
      }),
    ],
    parent: editorEl.value!,
  })

  loadFile(ttsStore.inputs.notePath)
  marker = new Mark(previewEl.value!)
})

onBeforeUnmount(() => {
  cmView?.destroy()
  cmView = null
  marker?.unmark()
  marker = null
})

watch(
  () => ttsStore.readOnly,
  (val) => {
    cmView?.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(val))
    })
  }
)

watch(
  () => ttsStore.mdEditor.lineWrap,
  (wrap) => {
    cmView?.dispatch({
      effects: lineWrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : [])
    })
  }
)

watch(
  () => ttsStore.inputs.notePath,
  (newPath) => {
    if (newPath) {
      loadFile(newPath)
    }
  }
)

// 历史版本恢复后重新从磁盘加载当前文件
watch(
  () => ttsStore.noteReloadTrigger,
  () => {
    const p = ttsStore.inputs.notePath
    if (p) loadFile(p)
  }
)

watch(
  () => ttsStore.mdCopyTrigger,
  () => { copyPreviewHtml() }
)

watch(query, () => {
  runSearch()
})

watch(renderedHtml, () => {
  if (searchVisible.value && query.value) {
    nextTick(() => runSearch())
  }
})

watch(
  () => ttsStore.mdMode,
  (mode) => {
    if (mode === 'preview') {
      setTimeout(() => previewEl.value?.focus(), 0)
    } else {
      cmView?.focus()
    }
  }
)


// 把 DOM 元素的 computed style 内联到 clone 上，用于复制到公众号
function inlineStyles(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement
  const sourceNodes = source.querySelectorAll('*')
  const cloneNodes = clone.querySelectorAll('*')

  // 只内联影响排版和颜色的关键属性，避免内联全部导致过于臃肿
  const INLINE_PROPS = [
    'color', 'background-color', 'font-size', 'font-weight', 'font-style',
    'font-family', 'line-height', 'letter-spacing', 'text-align',
    'border', 'border-left', 'border-bottom', 'border-top',
    'padding', 'margin', 'border-radius',
    'list-style-type', 'text-decoration',
  ]

  sourceNodes.forEach((srcEl, i) => {
    const cloneEl = cloneNodes[i] as HTMLElement
    if (!cloneEl) return
    const computed = window.getComputedStyle(srcEl)
    const inlined = INLINE_PROPS
      .map(p => `${p}:${computed.getPropertyValue(p)}`)
      .join(';')
    cloneEl.setAttribute('style', inlined)
  })

  // 内联根元素自身样式
  const rootComputed = window.getComputedStyle(source)
  const rootInlined = INLINE_PROPS
    .map(p => `${p}:${rootComputed.getPropertyValue(p)}`)
    .join(';')
  clone.setAttribute('style', rootInlined)

  return clone
}

function copyPreviewHtml() {
  const el = previewEl.value
  if (!el) return false
  const cloned = inlineStyles(el)
  const html = cloned.outerHTML
  const blob = new Blob([html], { type: 'text/html' })
  const text = el.innerText
  navigator.clipboard.write([
    new ClipboardItem({ 'text/html': blob, 'text/plain': new Blob([text], { type: 'text/plain' }) })
  ])
  return true
}

</script>

<style scoped>
.md-editor-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

/* WeChat dual-pane layout: left editor + right wechat preview */
.md-split-layout {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.md-split-left {
  flex: 1;
  overflow: auto;
  height: 100%;
  border-right: 1px solid #e4e7ed;
}

.md-split-right {
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.md-codemirror {
  flex: 1;
  overflow: auto;
  height: 100%;
}

.md-codemirror :deep(.cm-editor) {
  height: 100%;
  font-size: 14px;
}

/* 编辑模式选中颜色，更明显 */
.md-codemirror :deep(.cm-selectionBackground) {
  background: rgba(100, 180, 255, 0.35) !important;
}

.md-codemirror :deep(.cm-focused .cm-selectionBackground) {
  background: rgba(100, 180, 255, 0.45) !important;
}

.md-preview {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
}

.md-preview-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  height: 100%;
  position: relative;
}

.md-search-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.md-search-input {
  flex: 1;
  min-width: 0;
  height: 24px;
  padding: 0 8px;
  font-size: 13px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  outline: none;
  background: #fff;
  color: #303133;
}

.md-search-input:focus {
  border-color: #409eff;
}

.md-search-count {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
  min-width: 48px;
  text-align: center;
}

.md-search-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #606266;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.md-search-btn:hover {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}

.md-search-close {
  color: #909399;
}

.md-back-to-top {
  position: absolute;
  bottom: 24px;
  right: 24px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  transition: opacity 0.2s;
}

.md-back-to-top:hover {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}
</style>

<style>
.md-preview mark {
  background-color: rgba(255, 213, 0, 0.5);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}

.md-preview mark.active {
  background-color: rgba(255, 140, 0, 0.7);
}
</style>
