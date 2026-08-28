<template>
  <div class="wechat-preview-wrapper">
    <div class="wechat-preview-toolbar">
      <span class="wx-title">{{ t('wechat.previewTitle') }}</span>
      <div class="wx-toolbar-actions">
        <el-select
          :model-value="ttsStore.wechatTheme"
          size="small"
          style="width: 120px;"
          @change="(v: string) => ttsStore.setWechatTheme(v)"
        >
          <el-option
            v-for="opt in themeOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-tooltip :content="t('tools.copyAll')" placement="top">
          <el-button size="small" circle class="wx-tool-btn" @click="copyHtml">
            <el-icon><CopyDocument /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>
    <div class="wechat-preview-scroll">
      <div
        ref="previewEl"
        class="wechat-preview"
        v-html="renderedHtml"
      ></div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import path from 'path'
import { ElMessage } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'
import { useTtsStore } from '@/store/store'
import { stripFrontMatter } from '@/libs/frontMatter'
import { extractArticle } from '@/libs/articleStructure'
import { renderThemedArticle } from '@/libs/theme/decorate'
import { getWechatTheme, wechatThemes, loadUserThemes, isBuiltinTheme } from '@/libs/wechatThemes'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ content: string }>()
const { t, te } = useI18n()
const ttsStore = useTtsStore()
const previewEl = ref<HTMLElement | null>(null)

// 主题选项从注册表自动生成：内置 wechat-xxx → i18n key wechat.themeXxx；
// 用户主题没有 i18n 词条，直接用 spec 里的 displayName。
// wechatThemes 是 reactive Map，AI/文件新增主题后本列表自动刷新。
const themeOptions = computed(() => [...wechatThemes.entries()].map(([name, theme]) => {
  const suffix = name.slice('wechat-'.length)
  const camel = suffix.charAt(0).toUpperCase() + suffix.slice(1)
  const key = `wechat.theme${camel}`
  return { value: name, label: isBuiltinTheme(name) && te(key) ? t(key) : (theme.meta.displayName || name) }
}))

// 切换笔记本后重扫用户主题目录（挂载时也跑一次，覆盖应用启动后的首个笔记本）
function reloadUserThemes() {
  loadUserThemes(ttsStore.notebook.currentPath)
}
onMounted(reloadUserThemes)
watch(() => ttsStore.notebook.currentPath, reloadUserThemes)

const renderedHtml = computed(() => {
  let markdown = stripFrontMatter(props.content || '')
  // 命中 `# 标题 … ## 内容` 约定：只渲染标题 + 内容区正文，元信息区不显示
  const art = extractArticle(markdown)
  if (art.matched) {
    markdown = (art.title ? `# ${art.title}\n\n` : '') + art.body
  }
  const theme = getWechatTheme(ttsStore.wechatTheme)
  // 相对图片路径由渲染层的 image 规则解析为 file:// 绝对路径（markdown 源文本不改写，
  // 否则 validateLink 在解析期拦截 file: 协议，图片会被渲染成纯文本）
  const notePath = ttsStore.inputs.notePath
  const opts = notePath ? { imageBaseDir: path.dirname(notePath) } : {}
  // renderThemedArticle 已把主题样式内联到每个标签，脚注块也包含在返回串里
  return renderThemedArticle(markdown, theme, t('wechat.references'), opts)
})

// 复制渲染后的内联样式 HTML（可直接粘贴到公众号编辑器）
async function copyHtml() {
  const html = renderedHtml.value
  const el = previewEl.value
  const text = el ? el.innerText : ''
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) }),
    ])
  } catch {
    // Fallback for environments without ClipboardItem
    await navigator.clipboard.writeText(text)
  }
  ElMessage({ message: t('tools.copyAll'), type: 'success', duration: 2000 })
}
</script>

<style scoped>
.wechat-preview-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #f5f5f5;
}

.wechat-preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.wx-title {
  font-size: 13px;
  color: #606266;
  font-weight: 600;
}

.wx-toolbar-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* 与全局工具栏 Tools.vue 的 .tool-btn 保持一致 */
.wx-tool-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  min-width: 24px;
  margin: 0 !important;
}

.wx-tool-btn .el-icon {
  font-size: 14px;
}

.wechat-preview-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
}

/* Preview card — 只负责布局（max-width / 居中 / 圆角 / 阴影）；
   padding / background / color 由 renderThemedArticle 输出的根 <section> 内联样式提供。 */
.wechat-preview-scroll > .wechat-preview {
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  max-width: 640px;
  margin: 0 auto;
  overflow: hidden;
}
</style>
