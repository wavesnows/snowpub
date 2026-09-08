const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function loadTS(file, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const exports = {}
  vm.runInNewContext(source, {
    exports, require: id => id in imports ? imports[id] : require(id),
    setTimeout, clearTimeout, console,
  }, { filename: file })
  return exports
}

function loadActions(writes, overrides = {}) {
  const helperPath = path.join(__dirname, '../src/libs/treePerformance.ts')
  const helpers = fs.existsSync(helperPath) ? loadTS('src/libs/treePerformance.ts') : {}
  let config = {}
  const persist = { set: (...args) => writes.push(args), delete() {},
    get store() { return { ...config } }, set store(value) { config = value; writes.push([value]) } }
  return loadTS('src/store/store.ts', {
    pinia: { defineStore: (_, options) => options },
    '@editorjs/editorjs': {}, electron: {}, 'element-plus': {},
    '@/global/defaultConf': { appName: 'test' },
    '@/global/initLocalStore': { store: persist },
    '@/libs/fileHandler': {}, '@/libs/searchUtil': {}, '@/libs/gitHistory': {},
    '@/libs/errorHandler': {}, '@/libs/logger': {}, '@/libs/treePerformance': { ...helpers, ...overrides },
  }).useTtsStore.actions
}

test('rapid note selections persist one batch containing the latest state', async () => {
  const writes = []
  const actions = loadActions(writes)
  const state = {
    ...actions, cnote: { lastPath: '/a', title: 'a' }, editerData: { blocks: [] },
    treeMenu: { expandedKeys: ['/folder'] }, recentFiles: [],
  }
  state.setLastEditNote()
  state.addRecentFile('/a', 'a')
  state.cnote = { lastPath: '/b', title: 'b' }
  state.setLastEditNote()
  state.addRecentFile('/b', 'b')
  assert.equal(writes.length, 0, 'selection must not synchronously write configuration')
  state.flushPendingPreferences()
  assert.equal(writes.length, 1)
  assert.equal(writes[0][0].lastPath, '/b')
  assert.equal(writes[0][0].recentFiles[0].path, '/b')
  await new Promise(resolve => setTimeout(resolve, 650))
  assert.equal(writes.length, 1, 'flush must cancel the delayed duplicate write')
})

test('pin and unpin reorder siblings without scanning disk or replacing nodes', () => {
  const actions = loadActions([])
  const a = { path: '/a.md', isFolder: false }
  const b = { path: '/b.md', isFolder: false }
  const state = {
    ...actions, notebook: { bookType: 'local' }, favorites: { pinned: [] }, treeMenu: { data: [a, b] },
    scheduleTreeRefresh() { assert.fail('pinning must not scan the filesystem') },
  }
  state.togglePin('/b.md')
  assert.equal(state.treeMenu.data[0], b)
  assert.equal(state.flatFileList[0], '/b.md')
  state.togglePin('/b.md')
  assert.equal(state.treeMenu.data[0], a)
})

test('removing a recent file before a pending save does not resurrect it', () => {
  const writes = []
  const state = { ...loadActions(writes), recentFiles: [] }
  state.addRecentFile('/a.md', 'a')
  assert.equal(typeof state.removeRecentFile, 'function')
  state.removeRecentFile('/a.md')
  state.flushPendingPreferences()
  assert.equal(writes.length, 1)
  assert.equal(writes[0][0].recentFiles.length, 0)
})

function treeState(actions, data = []) {
  return { ...actions, notebook: { bookType: 'local', currentPath: '/notes' },
    virtualWorkspace: { dirs: [] }, showHiddenFiles: false, favorites: { pinned: [] },
    treeMenu: { data }, flatFileList: [] }
}

test('an unchanged refresh retains the tree and node identities', async () => {
  const a = { path: '/notes/a.md', label: 'a', isFolder: false }
  const actions = loadActions([], { readNotesAsync: async () => [{ ...a }] })
  const state = treeState(actions, [a])
  const original = state.treeMenu.data
  await state.refreshTreeData()
  assert.equal(state.treeMenu.data, original)
  assert.equal(state.treeMenu.data[0], a)
})

test('an older refresh cannot overwrite the result of a newer one', async () => {
  const pending = []
  const actions = loadActions([], { readNotesAsync: () => new Promise(resolve => pending.push(resolve)) })
  const state = treeState(actions)
  const first = state.refreshTreeData()
  const second = state.refreshTreeData()
  pending[1]([{ path: '/notes/new.md', label: 'new', isFolder: false }])
  await second
  pending[0]([{ path: '/notes/old.md', label: 'old', isFolder: false }])
  await first
  assert.equal(state.treeMenu.data[0].label, 'new')
})

