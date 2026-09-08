<template>
    <div class="filter-container">
      <el-input
        v-model="filterText"
        :prefix-icon="Search"
        :placeholder="t('fileTree.filterPlaceholder')"
        clearable
        class="filter-input"
      />
    </div>
    <el-scrollbar height="100%" width="100%" tabindex="0" @keydown.capture="handleTreeKeydown" @scroll="closeMenu()">
    <el-tree
      :data="treeMenu.data"
      @node-click="handleNodeClick"
      class="treemenu"
      node-key="path"
      :expand-on-click-node="false"
      :indent="5"
      :filter-node-method="filterNode"
      @node-contextmenu="openContextMenu"
      :default-expanded-keys="expandedKeys"
      @node-expand="onNodeExpand"
      @node-collapse="onNodeCollapse"
      ref="treeRef"
    >
    <template #default="{ node, data }">
        <div
          class="custom-tree-node"
          :class="{ 'keyboard-focused': data.path === focusedNodeKey }"
        >
          <input
            v-if="editingPath === data.path"
            class="rename-input"
            v-model="editingName"
            @keyup.enter="confirmRename(data)"
            @keyup.esc="cancelRename"
            @blur="confirmRename(data)"
            ref="renameInputRef"
          />
            <span
              v-else
              :title="node.label"
              class="el-dropdown-link"
              @dblclick.stop="startRename(data)"
            >
              <span class="node-icon">
                <template v-if="data.isFolder">
                  {{ node.expanded ? '📂' : '📁' }}
                </template>
                <template v-else>
                  {{ data.path.endsWith('.md') ? '📝' : '📄' }}
                </template>
              </span>
              {{ node.label }}
            </span>
          <span class="node-actions" @click.stop @dblclick.stop>
            <!-- Star icon for favorites -->
            <el-icon
              v-if="!node.data.isFolder && starredPaths.has(node.data.path)"
              class="star-icon"
              color="#f7ba2a">
              <StarFilled />
            </el-icon>
            <button type="button" class="icon-add" aria-haspopup="menu"
              :aria-label="node.label + ' 操作菜单'"
              @click="openMenu(data, node, $event)">⚙︎</button>
          </span>

          </div>

      </template>

    </el-tree>
    </el-scrollbar>

    <el-dropdown v-if="activeMenu" ref="menuRef" trigger="click" placement="bottom-start"
      :hide-timeout="0" :style="{ position: 'fixed', left: menuPosition.x + 'px', top: menuPosition.y + 'px' }"
      @command="handleCommand" @visible-change="onMenuVisibility">
      <span class="menu-anchor" tabindex="-1" aria-hidden="true"></span>
              <template #dropdown>
              <el-dropdown-menu ref="menuListRef" class="tree-context-menu" @keydown.esc.stop="closeMenu(true)">
                <el-dropdown-item v-if="activeMenu.data.isFolder" :command="{type:'mdfile', data:activeMenu.data}">
                  <el-icon><Document /></el-icon>
                  <span>{{ t('fileTree.createMdFile') }}</span>
                </el-dropdown-item>
                <el-dropdown-item v-if="activeMenu.data.isFolder" :command="{type:'demo', data:activeMenu.data}">
                  <el-icon><Document /></el-icon>
                  <span>{{ t('fileTree.createDemoNote') }}</span>
                </el-dropdown-item>
                <el-dropdown-item v-if="activeMenu.data.isFolder" :command="{type:'folder', data:activeMenu.data}">
                  <el-icon><Folder /></el-icon>
                  <span>{{ t('fileTree.createFolder') }}</span>
                </el-dropdown-item>
                <el-dropdown-item v-if="activeMenu.data.isFolder" :command="{type:'remove', data:activeMenu.data, node:activeMenu.node}" divided>
                  <el-icon><Delete /></el-icon>
                  <span>{{ t('fileTree.remove') }}</span>
                </el-dropdown-item>
                <el-dropdown-item v-if="!activeMenu.data.isFolder" :command="{type:'pin', data:activeMenu.data}">
                  <el-icon v-if="ttsStore.isPinned(activeMenu.data.path)"><RemoveFilled /></el-icon>
                  <el-icon v-else><Position /></el-icon>
                  <span>{{ ttsStore.isPinned(activeMenu.data.path) ? t('fileTree.unpinNote') : t('fileTree.pinNote') }}</span>
                </el-dropdown-item>
                <el-dropdown-item v-if="!activeMenu.data.isFolder" :command="{type:'star', data:activeMenu.data}">
                  <el-icon v-if="ttsStore.isStarred(activeMenu.data.path)"><StarFilled /></el-icon>
                  <el-icon v-else><Star /></el-icon>
                  <span>{{ ttsStore.isStarred(activeMenu.data.path) ? t('fileTree.removeStar') : t('fileTree.addStar') }}</span>
                </el-dropdown-item>
                <el-dropdown-item :command="{type:'showInFinder', data:activeMenu.data}" divided>
                  <el-icon><FolderOpened /></el-icon>
                  <span>{{ t('fileTree.showInFinder') }}</span>
                </el-dropdown-item>
                <el-dropdown-item v-if="!activeMenu.data.isFolder" :command="{type:'removeitem', data:activeMenu.data, node:activeMenu.node}">
                  <el-icon><Delete /></el-icon>
                  <span>{{ t('fileTree.remove') }}</span>
                </el-dropdown-item>
              </el-dropdown-menu>
              </template>
    </el-dropdown>

    <el-dialog v-model="dialogFormVisible" :title="t('dialog.typeFolderName')">
    <el-form :model="ttsStore.menu">
      <el-form-item :label="t('dialog.folderName')" :label-width="formLabelWidth">
        <el-input v-model="ttsStore.treeMenu.newFolderName" autocomplete="off" />
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogFormVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="addFolder" >{{ t('common.ok') }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import fs from 'fs'
import {join, dirname} from "path"
import { storeToRefs } from "pinia"
import {ref, shallowRef, computed, watch, nextTick, onMounted, onUnmounted} from 'vue'
import Node from 'element-plus/es/components/tree/src/model/node'
import {ElTree, ElDropdown, ElMessage,ElMessageBox} from 'element-plus'
import { Search, Star, StarFilled, Document, Folder, FolderOpened, Delete, Position, RemoveFilled } from "@element-plus/icons-vue"
import {getNoteLabel} from "@/libs/noteUtil"
import { DEMO_ARTICLE_MD } from "@/libs/demoArticle"
import { DEFAULT_COVER_BASE64 } from "@/assets/brand/defaultCoverBase64"
import { useTtsStore, Tree } from "@/store/store"
import { log, dir } from "@/libs/logger"
import {remove, removeFolder, renameFile} from "@/libs/fileHandler"
import { useI18n } from 'vue-i18n'
import { collectVisibleNodes } from '@/libs/treePerformance'

const { t } = useI18n()
const ttsStore = useTtsStore();
const { treeMenu } = storeToRefs(ttsStore);

const filterText = ref('')
const treeRef = ref<InstanceType<typeof ElTree>>()
const dialogFormVisible = ref(false)
const formLabelWidth = '120px';
const expandedKeys = ref<string[]>([]);

const editingPath = ref('')
const editingName = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

const focusedNodeKey = ref<string | null>(null)

// Element Plus can expand matching ancestors during filtering without changing
// the persisted expanded keys. Navigate its actual visible state, cached by Vue.
const visibleNodes = computed(() => collectVisibleNodes(
  treeMenu.value.data as Tree[], key => treeRef.value?.getNode(key)
))
const visibleNodeIndex = computed(() => new Map(visibleNodes.value.map((node, index) => [node.path, index])))
const starredPaths = computed(() => new Set<string>(ttsStore.favorites.starred))

function handleTreeKeydown(event: KeyboardEvent) {
  if ((event.target as HTMLElement)?.closest('input, textarea, button, [contenteditable=true]')) return
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(event.key) === -1) return
  event.preventDefault()
  event.stopPropagation()

  const visible = visibleNodes.value
  if (visible.length === 0) return

  const currentIdx = focusedNodeKey.value
    ? (visibleNodeIndex.value.get(focusedNodeKey.value) ?? -1)
    : -1

  if (event.key === 'ArrowDown') {
    if (currentIdx >= visible.length - 1) return
    const next = visible[currentIdx + 1]
    if (!next) return
    focusedNodeKey.value = next.path
    if (!next.isFolder) {
      const realNode = treeRef.value?.getNode(next.path)
      if (realNode) handleNodeClick(next, realNode as unknown as Node)
    }
  } else if (event.key === 'ArrowUp') {
    if (currentIdx <= 0) return
    const prev = visible[currentIdx - 1]
    if (!prev) return
    focusedNodeKey.value = prev.path
    if (!prev.isFolder) {
      const realNode = treeRef.value?.getNode(prev.path)
      if (realNode) handleNodeClick(prev, realNode as unknown as Node)
    }
  } else if (event.key === 'ArrowRight') {
    if (currentIdx === -1) return
    const node = visible[currentIdx]
    if (node.isFolder) {
      const actual = treeRef.value?.getNode(node.path)
      if (actual && !actual.expanded) {
        onNodeExpand(node)
        actual.expand()
      }
    }
  } else if (event.key === 'ArrowLeft') {
    if (currentIdx === -1) return
    const node = visible[currentIdx]
    if (node.isFolder) {
      const actual = treeRef.value?.getNode(node.path)
      if (actual?.expanded) {
        onNodeCollapse(node)
        actual.collapse()
      }
    } else {
      const parentPath = dirname(node.path)
      const parentNode = visible.find(n => n.path === parentPath)
      if (parentNode) {
        focusedNodeKey.value = parentNode.path
      }
    }
  }
}

