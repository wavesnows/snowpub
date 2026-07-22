<template>
    <!--Left Panel Start-->
    <div class="button-container">
      <el-button-group>
      <el-tooltip class="box-item" :content="t('toolbar.addFolder')" placement="top-start">
        <el-button type="info" size="small" circle class="circle-btn" @click="handleCommand">
          <el-icon ><Plus /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip class="box-item" :content="t('toolbar.gitSync')" placement="top-start">
        <el-dropdown @command="handleGit" v-show="currentNotebookIsGit && ttsStore.gitAvailable">
          <el-button type="success" size="small" circle class="circle-btn">
            <el-icon><Suitcase /></el-icon>
          </el-button>
        <template #dropdown>
        <el-dropdown-menu class="git-dropdown">
          <el-dropdown-item command="pull">
            <el-icon><Download /></el-icon>
            <span>{{ t('toolbar.pull') }}</span>
          </el-dropdown-item>
          <el-dropdown-item command="push">
            <el-icon><Upload /></el-icon>
            <span>{{ t('toolbar.push') }}</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
      </el-dropdown>
      </el-tooltip>
    <el-tooltip class="box-item" :content="t('toolbar.setting')" placement="top-start">
    <el-button type="info" size="small" circle class="circle-btn" @click="popHandler">
      <el-icon ><Setting /></el-icon>
    </el-button>
    </el-tooltip>
    </el-button-group>
    </div>
    <!--Left Panel End-->

    <!--Config Drawer Start-->
    <el-drawer v-model="config.drawer" direction="rtl" size="50%" :close-on-click-modal="true" :destroy-on-close="true" @open="onDrawerOpen">
      <template #header>
        <h3>{{ t('settings.title') }}</h3>
      </template>
      <template #default>
        <el-tabs v-model="settingsActiveTab" :key="locale" tab-position="left" style="height: 100%" class="demo-tabs">

          <!-- Tab 1: 笔记本 -->
          <el-tab-pane :label="t('settings.notebookTab')" name="notebook">
            <el-form label-width="120px" label-position="top">
              <el-form-item :label="t('settings.currentNotebook')">
                <el-select v-model="settings.currentbook" :placeholder="t('settings.currentNotebook')" value-key="value" @change="saveHander">
                  <el-option-group v-for="group in notebookOptions" :key="group.label" :label="group.label">
                    <el-option v-for="item in group.options" :key="item.value" :label="item.label" :value="item" />
                  </el-option-group>
                </el-select>
              </el-form-item>
              <el-form-item :label="t('settings.notebookPath')">
                <div class="path-display">{{ notebook.currentPath }}</div>
              </el-form-item>
              <el-form-item v-if="isMultiMode" :label="t('settings.createNotebook')">
                <div style="display: flex; gap: 8px; width: 100%;">
                  <el-input v-model="newNotebookName" :placeholder="t('settings.notebookNamePlaceholder')" style="flex: 1;" />
                  <el-button type="primary" @click="createNotebook" :disabled="!newNotebookName.trim()">
                    {{ t('common.ok') }}
                  </el-button>
                </div>
              </el-form-item>
              <el-form-item :label="t('settings.rootStoreList')">
                <div class="root-stores-list">
                  <div
                    v-for="storeDir in notestore.rootStores"
                    :key="storeDir"
                    class="root-store-item"
                    :class="{ active: storeDir === notestore.currentStore }"
                  >
                    <span class="root-store-path" :title="storeDir">{{ basename(storeDir) }}</span>
                    <div class="root-store-actions">
                      <el-button v-if="storeDir !== notestore.currentStore" size="small" type="primary" link @click="switchRootStore(storeDir)">{{ t('settings.switchStore') }}</el-button>
                      <el-button v-if="notestore.rootStores.length > 1" size="small" type="danger" link @click="removeRootStore(storeDir)">{{ t('settings.removeStore') }}</el-button>
                    </div>
                  </div>
                  <el-button size="small" @click="addRootStore" style="margin-top: 8px;">{{ t('settings.addRootStore') }}</el-button>
                </div>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- Tab 2: 外观 -->
          <el-tab-pane :label="t('settings.appearanceTab')" name="appearance">
            <el-form label-width="120px" label-position="top">
              <el-form-item :label="t('settings.languageLabel')">
                <el-select v-model="config.language" @change="changeLanguage">
                  <el-option :label="t('settings.english')" value="en_US" />
                  <el-option :label="t('settings.chinese')" value="zh_CN" />
                </el-select>
              </el-form-item>
              <el-form-item :label="t('settings.mdPreviewTheme')">
                <el-select :model-value="ttsStore.mdTheme" @change="(v: string) => ttsStore.setMdTheme(v)" style="width: 200px;">
                  <el-option :label="t('settings.themeTeal')" value="teal" />
                  <el-option :label="t('settings.themeGreen')" value="default" />
                  <el-option :label="t('settings.themePurple')" value="purple" />
                  <el-option :label="t('settings.themeOrange')" value="orange" />
                  <el-option :label="t('settings.themeRed')" value="red" />
                </el-select>
              </el-form-item>
              <el-form-item :label="t('settings.lineWrap')">
                <el-switch
                  :model-value="ttsStore.mdEditor.lineWrap"
                  @change="(v: boolean) => ttsStore.setLineWrap(v)"
                />
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- Tab 3: 同步 -->
          <el-tab-pane :label="t('settings.remoteSetting')" name="sync">
            <el-alert v-if="!ttsStore.gitAvailable" type="warning" :closable="false" style="margin-bottom: 16px;">
              <template #title>{{ t('settings.gitNotFound') }}</template>
              <template #default>
                <p style="margin: 4px 0;">{{ t('settings.gitNotFoundDesc') }}</p>
                <el-button size="small" type="primary" link @click="openGitInstallPage">{{ t('settings.installGit') }} →</el-button>
              </template>
            </el-alert>

            <!-- Git 平台选择 -->
            <div class="section-title">{{ t('settings.gitAccount') }}</div>
            <el-form :model="config" label-width="120px" label-position="top">
              <el-form-item :label="t('settings.gitProvider')">
                <el-select
                  v-model="config.gitProvider"
                  style="width: 160px;"
                  @change="saveGitHubConfig"
                >
                  <el-option label="GitHub" value="github" />
                  <el-option label="Gitee" value="gitee" />
                </el-select>
              </el-form-item>

              <!-- GitHub 配置 -->
              <template v-if="config.gitProvider === 'github'">
                <el-form-item :label="t('settings.githubUsername')">
                  <el-input v-model="config.githubUsername" :placeholder="t('settings.githubUsernamePlaceholder')" @change="saveGitHubConfig" />
                </el-form-item>
                <el-form-item :label="t('settings.githubToken')">
                  <el-input v-model="config.githubToken" type="password" show-password :placeholder="t('settings.githubTokenPlaceholder')" @change="saveGitHubConfig" />
                </el-form-item>
              </template>

              <!-- Gitee 配置 -->
              <template v-else>
                <el-form-item :label="t('settings.giteeUsername')">
                  <el-input v-model="config.giteeUsername" :placeholder="t('settings.giteeUsernamePlaceholder')" @change="saveGitHubConfig" />
                </el-form-item>
                <el-form-item :label="t('settings.giteeToken')">
                  <el-input v-model="config.giteeToken" type="password" show-password :placeholder="t('settings.giteeTokenPlaceholder')" @change="saveGitHubConfig" />
                </el-form-item>
              </template>
            </el-form>

            <!-- 添加远程仓库（自动判断创建或克隆） -->
            <div class="section-title" style="margin-top: 16px;">{{ t('settings.addRemoteRepo') }}</div>
            <el-form label-width="120px" label-position="top">
              <el-form-item :label="t('settings.repoName')">
                <el-input
                  v-model="cloneRepoName"
                  :placeholder="t('settings.repoPlaceholder')"
                  style="width: 100%;"
                  @blur="checkRepo"
                  @change="resetRepoCheck"
                />
              </el-form-item>

              <!-- 检查状态提示 -->
              <div v-if="repoCheckStatus === 'checking'" style="font-size: 12px; color: #909399; margin: -8px 0 12px;">
                ⏳ {{ t('settings.checkingRepo') }}
              </div>
              <div v-else-if="repoCheckStatus === 'exists'" style="font-size: 12px; color: #67c23a; margin: -8px 0 12px;">
                ✓ {{ t('settings.repoExists') }}
              </div>
              <div v-else-if="repoCheckStatus === 'not_found'" style="font-size: 12px; color: #e6a23c; margin: -8px 0 12px;">
                ✦ {{ t('settings.repoWillCreate') }}
              </div>

              <!-- 公私有：仅在需要创建时显示 -->
              <el-form-item v-if="repoCheckStatus === 'not_found'">
                <div style="display: flex; align-items: center; gap: 10px; -webkit-app-region: no-drag;">
                  <el-switch v-model="newRemoteRepoPrivate" />
                  <span style="font-size: 13px; color: #606266;">{{ newRemoteRepoPrivate ? t('settings.repoPrivate') : t('settings.repoPublic') }}</span>
                </div>
              </el-form-item>

              <el-form-item>
                <div style="display: flex; align-items: center; gap: 10px; -webkit-app-region: no-drag;">
                  <el-switch
                    :model-value="cloneMode === 'multi'"
                    @change="(v: boolean) => cloneMode = v ? 'multi' : 'direct'"
                  />
                  <span style="font-size: 13px; color: #606266;">
                    {{ cloneMode === 'multi' ? t('settings.cloneModeMulti') : t('settings.cloneModeDirect') }}
                  </span>
                </div>
              </el-form-item>
              <el-form-item :label="t('settings.cloneTo')">
                <div class="path-display">{{ cloneTargetPath }}</div>
              </el-form-item>
              <el-form-item>
                <el-button
                  type="primary"
                  @click="cloneRepo"
                  :disabled="!canClone || repoCheckStatus === 'checking' || repoCheckStatus === 'auth_error'"
                  :loading="cloning"
                  style="width: 100%;"
                >
                  {{ repoCheckStatus === 'not_found' ? t('settings.createAndCloneBtn') : t('settings.addRepoBtn') }}
                </el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- Tab 4: 公众号 -->
          <el-tab-pane :label="t('wechat.tabName')" name="wechat">
            <div style="-webkit-app-region: no-drag">
              <el-alert type="info" :closable="false" style="margin-bottom: 16px;">
                <template #title>{{ t('wechat.configHint') }}</template>
              </el-alert>
              <el-form :model="wechatForm" label-width="120px" label-position="top">
                <el-form-item :label="t('wechat.appId')">
                  <el-input v-model="wechatForm.appId" :placeholder="t('wechat.appIdPlaceholder')" />
                </el-form-item>
                <el-form-item :label="t('wechat.appSecret')">
                  <el-input v-model="wechatForm.appSecret" type="password" show-password :placeholder="t('wechat.appSecretPlaceholder')" />
                </el-form-item>
                <el-form-item :label="t('wechat.defaultAuthor')">
                  <el-input
                    :model-value="ttsStore.config.wechat.defaultAuthor"
                    :placeholder="t('wechat.defaultAuthorPlaceholder')"
                    @change="(v: string) => ttsStore.setDefaultAuthor(v.trim())"
                  />
                </el-form-item>
                <el-form-item>
                  <div style="display:flex; gap:8px; width:100%;">
                    <el-button type="primary" @click="saveWechatConfig" :disabled="!wechatForm.appId || !wechatForm.appSecret">
                      {{ t('wechat.saveConfig') }}
                    </el-button>
                    <el-button @click="testWechatConnection" :loading="wechatTesting" :disabled="!wechatForm.appId || !wechatForm.appSecret">
                      {{ wechatTesting ? t('wechat.testing') : t('wechat.testConnection') }}
                    </el-button>
                    <el-button link type="primary" @click="openWechatConsole">{{ t('wechat.openConsole') }}</el-button>
                  </div>
                </el-form-item>
                <el-form-item :label="t('settings.mdPreviewTheme') + ' (' + t('wechat.tabName') + ')'">
                  <el-select :model-value="ttsStore.wechatTheme" @change="(v: string) => ttsStore.setWechatTheme(v)" style="width: 200px;">
                    <el-option :label="t('wechat.themeGreen')" value="wechat-green" />
                    <el-option :label="t('wechat.themeBlack')" value="wechat-black" />
                    <el-option :label="t('wechat.themeOrange')" value="wechat-orange" />
                    <el-option :label="t('wechat.themeDefault')" value="wechat-default" />
                  </el-select>
                </el-form-item>
              </el-form>
            </div>
          </el-tab-pane>

          <!-- Tab 5: 关于 -->
          <el-tab-pane :label="t('help.about')" name="about">
            <div class="about-tab" style="-webkit-app-region: no-drag">
              <div class="about-tab-header">
                <img src="../../assets/brand/logo-mark.svg" alt="Snowpub" class="about-brand-mark" />
                <div class="about-tab-name">Snowpub</div>
                <div class="about-tab-version">v{{ appVersion }}</div>
              </div>
              <p class="about-tab-desc">{{ t('help.aboutDesc') }}</p>
              <el-button type="primary" @click="openGithub" style="margin-bottom:24px">
                {{ t('help.aboutGithub') }}
              </el-button>
              <div class="about-tab-donate-title">{{ t('help.aboutDonate') }}</div>
              <div class="about-tab-qr">
                <div class="about-tab-qr-item">
                  <img src="../../assets/wx.jpg" alt="WeChat Pay" />
                  <span>{{ t('help.aboutDonateWechat') }}</span>
                </div>
                <div class="about-tab-qr-item">
                  <img src="../../assets/zfb.jpg" alt="Alipay" />
                  <span>{{ t('help.aboutDonateAlipay') }}</span>
                </div>
              </div>
            </div>
          </el-tab-pane>

        </el-tabs>
      </template>
    </el-drawer>
    <!--Config Drawer End-->

    <!--Create Note Folder Dialog-->
    <el-dialog v-model="dialogFormVisible" :title="t('dialog.addToNotebook')" width="420px">
      <el-tabs v-model="addDialogTab">
        <!-- Tab 1: 本地文件夹 -->
        <el-tab-pane :label="t('dialog.localFolder')" name="local">
          <el-form style="margin-top: 12px;">
            <el-form-item :label="t('dialog.folderName')" :label-width="formLabelWidth">
              <el-input v-model="rootFolderName" autocomplete="off" :placeholder="t('dialog.folderNamePlaceholder')" />
            </el-form-item>
          </el-form>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
            <el-button @click="dialogFormVisible = false">{{ t('common.cancel') }}</el-button>
            <el-button type="primary" @click="addRootFolder" :disabled="!rootFolderName.trim()">{{ t('common.ok') }}</el-button>
          </div>
        </el-tab-pane>

        <!-- Tab 2: Git 仓库 -->
        <el-tab-pane :label="t('dialog.gitRepo')" name="git">
          <div v-if="currentNotebookIsGit" style="margin-top: 16px; padding: 12px; background: #ecf5ff; border-radius: 4px; border-left: 4px solid #409eff; font-size: 13px; color: #606266;">
            ℹ️ {{ t('dialog.notebookAlreadyGit') }}
          </div>
          <template v-else>
          <el-form style="margin-top: 12px;">
            <el-form-item :label="t('settings.repoName')" :label-width="formLabelWidth">
              <el-input v-model="dialogCloneRepoName" autocomplete="off" :placeholder="t('settings.repoPlaceholder')" />
            </el-form-item>
          </el-form>
          <div v-if="!ttsStore.config.githubUsername || !ttsStore.config.githubToken" style="font-size: 12px; color: #e6a23c; margin-bottom: 8px;">
            {{ t('dialog.gitConfigRequired') }}
          </div>
          <div v-else style="font-size: 12px; color: #909399; margin-bottom: 8px;">
            → {{ ttsStore.notebook.currentPath }}/{{ dialogCloneRepoName || 'repo-name' }}
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <el-button @click="dialogFormVisible = false">{{ t('common.cancel') }}</el-button>
            <el-button type="primary" @click="addGitRepo" :disabled="!canDialogClone" :loading="dialogCloning">
              {{ t('dialog.cloneBtn') }}
            </el-button>
          </div>
          </template>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
