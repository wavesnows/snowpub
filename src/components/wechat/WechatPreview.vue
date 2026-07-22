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
          <el-option :label="t('wechat.themeGreen')" value="wechat-green" />
          <el-option :label="t('wechat.themeBlack')" value="wechat-black" />
          <el-option :label="t('wechat.themeOrange')" value="wechat-orange" />
          <el-option :label="t('wechat.themeDefault')" value="wechat-default" />
        </el-select>
        <el-tooltip :content="t('wechat.copyImageUrl')" placement="top">
          <el-button size="small" @click="copyHtml">HTML</el-button>
        </el-tooltip>
      </div>
    </div>
    <div class="wechat-preview-scroll">
      <div
        ref="previewEl"
        class="wechat-preview"
        :class="`theme-${ttsStore.wechatTheme}`"
        v-html="renderedHtml"
      ></div>
      <div v-if="footnotes.length" class="wechat-footnotes">
        <div class="footnote-title">{{ t('wechat.references') }}</div>
        <ol>
          <li v-for="(fn, i) in footnotes" :key="i">
            <span class="fn-num">[{{ i + 1 }}]</span>
            <a :href="fn.url" target="_blank" rel="noopener">{{ fn.text }}</a>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import MarkdownIt from 'markdown-it'
import { useTtsStore } from '@/store/store'
import { stripFrontMatter } from '@/libs/frontMatter'
import { extractArticle } from '@/libs/articleStructure'
import { inlineComputedStyles } from '@/libs/wechatRender'
import { useI18n } from 'vue-i18n'
import '@/assets/wechat-preview.css'

interface Footnote { url: string; text: string }

const props = defineProps<{ content: string }>()
const { t } = useI18n()
const ttsStore = useTtsStore()
const previewEl = ref<HTMLElement | null>(null)

const md = new MarkdownIt({ html: false, linkify: true, typographer: true })

// 图片相对路径解析
const defaultImageRenderer = md.renderer.rules.image
  || ((tokens: any[], idx: number, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options))
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const srcIndex = token.attrIndex('src')
  if (srcIndex >= 0 && token.attrs) {
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

// 收集外链 → 转为脚注
const footnotes = ref<Footnote[]>([])
let linkCounter = 0
const originalLinkOpen = md.renderer.rules.link_open
  || ((tokens: any[], idx: number, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options))
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const hrefIndex = token.attrIndex('href')
  if (hrefIndex >= 0 && token.attrs) {
    const href = token.attrs[hrefIndex][1] as string
    // 只对 http(s) 外链做脚注处理，跳过锚点
    if (href.startsWith('http')) {
      // 取下一个 token 的文本作为链接文字
      const next = tokens[idx + 1]
      const text = next && next.content ? next.content : href
      footnotes.value.push({ url: href, text })
      linkCounter++
      // 在链接文字后插入 [n] 角标
      const sup = `<sup class="wx-fn-ref">[${linkCounter}]</sup>`
      const rendered = originalLinkOpen(tokens, idx, options, env, self)
      // renderToken 只输出 <a ...>，需要在结尾追加角标 — 这里返回 renderToken 后由后续 inline 渲染
      // 简单处理：把角标作为独立 token 输出，通过修改 attr 不太方便，直接在后面注入
      return rendered + sup
    }
  }
  return originalLinkOpen(tokens, idx, options, env, self)
}

// 每次 content 变化前重置脚注
watch(() => props.content, () => {
  footnotes.value = []
  linkCounter = 0
}, { immediate: true })

const renderedHtml = computed(() => {
  let markdown = stripFrontMatter(props.content || '')
  // 命中 `# 标题 … ## 内容` 约定：只渲染标题 + 内容区正文，元信息区不显示
  const art = extractArticle(markdown)
  if (art.matched) {
    markdown = (art.title ? `# ${art.title}\n\n` : '') + art.body
  }
  return md.render(markdown)
})

// 复制内联样式的 HTML（用于直接粘贴到公众号编辑器）— 内联逻辑与发布共用 wechatRender
async function copyHtml() {
  const el = previewEl.value
  if (!el) return
  const cloned = inlineComputedStyles(el)
  const html = cloned.outerHTML
  const text = el.innerText
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) }),
    ])
  } catch {
    // Fallback for environments without ClipboardItem
    await navigator.clipboard.writeText(text)
  }
}

onMounted(() => {})
onBeforeUnmount(() => {})
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
}

.wechat-preview-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
}

/* Preview card */
.wechat-preview-scroll > .wechat-preview {
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  max-width: 640px;
  margin: 0 auto;
}

.wechat-footnotes {
  max-width: 640px;
  margin: 16px auto 0;
  padding: 12px 16px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  font-size: 12px;
  color: #888;
}

.footnote-title {
  font-weight: 600;
  margin-bottom: 6px;
  color: #606266;
}

.wechat-footnotes ol {
  padding-left: 1.4em;
  margin: 0;
}

.wechat-footnotes li {
  margin: 3px 0;
  word-break: break-all;
}

.wechat-footnotes a {
  color: #576b95;
  text-decoration: none;
}

.fn-num {
  color: #576b95;
  margin-right: 4px;
}

:deep(.wx-fn-ref) {
  color: #576b95;
  font-size: 0.8em;
  font-weight: 400;
  margin: 0 2px;
}
</style>
