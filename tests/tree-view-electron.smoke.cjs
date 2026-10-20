// Run after vite build: electron tests/tree-view-electron.smoke.cjs
// Isolated userData and home; never opens the user's notes or starts schedulers.
const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('fs'), os = require('os'), path = require('path')
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'yesnote-tree-smoke-'))
const notes = path.join(fixture, 'notes')
fs.mkdirSync(notes)
const restoredNote = path.join(notes, 'restore.md')
fs.writeFileSync(restoredNote, 'Local notebook fixture')
app.setPath('userData', fixture)
app.disableHardwareAcceleration()
require('electron-store').initRenderer()
fs.writeFileSync(path.join(fixture, 'config.json'), JSON.stringify({
  currentNotebookPath: notes, currentStore: fixture, rootStores: [fixture],
  currentNotebookType: 'local', currentNotebook: 'test', lastPath: restoredNote, expandedKeys: [],
  virtualDirs: [{ id: 'fixture', name: 'fixture', realPath: notes }],
}))
const preload = path.join(fixture, 'preload.cjs')
fs.writeFileSync(preload, `require('os').homedir = () => ${JSON.stringify(fixture)}`)
for (const channel of ['scheduler:list', 'external-tasks:list']) ipcMain.handle(channel, () => [])
ipcMain.handle('wechat:getConfig', () => ({}))
ipcMain.handle('get-git-available', () => false)
ipcMain.handle('app:version', () => 'test')
ipcMain.handle('article-rewrite:is-running', () => false)
ipcMain.handle('article-rewrite:log-dir', () => fixture)
let win
const timeout = setTimeout(() => { console.error('Smoke test timed out'); app.exit(1) }, 45000)
app.whenReady().then(async () => {
  win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, preload } })
  await win.loadFile(path.resolve('dist/index.html'))
  const result = await win.webContents.executeJavaScript(`(async () => {
    const app = document.querySelector('#app').__vue_app__
    const s = [...app.config.globalProperties.$pinia._s.values()].find(store => store.treeMenu)
    if (!s.cnote.lastPath.endsWith('/restore.md')) throw new Error('Note not restored at startup')
    function findTree(vnode) {
      if (!vnode) return
      if (vnode.component?.type.name === 'ElTree') return vnode.component.proxy
      if (vnode.component) { const found = findTree(vnode.component.subTree); if (found) return found }
      if (Array.isArray(vnode.children)) for (const child of vnode.children) { const found = findTree(child); if (found) return found }
    }
    const tree = findTree(document.querySelector('#app')._vnode)
    const tick = async () => { await tree.$nextTick(); await tree.$nextTick(); await tree.$nextTick() }
    const file = i => ({path:'/fixture/'+i+'.md',label:'note '+i,isFolder:false,isLeaf:true})
    const children = Array.from({length:25000},(_,i)=>file(i))
    const folder = list => ({path:'/fixture',label:'fixture',isFolder:true,isLeaf:false,children:list})
    s.treeMenu.data = [folder(children)]
    await tick()
    const selected = tree.getNode('/fixture/12.md')
    if (!selected) throw new Error('Initial tree did not render')
    tree.setCurrentKey(selected.key, false)
    let created = 0
    const register = tree.store.registerNode.bind(tree.store)
    tree.store.registerNode = node => { created++; register(node) }
    const start = performance.now()
    s.treeMenu.data = [folder([...children,file('new')])]
    await tick()
    const updateMs = performance.now()-start
    if (created !== 1) throw new Error('Recreated '+created+' nodes')
    if (tree.getNode(selected.key) !== selected) throw new Error('Lost node identity')
    if (tree.store.currentNode !== selected) throw new Error('Lost selection')
    s.togglePin('/fixture/new.md')
    await tick()
    if (tree.getNode('/fixture').childNodes[0].key !== '/fixture/new.md') throw new Error('Pin order not updated')
    const menu = [...document.querySelectorAll('.el-menu-item')]
    const expanded = tree.getNode('/fixture')
    expanded.expand()
    for (let i = 0; i < 24; i++) {
      const index = [1, 0, 2, 0][i % 4]
      menu[index].click()
      await tick()
      if (!menu[index].classList.contains('is-active')) throw new Error('Menu failed: '+index)
    }
    if (!expanded.expanded || tree.store.currentNode !== selected) throw new Error('Menu lost tree state')
    s.treeMenu.data = [folder([file(12)])]
    await tick()
    if (tree.getNode('/fixture/new.md')) throw new Error('Deleted node remains registered')
    s.page.asideIndex = '2'; await tick(); s.page.asideIndex = '1'; await tick()
    if (tree.getNode('/fixture/12.md') !== selected) throw new Error('Menu switch recreated tree')
    return {noteRestored:true,menuSwitches:24,createdDuringAddition:1,updateMs:Math.round(updateMs),remaining:tree.getNode('/fixture').childNodes.length}
  })()`)
  console.log(JSON.stringify(result))
  clearTimeout(timeout)
  win.destroy()
  app.exit(0)
}).catch(error => { console.error(error); clearTimeout(timeout); if(win) win.destroy(); app.exit(1) })