</template>

<script lang="ts" setup>
  import { ref, computed, onMounted } from 'vue'
  import { Setting, Plus, Download, Upload, Suitcase } from '@element-plus/icons-vue'
  import { ElMessageBox, ElMessage } from 'element-plus'
  import { useTtsStore, Tree } from "@/store/store";
  import { storeToRefs } from "pinia";
  import { gitPull, gitHubPush, addRemoteRepo, checkRepoExists } from "@/libs/github"
  import fs from 'fs'
  import { join, basename } from "path";
  import { readOneDir } from "@/libs/fileHandler"
  import defaultConf from "@/global/defaultConf";
  import { ipcRenderer } from 'electron';
  import { useI18n } from 'vue-i18n';

  const { t, locale } = useI18n();
  const formLabelWidth = '140px';
  const appVersion = ref('')
  const showDonateDialog = ref(false)

  // ── WeChat Official Account settings ──
  const wechatForm = ref({ appId: '', appSecret: '' })
  const wechatTesting = ref(false)

  onMounted(async () => {
    appVersion.value = await ipcRenderer.invoke('app:version')
    // Preload WeChat config into local form
    await ttsStore.loadWechatConfig()
    wechatForm.value.appId = ttsStore.config.wechat.appId
    wechatForm.value.appSecret = ttsStore.config.wechat.appSecret
  })

  async function saveWechatConfig() {
    await ttsStore.saveWechatConfig(wechatForm.value.appId.trim(), wechatForm.value.appSecret.trim())
    ElMessage({ message: t('settings.saveSuccess'), type: 'success' })
  }

  async function testWechatConnection() {
    wechatTesting.value = true
    try {
      const result = await ttsStore.testWechatConnection(wechatForm.value.appId.trim(), wechatForm.value.appSecret.trim())
      if (result?.ok) {
        ElMessage({ message: t('wechat.testSuccess'), type: 'success' })
      } else {
        ElMessage({ message: t('wechat.testFailed', { msg: result?.errmsg || result?.errcode || '' }), type: 'error' })
      }
    } finally {
      wechatTesting.value = false
    }
  }

  function openWechatConsole() {
    const { shell } = require('electron')
    shell.openExternal('https://mp.weixin.qq.com/')
  }

  function openGithub() {
    const { shell } = require('electron')
    shell.openExternal('https://github.com/wavesnows/snowpub')
  }
  const dialogFormVisible = ref(false)
  const addDialogTab = ref('local')
  const settingsActiveTab = ref('notebook')
  const rootFolderName = ref('')
  const dialogCloneRepoName = ref('')
  const dialogCloning = ref(false)

  const canDialogClone = computed(() => {
    const isGitee = config.value.gitProvider === 'gitee'
    const hasCredentials = isGitee
      ? !!(config.value.giteeUsername && config.value.giteeToken)
      : !!(config.value.githubUsername && config.value.githubToken)
    return hasCredentials && !!dialogCloneRepoName.value.trim()
  })

  async function addGitRepo() {
    if (!canDialogClone.value) return;
    const repoName = dialogCloneRepoName.value.trim();
    dialogCloning.value = true;
    try {
      const success = await addRemoteRepo(t, repoName, false, 'direct');
      if (success) {
        dialogCloneRepoName.value = '';
        dialogFormVisible.value = false;
        ttsStore.refreshTreeData();
        ElMessage({ message: t('github.cloneSuccess'), type: 'success' });
      } else {
        ElMessage({ message: t('github.cloneFailed'), type: 'error' });
      }
    } finally {
      dialogCloning.value = false;
    }
  }
  const ttsStore = useTtsStore();
  const { config, notebook, notestore, settings, cnote } = storeToRefs(ttsStore);

  const newNotebookName = ref('');

  function createNotebook() {
    const name = newNotebookName.value.trim();
    if (!name) return;
    const reposPath = join(ttsStore.notestore.currentStore, defaultConf.defaultRepoPath);
    const notebookPath = join(reposPath, name);
    try {
      fs.mkdirSync(notebookPath, { recursive: true });
      newNotebookName.value = '';
      buildNotebookOptions();
      const newNotebook = { value: name, label: name, type: 'local', rootDir: ttsStore.notestore.currentStore };
      saveHander(newNotebook);
      ElMessage({ message: t('settings.notebookCreated'), type: 'success' });
    } catch (e: any) {
      ElMessage({ message: e.message, type: 'error' });
    }
  }

  const newRemoteRepoPrivate = ref(false);
  const cloneRepoName = ref('');
  const cloneMode = ref<'multi' | 'direct'>('multi');
  const cloning = ref(false);
  const repoCheckStatus = ref<'idle' | 'checking' | 'exists' | 'not_found' | 'auth_error'>('idle');

  const canClone = computed(() => {
    const isGitee = config.value.gitProvider === 'gitee'
    const hasCredentials = isGitee
      ? !!(config.value.giteeUsername && config.value.giteeToken)
      : !!(config.value.githubUsername && config.value.githubToken)
    return hasCredentials && !!cloneRepoName.value.trim()
  });

  function resetRepoCheck() {
    repoCheckStatus.value = 'idle';
  }

  async function checkRepo() {
    const name = cloneRepoName.value.trim();
    if (!name || !config.value.githubUsername || !config.value.githubToken) return;
    repoCheckStatus.value = 'checking';
    const isGitee = config.value.gitProvider === 'gitee';
    const checkUsername = isGitee ? config.value.giteeUsername : config.value.githubUsername;
    const checkToken = isGitee ? config.value.giteeToken : config.value.githubToken;
    const result = await checkRepoExists(checkUsername, checkToken, name, config.value.gitProvider || 'github');
    repoCheckStatus.value = result;
    if (result === 'auth_error') {
      ElMessage({ message: t('github.authFailed'), type: 'error' });
    }
  }

  const cloneTargetPath = computed(() => {
    const repoName = cloneRepoName.value || 'repo-name';
    const root = ttsStore.notestore.currentStore;
    return cloneMode.value === 'multi'
      ? join(root, 'repos', repoName)
      : join(root, repoName);
  });

  async function cloneRepo() {
    if (!canClone.value) return;
    const repoName = cloneRepoName.value.trim();

    // Warn if switching to multi mode and root has non-repos/ content
    if (cloneMode.value === 'multi') {
      const reposPath = join(ttsStore.notestore.currentStore, defaultConf.defaultRepoPath);
      if (!fs.existsSync(reposPath)) {
        const items = fs.readdirSync(ttsStore.notestore.currentStore).filter((f: string) => !f.startsWith('.'));
        if (items.length > 0) {
          try {
            await ElMessageBox.confirm(
              t('settings.cloneMultiModeWarning'),
              t('common.confirm'),
              { confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel'), type: 'warning' }
            );
          } catch { return; }
        }
      }
    }

    cloning.value = true;
    try {
      const success = await addRemoteRepo(t, repoName, newRemoteRepoPrivate.value, cloneMode.value);
      if (success) {
        cloneRepoName.value = '';
        repoCheckStatus.value = 'idle';
        buildNotebookOptions();
        ElMessage({ message: t('github.cloneSuccess'), type: 'success' });
        if (cloneMode.value === 'multi') {
          const githubNotebook = { value: repoName, label: repoName, type: 'github', rootDir: ttsStore.notestore.currentStore };
          saveHander(githubNotebook);
        } else {
          ttsStore.refreshTreeData();
        }
      } else {
        ElMessage({ message: t('github.cloneFailed'), type: 'error' });
      }
    } finally {
      cloning.value = false;
    }
  }

  // Notebook options — computed lazily only when drawer opens, not reactive to every store change
  const notebookOptions = ref<{ label: string; options: any[] }[]>([]);

  function buildNotebookOptions() {
    const groups: { label: string; options: any[] }[] = [];
    for (const rootDir of ttsStore.notestore.rootStores) {
      const reposPath = join(rootDir, defaultConf.defaultRepoPath);
      const hasRepos = fs.existsSync(reposPath) && fs.statSync(reposPath).isDirectory();
      const dirName = basename(rootDir);
      if (hasRepos) {
        const allNotebooks = readOneDir(reposPath);
        if (allNotebooks.length === 0) continue;
        groups.push({ label: dirName, options: allNotebooks.map((nb: any) => ({ ...nb, rootDir })) });
      } else {
        groups.push({
          label: dirName,
          options: [{ label: dirName, value: dirName, path: rootDir, type: 'direct', rootDir }],
        });
      }
    }
    notebookOptions.value = groups;
  }

  function onDrawerOpen() {
    // 外部请求定位到指定 tab（如发布按钮引导到微信配置）
    if (ttsStore.config.settingsTab) {
      settingsActiveTab.value = ttsStore.config.settingsTab;
      ttsStore.config.settingsTab = '';
    }
    buildNotebookOptions();
  }

  const isMultiMode = computed(() => {
    const reposPath = join(ttsStore.notestore.currentStore, defaultConf.defaultRepoPath);
    return fs.existsSync(reposPath);
  });

  const currentNotebookIsGit = computed(() => {
    const gitPath = join(ttsStore.notebook.currentPath, '.git');
    return fs.existsSync(gitPath);
  });

  function openGitInstallPage() {
    const { shell } = require('electron');
    shell.openExternal('https://git-scm.com/downloads');
  }


  const openDialog = () => {
    ipcRenderer.removeAllListeners('selected-directory');
    ipcRenderer.send('open-dialog');
    ipcRenderer.once('selected-directory', (event, path) => {
      config.value.savePath = path[0];
      ttsStore.notestore.currentStore = path[0];
      ttsStore.addRootStore(path[0]);
      ttsStore.notebook.currentPath = join(path[0], defaultConf.defaultRepoPath, defaultConf.defaultRepoName);
      ttsStore.settings.defaultNotePath = join(path[0], defaultConf.defaultRepoPath, defaultConf.defaultRepoName);
      buildNotebookOptions();
    });
  };

  function popHandler() {
    ttsStore.config.drawer = true;
  }

  function saveGitHubConfig() {
    ttsStore.setLocalNotePath();
    ElMessage({ message: t('settings.saveSuccess'), type: 'success' });
  }

  function addRootStore() {
    ipcRenderer.removeAllListeners('selected-directory');
    ipcRenderer.send('open-dialog');
    ipcRenderer.once('selected-directory', (_event: any, paths: string[]) => {
      if (paths && paths[0]) {
        ttsStore.addRootStore(paths[0]);
        buildNotebookOptions();
        ElMessage({ message: t('settings.rootStoreAdded'), type: 'success' });
      }
    });
  }

  function removeRootStore(dirPath: string) {
    ttsStore.removeRootStore(dirPath);
    buildNotebookOptions();
    ElMessage({ message: t('settings.rootStoreRemoved'), type: 'success' });
  }

  function switchRootStore(dirPath: string) {
    ttsStore.setActiveStore(dirPath);
    const reposPath = join(dirPath, defaultConf.defaultRepoPath);
    const hasRepos = fs.existsSync(reposPath) && fs.statSync(reposPath).isDirectory();
    if (!hasRepos) {
      ttsStore.notebook.currentPath = dirPath;
      ttsStore.setNoteBookConfig();
    }
    ttsStore.refreshTreeData();
    ElMessage({ message: t('settings.rootStoreSwitched', { name: basename(dirPath) }), type: 'success' });
  }

  const handleCommand = () => {
    dialogFormVisible.value = true;
  }

  const changeLanguage = (lang: string) => {
    locale.value = lang;
    ttsStore.setLanguage(lang);
    ElMessage({ message: t('settings.languageSwitched'), type: 'success' });
  }

  const handleGit = async (command: string) => {
    if (command === 'pull') await gitPull(t);
    else if (command === 'push') await gitHubPush(t);
    else ElMessage("Do nothing");
  }

  const addRootFolder = () => {
    const foldername = rootFolderName.value.trim();
    if (!foldername) return;
    try {
      fs.mkdirSync(join(ttsStore.notebook.currentPath, foldername));
      rootFolderName.value = '';
      dialogFormVisible.value = false;
      ttsStore.refreshTreeData();
      ElMessage({ message: t('dialog.folderCreated'), type: 'success' });
    } catch (error) {
      ElMessage({ message: error as string, grouping: true, type: 'error' });
    }
  }

  async function saveHander(value: any) {
    ttsStore.settings.currentbook = value;
    if (value.rootDir && value.rootDir !== ttsStore.notestore.currentStore) {
      ttsStore.setActiveStore(value.rootDir);
    }
    const newPath = value.type === 'direct'
      ? value.rootDir
      : join(value.rootDir || ttsStore.notestore.currentStore, defaultConf.defaultRepoPath, value.value);
    ttsStore.notebook.currentPath = newPath;
    ttsStore.notebook.bookType = value.type;
    ttsStore.setNoteBookConfig();

    if (value.type === 'github') await gitPull(t, ttsStore.notebook.currentPath);

    ttsStore.refreshTreeData();
    ttsStore.config.needUpdateTree = true;
    ttsStore.startGitStatusCheck();

    ElMessage({ message: t('settings.notebookSwitched', { name: value.label }), type: 'success' });
  }
</script>

<style scoped>
.button-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

.el-button-group {
  display: flex;
  flex-direction: column;
}

.circle-btn {
  width: 25px;
  height: 25px;
  border-radius: 50% !important;
  border: none;
  margin-top: 10px;
  background-color: gray;
}


/* Git dropdown menu styling */
.git-dropdown :deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
}

