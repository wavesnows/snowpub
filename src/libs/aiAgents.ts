// 本地 agent CLI 调用层（BYOA：用户自装 CLI、自付 token，Snowpub 只做调度）。
// 设计要点（QuanTool 教训）：
//   - 直 spawn binary（argv 数组），不经 login shell —— 无引号转义问题
//   - stdin 类：stdio[0]='pipe' + child.stdin.write/end，与重定向法二选一不可混用
//   - cwd 固定 os.homedir()：避免 agent 在应用目录读到 CLAUDE.md 等意外上下文
//   - env 用 childEnv()（login shell 捕获），GUI 打包后 PATH/认证变量才完整
import { spawn, execFileSync } from 'child_process'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { childEnv, findNvmBin } from './shell-env'

export interface AgentCli {
  id: string
  name: string
  /** 候选 binary 名（按顺序探测） */
  binNames: string[]
  /** 构造 argv；promptVia='argv' 的实现把 prompt 放进去 */
  args: (prompt: string) => string[]
  promptVia: 'stdin' | 'argv'
  /** 未安装时面板展示的引导 */
  install: { command: string; url: string }
}

export interface AgentResult {
  text: string
  error?: string
}

// 顺序即面板下拉默认顺序。新 CLI 入驻 = 加一条配置（各 CLI 的一次性调用形态
// 已逐一实机验证：claude/opencode 吃 stdin，openclaw 走 -m argv）
export const AGENT_CLIS: AgentCli[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    binNames: ['claude'],
    args: () => ['-p', '-', '--output-format', 'text'],
    promptVia: 'stdin',
    install: {
      command: 'npm install -g @anthropic-ai/claude-code',
      url: 'https://code.claude.com/docs/en/setup',
    },
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    binNames: ['opencode'],
    args: () => ['run', '-'],
    promptVia: 'stdin',
    install: {
      command: 'curl -fsSL https://opencode.ai/install | bash',
      url: 'https://opencode.ai',
    },
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    binNames: ['openclaw'],
    args: (p) => ['agent', '--local', '--agent', 'main', '-m', p],
    promptVia: 'argv',
    install: {
      command: 'npm install -g openclaw',
      url: 'https://docs.openclaw.ai',
    },
  },
]

// ── binary 探测：which + 常见安装目录，结果缓存 ──
const isWindows = process.platform === 'win32'
const _resolved: Partial<Record<string, string | null>> = {}

function knownBinDirs(): string[] {
  const home = process.env.HOME || os.homedir()
  if (isWindows) {
    return [
      path.join(home, 'AppData', 'Roaming', 'npm'),
      'C:\\Program Files\\nodejs',
    ]
  }
  return [
    findNvmBin(home) as string,
    path.join(home, '.opencode', 'bin'),
    path.join(home, '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
  ].filter(Boolean)
}

export function resolveBin(cli: AgentCli): string | null {
  if (cli.id in _resolved) return _resolved[cli.id]!
  const env = childEnv()
  for (const bin of cli.binNames) {
    try {
      const hit = execFileSync(isWindows ? 'where' : 'which', [bin], {
        encoding: 'utf-8',
        timeout: 3000,
        env,
      }).trim().split('\n')[0].trim()
      if (hit) {
        _resolved[cli.id] = hit
        return hit
      }
    } catch { /* not in PATH */ }
    const exts = isWindows ? ['.cmd', '.exe', ''] : ['']
    for (const dir of knownBinDirs()) {
      for (const ext of exts) {
        const abs = path.join(dir, `${bin}${ext}`)
        try {
          fs.accessSync(abs)
          _resolved[cli.id] = abs
          return abs
        } catch { /* not there */ }
      }
    }
  }
  _resolved[cli.id] = null
  return null
}

export function isAgentAvailable(cli: AgentCli): boolean {
  return resolveBin(cli) !== null
}

/** 安装新 CLI 后清缓存重新探测。 */
export function resetAgentCache(): void {
  for (const k of Object.keys(_resolved)) delete _resolved[k]
}

// ── 输出清洗：非 TTY 下仍可能带 ANSI 码（进度/横幅），统一剥掉 ──
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001B\[[0-9;]*[a-zA-Z]/g
export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}

/**
 * 调用本地 agent 一次性执行 prompt，返回纯文本。
 * 永不 reject：错误（超时/非零退出/异常）都收敛进 result.error。
 */
export function callAgent(
  cli: AgentCli,
  prompt: string,
  timeoutMs = 180000,
): Promise<AgentResult> {
  return new Promise((resolve) => {
    const bin = resolveBin(cli)
    if (!bin) {
      resolve({ text: '', error: `${cli.name} 未安装` })
      return
    }
    const child = spawn(bin, cli.args(prompt), {
      env: childEnv(),
      cwd: os.homedir(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    if (cli.promptVia === 'stdin') {
      child.stdin.write(prompt)
      child.stdin.end()
    }

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    const timer = setTimeout(() => {
      child.kill()
      resolve({ text: '', error: `调用超时（${Math.round(timeoutMs / 1000)}s），可在终端直接验证该 CLI` })
    }, timeoutMs)

    child.on('close', (code) => {
      clearTimeout(timer)
      const text = stripAnsi(stdout).trim()
      const errText = stripAnsi(stderr).trim()
      if (code !== 0 && !text) {
        resolve({ text: '', error: errText || `exit code ${code}` })
      } else {
        // openclaw 的失败（FailoverError 等）走 stderr 但 exit 0，text 为空时把 stderr 暴露给用户
        resolve({ text: text || errText, error: text ? undefined : (errText || undefined) })
      }
    })

    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ text: '', error: e.message })
    })
  })
}
