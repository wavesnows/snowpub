// @/store/firstStore.js
import { defineStore } from "pinia";
import {join} from "path";
import type Node from 'element-plus/es/components/tree/src/model/node'
import DFConf from "@/global/defaultConf";
import {store as defaultStore} from "@/global/initLocalStore";
import {readNotes} from "@/libs/fileHandler"
import {SearchSession, type SearchResult} from "@/libs/searchUtil"
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ipcRenderer } from 'electron';
import { getFileHistory, getFileContentAtCommit, restoreFileToCommit, isFileInGitRepo, getRepoPath, getGitStatus } from '@/libs/gitHistory';
import { ElMessage } from 'element-plus';
import { errorHandler } from '@/libs/errorHandler';
import { log } from '@/libs/logger'
export interface Tree {
  label: string
  isLeaf:boolean
  isFolder:boolean
  path?: any
  children?: Tree[]
  }

const store = defaultStore

// electron-store (conf) rejects undefined values — use delete() to clear
function safeSet(key: string, value: any) {
  if (value === undefined) {
    store.delete(key);
  } else {
    store.set(key, value);
  }
}

/*
if(store.get("savePath") == ""){
  const homedir = os.homedir();
  store.set("savePath", path.join(homedir, noteConf.appName))
}
*/

// 定义并导出容器，第一个参数是容器id，必须唯一，用来将所有的容器
// 挂载到根容器上

/*一个数据是存储在本地的数据，
  配置的数据一部分是存储在本地的，另外也会有一些是构造出来的
  每个根文件夹是一个notestore
  每个store里面可能会有多个notebook，其中有个notebook是默认的notebook是default

*/

