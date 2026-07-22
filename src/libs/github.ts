import {showMessage} from './globalLib'
import { useTtsStore } from "@/store/store";
import { store } from '@/global/initLocalStore';
import { ErrorType } from '@/libs/errorHandler';
import { getRepoPath } from '@/libs/gitHistory';
import path from 'path';
import fs from 'fs';
import os from 'os';

const GitHub = require('github-api');
const encode = require('encoding');
const simpleGit = require('simple-git');
import axios from 'axios';
import { log } from '@/libs/logger'

// Create a simpleGit instance for cloning
function makeGitForClone() {
  return simpleGit({ baseDir: os.homedir() });
}
const CLONE_OPTS: string[] = [];

/**
 * Add a remote repo: try to clone first, if not found create it then clone.
 */
function getProviderConfig(ttsStore: any) {
  const provider = ttsStore.config.gitProvider || 'github';
  if (provider === 'gitee') {
    const token = ttsStore.config.giteeToken;
    const giteeUser = ttsStore.config.giteeUsername;
    return {
      provider: 'gitee' as const,
      username: giteeUser,
      token,
      repoUrl: (_user: string, repo: string) => `https://${giteeUser}:${encodeURIComponent(token)}@gitee.com/${giteeUser}/${repo}.git`,
      apiCheckUrl: (username: string, repo: string) => `https://gitee.com/api/v5/repos/${username}/${repo}`,
      apiCreateUrl: () => 'https://gitee.com/api/v5/user/repos',
      authHeader: (token: string) => ({ 'Content-Type': 'application/json' }),
      authParam: (token: string) => ({ access_token: token }),
    };
  }
  const githubToken = ttsStore.config.githubToken;
  const githubUsername = ttsStore.config.githubUsername;
  return {
    provider: 'github' as const,
    username: githubUsername,
    token: githubToken,
    repoUrl: (_user: string, repo: string) => `https://${githubUsername}:${githubToken}@github.com/${githubUsername}/${repo}.git`,
    apiCheckUrl: (username: string, repo: string) => `https://api.github.com/repos/${username}/${repo}`,
    apiCreateUrl: () => 'https://api.github.com/user/repos',
    authHeader: (token: string) => ({ Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }),
    authParam: (_token: string) => ({}),
  };
}

export async function checkRepoExists(username: string, token: string, repoName: string, provider: 'github' | 'gitee' = 'github'): Promise<'exists' | 'not_found' | 'auth_error'> {
  let url: string;
  let params: any = {};
  const headers: any = {};

  if (provider === 'gitee') {
    url = `https://gitee.com/api/v5/repos/${username}/${repoName}`;
    if (token) params.access_token = token;
  } else {
    url = `https://api.github.com/repos/${username}/${repoName}`;
    if (token) headers.Authorization = `token ${token}`;
    headers.Accept = 'application/vnd.github.v3+json';
  }

  try {
    await axios.get(url, { headers, params });
    return 'exists';
  } catch (e: any) {
    const status = e.response?.status;
    if (status === 401 || status === 403) {
      return token ? 'auth_error' : 'not_found';
    }
    return 'not_found';
  }
}

