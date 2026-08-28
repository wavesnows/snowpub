// AI 面板与 CodeMirror 编辑器之间的桥：MarkdownEditor 挂载时注册 view，
// 面板通过这里取选中/全文、回插结果。同一时间只有一个活动编辑器。
import type { EditorView } from '@codemirror/view'

let view: EditorView | null = null

export function registerEditorView(v: EditorView | null): void {
  view = v
}

/** 主选区的文本；无编辑器或无选中时返回空串。 */
export function editorSelection(): string {
  if (!view) return ''
  const { from, to } = view.state.selection.main
  return from === to ? '' : view.state.sliceDoc(from, to)
}

/** 当前文档全文；无编辑器时返回空串。 */
export function editorContent(): string {
  return view ? view.state.doc.toString() : ''
}

/** 在光标处插入文本（有选中则替换选中），并把光标移到插入内容末尾。 */
export function insertAtCursor(text: string): boolean {
  if (!view) return false
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
    scrollIntoView: true,
  })
  view.focus()
  return true
}