function startRename(data: Tree) {
  if (data.isFolder) return
  editingPath.value = data.path
  editingName.value = data.label
  nextTick(() => {
    renameInputRef.value?.select()
  })
}

function confirmRename(data: Tree) {
  if (!editingPath.value) return
  const newName = editingName.value.trim()
  if (newName && newName !== data.label) {
    // Update store state so renameFile() picks it up
    ttsStore.cnote.destTitle = newName
    ttsStore.cnote.title = data.label
    ttsStore.inputs.notePath = data.path
    if (renameFile()) data.label = newName
  }
  editingPath.value = ''
  editingName.value = ''
}

function cancelRename() {
  editingPath.value = ''
  editingName.value = ''
}



// ── 展开状态管理 ────────────────────────────────────────────────────
// 用户展开/折叠 → 内存立即更新，磁盘写防抖（避免每次操作同步阻塞主线程）
// 数据刷新 / 启动  → restoreExpandedState() 从 store 恢复

function schedulePersist() {
  ttsStore.persistExpandedKeys()
}

function restoreExpandedState() {
  const keys = ttsStore.treeMenu.expandedKeys
  if (!keys || keys.length === 0) return
  nextTick(() => {
    keys.forEach((key: string) => {
      try {
        const node = treeRef.value?.getNode(key)
        if (node) node.expand()
      } catch (_) {}
    })
  })
}

