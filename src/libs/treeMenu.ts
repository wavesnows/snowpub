import { useTtsStore, Tree } from '@/store/store'

// Tree rows are view snapshots, not the canonical notebook data. Remove by
// path from the store rather than mutating the Element Plus node's parent.
export function updateTreeMenu() {
  const store = useTtsStore()
  const target = store.treeMenu.treeData.path
  function removeFrom(nodes: Tree[]): boolean {
    const index = nodes.findIndex(node => node.path === target)
    if (index >= 0) { nodes.splice(index, 1); return true }
    return nodes.some(node => node.children && removeFrom(node.children))
  }
  if (removeFrom(store.treeMenu.data as Tree[])) {
    store.treeMenu.revision++
    store.buildFlatFileList()
  }
}
