const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const vue = require('vue')
const { renderToString } = require('@vue/server-renderer')
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc')

function evaluate(source, imports) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText, { exports, require: id => id in imports ? imports[id] : require(id), setTimeout, clearTimeout })
  return exports
}

test('a large tree renders no per-row dropdowns and shares one menu with the correct target', async () => {
  const data = Array.from({ length: 1000 }, (_, i) => ({ label: `note ${i}`, path: `/notes/${i}.md`, isFolder: false }))
  const pins = []
  const commands = []
  const state = vue.reactive({
    treeMenu: { data, expandedKeys: [] }, page: { asideIndex: '1' }, config: {},
    favorites: { starred: [] }, cnote: {}, inputs: {}, menu: {},
    isPinned: () => false, isStarred: () => false, togglePin: path => pins.push(path),
  })
  const pass = (tag = 'div') => ({ setup: (_, { slots }) => () => vue.h(tag, slots.default?.()) })
  const Tree = { props: ['data'], setup: (props, { slots }) => () =>
    vue.h('section', props.data.map(data => slots.default({ data, node: { data, label: data.label } }))) }
  const Dropdown = { setup: (_, { slots }) => () => vue.h('aside', { 'data-shared-menu': 'yes' }, slots.dropdown?.()) }
  const imports = {
    vue, pinia: { storeToRefs: vue.toRefs },
    'element-plus': { ElTree: Tree, ElDropdown: Dropdown },
    '@element-plus/icons-vue': new Proxy({}, { get: () => pass('i') }),
    '@/store/store': { useTtsStore: () => state },
    '@/libs/logger': { log() {}, dir() {} }, '@/libs/github': {}, '@/libs/noteUtil': {},
    '@/libs/fileHandler': {}, '@/libs/treeMenu': {},
    '@/libs/demoArticle': { DEMO_ARTICLE_MD: '' }, '@/assets/brand/defaultCoverBase64': { DEFAULT_COVER_BASE64: '' },
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '@/libs/treePerformance': { collectVisibleNodes: () => [] },
  }
  const { descriptor } = parse(fs.readFileSync('src/components/aside/FileTree.vue', 'utf8'))
  const script = compileScript(descriptor, { id: 'file-tree-render-test' })
  const component = evaluate(script.content, imports).default
  component.render = evaluate(compileTemplate({ source: descriptor.template.content, filename: 'FileTree.vue',
    id: 'file-tree-render-test', compilerOptions: { bindingMetadata: script.bindings },
  }).code, imports).render
  const setup = component.setup
  let captured
  component.setup = (props, ctx) => captured || (captured = setup(props, ctx))
  async function render() {
    commands.length = 0
    const app = vue.createSSRApp(component)
    for (const name of ['ElInput', 'ElTooltip', 'ElIcon', 'ElScrollbar', 'ElDialog', 'ElForm', 'ElFormItem', 'ElButton', 'ElDropdownMenu']) app.component(name, pass())
    app.component('ElDropdownItem', { props: ['command'], setup: props => {
      commands.push(props.command)
      return () => vue.h('button', { 'data-command': props.command.type })
    } })
    return renderToString(app)
  }
  const before = await render()
  assert.equal((before.match(/aria-haspopup="menu"/g) || []).length, 1000)
  assert.equal(before.includes('data-shared-menu'), false)
  const event = { type: 'click', detail: 1, currentTarget: { getBoundingClientRect: () => ({ left: 20, bottom: 30 }) } }
  await captured.openMenu(data[4], { data: data[4] }, event)
  const after = await render()
  assert.equal((after.match(/data-shared-menu/g) || []).length, 1)
  captured.handleCommand(commands.find(command => command.type === 'pin'))
  assert.deepEqual(pins, ['/notes/4.md'])
  await captured.openContextMenu({ ...event, type: 'contextmenu', clientX: 10, clientY: 40, preventDefault() {} }, data[7], { data: data[7] })
  await render()
  captured.handleCommand(commands.find(command => command.type === 'pin'))
  assert.deepEqual(pins, ['/notes/4.md', '/notes/7.md'])
  const folder = { label: 'folder', path: '/notes/folder', isFolder: true, children: [] }
  await captured.openMenu(folder, { data: folder }, event)
  await render()
  const types = commands.map(command => command.type)
  const expected = require('../package.json').name === 'snowpub'
    ? ['mdfile', 'demo', 'folder', 'remove', 'showInFinder']
    : ['file', 'mdfile', 'folder', 'remove', 'showInFinder']
  assert.deepEqual(types, expected)
  assert.ok(commands.every(command => command.data.path === folder.path))
})