function onNodeExpand(data: Tree) {
  closeMenu()
  const keys = ttsStore.treeMenu.expandedKeys || []
  if (!keys.includes(data.path)) {
    ttsStore.treeMenu.expandedKeys = [...keys, data.path]
    schedulePersist()
  }
}

function onNodeCollapse(data: Tree) {
  closeMenu()
  ttsStore.treeMenu.expandedKeys = (ttsStore.treeMenu.expandedKeys || []).filter(k => k !== data.path)
  schedulePersist()
}

// 数据刷新后新节点默认折叠，重新恢复展开状态
watch(() => ttsStore.treeMenu.data, () => {
  closeMenu()
  activeMenu.value = null
  focusedNodeKey.value = null
  restoreExpandedState()
  nextTick(() => treeRef.value?.filter(filterText.value.trim()))
}, { deep: false })



const activeMenu = shallowRef<{ data: Tree; node: Node } | null>(null)
const menuRef = ref<InstanceType<typeof ElDropdown>>()
const menuListRef = ref<{ $el: HTMLElement }>()
const menuPosition = ref({ x: 0, y: 0 })
let menuRequest = 0
let menuOpener: HTMLElement | null = null
let keyboardMenu = false

function closeMenu(restoreFocus = false) {
  ++menuRequest
  menuRef.value?.handleClose()
  if (restoreFocus && menuOpener?.isConnected) menuOpener.focus()
}