.git-dropdown :deep(.el-dropdown-menu__item .el-icon) {
  font-size: 16px;
}

.form-item-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.path-display {
  padding: 8px 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
  color: #606266;
  word-break: break-all;
}

.action-button {
  width: fit-content;
  align-self: flex-start;
}

.root-stores-list {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 4px;
}

.root-store-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 4px;
  background-color: #f5f7fa;
  font-size: 13px;
}

.root-store-item.active {
  background-color: #ecf5ff;
  border: 1px solid #b3d8ff;
}

.root-store-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #606266;
}

.root-store-item.active .root-store-path {
  color: #409eff;
  font-weight: 600;
}

.root-store-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

:deep(.el-form-item__label) {
  font-size: 12px;
  font-weight: 600;
}




.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  padding: 0 0 8px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 12px;
}

.about-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 16px;
}

.about-tab-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.about-brand-mark {
  width: 76px;
}

.about-tab-name {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.about-tab-cn {
  font-size: 14px;
  color: #909399;
  font-weight: 400;
  margin-left: 4px;
}

.about-tab-version {
  font-size: 12px;
  color: #c0c4cc;
}

.about-tab-desc {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin: 0 0 16px;
  max-width: 280px;
}

.about-tab-donate-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
}

.about-tab-qr {
  display: flex;
  gap: 24px;
}

.about-tab-qr-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #606266;
}

.about-tab-qr-item img {
  width: 120px;
  height: 120px;
  border-radius: 8px;
  object-fit: cover;
}

</style>