test('switching notebook invalidates an in-flight refresh', async () => {
  let finish
  const actions = loadActions([], { readNotesAsync: () => new Promise(resolve => { finish = resolve }) })
  const state = treeState(actions)
  const refresh = state.refreshTreeData()
  state.notebook.currentPath = '/other-notebook'
  finish([{ path: '/notes/old.md', label: 'old', isFolder: false }])
  await refresh
  assert.equal(state.treeMenu.data.length, 0)
})

test('async scanning preserves filtering, discovers external changes, and avoids symlink loops', async () => {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'yesnote-tree-test-'))
  try {
    fs.mkdirSync(path.join(dir, 'folder'))
    fs.writeFileSync(path.join(dir, 'a.md'), 'a')
    fs.writeFileSync(path.join(dir, '.hidden.md'), 'hidden')
    fs.writeFileSync(path.join(dir, 'other.txt'), 'other')
    fs.writeFileSync(path.join(dir, 'folder/b.json'), '{}')
    fs.symlinkSync(dir, path.join(dir, 'folder/loop'))
    const { readNotesAsync, sameTree } = loadTS('src/libs/treePerformance.ts', {
      fs: { promises: fs.promises }, // Any synchronous filesystem call would fail.
    })
    const before = await readNotesAsync(dir)
    assert.equal(before.length, 2)
    assert.equal(before.find(n => n.label === 'folder').children.length, 2)
    const all = await readNotesAsync(dir, true)
    assert.equal(all.length, 4)
    fs.writeFileSync(path.join(dir, 'new.md'), 'new')
    const after = await readNotesAsync(dir)
    assert.equal(sameTree(before, after), false)
    assert.equal(after.length, 3)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('keyboard navigation follows actual filtered and expanded nodes without scanning collapsed subtrees', () => {
  const helpers = loadTS('src/libs/treePerformance.ts')
  assert.equal(typeof helpers.collectVisibleNodes, 'function')
  const child = { path: '/folder/child', label: 'child' }
  const hidden = { path: '/folder/hidden', label: 'hidden' }
  const folder = { path: '/folder', label: 'folder', children: [child, hidden] }
  const collapsed = { path: '/closed', children: [{ path: '/closed/unused' }] }
  const states = {
    '/folder': { visible: true, expanded: true },
    '/folder/child': { visible: true },
    '/folder/hidden': { visible: false },
    '/closed': { visible: true, expanded: false },
  }
  const visited = []
  const result = helpers.collectVisibleNodes([folder, collapsed], path => { visited.push(path); return states[path] })
  assert.equal(result.map(n => n.path).join(','), '/folder,/folder/child,/closed')
  assert.equal(visited.includes('/closed/unused'), false)
})

test('moving keyboard focus reuses the visible-node cache; expanding a folder invalidates it', () => {
  const { computed, reactive, ref } = require('vue')
  const { collectVisibleNodes } = loadTS('src/libs/treePerformance.ts')
  assert.equal(typeof collectVisibleNodes, 'function')
  const focused = ref('')
  const state = reactive({ visible: true, expanded: false })
  let traversals = 0
  const list = computed(() => {
    traversals++
    return collectVisibleNodes([{ path: '/folder', children: [{ path: '/child' }] }],
      path => path === '/folder' ? state : { visible: true, expanded: false })
  })
  assert.equal(list.value.length, 1)
  focused.value = '/folder'
  assert.equal(list.value.length, 1)
  assert.equal(traversals, 1)
  state.expanded = true
  assert.equal(list.value.length, 2)
  assert.equal(traversals, 2)
})


test('batched preferences preserve undefined-as-delete semantics', () => {
  const writes = []
  const state = { ...loadActions(writes), cnote: { lastPath: '/a', title: 'a' },
    treeMenu: { expandedKeys: [] }, editerData: { blocks: [] } }
  state.setLastEditNote()
  state.flushPendingPreferences()
  state.cnote.title = undefined
  state.setLastEditNote()
  state.flushPendingPreferences()
  assert.equal(Object.hasOwn(writes[1][0], 'title'), false)
  assert.equal(writes[1][0].lastPath, '/a')
})
