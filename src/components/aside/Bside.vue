<template>
  <div class="aside" :style="{ width: width + 'px' }">
    <!-- FileTree 多根节点，需套 wrapper 使 v-show 完整生效 -->
    <div v-show="ttsStore.page.asideIndex == '1'" class="panel-wrap">
      <FileTree/>
    </div>
    <!-- 纯展示、无副作用，按需创建即可 -->
    <Favorites v-if="ttsStore.page.asideIndex == '2'"/>
    <RecentFiles v-if="ttsStore.page.asideIndex == '3'"/>
    <!-- AI 面板带会话状态，切走不销毁 -->
    <div v-show="ttsStore.page.asideIndex == '4'" class="panel-wrap">
      <AiPanel v-if="aiMounted"/>
    </div>
    <Lan v-if="ttsStore.page.asideIndex == '5'"/>
    <!-- Drag handle -->
    <div class="resize-handle" @mousedown="startDrag"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useTtsStore } from "@/store/store";
import { storeToRefs } from "pinia";
import FileTree from "./FileTree.vue"
import Favorites from "./Favorites.vue"
import RecentFiles from "./RecentFiles.vue"
import AiPanel from "./AiPanel.vue"
import Lan from "./Lan.vue"

const ttsStore = useTtsStore();
const { page, config } = storeToRefs(ttsStore);

// AI 面板惰性挂载：第一次切到 index 4 时才创建，之后常驻（v-show 切走不销毁）
const aiMounted = ref(ttsStore.page.asideIndex == '4');

const MIN_WIDTH = 120;
const MAX_WIDTH = 400;
const AI_MIN_WIDTH = 420; // 低于此宽聊天/代码块太挤，切到 AI 页自动扩到该值
const width = ref(200);
// 进入 AI 面板前的宽度，切走时恢复（含用户手动拖的值）
let widthBeforeAi: number | null = null;

// AI 页放开拖拽上限到窗口 45%，其他面板保持 400
const maxWidth = computed(() =>
  ttsStore.page.asideIndex == '4'
    ? Math.max(MAX_WIDTH, Math.floor(window.innerWidth * 0.45))
    : MAX_WIDTH
);

watch(() => ttsStore.page.asideIndex, (v, prev) => {
  if (v == '4') {
    aiMounted.value = true;
    widthBeforeAi = width.value;
    if (width.value < AI_MIN_WIDTH) width.value = Math.min(AI_MIN_WIDTH, maxWidth.value);
    ttsStore.layout.bsideWidth = width.value;
  } else if (prev == '4' && widthBeforeAi !== null) {
    width.value = widthBeforeAi;
    widthBeforeAi = null;
    ttsStore.layout.bsideWidth = width.value;
  }
});

onMounted(() => {
  // 启动即落在 AI 面板时同样放宽（不记返回宽度，无前一状态）
  if (ttsStore.page.asideIndex == '4' && width.value < AI_MIN_WIDTH) {
    width.value = Math.min(AI_MIN_WIDTH, maxWidth.value);
  }
  ttsStore.layout.bsideWidth = width.value;
});

let dragStartX = 0;
let dragStartWidth = 0;

function startDrag(e: MouseEvent) {
  dragStartX = e.clientX;
  dragStartWidth = width.value;
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
}

function onDrag(e: MouseEvent) {
  const delta = e.clientX - dragStartX;
  width.value = Math.min(maxWidth.value, Math.max(MIN_WIDTH, dragStartWidth + delta));
  ttsStore.layout.bsideWidth = width.value;
}

function stopDrag() {
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
}
</script>

<style scoped>
.aside {
  height: 100%;
  background-color: var(--note-side-bgcolor);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  flex-shrink: 0;
}

.panel-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}

.resize-handle:hover {
  background: rgba(64, 158, 255, 0.4);
}

.el-menu {
  border-right: unset !important;
}

.el-menu-item {
  box-sizing: border-box;
  background-color: var(--note-side-bgcolor);
  border-color: var(--el-menu-active-color);
}

.is-active {
  border-left: 2px solid;
}
</style>