export async function addRemoteRepo(
  t: (key: string) => string,
  repoName: string,
  isPrivate: boolean,
  mode: 'multi' | 'direct'
): Promise<boolean> {
  const ttsStore = useTtsStore();
  const prevRepo = ttsStore.config.githubRepoName;
  const pc = getProviderConfig(ttsStore);

  if (!pc.username || !pc.token) {
    ttsStore.setPushStatus(t('github.configMissing'), 'error');
    return false;
  }

  const root = ttsStore.notestore.currentStore;
  const localPath = mode === 'multi'
    ? path.join(root, "repos", repoName)
    : path.join(root, repoName);
  const gitUrl = pc.repoUrl(pc.username, repoName);

  // Step 1: Check if repo exists
  ttsStore.setPushStatus(t('github.cloning'), 'loading');
  let repoExists = false;
  try {
    const params = pc.authParam(pc.token);
    const headers = pc.authHeader(pc.token);
    await axios.get(pc.apiCheckUrl(pc.username, repoName), { headers, params });
    repoExists = true;
  } catch (e: any) {
    if (e.response?.status === 401) {
      ttsStore.setPushStatus(t('github.authFailed'), 'error');
      return false;
    }
  }

  if (repoExists) {
    try {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      await makeGitForClone().clone(gitUrl, localPath, CLONE_OPTS);
      ttsStore.setPushStatus(t('github.cloneSuccess'), 'success');
      return true;
    } catch (cloneErr: any) {
      const msg = cloneErr.message || '';
      console.error('[clone] full error:', cloneErr);
      const alreadyExists = msg.includes('already exists') || msg.includes('destination path');
      ttsStore.setPushStatus(
        t('github.cloneFailed') + ': ' + (alreadyExists ? t('github.repoAlreadyExists') : msg.split('\n')[0].substring(0, 120)),
        'error'
      );
      return false;
    }
  }

  // Step 2: Repo doesn't exist — create it then clone
  ttsStore.setPushStatus(t('github.creatingRepo'), 'loading');
  try {
    if (pc.provider === 'gitee') {
      await axios.post(
        pc.apiCreateUrl(),
        { name: repoName, private: isPrivate, auto_init: true, access_token: pc.token }
      );
    } else {
      await axios.post(
        pc.apiCreateUrl(),
        { name: repoName, private: isPrivate, auto_init: true },
        { headers: pc.authHeader(pc.token) }
      );
    }
  } catch (createErr: any) {
    const status = createErr.response?.status;
    const errMsg = createErr.response?.data?.message || createErr.message;
    ttsStore.setPushStatus(
      t('github.createRepoFailed') + ': ' + (status === 401 ? t('github.authFailed') : errMsg),
      'error'
    );
    return false;
  }

  // Wait a moment for GitHub to initialize the repo
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    await makeGitForClone().clone(gitUrl, localPath, CLONE_OPTS);
    ttsStore.setPushStatus(t('github.cloneSuccess'), 'success');
    return true;
  } catch (e: any) {
    console.error('[clone] full error:', e);
    ttsStore.config.githubRepoName = prevRepo;
    ttsStore.setPushStatus(t('github.cloneFailed') + ': ' + e.message, 'error');
    return false;
  }
}

/**
 * Create a new GitHub repository and clone it locally
 */
