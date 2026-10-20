import { markRaw, toRaw } from 'vue'
import type Node from 'element-plus/es/components/tree/src/model/node'
import type { Tree } from '@/store/store'

// Element Plus watches `data` deeply. Keep its mutable view model separate
// from Pinia so one external file change doesn't rebuild the entire notebook.
export function createTreeSnapshot(nodes: Tree[]): Tree[] {
  return markRaw(toRaw(nodes).map(value => {
    const node = toRaw(value)
    return markRaw({
      label: node.label, path: node.path, isFolder: node.isFolder,
      isLeaf: node.isLeaf,
      children: node.children ? createTreeSnapshot(node.children) : undefined,
    })
  }))
}

function sameMetadata(a: Tree, b: Tree) {
  return a.path === b.path && a.label === b.label && a.isFolder === b.isFolder &&
    a.isLeaf === b.isLeaf
}

function sameBranch(a: Tree[], b: Tree[]): boolean {
  return a.length === b.length && a.every((node, i) => sameMetadata(node, b[i]) &&
    sameBranch(node.children || [], b[i].children || []))
}

function replaceChangedRange<T>(target: T[], next: T[]) {
  let start = 0
  while (start < target.length && start < next.length && target[start] === next[start]) start++
  if (start === target.length && start === next.length) return
  let end = target.length, nextEnd = next.length
  while (end > start && nextEnd > start && target[end - 1] === next[nextEnd - 1]) { end--; nextEnd-- }
  // Avoid spreading an arbitrarily large notebook into a function call.
  target.splice(start, end - start)
  for (let i = start; i < nextEnd; i += 1000) target.splice(i, 0, ...next.slice(i, Math.min(i + 1000, nextEnd)))
}

export function syncTreeView(root: Node, source: Tree[]) {
  const snapshot = createTreeSnapshot(source)
  function sync(parent: Node, next: Tree[]) {
    const previous: Tree[] = parent.level === 0 ? parent.data as Tree[] : (parent.data.children || [])
    if (sameBranch(previous, next)) return
    const existing = new Map(parent.childNodes.map(node => [node.data.path, node]))
    const wanted = new Map(next.map(node => [node.path, node]))
    for (const node of [...parent.childNodes]) {
      const replacement = wanted.get(node.data.path)
      if (!replacement || replacement.isFolder !== node.data.isFolder) {
        // removeChild repeatedly scans/splices the sibling arrays (quadratic
        // for a bulk deletion). Unregister now, patch both arrays once below.
        parent.store.deregisterNode(node)
        const detached: { parent: Node | null } = node
        detached.parent = null
        existing.delete(node.data.path)
      }
    }
    const ordered: Node[] = []
    for (const data of next) {
      let node = existing.get(data.path)
      if (!node) {
        // batch=true: manage the raw data array ourselves after reconciliation.
        parent.insertChild({ data }, undefined, true)
        node = parent.childNodes[parent.childNodes.length - 1]
      } else {
        if (!sameMetadata(node.data as Tree, data)) {
          node.data = markRaw({ ...data, children: node.data.children })
        }
        if (data.isFolder) sync(node, data.children || [])
      }
      ordered.push(node)
    }
    replaceChangedRange(parent.childNodes, ordered)
    replaceChangedRange(previous, ordered.map(node => node.data as Tree))
    if (parent.level > 0 && parent.data.isFolder) parent.data.children = previous
    parent.updateLeafState()
  }
  sync(root, snapshot)
  const current = root.store.currentNode
  if (current && root.store.getNode(current.key) !== current) {
    current.isCurrent = false
    // Element Plus initializes this field to null, despite its non-null type.
    const store: { currentNode: Node | null } = root.store
    store.currentNode = null
  }
}
