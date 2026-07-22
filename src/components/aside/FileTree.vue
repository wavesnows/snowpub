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
    <el-scrollbar height="100%" width="100%" tabindex="0" @keydown.capture="handleTreeKeydown">
    <el-tree
      :data="treeMenu.data"
      @node-click="handleNodeClick"
      @loadNode=" loadHandler"
      class="treemenu"
      node-key="path"
      :expand-on-click-node="false"
      :indent="5"
      :filter-node-method="filterNode"
      @node-contextmenu="showItemMenu "
      :default-expanded-keys="expandedKeys"
      @node-expand="onNodeExpand"
      @node-collapse="onNodeCollapse"
      ref="treeRef"
    >
    <template #default="{ node, data }">
        <div
          class="custom-tree-node"
          :class="{ 'keyboard-focused': data.path === focusedNodeKey }"
          @contextmenu.prevent="handleContextMenu(node, $event)"
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
          <el-tooltip
            v-else
            :content="node.label"
            placement="right"
            :show-after="800"
            :hide-after="0"
          >
            <span
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
          </el-tooltip>
          <span class="node-actions">
            <!-- Star icon for favorites -->
            <el-icon
              v-if="!node.data.isFolder && ttsStore.isStarred(node.data.path)"
              class="star-icon"
              color="#f7ba2a">
              <StarFilled />
            </el-icon>
            <el-dropdown  @command="handleCommand" trigger="click">
             <a class="icon-add" >⚙︎</a>
              <template #dropdown>
              <el-dropdown-menu class="tree-context-menu">
                <el-dropdown-item v-if="node.data.isFolder" :command="{type:'mdfile', data:data}">
                  <el-icon><Document /></el-icon>
                  <span>{{ t('fileTree.createMdFile') }}</span>
                </el-dropdown-item>
                <el-dropdown-item v-if="node.data.isFolder" :command="{type:'folder', data:data}">
                  <el-icon><Folder /></el-icon>
                  <span>{{ t('fileTree.createFolder') }}</span>
                </el-dropdown-item>
                <el-dropdown-item v-if="node.data.isFolder" :command="{type:'remove', data:data, node:node}" divided>
                  <el-icon><Delete /></el-icon>
                  <span>{{ t('fileTree.remove') }}</span>
                </el-dropdown-item>
                <el-dropdown-item v-if="!node.data.isFolder" :command="{type:'pin', data:data}">
                  <el-icon v-if="ttsStore.isPinned(data.path)"><RemoveFilled /></el-icon>
                  <el-icon v-else><Position /></el-icon>
                  <span>{{ ttsStore.isPinned(data.path) ? t('fileTree.unpinNote') : t('fileTree.pinNote') }}</span>
                </el-dropdown-item>
                <el-dropdown-item v-if="!node.data.isFolder" :command="{type:'star', data:data}">
                  <el-icon v-if="ttsStore.isStarred(data.path)"><StarFilled /></el-icon>
                  <el-icon v-else><Star /></el-icon>
                  <span>{{ ttsStore.isStarred(data.path) ? t('fileTree.removeStar') : t('fileTree.addStar') }}</span>
                </el-dropdown-item>
                <el-dropdown-item :command="{type:'showInFinder', data:data}" divided>
                  <el-icon><FolderOpened /></el-icon>
                  <span>{{ t('fileTree.showInFinder') }}</span>
                </el-dropdown-item>
                <el-dropdown-item v-if="!node.data.isFolder" :command="{type:'removeitem', data:data, node:node}">
                  <el-icon><Delete /></el-icon>
                  <span>{{ t('fileTree.remove') }}</span>
                </el-dropdown-item>
              </el-dropdown-menu>
              </template>
            </el-dropdown>
          </span>
          
          <!-- <el-dropdown v-if="dropdownVisible" :style="{ position: 'fixed', top: `${dropdownPosition.y}px`, left: `${dropdownPosition.x}px` }">
              <span class="el-dropdown-link">{{ node.label }}</span>
              <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click.native="handleDropdownItemClick">菜单项</el-dropdown-item>
              </el-dropdown-menu>
            </template>
            </el-dropdown>-->
           
            <!--  <el-popconfirm
              confirm-button-text="Yes" cancel-button-text="No" :icon="InfoFilled" icon-color="#626AEF"
              title="Are you sure to delete this?" @confirm="remove(node, data)" @cancel="cancelEvent" >
              <template #reference>
                <a v-if="!node.data.isFolder" class="icon-remove" >✗</a>
              </template>
            </el-popconfirm> -->
          </div>
       
      </template>
    
    </el-tree>
    </el-scrollbar>

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
import {ref, watch, nextTick, getCurrentInstance, onMounted, onUnmounted} from 'vue'
import Node from 'element-plus/es/components/tree/src/model/node'
import {ElTree, ElMessage,ElMessageBox, ElPopconfirm} from 'element-plus'
import { Search, InfoFilled, Star, StarFilled, Document, Folder, FolderOpened, Delete, Position, RemoveFilled } from "@element-plus/icons-vue"
import {getNoteLabel} from "@/libs/noteUtil"
import { useTtsStore, Tree } from "@/store/store"
import { log, dir } from "@/libs/logger"
import { readDir,readNotes} from "@/libs/fileHandler"
import {updateTreeMenu} from "@/libs/treeMenu"
import {remove, removeFolder, renameFile} from "@/libs/fileHandler"
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const ttsStore = useTtsStore();
var {inputs,cnote ,treeMenu} = storeToRefs(ttsStore);