async function openMenu(data: Tree, node: Node, event: MouseEvent) {
  closeMenu()
  const request = ++menuRequest
  menuOpener = event.currentTarget as HTMLElement
  keyboardMenu = event.detail === 0 && event.type !== 'contextmenu'
  const rect = menuOpener?.getBoundingClientRect()
  menuPosition.value = event.type === 'contextmenu'
    ? { x: event.clientX, y: event.clientY }
    : { x: rect?.left || 0, y: rect?.bottom || 0 }
  activeMenu.value = { data, node }
  await nextTick()
  if (request === menuRequest) menuRef.value?.handleOpen()
}

function openContextMenu(event: MouseEvent, data: Tree, node: Node) {
  event.preventDefault()
  void openMenu(data, node, event)
}

function onMenuVisibility(visible: boolean) {
  if (visible && keyboardMenu) nextTick(() => {
    menuListRef.value?.$el.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  })
}

watch(() => ttsStore.page.asideIndex, () => closeMenu())

const handleCommand = (command: any) => {
    log('[FileTree] command:', command.type, command.data?.path)
    ttsStore.treeMenu.treeData = command.data as Tree;
    ttsStore.treeMenu.node = command.node as Node;
    switch (command.type) {
      case 'mdfile':
        appendMd(command.data)
        break;
      case 'demo':
        appendDemo(command.data)
        break;
      case 'folder':
        dialogFormVisible.value = true;
        break;
      case 'showInFinder':
        ttsStore.showItemInFolder(command.data.path);
        break;
      case 'pin':
        ttsStore.togglePin(command.data.path);
        break;
      case 'star':
        ttsStore.toggleStar(command.data.path);
        break;
      case 'removeitem':
      ElMessageBox.confirm(
        t('fileTree.confirmDelete', { name: ttsStore.treeMenu.node.label }),
        t('common.delete'),
        {
          confirmButtonText: t('common.ok'),
          cancelButtonText: t('common.cancel'),
          type: 'warning',
        }
      )
        .then(()=>{
         // removeFolder()
         remove(command.node, command.data)
        }
        )
        .catch(() => {
      // catch error
        })
        break;
      case 'remove':
        ElMessageBox.confirm(
          t('fileTree.confirmDeleteFolder', { name: ttsStore.treeMenu.node.label }),
          t('common.delete'),
          {
            confirmButtonText: t('common.ok'),
            cancelButtonText: t('common.cancel'),
            type: 'warning',
          }
        )
        .then(()=>{
          removeFolder()
        }
        )
        .catch(() => {
      // catch error
        })
        break;
      default:
        break;
    }
  }

watch(
  () => ttsStore.config.needUpdateTree, (newValue, oldValue) => {
    // do something
    ttsStore.config.needUpdateTree = false;
  }
)


// 防抖过滤：每次按键立即触发 el-tree.filter 会遍历全树重渲染，体感卡顿
let _filterTimer: ReturnType<typeof setTimeout> | null = null
watch(filterText, (val) => {
  closeMenu()
  if (_filterTimer) clearTimeout(_filterTimer)
  _filterTimer = setTimeout(() => treeRef.value?.filter(val.trim()), 300)
})

