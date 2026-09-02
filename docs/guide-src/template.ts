// 文档页 HTML 模板。复用落地页设计系统:微信绿 #07c160、同字体栈、同圆角
export interface NavLink { href: string; label: string; desc?: string }
export interface PageConfig {
  title: string        // <title> 与侧边栏当前项高亮
  desc: string         // 页面一句话说明（og:description / 摘要行）
  body: string         // markdown-it 渲染后的 HTML
  nav: NavLink[]       // 侧边栏:由 PAGES 清单生成
  prev?: NavLink       // 上一页（清单顺序）
  next?: NavLink       // 下一页（清单顺序）
}

// 插值统一转义，防止标题/说明里的 & < > " 破坏标签结构
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildPage(cfg: PageConfig): string {
  const navLinks = cfg.nav
    .map((n) => {
      const active = n.label === cfg.title ? ' class="active"' : ''
      const tip = n.desc ? ` title="${esc(n.desc)}"` : ''
      return `        <a href="${esc(n.href)}"${tip}${active}>${esc(n.label)}</a>`
    })
    .join('\n')

  const pagerPrev = cfg.prev
    ? `<a class="pager-prev" href="${esc(cfg.prev.href)}"><span class="pager-label">上一页</span>${esc(cfg.prev.label)}</a>`
    : '<span class="pager-empty"></span>'
  const pagerNext = cfg.next
    ? `<a class="pager-next" href="${esc(cfg.next.href)}"><span class="pager-label">下一页</span>${esc(cfg.next.label)}</a>`
    : '<span class="pager-empty"></span>'

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(cfg.title)} · Snowpub 文档</title>
  <link rel="icon" type="image/png" href="../icon.png">
  <meta name="description" content="${esc(cfg.desc)}">
  <meta property="og:title" content="${esc(cfg.title)} · Snowpub 文档">
  <meta property="og:description" content="${esc(cfg.desc)}">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --primary: #07c160;
      --primary-dark: #06ad56;
      --text: #303133;
      --muted: #606266;
      --border: #e4e7ed;
      --bg: #f5f7fa;
      --code-bg: #282c34;
      --code-fg: #abb2bf;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--text);
      background: #fff;
      line-height: 1.6;
    }

    /* ── 布局:左 240px 粘性侧边栏 + 右内容列 ── */
    .layout { display: flex; min-height: 100vh; align-items: flex-start; }

    .sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      width: 240px;
      flex-shrink: 0;
      background: #fff;
      border-right: 1px solid var(--border);
      padding: 24px 0;
      overflow-y: auto;
    }

    .sidebar .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 20px 20px;
      margin-bottom: 10px;
      color: var(--text);
      text-decoration: none;
      font-weight: 700;
      font-size: 1.15rem;
      letter-spacing: -0.3px;
    }

    .sidebar .brand img { width: 28px; height: 28px; border-radius: 7px; }

    .sidebar .nav { display: flex; flex-direction: column; }

    .sidebar .nav a {
      display: block;
      padding: 8px 20px 8px 17px;
      color: var(--muted);
      text-decoration: none;
      font-size: 0.95rem;
      border-left: 3px solid transparent;
    }

    .sidebar .nav a:hover { color: var(--primary); }

    .sidebar .nav a.active {
      color: var(--primary);
      font-weight: 600;
      border-left: 3px solid var(--primary);
    }

    .main { flex: 1; min-width: 0; background: #fff; }

    /* ── 正文 ── */
    .content { max-width: 760px; margin: 0 auto; padding: 48px 40px 24px; }

    .content h1 {
      font-size: 1.9rem;
      font-weight: 700;
      letter-spacing: -0.3px;
      margin: 8px 0 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    .content h2 { font-size: 1.35rem; font-weight: 600; margin: 40px 0 14px; }
    .content h3 { font-size: 1.12rem; font-weight: 600; margin: 28px 0 10px; }
    .content p { margin: 14px 0; }
    .content strong { font-weight: 600; }

    .content ul, .content ol { margin: 14px 0; padding-left: 1.6em; }
    .content li { margin: 5px 0; }

    .content a { color: var(--primary); text-decoration: none; }
    .content a:hover { text-decoration: underline; }

    .content blockquote {
      margin: 16px 0;
      padding: 6px 18px;
      border-left: 3px solid var(--border);
      color: var(--muted);
    }

    .content hr { border: none; border-top: 1px solid var(--border); margin: 36px 0; }

    .content img { max-width: 100%; height: auto; border-radius: 8px; }

    /* 行内代码 */
    .content code {
      background: var(--bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
      color: #476582;
    }

    /* 代码块:深底浅字 */
    .content pre {
      background: var(--code-bg);
      color: var(--code-fg);
      padding: 16px 20px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 16px 0;
      line-height: 1.6;
    }

    .content pre code {
      background: transparent;
      padding: 0;
      color: inherit;
      font-size: 0.875rem;
    }

    /* 表格:斑马纹 */
    .content table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 0.95rem; }
    .content th, .content td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; }
    .content th { background: var(--bg); font-weight: 600; }
    .content tbody tr:nth-child(even) { background: #fafafa; }

    /* ── 提示框（markdown-it-container 渲染目标）── */
    .admonition { margin: 20px 0; padding: 12px 20px 14px; border-radius: 0 8px 8px 0; }
    .admonition p { margin: 4px 0; }
    .admonition.tip { border-left: 4px solid var(--primary); background: #f2fbf6; }
    .admonition.tip::before { content: '提示'; display: block; font-weight: 600; font-size: 0.9rem; color: var(--primary); margin-bottom: 2px; }
    .admonition.warning { border-left: 4px solid #e6a23c; background: #fdf6ec; }
    .admonition.warning::before { content: '注意'; display: block; font-weight: 600; font-size: 0.9rem; color: #b88230; margin-bottom: 2px; }

    /* ── 上一页/下一页 ── */
    .pager {
      max-width: 760px;
      margin: 0 auto;
      padding: 20px 40px 56px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }

    .pager a {
      display: block;
      max-width: 48%;
      padding: 10px 18px;
      border: 1px solid var(--border);
      border-radius: 8px;
      text-decoration: none;
      color: var(--text);
      transition: border-color 0.2s, color 0.2s;
    }

    .pager a:hover { border-color: var(--primary); color: var(--primary); }
    .pager .pager-label { display: block; font-size: 0.8rem; color: var(--muted); margin-bottom: 2px; }
    .pager .pager-next { text-align: right; }

    /* ── 窄屏:侧边栏折叠为顶部条，布局单列 ── */
    @media (max-width: 900px) {
      .layout { flex-direction: column; }

      .sidebar {
        position: static;
        height: auto;
        width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--border);
        padding: 14px 16px 10px;
      }

      .sidebar .brand { padding-bottom: 10px; margin-bottom: 6px; }

      .sidebar .nav { flex-direction: row; flex-wrap: wrap; gap: 2px 6px; }

      .sidebar .nav a { border-left: none; padding: 5px 12px; border-radius: 999px; }

      .sidebar .nav a.active { border-left: none; background: #f2fbf6; }

      .content { padding: 24px 20px 16px; }

      .pager { padding: 16px 20px 40px; flex-wrap: wrap; }
      .pager a { max-width: 100%; flex: 1 1 180px; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <a class="brand" href="../index.html">
        <img src="../icon.png" alt="Snowpub">Snowpub
      </a>
      <nav class="nav">
${navLinks}
      </nav>
    </aside>
    <main class="main">
      <article class="content">
${cfg.body}
      </article>
      <nav class="pager">
        ${pagerPrev}
        ${pagerNext}
      </nav>
    </main>
  </div>
</body>
</html>`
}