const filterText = ref('')
const treeRef = ref<InstanceType<typeof ElTree>>()
const dialogFormVisible = ref(false)
const formLabelWidth = '120px';
const expandedKeys = ref<string[]>([]);

const editingPath = ref('')
const editingName = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

const focusedNodeKey = ref<string | null>(null)

function getVisibleNodes(): Tree[] {
  // onNodeExpand/onNodeCollapse 已精确维护 ttsStore.treeMenu.expandedKeys，
  // 无需在每次键盘导航时全量遍历树并写磁盘
  const result: Tree[] = []
  const expandedSet = new Set(ttsStore.treeMenu.expandedKeys || [])
  const filter = filterText.value.trim()

  function subtreeHasMatch(node: Tree): boolean {
    if (node.label.includes(filter)) return true
    if (node.children) {
      return node.children.some(child => subtreeHasMatch(child))
    }
    return false
  }

  function traverse(nodes: Tree[]) {
    for (const node of nodes) {
      if (filter && !subtreeHasMatch(node)) continue
      result.push(node)
      if (node.isFolder && expandedSet.has(node.path) && node.children) {
        traverse(node.children)
      }
    }
  }

  traverse(ttsStore.treeMenu.data as Tree[])
  return result
}

function handleTreeKeydown(event: KeyboardEvent) {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(event.key) === -1) return
  event.preventDefault()
  event.stopPropagation()

  const visible = getVisibleNodes()
  if (visible.length === 0) return

  const currentIdx = focusedNodeKey.value
    ? visible.findIndex(n => n.path === focusedNodeKey.value)
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
      const keys = ttsStore.treeMenu.expandedKeys || []
      if (!keys.includes(node.path)) {
        ttsStore.treeMenu.expandedKeys = [...keys, node.path]
        nextTick(() => {
          treeRef.value?.getNode(node.path)?.expand()
        })
      }
    }
  } else if (event.key === 'ArrowLeft') {
    if (currentIdx === -1) return
    const node = visible[currentIdx]
    if (node.isFolder) {
      const keys = ttsStore.treeMenu.expandedKeys || []
      if (keys.includes(node.path)) {
        ttsStore.treeMenu.expandedKeys = keys.filter(k => k !== node.path)
        nextTick(() => {
          treeRef.value?.getNode(node.path)?.collapse()
        })
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
    renameFile()
    data.label = newName
  }
  editingPath.value = ''
  editingName.value = ''
}

function cancelRename() {
  editingPath.value = ''
  editingName.value = ''
}

var show = ref(false);

const dropdownVisible = ref(false);

// ── 展开状态管理 ────────────────────────────────────────────────────
// 用户展开/折叠 → 内存立即更新，磁盘写防抖（避免每次操作同步阻塞主线程）
// 数据刷新 / 启动  → restoreExpandedState() 从 store 恢复

let _persistTimer: ReturnType<typeof setTimeout> | null = null
function schedulePersist() {
  if (_persistTimer) clearTimeout(_persistTimer)
  _persistTimer = setTimeout(() => ttsStore.persistExpandedKeys(), 600)
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
  const keys = ttsStore.treeMenu.expandedKeys || []
  if (!keys.includes(data.path)) {
    ttsStore.treeMenu.expandedKeys = [...keys, data.path]
    schedulePersist()
  }
}

function onNodeCollapse(data: Tree) {
  ttsStore.treeMenu.expandedKeys = (ttsStore.treeMenu.expandedKeys || []).filter(k => k !== data.path)
  schedulePersist()
}

// 数据刷新后新节点默认折叠，重新恢复展开状态
watch(() => ttsStore.treeMenu.data, () => {
  focusedNodeKey.value = null
  restoreExpandedState()
}, { deep: false })



const showItemMenu = () => {
    show.value = true;
  };

  const dropdownPosition = ref({ x: 0, y: 0 });
  const handleContextMenu = (node:any, event:any) => {
      dropdownPosition.value = { x: event.clientX, y: event.clientY };
      dropdownVisible.value = true;
    };




    const handleDropdownItemClick = () => {
      dropdownVisible.value = false;
    };



const handleCommand = (command: any) => {
    log('[FileTree] command:', command.type, command.data?.path)
    ttsStore.treeMenu.treeData = command.data as Tree;
    ttsStore.treeMenu.node = command.node as Node;
    switch (command.type) {
      case 'mdfile':
        appendMd(command.data)
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

const defaultProps = {
    children: 'children',
    label: 'label',
    isLeaf:true
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
  if (_filterTimer) clearTimeout(_filterTimer)
  _filterTimer = setTimeout(() => treeRef.value?.filter(val), 300)
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
  cancelEvent()
  // el-tree 初始化是同步的，一个 nextTick 就够；
  // v-show 保留 el-tree 内存状态，最小化/切 tab 回来无需重设
  nextTick(() => restoreExpandedState())
})

onUnmounted(() => {})

function cancelEvent(){

}

const filterNode:any = (value: string, data: Tree,node:Node) => {
  if (!value) return true
  return data.label.includes(value)
}

function loadHandler(data:any){
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

const handleNodeClick = ((itemdata: Tree,node:Node) => {
    log('[FileTree] node click:', itemdata.path)
    dir(itemdata)
    ttsStore.treeMenu.node = node;
    ttsStore.treeMenu.treeData = itemdata
    ttsStore.inputs.itemData = itemdata
    focusedNodeKey.value = itemdata.path
   if(!itemdata.isFolder && fs.existsSync(itemdata.path)){
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
  .icon-add{
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