// 外部跳转（expandTreeToPath）新增了 key，展开对应节点
watch(
  () => ttsStore.treeMenu.expandedKeys,
  (newKeys, oldKeys) => {
    if (!newKeys || newKeys.length === 0) return
    const oldSet = new Set(oldKeys || [])
    const added = newKeys.filter(k => !oldSet.has(k))
    if (added.length === 0) return
    nextTick(() => {
      added.forEach(key => {
        try {
          const node = treeRef.value?.getNode(key)
          if (node) node.expand()
        } catch (_) {}
      })
    })
  }
)

onMounted(() => {
  window.addEventListener('blur', handleWindowBlur)
  // el-tree 初始化是同步的，一个 nextTick 就够；
  // v-show 保留 el-tree 内存状态，最小化/切 tab 回来无需重设
  nextTick(() => restoreExpandedState())
})

const handleWindowBlur = () => closeMenu()

onUnmounted(() => {
  closeMenu()
  window.removeEventListener('blur', handleWindowBlur)
  if (_filterTimer) clearTimeout(_filterTimer)
})

const filterNode:any = (value: string, data: Tree,node:Node) => {
  if (!value) return true
  return data.label.includes(value)
}

const addFolder = () =>{
  //let data:Tree = ttsStore.menu.curentData;
  let data:Tree = ttsStore.treeMenu.treeData;
  dialogFormVisible.value = false;
  let foldername  = ttsStore.treeMenu.newFolderName;
  let path = join(data.path, foldername)
  const newChild:Tree = {label: foldername, path: path, isFolder:true, isLeaf: true}
  if (!data.children) {
    data.children = []
  }
  data.children.push(newChild as Tree)
  fs.mkdirSync(join(data.path, foldername));

  }

  const appendMd = (data: Tree) => {
    let label:string = getNoteLabel();
    let path:any = join(data.path, label + '.md')
    const newChild:Tree = {label: label, path: path, isFolder:false, isLeaf: true}
    if (!data.children) {
      data.children = []
    }
    data.children.push(newChild as Tree)
    ttsStore.inputs.notePath = path
    // 公众号笔记固定格式：front matter 元信息，发布时自动读取；作者取系统默认配置
    const template = [
      '---',
      'title: ',
      `author: ${ttsStore.config.wechat.defaultAuthor || ''}`,
      `# digest: ${t('fileTree.tplDigestHint')}`,
      `# cover: ./cover.png  ${t('fileTree.tplCoverHint')}`,
      '---',
      '',
      ''
    ].join('\n')
    fs.writeFileSync(path, template, 'utf8')
  }

  // 新建「主题演示」笔记：内容与黄金样张同源（demoArticle.ts），覆盖全部排版元素，
  // 方便在公众号预览里切换 12 套主题对比。演示图复用内置默认封面，解码到 imgs/ 下。
  const appendDemo = (data: Tree) => {
    const baseName = t('fileTree.demoNoteName')
    let label = baseName
    let path = join(data.path, label + '.md')
    let seq = 2
    while (fs.existsSync(path)) {
      label = `${baseName}-${seq}`
      path = join(data.path, label + '.md')
      seq++
    }
    const imgsDir = join(data.path, 'imgs')
    if (!fs.existsSync(imgsDir)) fs.mkdirSync(imgsDir, { recursive: true })
    const demoImg = join(imgsDir, 'demo-cover.png')
    if (!fs.existsSync(demoImg)) {
      fs.writeFileSync(demoImg, Buffer.from(DEFAULT_COVER_BASE64, 'base64'))
    }
    const template = [
      '---',
      `title: ${label}`,
      `author: ${ttsStore.config.wechat.defaultAuthor || ''}`,
      '---',
      '',
      DEMO_ARTICLE_MD,
    ].join('\n')
    fs.writeFileSync(path, template, 'utf8')
    const newChild: Tree = { label, path, isFolder: false, isLeaf: true }
    if (!data.children) {
      data.children = []
    }
    data.children.push(newChild as Tree)
    ttsStore.inputs.notePath = path
  }

