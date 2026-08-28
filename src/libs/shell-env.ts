// 打包后 GUI 应用 PATH 极短（nvm/homebrew/.local 下的 CLI 全找不到），
// 通过 login shell 捕获完整环境变量。模块级缓存，整个会话只探测一次。
import { execFileSync } from 'child_process'
import os from 'os'
import fs from 'fs'
import path from 'path'

let _cache: Record<string, string> | null = null

export function findNvmBin(home: string): string | null {
  const nvmDir = path.join(home, '.nvm', 'versions', 'node')
  try {
    const versions = fs.readdirSync(nvmDir)
      .filter(v => v.startsWith('v'))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    if (versions.length > 0) return path.join(nvmDir, versions[0], 'bin')
  } catch { /* nvm not installed */ }
  return null
}

export function getShellEnv(): Record<string, string> {
  if (_cache) return _cache

  // Windows 的 PATH 由系统管理，不需要 login shell 捕获
  if (process.platform === 'win32') {
    _cache = {}
    return _cache
  }

  const home = os.homedir()
  const nvmBin = findNvmBin(home)
  const extraPaths = [
    `${home}/miniconda3/bin`,
    `${home}/anaconda3/bin`,
    `${home}/.pyenv/bin`,
    `${home}/.opencode/bin`,
    nvmBin,
    `${home}/.local/bin`,
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ].filter(Boolean).join(':')
  const baseEnv = { HOME: home, PATH: `${extraPaths}:/usr/bin:/bin:/usr/sbin:/sbin` }

  const shells: string[] = []
  const envShell = process.env.SHELL
  if (envShell) shells.push(envShell)
  for (const s of ['/bin/zsh', '/bin/bash', '/usr/bin/zsh', '/usr/bin/bash']) {
    if (!shells.includes(s)) shells.push(s)
  }

  for (const shell of shells) {
    try {
      const output = execFileSync(shell, ['-l', '-c', 'env'], {
        encoding: 'utf-8',
        timeout: 8000,
        env: baseEnv,
      })
      const env: Record<string, string> = {}
      for (const line of output.split('\n')) {
        const idx = line.indexOf('=')
        if (idx > 0) env[line.slice(0, idx)] = line.slice(idx + 1)
      }
      if (env['PATH']) {
        _cache = env
        return _cache
      }
    } catch { /* try next shell */ }
  }

  _cache = {}
  return _cache
}

export function childEnv(): Record<string, string> {
  return { ...process.env, ...getShellEnv(), HOME: os.homedir() } as Record<string, string>
}