export const useTtsStore = defineStore(DFConf.appName, {
  // 定义state，用来存储状态的
  state: () => {
    const homeDir = os.homedir();
    const defaultDir = path.join(homeDir, DFConf.appName);
    const defaultNotebookPath = path.join(defaultDir, DFConf.defaultRepoPath, DFConf.defaultRepoName);
    const currentNotebookPath = store.get('currentNotebookPath') || defaultNotebookPath;
    const savedLastPath = store.get("lastPath");

    // Check if lastPath belongs to current notebook
    let validLastPath = "";
    if (savedLastPath && savedLastPath.startsWith(currentNotebookPath)) {
      // Check if file still exists
      if (fs.existsSync(savedLastPath)) {
        validLastPath = savedLastPath;
      }
    }

    return {
      notestore:{
        currentStore: store.get('currentStore') || defaultDir,
        rootStores: (store.get('rootStores') as string[]) || [store.get('currentStore') || defaultDir],
      },
      notebook:{
        currentPath: currentNotebookPath,
        current: store.get('currentNotebook') || DFConf.defaultRepoName,
        bookType: store.get('currentNotebookType') || 'local'
      },
      cnote:{ // current note which in editor
        title: validLastPath ? store.get("title") : "",
        lastPath: validLastPath,
        destTitle: validLastPath ? store.get("title") : "",
        titleVisable:true,
      },
      inputs: {
        noteTitle:"Title",
        notePath: validLastPath,
        noteValue: "",
        itemData:<Tree>{}
      },
      treeMenu:{
        data:readNotes(store.get('currentNotebookPath') || defaultNotebookPath, store.get('pinnedNotes') || []),
        node:<Node>{},
        treeData:<Tree>{},
        currentNode:<any>{},
        expandedKeys:(store.get('expandedKeys') as string[]) || null,
        newFolderName:DFConf.newFolderName,
      },
      favorites: {
        pinned: store.get('pinnedNotes') || [],
        starred: store.get('starredNotes') || [],
      },
      recentFiles: (store.get('recentFiles') as Array<{path: string, label: string, time: number}>) || [],
      menu:{
        current:"",
        curentData:<Tree>{}
      },
      folderName:"",
      editerflag:false,
      readOnly:false,
      editor:{

      },
      // 递增触发器：历史版本恢复后通知 MarkdownEditor 重新加载当前文件
      noteReloadTrigger: 0,
      page: {
        asideIndex: "1",
        tsideIndex:"1",
        tabIndex: "1",
      },
      config: {
        needUpdateTree:false,
     //   defaultNoteInit:store.get("defaultNoteInit")? true:false,
        savePath: store.get("savePath") || defaultDir,
      //  store.set("defaultStorePath",this.notestore.currentStore);
        defaultNotePath: store.get("defaultNotePath") || defaultNotebookPath,
        drawer:false,
        // 请求设置抽屉打开时定位到指定 tab（notebook/appearance/sync/wechat/about），空串表示默认
        settingsTab: '',
        githubEnable:false,
        githubRepoName:store.get("GithubRepoName") || "",
        githubUsername:store.get("GithubUsername") || "",
        githubToken:store.get("GithubToken") || "",
        gitProvider: (store.get("gitProvider") as 'github' | 'gitee') || 'github',
        giteeUsername: store.get("GiteeUsername") || "",
        giteeToken: store.get("GiteeToken") || "",
        formConfigJson: store.get("FormConfig"),
        updateNotification: store.get("updateNotification"),
        language: store.get("language") || 'en_US',
        // WeChat Official Account configuration (AppID/AppSecret stored in electron-store
        // via main-process IPC; renderer only caches them for UI).
        wechat: {
          appId: store.get("wechat.appId") || "",
          appSecret: store.get("wechat.appSecret") || "",
          // 默认封面（内置品牌图）上传后的永久素材缓存，避免重复上传
          defaultCoverMediaId: store.get("wechat.defaultCoverMediaId") || "",
          defaultCoverUrl: store.get("wechat.defaultCoverUrl") || "",
          // 默认作者：新建笔记 front matter 与发布对话框的作者兜底
          defaultAuthor: store.get("wechat.defaultAuthor") || "",
        },
      },
      settings: {
        currentStore: store.get('currentStore') || defaultDir,
        currentbook: store.get('currentNoteBookObj'),
        defaultNotePath: store.get("defaultNotePath") || defaultNotebookPath,
      },
      search: {
        query: "",
        results: <SearchResult[]>[],
        isSearching: false,
        isLoadingMore: false,
        showResults: false,
        session: null as SearchSession | null,
      },
      history: {
        showDrawer: false,
        commits: [] as any[],
        selectedCommit: null as any,
        isLoading: false,
        previewData: null as any,
        isInGitRepo: false,
      },
      mdMode: 'edit' as 'edit' | 'preview',
      mdTheme: (store.get('mdTheme') as string) || 'teal',
      mdCopyTrigger: 0,
      mdPreviewSplit: 'single' as 'single' | 'wechat', // preview layout: single (default) | wechat (dual with wechat preview)
      wechatTheme: (store.get('wechatTheme') as string) || 'wechat-green', // wechat preview theme
      gitAvailable: false,
      gitStatus: {
        hasUncommitted: false,
        hasUnpushed: false,
        ahead: 0,
        behind: 0,
        filesChanged: 0,
        changedFiles: [] as string[],
        isChecking: false,
        checkTimeout: null as any,
      },
      pushStatus: {
        message: '',
        type: '' as 'loading' | 'success' | 'error' | '',
        timeout: null as any,
      },
      saveStatus: {
        status: 'idle' as 'idle' | 'saving' | 'saved' | 'error',
        message: '',
        timeout: null as any,
      },
      treeRefresh: {
        timeout: null as any,
        debounceMs: 500, // 500ms debounce for tree refresh
      },
      helpDialog: {
        show: false,
      },
      terminal: {
        show: false,
      },
      layout: {
        bsideWidth: 200, // synced from Bside for terminal positioning
      },
      mdEditor: {
        lineWrap: (store.get("mdEditor.lineWrap") as boolean) ?? true,
      },
      showHiddenFiles: false,
      flatFileList: [] as string[],
      // ── WeChat publishing runtime state ────────────────────────────────────
      wechatPublish: {
        // 草稿同步
        drafts: [] as any[],
        draftLoading: false,
        // 素材库（封面图候选）
        materials: [] as any[],
        materialLoading: false,
        materialTotal: 0,
        // 当前文章发布状态
        currentMediaId: '', // 已上传到公众号草稿箱的 media_id
        publishStatus: 'idle' as 'idle' | 'uploading' | 'publishing' | 'success' | 'error',
        publishMessage: '',
        publishId: '', // 发布任务 ID，用于轮询
        // 封面图
        coverMediaId: '',
        coverUrl: '',
        // 摘要（digest），不填则由微信自动截取正文前 54 字
        digest: '',
        author: '',
        articleUrl: '', // 已发布后的文章 URL
      },
    };
  },
  // 定义getters，类似于computed，具有缓存功能
  getters: {},
  // 定义actions，类似于methods，用来修改state，做一些业务逻辑
  actions: {
    setLastEditNote(){
      safeSet("lastPath", this.cnote.lastPath);
      safeSet("title", this.cnote.title);
      if (this.treeMenu.expandedKeys) {
        store.set('expandedKeys', this.treeMenu.expandedKeys);
      }
    },
    persistExpandedKeys() {
      if (this.treeMenu.expandedKeys) {
        store.set('expandedKeys', this.treeMenu.expandedKeys);
      }
    },
    setSavePath() {
      store.set("savePath", this.config.savePath);
      store.set("defaultStorePath",this.notestore.currentStore);
     // store.set("defaultNotePath",this.config.defaultNotePath);
    },
    setNoteBookConfig() {
    //  store.set("currentNotebook", this.notebook.current);
      store.set("currentNotebookType",this.notebook.bookType);
      store.set("currentNotebookPath",this.notebook.currentPath);
      safeSet('currentNoteBookObj', this.settings.currentbook)
    },
    setLocalNotePath() {
      store.set("GithubRepoName", this.config.githubRepoName);
      store.set("GithubUsername", this.config.githubUsername);
      store.set("GithubToken", this.config.githubToken);
      store.set("gitProvider", this.config.gitProvider);
      store.set("GiteeUsername", this.config.giteeUsername);
      store.set("GiteeToken", this.config.giteeToken);
      this.setSavePath()
    },
    updateSettings(){
      store.set("currentStore",this.notestore.currentStore);
      store.set("currentNotebookPath",this.notebook.currentPath)
      safeSet("defaultNotePath", this.settings.defaultNotePath)

      store.set("GithubRepoName", this.config.githubRepoName?this.config.githubRepoName:"");
      store.set("GithubUsername", this.config.githubUsername?this.config.githubUsername:"");
      store.set("GithubToken", this.config.githubToken?this.config.githubToken:"");

     // this.setLocalNotePath();
     // this.setSavePath();
   
    },

    initDefaultNotePath(){
      this.setSavePath();
      this.config.defaultNotePath = join(this.config.savePath, DFConf.defaultRepoPath, DFConf.defaultRepoName)
      store.set("defaultNotePath", this.config.defaultNotePath);
    },
    updateNotificationChange() {
      store.set("updateNotification", this.config.updateNotification);
    },
    getValueFormStore(key:string){
      return store.get(key);
    },
    showItemInFolder(filePath: string) {
      ipcRenderer.send("showItemInFolder", filePath);
    },
    async performFullTextSearch(query: string) {
      if (!query || query.trim().length === 0) {
        this.search.results = [];
        this.search.showResults = false;
        return;
      }

      // Stop previous session
      if (this.search.session) {
        this.search.session.stop();
      }

      this.search.isSearching = true;
      this.search.query = query;
      this.search.results = [];

      const session = new SearchSession();
      session.start(this.notebook.currentPath, query);
      this.search.session = session;

      try {
        await session.loadMore();
        this.search.results = [...session.results];
        this.search.showResults = true;
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        this.search.isSearching = false;
      }
    },

    async loadMoreSearchResults() {
      const session = this.search.session;
      if (!session || session.done || this.search.isLoadingMore) return;

      this.search.isLoadingMore = true;
      try {
        await session.loadMore();
        this.search.results = [...session.results];
      } finally {
        this.search.isLoadingMore = false;
      }
    },
    clearSearch() {
      if (this.search.session) {
        this.search.session.stop();
        this.search.session = null;
      }
      this.search.query = "";
      this.search.results = [];
      this.search.showResults = false;
      this.search.isLoadingMore = false;
    },
    addRecentFile(filePath: string, label: string) {
      // Remove existing entry for same path
      this.recentFiles = this.recentFiles.filter((f: any) => f.path !== filePath);
      // Add to front
      this.recentFiles.unshift({ path: filePath, label, time: Date.now() });
      // Keep max 50
      if (this.recentFiles.length > 50) {
        this.recentFiles = this.recentFiles.slice(0, 50);
      }
      store.set('recentFiles', this.recentFiles);
    },
    togglePin(path: string) {
      const index = this.favorites.pinned.indexOf(path);
      if (index > -1) {
        this.favorites.pinned.splice(index, 1);
      } else {
        this.favorites.pinned.push(path);
      }
      store.set('pinnedNotes', this.favorites.pinned);
      // Use debounced refresh instead of immediate refresh
      this.scheduleTreeRefresh();
    },
    toggleStar(path: string) {
      const index = this.favorites.starred.indexOf(path);
      if (index > -1) {
        this.favorites.starred.splice(index, 1);
      } else {
        this.favorites.starred.push(path);
      }
      store.set('starredNotes', this.favorites.starred);
    },
    isPinned(path: string): boolean {
      return this.favorites.pinned.includes(path);
    },
    isStarred(path: string): boolean {
      return this.favorites.starred.includes(path);
    },
    refreshTreeData() {
      const newData = readNotes(this.notebook.currentPath, this.favorites.pinned, this.showHiddenFiles);
      this.treeMenu.data = [...newData];
      this.buildFlatFileList();
    },
    buildFlatFileList() {
      const result: string[] = [];
      const traverse = (nodes: Tree[]) => {
        for (const node of nodes) {
          if (!node.isFolder) {
            result.push(node.path);
          }
          if (node.children && node.children.length > 0) {
            traverse(node.children);
          }
        }
      };
      traverse(this.treeMenu.data as Tree[]);
      this.flatFileList = result;
    },
    navigateNote(direction: 'prev' | 'next') {
      const list = this.flatFileList;
      if (list.length === 0) return;
      const current = this.cnote.lastPath;
      const idx = list.indexOf(current);
      let nextIdx: number;
      if (idx === -1) {
        nextIdx = direction === 'next' ? 0 : list.length - 1;
      } else {
        nextIdx = direction === 'next' ? idx + 1 : idx - 1;
      }
      if (nextIdx < 0 || nextIdx >= list.length) return;
      const nextPath = list[nextIdx];
      this.inputs.notePath = nextPath;
      this.cnote.lastPath = nextPath;
      const fileName = path.basename(nextPath);
      const label = fileName.replace(/\.(json|md)$/, '');
      this.cnote.title = label;
      this.cnote.destTitle = label;
      // 文件内容由 MarkdownEditor 的 notePath watcher 加载
      this.setLastEditNote();
      this.addRecentFile(nextPath, label);
    },

    // Debounced tree refresh to avoid excessive file scanning
    scheduleTreeRefresh() {
      // Clear existing timeout
      if (this.treeRefresh.timeout) {
        clearTimeout(this.treeRefresh.timeout);
      }

      // Schedule refresh after debounce period
      this.treeRefresh.timeout = setTimeout(() => {
        log('Refreshing tree data (debounced)...');
        this.refreshTreeData();
      }, this.treeRefresh.debounceMs);
    },
    setLanguage(language: string) {
      this.config.language = language;
      store.set('language', language);
      // Update error handler language
      errorHandler.setLanguage(language);
    },

    // Open history viewer for current note
    async openHistoryViewer() {
      const filePath = this.cnote.lastPath;

      if (!filePath) {
        ElMessage({
          type: 'warning',
          message: 'No file is currently open',
        });
        return;
      }

      this.history.showDrawer = true;
      this.history.isLoading = true;
      this.history.commits = [];

      // Check if file is in git repo
      this.history.isInGitRepo = isFileInGitRepo(filePath);

      if (!this.history.isInGitRepo) {
        this.history.isLoading = false;
        return;
      }

      // Load commit history
      await this.loadCommitHistory(filePath);
    },

    // Load commit history for file
    async loadCommitHistory(filePath: string) {
      try {
        const repoPath = getRepoPath(filePath);
        if (!repoPath) {
          this.history.isInGitRepo = false;
          return;
        }

        const commits = await getFileHistory(filePath, repoPath, 50);
        this.history.commits = commits;
      } catch (error) {
        console.error('Failed to load commit history:', error);
        ElMessage({
          type: 'error',
          message: 'Failed to load history',
        });
      } finally {
        this.history.isLoading = false;
      }
    },

    // Preview a specific commit
    async previewCommit(commit: any) {
      const filePath = this.cnote.lastPath;
      const repoPath = getRepoPath(filePath);

      if (!repoPath) {
        console.error('No repo path found');
        throw new Error('Repository path not found');
      }

      log('Previewing commit:', commit.hash, 'for file:', filePath);

      try {
        const content = await getFileContentAtCommit(filePath, repoPath, commit.hash);
        log('Got content:', content !== null ? `length: ${content.length}` : 'null');

        if (content !== null) {
          // 所有文件（.md / 旧版 .json）统一按纯文本预览，不做 JSON 解析
          this.history.previewData = { _markdown: content, time: Date.now(), blocks: [], version: "2.26.5" };
          this.history.selectedCommit = commit;
        } else {
          console.error('No content returned from git - file may not exist in this commit');
          throw new Error('File does not exist in this commit');
        }
      } catch (error: any) {
        console.error('Failed to preview commit:', error);
        if (error.message === 'File does not exist in this commit') {
          ElMessage({
            type: 'warning',
            message: 'This file does not exist in the selected commit',
          });
        }
        throw error;
      }
    },

    // Restore file to commit version
    async restoreToCommit(commit: any) {
      const filePath = this.cnote.lastPath;
      const repoPath = getRepoPath(filePath);

      if (!repoPath) return;

      try {
        const success = await restoreFileToCommit(filePath, repoPath, commit.hash);

        if (success) {
          // 触发 MarkdownEditor 重新从磁盘加载当前文件
          this.noteReloadTrigger++;
          return true;
        }

        return false;
      } catch (error) {
        console.error('Failed to restore commit:', error);
        throw error;
      }
    },

    // Close history viewer
    closeHistoryViewer() {
      this.history.showDrawer = false;
      this.history.commits = [];
      this.history.selectedCommit = null;
      this.history.previewData = null;
    },

    // Open raw JSON editor
    // Check Git status for current notebook
    async checkGitStatus() {
      // Prefer repo path from current note, fall back to notebook path
      const notePath = this.cnote.lastPath;
      const repoPath = (notePath && getRepoPath(notePath)) || getRepoPath(this.notebook.currentPath);

      if (!repoPath) {
        return;
      }

      this.gitStatus.isChecking = true;

      try {
        const status = await getGitStatus(repoPath);
        this.gitStatus.hasUncommitted = status.hasUncommitted;
        this.gitStatus.hasUnpushed = status.hasUnpushed;
        this.gitStatus.ahead = status.ahead;
        this.gitStatus.behind = status.behind;
        this.gitStatus.filesChanged = status.filesChanged;
        this.gitStatus.changedFiles = status.changedFiles;
      } catch (error) {
        console.error('Failed to check git status:', error);
      } finally {
        this.gitStatus.isChecking = false;
      }
    },

    // Debounced Git status check
    scheduleGitStatusCheck() {
      // Clear existing timeout
      if (this.gitStatus.checkTimeout) {
        clearTimeout(this.gitStatus.checkTimeout);
      }

      // Schedule check after 1 second of inactivity
      this.gitStatus.checkTimeout = setTimeout(() => {
        this.checkGitStatus();
      }, 1000);
    },

    // Start Git status check (called on mount)
    startGitStatusCheck() {
      // Check immediately
      this.checkGitStatus();
    },

    // Set push status message
    setPushStatus(message: string, type: 'loading' | 'success' | 'error') {
      // Clear existing timeout
      if (this.pushStatus.timeout) {
        clearTimeout(this.pushStatus.timeout);
      }

      this.pushStatus.message = message;
      this.pushStatus.type = type;

      // Auto-clear after 3 seconds for success/error
      if (type === 'success' || type === 'error') {
        this.pushStatus.timeout = setTimeout(() => {
          this.pushStatus.message = '';
          this.pushStatus.type = '';
        }, 3000);
      }
    },

    // Clear push status
    clearPushStatus() {
      if (this.pushStatus.timeout) {
        clearTimeout(this.pushStatus.timeout);
      }
      this.pushStatus.message = '';
      this.pushStatus.type = '';
    },

    // Set save status
    setSaveStatus(status: 'idle' | 'saving' | 'saved' | 'error', message: string = '') {
      // Clear existing timeout
      if (this.saveStatus.timeout) {
        clearTimeout(this.saveStatus.timeout);
      }

      this.saveStatus.status = status;
      this.saveStatus.message = message;

      // Auto-clear after 3 seconds for saved/error
      if (status === 'saved' || status === 'error') {
        this.saveStatus.timeout = setTimeout(() => {
          this.saveStatus.status = 'idle';
          this.saveStatus.message = '';
        }, 3000);
      }
    },

    // Clear all pending timers (call on app/component unmount)
    clearAllTimers() {
      if (this.treeRefresh.timeout) {
        clearTimeout(this.treeRefresh.timeout);
        this.treeRefresh.timeout = null;
      }
      if (this.gitStatus.checkTimeout) {
        clearTimeout(this.gitStatus.checkTimeout);
        this.gitStatus.checkTimeout = null;
      }
      if (this.pushStatus.timeout) {
        clearTimeout(this.pushStatus.timeout);
        this.pushStatus.timeout = null;
      }
      if (this.saveStatus.timeout) {
        clearTimeout(this.saveStatus.timeout);
        this.saveStatus.timeout = null;
      }
    },

    // Open help dialog
    openHelpDialog() {
      this.helpDialog.show = true;
    },

    // 打开设置抽屉，可选定位到指定 tab
    openSettings(tab?: string) {
      this.config.settingsTab = tab || '';
      this.config.drawer = true;
    },

    // Close help dialog
    closeHelpDialog() {
      this.helpDialog.show = false;
    },

    toggleTerminal() {
      this.terminal.show = !this.terminal.show;
    },
    openTerminal() {
      this.terminal.show = true;
    },
    closeTerminal() {
      this.terminal.show = false;
    },

    // Expand tree to show a specific path
    expandTreeToPath(targetPath: string) {
      const path = require('path');
      const notebookPath = this.notebook.currentPath;

      // Get all parent paths from notebook root to target
      const expandKeys: string[] = [];
      let currentPath = targetPath;

      while (currentPath && currentPath !== notebookPath && currentPath.startsWith(notebookPath)) {
        expandKeys.push(currentPath);
        currentPath = path.dirname(currentPath);
      }

      // Add notebook root
      if (notebookPath) {
        expandKeys.push(notebookPath);
      }

      // Update expanded keys
      this.treeMenu.expandedKeys = expandKeys;

      log('Expanding tree to path:', targetPath, 'Keys:', expandKeys);
    },

    setMdTheme(theme: string) {
      this.mdTheme = theme;
      store.set('mdTheme', theme);
    },
    setWechatTheme(theme: string) {
      this.wechatTheme = theme;
      store.set('wechatTheme', theme);
    },
    setMdPreviewSplit(mode: 'single' | 'wechat') {
      this.mdPreviewSplit = mode;
    },
    setLineWrap(v: boolean) {
      this.mdEditor.lineWrap = v;
      safeSet('mdEditor.lineWrap', v);
    },
    triggerMdCopy() {
      this.mdCopyTrigger++;
    },

    // ── WeChat publishing actions ──────────────────────────────────────────────
    async loadWechatConfig() {
      try {
        const cfg = await ipcRenderer.invoke('wechat:getConfig')
        this.config.wechat.appId = cfg?.appId || ''
        this.config.wechat.appSecret = cfg?.appSecret || ''
      } catch (e) {
        console.error('loadWechatConfig failed', e)
      }
    },
    async saveWechatConfig(appId: string, appSecret: string) {
      await ipcRenderer.invoke('wechat:saveConfig', { appId, appSecret })
      this.config.wechat.appId = appId
      this.config.wechat.appSecret = appSecret
    },
    async testWechatConnection(appId: string, appSecret: string) {
      return await ipcRenderer.invoke('wechat:test', { appId, appSecret })
    },
    setDefaultAuthor(author: string) {
      this.config.wechat.defaultAuthor = author
      safeSet('wechat.defaultAuthor', author)
    },
    async uploadArticleImage(filePath: string) {
      return await ipcRenderer.invoke('wechat:uploadArticleImage', filePath)
    },
    async addImageMaterial(filePath: string) {
      return await ipcRenderer.invoke('wechat:addImageMaterial', filePath)
    },

    // 获取默认封面（内置品牌图）的 media_id；未上传过则先上传并缓存
    async ensureDefaultCover(): Promise<{ media_id: string; url: string } | null> {
      if (this.config.wechat.defaultCoverMediaId) {
        return {
          media_id: this.config.wechat.defaultCoverMediaId,
          url: this.config.wechat.defaultCoverUrl,
        };
      }
      try {
        const { ensureDefaultCoverFile } = await import('@/libs/defaultCover');
        const result = await this.addImageMaterial(ensureDefaultCoverFile());
        if (result && result.media_id) {
          this.config.wechat.defaultCoverMediaId = result.media_id;
          this.config.wechat.defaultCoverUrl = result.url || '';
          safeSet('wechat.defaultCoverMediaId', result.media_id);
          safeSet('wechat.defaultCoverUrl', result.url || '');
          return { media_id: result.media_id, url: result.url || '' };
        }
        return null;
      } catch (e) {
        console.error('ensureDefaultCover failed:', e);
        return null;
      }
    },
    async loadImageMaterials(offset = 0, count = 20) {
      this.wechatPublish.materialLoading = true
      try {
        const result = await ipcRenderer.invoke('wechat:getImageMaterialList', offset, count)
        if (result.errcode) {
          ElMessage.error(`加载素材失败: ${result.errmsg || result.errcode}`)
          return
        }
        this.wechatPublish.materials = result.item || []
        this.wechatPublish.materialTotal = result.total_count || 0
      } finally {
        this.wechatPublish.materialLoading = false
      }
    },
    async deleteImageMaterial(mediaId: string) {
      return await ipcRenderer.invoke('wechat:deleteMaterial', mediaId)
    },
    async loadWechatDrafts(offset = 0, count = 20) {
      this.wechatPublish.draftLoading = true
      try {
        const result = await ipcRenderer.invoke('wechat:getDraftList', offset, count)
        if (result.errcode) {
          ElMessage.error(`加载草稿失败: ${result.errmsg || result.errcode}`)
          return
        }
        this.wechatPublish.drafts = result.item || []
      } finally {
        this.wechatPublish.draftLoading = false
      }
    },
    async addWechatDraft(article: any) {
      return await ipcRenderer.invoke('wechat:addDraft', article)
    },
    async getWechatDraft(mediaId: string) {
      return await ipcRenderer.invoke('wechat:getDraft', mediaId)
    },
    async updateWechatDraft(mediaId: string, index: number, article: any) {
      return await ipcRenderer.invoke('wechat:updateDraft', mediaId, index, article)
    },
    async deleteWechatDraft(mediaId: string) {
      return await ipcRenderer.invoke('wechat:deleteDraft', mediaId)
    },
    async publishWechatDraft(mediaId: string) {
      return await ipcRenderer.invoke('wechat:publish', mediaId)
    },
    async getWechatPublishStatus(publishId: string) {
      return await ipcRenderer.invoke('wechat:getPublishStatus', publishId)
    },
    setPublishStatus(status: 'idle' | 'uploading' | 'publishing' | 'success' | 'error', message = '') {
      this.wechatPublish.publishStatus = status
      this.wechatPublish.publishMessage = message
    },
    resetPublishState() {
      this.wechatPublish.currentMediaId = ''
      this.wechatPublish.publishId = ''
      this.wechatPublish.articleUrl = ''
      this.wechatPublish.publishStatus = 'idle'
      this.wechatPublish.publishMessage = ''
    },

    // Add a new root store directory
    addRootStore(dirPath: string) {
      if (!this.notestore.rootStores.includes(dirPath)) {
        this.notestore.rootStores.push(dirPath);
        store.set('rootStores', this.notestore.rootStores);
      }
    },

    // Remove a root store directory (only removes from list, does not delete files)
    removeRootStore(dirPath: string) {
      const index = this.notestore.rootStores.indexOf(dirPath);
      if (index > -1) {
        this.notestore.rootStores.splice(index, 1);
        store.set('rootStores', this.notestore.rootStores);
        // If removed store was active, switch to first remaining store
        if (this.notestore.currentStore === dirPath && this.notestore.rootStores.length > 0) {
          this.setActiveStore(this.notestore.rootStores[0]);
        }
      }
    },

    // Switch active root store and update currentStore
    setActiveStore(dirPath: string) {
      this.notestore.currentStore = dirPath;
      this.settings.currentStore = dirPath;
      store.set('currentStore', dirPath);
    },
  },
});