const handleNodeClick = ((itemdata: Tree,node:Node) => {
    log('[FileTree] node click:', itemdata.path)
    dir(itemdata)
    ttsStore.treeMenu.node = node;
    ttsStore.treeMenu.treeData = itemdata
    ttsStore.inputs.itemData = itemdata
    focusedNodeKey.value = itemdata.path
   if(!itemdata.isFolder && fs.existsSync(itemdata.path)){
    if (ttsStore.cnote.lastPath === itemdata.path && ttsStore.inputs.notePath === itemdata.path) return
    ttsStore.inputs.notePath = itemdata.path;
    ttsStore.cnote.title = itemdata.label;
    ttsStore.cnote.destTitle = itemdata.label;
    ttsStore.cnote.lastPath = itemdata.path;
    ttsStore.treeMenu.currentNode = treeRef.value?.getCurrentNode()
    ttsStore.setLastEditNote()
    ttsStore.addRecentFile(itemdata.path, itemdata.label)
    // 所有文件内容由 MarkdownEditor 的 notePath watcher 加载
  }
  })
  </script>


  <style scoped>
  .filter-container {
    padding: 8px;
    background: transparent;
  }


  .filter-input {
    --el-input-border-color: transparent;
    --el-input-hover-border-color: #dcdfe6;
    --el-input-focus-border-color: #409eff;
  }

  .filter-input :deep(.el-input__wrapper) {
    background-color: rgba(0, 0, 0, 0.03);
    border-radius: 6px;
    box-shadow: none;
    transition: all 0.2s;
    padding: 4px 8px;
  }

  .filter-input :deep(.el-input__wrapper:hover) {
    background-color: rgba(0, 0, 0, 0.05);
  }

  .filter-input :deep(.el-input__wrapper.is-focus) {
    background-color: #fff;
    box-shadow: 0 0 0 1px #409eff inset;
  }

  .filter-input :deep(.el-input__inner) {
    font-size: 12px;
    color: #606266;
  }

  .filter-input :deep(.el-input__inner::placeholder) {
    color: #a8abb2;
    font-size: 12px;
  }

  .filter-input :deep(.el-input__prefix) {
    color: #909399;
  }

  .filter-input :deep(.el-input__suffix) {
    color: #909399;
  }

  /* Tree context menu styling */
  .tree-context-menu :deep(.el-dropdown-menu__item) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    font-size: 13px;
  }

  .tree-context-menu :deep(.el-dropdown-menu__item .el-icon) {
    font-size: 16px;
    flex-shrink: 0;
  }

  .tree-context-menu :deep(.el-dropdown-menu__item span) {
    flex: 1;
  }

  .treemenu{
      background-color: transparent;
      padding-bottom: 50px; /* Add padding to avoid being covered by AConfig buttons */
  }

.el-dropdown{
  vertical-align: middle;
}
  .menu-anchor { display: block; width: 1px; height: 1px; pointer-events: none; }

  .icon-add{
    border: 0;
    background: transparent;
    padding: 0 2px;
    font: inherit;
    cursor: pointer;
    color: rgb(115, 117, 115);
    margin-right: 2px;
    float: right;
  }

  .icon-remove{
    color: red;
    margin-right: 2px;
  }
  .custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  padding-right: 8px;
  min-width: 0;
  max-width: 100%;
  position: relative;
}

.el-dropdown-link {
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  max-width: calc(100% - 30px);
  padding-right: 8px;
}

.node-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  position: absolute;
  right: 8px;
  background: inherit;
}

.star-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.star-icon:hover {
  transform: scale(1.2);
  transition: transform 0.2s;
}

.node-icon {
  margin-right: 3px;
  font-size: 12px;
  flex-shrink: 0;
  line-height: 1;
}

.rename-input {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  border: 1px solid #409eff;
  border-radius: 3px;
  padding: 0 4px;
  height: 20px;
  outline: none;
  background: #fff;
  color: #303133;
}

.keyboard-focused {
  background-color: rgba(64, 158, 255, 0.12);
  border-radius: 4px;
}

  </style>
