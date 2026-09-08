const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { createSSRApp, h, resolveDynamicComponent } = require('vue')
const { renderToString } = require('@vue/server-renderer')
const element = require('element-plus')

test('minified message service cannot shadow the native ul tag in select scrollbars', async () => {
  const previous = Object.getOwnPropertyDescriptor(element.ElMessage, 'name')
  Object.defineProperty(element.ElMessage, 'name', { value: 'Ul', configurable: true })
  try {
    const exports = {}
    const code = ts.transpileModule(fs.readFileSync('src/global/registerElement.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText
    vm.runInNewContext(code, { exports, require: name => name.endsWith('.css') ? {} : require(name) })
    let tag
    const app = createSSRApp({ render() { tag = resolveDynamicComponent('ul'); return h('div') } })
    exports.default(app)
    await renderToString(app)
    assert.equal(tag, 'ul')
    assert.ok(app.component('ElSelect'))
  } finally { Object.defineProperty(element.ElMessage, 'name', previous) }
})
