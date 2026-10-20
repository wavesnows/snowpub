const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { reactive, isReactive, nextTick } = require('vue')
const TreeStore = require('element-plus/lib/components/tree/src/model/tree-store.js').default
function load() {
  const exports = {}
  const file = 'src/libs/treeView.ts'
  if (!fs.existsSync(file)) return exports
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText, { exports, require })
  return exports
}
const leaf = (path, label = path) => ({ path, label, isFolder: false, isLeaf: true })
const folder = (path, children) => ({ path, label: path, isFolder: true, isLeaf: false, children })
function model(data) {
  const s = reactive(new TreeStore({ data, key: 'path', props: {}, defaultExpandedKeys: [], defaultCheckedKeys: [] }))
  s.initialize()
  return s
}
test('one added file does not recreate 25000 existing tree nodes or lose expanded selection', async () => {
  const { createTreeSnapshot, syncTreeView } = load()
  assert.equal(typeof createTreeSnapshot, 'function', 'tree view must be isolated from deep reactive source data')
  const data = [folder('/notes', Array.from({length: 25000}, (_, i) => leaf(`/notes/${i}.md`)))]
  const snapshot = createTreeSnapshot(reactive(data))
  const s = model(snapshot)
  const parent = s.getNode('/notes'), selected = s.getNode('/notes/12.md')
  parent.expand()
  s.setCurrentNodeKey(selected.key)
  let created = 0
  const register = s.registerNode.bind(s)
  s.registerNode = n => { created++; register(n) }
  const next = [folder('/notes', [...data[0].children, leaf('/notes/new.md')])]
  syncTreeView(s.root, next)
  await nextTick()
  assert.equal(created, 1)
  assert.equal(s.getNode('/notes/12.md'), selected)
  assert.equal(s.currentNode, selected)
  assert.equal(parent.expanded, true)
  assert.equal(parent.childNodes.length, 25001)
  assert.equal(isReactive(parent.data), false)
  assert.equal(data[0].children.length, 25000, 'view mutations must not alter the notebook store')
})
test('incremental updates preserve ordering, update labels and remove stale descendants', () => {
  const { createTreeSnapshot, syncTreeView } = load()
  assert.equal(typeof syncTreeView, 'function')
  const data = [folder('/a', [leaf('/a/1'), leaf('/a/2')]), folder('/b', [leaf('/b/1')])]
  const s = model(createTreeSnapshot(data))
  const retained = s.getNode('/a/2')
  syncTreeView(s.root, [folder('/a', [leaf('/a/2', 'renamed'), leaf('/a/3')])])
  assert.equal(s.getNode('/a/2'), retained)
  assert.equal(retained.label, 'renamed')
  assert.equal(s.getNode('/a/1'), null)
  assert.equal(s.getNode('/b/1'), null)
  assert.equal(s.root.childNodes.length, 1)
  assert.equal(s.getNode('/a').childNodes.map(n => n.key).join(','), '/a/2,/a/3')
  syncTreeView(s.root, [folder('/a', [leaf('/a/3'), leaf('/a/2', 'renamed')])])
  assert.equal(s.getNode('/a').childNodes.map(n => n.key).join(','), '/a/3,/a/2')
  assert.equal(s.getNode('/a').data.children.map(n => n.path).join(','), '/a/3,/a/2')
  syncTreeView(s.root, [])
  assert.equal(s.root.childNodes.length, 0)
  assert.equal(s.getNode('/a/3'), null)
})
test('replacing the selected folder with a file clears stale selection and descendants', () => {
  const {createTreeSnapshot, syncTreeView} = load()
  const s = model(createTreeSnapshot([folder('/a', [leaf('/a/child')])]))
  s.setCurrentNodeKey('/a')
  syncTreeView(s.root, [leaf('/a')])
  assert.equal(s.currentNode, null)
  assert.equal(s.getNode('/a').isLeaf, true)
  assert.equal(s.getNode('/a/child'), null)
})
test('deletion updates canonical data even when the menu holds an isolated row snapshot', () => {
  const state = { treeMenu: {data:[folder('/a',[leaf('/a/1'),leaf('/a/2')])], treeData:leaf('/a/1'), revision:0},
    buildFlatFileList() { this.flatFileList = this.treeMenu.data[0].children.map(n=>n.path) } }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/libs/treeMenu.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,
    {exports, require:id=>id==='@/store/store'?{useTtsStore:()=>state}:require(id)})
  exports.updateTreeMenu()
  assert.deepEqual(state.flatFileList, ['/a/2'])
  assert.equal(state.treeMenu.revision,1)
  exports.updateTreeMenu()
  assert.deepEqual(state.flatFileList, ['/a/2'], 'a missing row must not remove the last file')
  assert.equal(state.treeMenu.revision,1)
})