export async function createAndCloneGitHubRepo(
  t: (key: string) => string,
  repoName: string,
  isPrivate: boolean,
  mode: 'multi' | 'direct'
): Promise<boolean> {
  const ttsStore = useTtsStore();
  const { githubUsername, githubToken } = ttsStore.config;

  if (!githubUsername || !githubToken) {
    ttsStore.setPushStatus(t('github.configMissing'), 'error');
    return false;
  }

  ttsStore.setPushStatus(t('github.creatingRepo'), 'loading');

  try {
    // Step 1: Create repo via GitHub API
    await axios.post(
      'https://api.github.com/user/repos',
      { name: repoName, private: isPrivate, auto_init: true },
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
  } catch (e: any) {
    const status = e.response?.status;
    const msg = e.response?.data?.message || e.message;
    if (status === 422) {
      ttsStore.setPushStatus(t('github.repoAlreadyExists'), 'error');
    } else if (status === 401) {
      ttsStore.setPushStatus(t('github.authFailed'), 'error');
    } else {
      ttsStore.setPushStatus(t('github.createRepoFailed') + ': ' + msg, 'error');
    }
    return false;
  }

  // Step 2: Clone locally
  ttsStore.config.githubRepoName = repoName;
  return await gitHubClone(t, mode);
}

/**
 * Clone a GitHub repository to local storage
 * @param t - i18n translation function
 * @returns Promise<boolean> - true if clone succeeded, false otherwise
 */
export async function gitHubClone(t: (key: string) => string, mode: 'multi' | 'direct' = 'multi'): Promise<boolean> {
  const ttsStore = useTtsStore();
  const pc = getProviderConfig(ttsStore);

  if (!pc.username || !ttsStore.config.githubRepoName) {
    ttsStore.setPushStatus(t('github.configMissing'), 'error');
    return false;
  }

  const name = pc.username;
  const repo = ttsStore.config.githubRepoName;
  const gitUrl = pc.repoUrl(name, repo);
  const root = ttsStore.notestore.currentStore;
  // multi: clone to repos/ subdir; direct: clone directly under root
  const localPath = mode === 'multi'
    ? path.join(root, "repos", repo)
    : path.join(root, repo);

  log('Cloning to:', localPath);
  ttsStore.setPushStatus(t('github.cloning'), 'loading');

  try {
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    await makeGitForClone().clone(gitUrl, localPath, CLONE_OPTS);
    ttsStore.setPushStatus(t('github.cloneSuccess'), 'success');
    log('Clone finished');
    return true;
  } catch(error: any) {
    const msg = error.message || '';
    console.error('[clone] full error:', error);
    let friendlyMsg: string;
    if (msg.includes('not found') || msg.includes('Repository not found') || msg.includes('does not exist')) {
      friendlyMsg = t('github.repoNotFound');
    } else if (msg.includes('Authentication failed') || msg.includes('auth')) {
      friendlyMsg = t('github.authFailed');
    } else if (msg.includes('already exists')) {
      friendlyMsg = t('github.repoAlreadyExists');
    } else {
      friendlyMsg = msg.split('\n')[0].substring(0, 120);
    }
    ttsStore.setPushStatus(t('github.cloneFailed') + ': ' + friendlyMsg, 'error');
    console.error('Clone failed:', error);
    return false;
  }
}


/**
 * Pull updates from remote GitHub repository
 * @param t - i18n translation function
 * @param loclRepo Optional local repository path
 */
export async function gitPull(t: (key: string) => string, loclRepo: string = ''): Promise<boolean> {
  const ttsStore = useTtsStore();

  if (loclRepo === '') {
    // Try to find repo from current note path first
    const notePath = ttsStore.cnote.lastPath;
    if (notePath) {
      const repoFromNote = getRepoPath(notePath);
      if (repoFromNote) {
        loclRepo = repoFromNote;
      }
    }
    // Fall back to notebook path
    if (!loclRepo) {
      loclRepo = getRepoPath(ttsStore.notebook.currentPath) || ttsStore.notebook.currentPath;
    }
  }

  // Check if directory exists
  if (!fs.existsSync(loclRepo)) {
    console.error('Repository directory does not exist:', loclRepo);
    ttsStore.setPushStatus(t('github.repoNotCloned'), 'error');
    return false;
  }

  log('Pulling from:', loclRepo);
  ttsStore.setPushStatus(t('github.pulling'), 'loading');

  const git = simpleGit(loclRepo);
  try {
    const update = await git.pull();
    log('Repo updated:', update);
    ttsStore.setPushStatus(t('github.pullSuccess'), 'success');
    return true;
  } catch (err: any) {
    console.error('Pull failed:', err);
    // Extract short error message
    let errorMsg = err.message || 'Unknown error';

    // Extract key error info (first line or first 50 chars)
    if (errorMsg.includes('\n')) {
      errorMsg = errorMsg.split('\n')[0];
    }
    if (errorMsg.length > 60) {
      errorMsg = errorMsg.substring(0, 60) + '...';
    }

    // Check for common error patterns
    if (errorMsg.includes('Authentication failed') || errorMsg.includes('auth')) {
      errorMsg = t('github.authFailed');
    } else if (errorMsg.includes('Network') || errorMsg.includes('network')) {
      errorMsg = t('github.networkError');
    } else if (errorMsg.includes('conflict') || errorMsg.includes('CONFLICT')) {
      errorMsg = t('github.conflictError');
    }

    ttsStore.setPushStatus(t('github.pullFailed') + ': ' + errorMsg, 'error');
    return false;
  }
}

/**
 * Push local changes to remote GitHub repository
 * @param t - i18n translation function
 */
export async function gitHubPush(t: (key: string) => string): Promise<boolean> {
  const ttsStore = useTtsStore();

  // Use repo path from current note, falling back to notebook path
  const notePath = ttsStore.cnote.lastPath;
  const repoDir = (notePath && getRepoPath(notePath)) || getRepoPath(ttsStore.notebook.currentPath) || ttsStore.notebook.currentPath;

  if (!repoDir) {
    ttsStore.setPushStatus(t('github.configMissing'), 'error');
    return false;
  }

  // Check if directory exists
  if (!fs.existsSync(repoDir)) {
    console.error('Repository directory does not exist:', repoDir);
    ttsStore.setPushStatus(t('github.repoNotCloned'), 'error');
    return false;
  }

  log('Pushing from:', repoDir);
  ttsStore.setPushStatus(t('github.pushing'), 'loading');

  const git = simpleGit(repoDir);

  try {
    // Check if there are any changes to commit
    const status = await git.status();

    if (status.files.length > 0) {
      // There are changes, commit them
      await git.add('.');
      await git.commit('[snowpub] add file');
    }

    // Check if there are commits to push
    if (status.ahead > 0 || status.files.length > 0) {
      const branch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();
      await git.push(['-u', 'origin', branch]);
      log('Push succeeded');
      ttsStore.setPushStatus(t('github.pushSuccess'), 'success');

      // Schedule git status check after successful push
      ttsStore.scheduleGitStatusCheck();
      return true;
    } else {
      log('Nothing to push');
      ttsStore.setPushStatus(t('git.upToDate'), 'success');

      // Still check status to make sure indicator is updated
      ttsStore.scheduleGitStatusCheck();
      return true;
    }
  } catch (err: any) {
    console.error('Push failed:', err);
    // Extract short error message
    let errorMsg = err.message || 'Unknown error';

    // Extract key error info (first line or first 50 chars)
    if (errorMsg.includes('\n')) {
      errorMsg = errorMsg.split('\n')[0];
    }
    if (errorMsg.length > 60) {
      errorMsg = errorMsg.substring(0, 60) + '...';
    }

    // Check for common error patterns
    if (errorMsg.includes('Authentication failed') || errorMsg.includes('auth')) {
      errorMsg = t('github.authFailed');
    } else if (errorMsg.includes('Network') || errorMsg.includes('network')) {
      errorMsg = t('github.networkError');
    } else if (errorMsg.includes('rejected') || errorMsg.includes('non-fast-forward')) {
      errorMsg = t('github.pushRejected');
    }

    ttsStore.setPushStatus(t('github.pushFailed') + ': ' + errorMsg, 'error');
    return false;
  }
}

/**
 * Auto pull with conflict backup:
 * If local files are modified, save timestamped backups before resetting and pulling.
 * Returns the list of backed-up file names (empty if no conflicts).
 */
export async function autoPull(
  t: (key: string) => string,
  repoPath: string = ''
): Promise<{ success: boolean; backedUp: string[] }> {
  const ttsStore = useTtsStore();

  if (!repoPath) {
    const notePath = ttsStore.cnote.lastPath;
    if (notePath) repoPath = getRepoPath(notePath) || '';
    if (!repoPath) repoPath = getRepoPath(ttsStore.notebook.currentPath) || ttsStore.notebook.currentPath;
  }

  if (!repoPath || !fs.existsSync(repoPath)) {
    return { success: false, backedUp: [] };
  }

  const git = simpleGit(repoPath);
  const backedUp: string[] = [];

  try {
    const status = await git.status();
    const modified = [...status.modified, ...status.not_added].filter(f => f.endsWith('.json') || f.endsWith('.md'));

    if (modified.length > 0) {
      const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '').replace('-', '').replace('-', '')
      for (const relPath of modified) {
        const fullPath = path.join(repoPath, relPath)
        if (!fs.existsSync(fullPath)) continue
        const ext = path.extname(relPath)
        const base = relPath.slice(0, relPath.length - ext.length)
        const backupPath = path.join(repoPath, `${base}_conflict_${ts}${ext}`)
        fs.copyFileSync(fullPath, backupPath)
        backedUp.push(path.basename(backupPath))
      }
      await git.reset(['--hard', 'HEAD'])
    }

    await git.pull()
    ttsStore.refreshTreeData()
    return { success: true, backedUp }
  } catch (err: any) {
    console.error('autoPull failed:', err.message)
    return { success: false, backedUp }
  }
}
