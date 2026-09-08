import { promises as fs } from 'fs'
import path from 'path'
import type { Tree } from '@/store/store'

export function collectVisibleNodes(
  nodes: Tree[],
  getNode: (key: string) => { visible: boolean; expanded: boolean } | undefined,
): Tree[] {
  const result: Tree[] = []
  const visit = (siblings: Tree[]) => {
    for (const node of siblings) {
      const actual = getNode(node.path)
      if (!actual?.visible) continue
      result.push(node)
      if (actual.expanded && node.children) visit(node.children)
    }
  }
  visit(nodes)
  return result
}

// Keep node objects and child arrays alive so el-tree retains interaction state.
export function sortPinnedInPlace(nodes: Tree[], pinnedPaths: string[]) {
  const pinned = new Set(pinnedPaths)
  const visit = (siblings: Tree[]) => {
    siblings.sort((a, b) => {
      const priority = Number(!b.isFolder && pinned.has(b.path)) - Number(!a.isFolder && pinned.has(a.path))
      if (priority) return priority
      const left = path.basename(a.path), right = path.basename(b.path)
      return left < right ? -1 : left > right ? 1 : 0
    })
    for (const node of siblings) if (node.children) visit(node.children)
  }
  visit(nodes)
}

export function sameTree(a: Tree[], b: Tree[]): boolean {
  return a.length === b.length && a.every((node, i) => {
    const other = b[i]
    return node.path === other.path && node.label === other.label &&
      node.isFolder === other.isFolder && sameTree(node.children || [], other.children || [])
  })
}

export async function readNotesAsync(dir: string, showHidden = false, ancestors = new Set<string>()): Promise<Tree[]> {
  let realPath: string
  let entries
  try {
    realPath = await fs.realpath(dir)
    if (ancestors.has(realPath)) return [] // A symlink can point back to an ancestor.
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (error: any) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const parents = new Set(ancestors).add(realPath)
  const result: Tree[] = []
  for (const entry of entries) {
    if (!showHidden && entry.name.startsWith('.')) continue
    const ext = path.extname(entry.name)
    if (!showHidden && ext !== '' && ext !== '.json' && ext !== '.md') continue
    const fullPath = path.resolve(dir, entry.name)
    let isFolder = entry.isDirectory()
    if (entry.isSymbolicLink()) {
      try { isFolder = (await fs.stat(fullPath)).isDirectory() }
      catch (error: any) {
        if (error.code === 'ENOENT') continue
        throw error
      }
    }
    if (!showHidden && !ext && !isFolder) continue
    result.push({
      label: isFolder ? entry.name : entry.name.substring(0, entry.name.lastIndexOf('.')),
      path: fullPath, isFolder, isLeaf: !isFolder,
      children: isFolder ? await readNotesAsync(fullPath, showHidden, parents) : undefined,
    })
  }
  return result
}
