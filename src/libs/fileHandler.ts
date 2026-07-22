import fs from 'fs'
import path from 'path'
import {getNoteLabel} from '@/libs/noteUtil'
import { useTtsStore,Tree } from "@/store/store";
import Node from 'element-plus/es/components/tree/src/model/node'
import {updateTreeMenu} from "@/libs/treeMenu"
import {showMessage} from '@/libs/globalLib'
import { log, dir } from '@/libs/logger'

  export function renameFile(): boolean {
    //  saveContent(editor,ttsStore);
     // ttsStore.treeMenu.data = readDir();
    let ttsStore = useTtsStore()
    var destPath = path.dirname(ttsStore.inputs.notePath)
    const ext = path.extname(ttsStore.inputs.notePath) || '.md'
    var destPath = path.join(destPath, ttsStore.cnote.destTitle + ext)
    //log(destPath)
    //log(ttsStore.inputs.notePath)
    if(ttsStore.inputs.notePath != destPath){
      const oldPath = ttsStore.inputs.notePath;

      let copyOk = false
      try{
        fs.copyFileSync(ttsStore.inputs.notePath,destPath,fs.constants.COPYFILE_EXCL)
        copyOk = true
      }
      catch(e:any){
        showMessage(e.message, 'warning')
      }
      if (!copyOk) return false
      fs.rmSync(ttsStore.inputs.notePath)

      // Update favorites paths if the file was pinned or starred
      const wasPinned = ttsStore.isPinned(oldPath);
      const wasStarred = ttsStore.isStarred(oldPath);

      if (wasPinned) {
        ttsStore.togglePin(oldPath); // Remove old path
        ttsStore.togglePin(destPath); // Add new path
      }
      if (wasStarred) {
        ttsStore.toggleStar(oldPath); // Remove old path
        ttsStore.toggleStar(destPath); // Add new path
      }

      ttsStore.inputs.notePath = destPath;
      ttsStore.cnote.title = ttsStore.cnote.destTitle;
      ttsStore.scheduleTreeRefresh() // reload file with debounce
    }
    return true;
  }


  export function removeFolder() {
    let ttsStore = useTtsStore()
    log("remove Folder")
    let node  = ttsStore.treeMenu.node ;
  //  updateTreeMenu()
    updateTreeMenu()
    ttsStore.inputs.notePath =  node.data.path
    log("----"+node.data.path)
    try {
      fs.rmSync(node.data.path, { recursive: true, force: true })
      showMessage('Remove success!', 'success')
         //'success' | 'warning' | 'info' | 'error'
    } catch (error) {
      showMessage(error as string, 'error')
         //'success' | 'warning' | 'info' | 'error'
    }
    return null
  }
  
  export function remove(node: Node, data: Tree) {
    let ttsStore = useTtsStore()
    ttsStore.treeMenu.treeData = data;
    ttsStore.treeMenu.node = node;
    updateTreeMenu()
    ttsStore.inputs.notePath =  node.data.path

    // Remove from favorites if present
    const filePath = node.data.path;
    if (ttsStore.isPinned(filePath)) {
      ttsStore.togglePin(filePath);
    }
    if (ttsStore.isStarred(filePath)) {
      ttsStore.toggleStar(filePath);
    }

    try {
      fs.rmSync(ttsStore.inputs.notePath)
      showMessage('Remove success!', 'success')
    } catch (error) {
      showMessage(error as string, 'error')
    }
  }




  export function removeFile(){
    const ttsStore = useTtsStore();

    updateTreeMenu()

    // Remove from favorites if present
    const filePath = ttsStore.inputs.notePath;
    if (ttsStore.isPinned(filePath)) {
      ttsStore.togglePin(filePath);
    }
    if (ttsStore.isStarred(filePath)) {
      ttsStore.toggleStar(filePath);
    }

    // var destPath = path.dirname(ttsStore.inputs.notePath)
    try {
      fs.rmSync(ttsStore.inputs.notePath)
      showMessage('Remove success!', 'success')
         //'success' | 'warning' | 'info' | 'error'
    } catch (error) {
      showMessage(error as string, 'error')
         //'success' | 'warning' | 'info' | 'error'
    }
      return ;
  }

// 通用目录读取函数
function readDirGeneric(dirPath: string, options: {
  recursive?: boolean,
  includeJson?: boolean,
  dirsOnly?: boolean,
  checkExists?: boolean,
  showHidden?: boolean,
  customMapper?: (file: string, fullPath: string, isDirectory: boolean) => any
}): any[] {
  if (options.checkExists && !fs.existsSync(dirPath)) {
    log("file path is empty")
    return []
  }

  const hiddenFilter = (file: string) => options.showHidden ? true : !file.startsWith('.')
  let filter = hiddenFilter
  if (options.includeJson) {
    filter = (file: string) => {
      if (!options.showHidden && file.startsWith('.')) return false
      const ext = path.extname(file)
      if (ext === '.json' || ext === '.md') return true
      // showHidden: include all text files and hidden files
      if (options.showHidden) return true
      // 无扩展名只保留目录，过滤掉无扩展名的普通文件
      if (ext === '') {
        const fullPath = path.resolve(dirPath, file)
        return fs.statSync(fullPath).isDirectory()
      }
      return false
    }
  } else if (options.dirsOnly) {
    filter = (file: string) => !file.startsWith('.') && path.extname(file) == ''
  }

  const files = fs.readdirSync(dirPath).filter(filter)

  return files.map((file: string) => {
    const fullPath = path.resolve(dirPath, file)
    const isDirectory = fs.statSync(fullPath).isDirectory()

    if (options.customMapper) {
      return options.customMapper(file, fullPath, isDirectory)
    }

    // Default mapper for readDir/readNotes
    return {
      label: isDirectory ? file : file.substring(0, file.lastIndexOf('.')),
      path: fullPath,
      isFolder: isDirectory,
      children: isDirectory && options.recursive ? readDirGeneric(fullPath, options) : null
    }
  }).filter(item => item !== "")
}

export function readDir(dir: string = ''): any {
  let dirPath = dir
  if (dir == '') {
    const ttsStore = useTtsStore()
    dirPath = path.join(ttsStore.settings.currentStore, 'repos', ttsStore.config.githubRepoName, 'notes')
    log(dirPath)
  }
  return readDirGeneric(dirPath, { recursive: true, includeJson: true })
}

export function readOneDir(dir: string = ''): Array<any> {
  log('readOneDir called with dir:', dir);

  const result = readDirGeneric(dir, {
    dirsOnly: true,
    checkExists: true,
    customMapper: (file, fullPath, isDirectory) => {
      if (isDirectory) {
        // Check if this is a git repository (has .git folder)
        const gitPath = path.join(fullPath, '.git');
        const isGitRepo = fs.existsSync(gitPath);

        log(`Checking notebook: ${file}, path: ${fullPath}, isGitRepo: ${isGitRepo}`);

        return {
          label: file,
          value: file,
          path: fullPath,
          type: isGitRepo ? 'github' : 'local',
        }
      }
      return ""
    }
  });

  log('readOneDir result:', result);
  return result;
}

export function sortTreeByPinned(tree: Tree[], pinnedPaths: string[]): Tree[] {
  // Separate pinned and unpinned items
  const pinned: Tree[] = [];
  const unpinned: Tree[] = [];

  tree.forEach(item => {
    if (!item.isFolder && pinnedPaths.includes(item.path)) {
      pinned.push(item);
    } else {
      unpinned.push(item);
    }

    // Recursively sort children
    if (item.children && item.children.length > 0) {
      item.children = sortTreeByPinned(item.children, pinnedPaths);
    }
  });

  return [...pinned, ...unpinned];
}

export function readNotes(dirPath: string, pinnedPaths?: string[], showHidden = false): any {
  const notes = readDirGeneric(dirPath, {
    recursive: true,
    includeJson: true,
    checkExists: true,
    showHidden,
  });

  // Apply pinned sorting if provided
  if (pinnedPaths && pinnedPaths.length > 0) {
    return sortTreeByPinned(notes, pinnedPaths);
  }

  return notes;
}

export function addHandler(){
  const ttsStore = useTtsStore();
  log("add")
  let data = ttsStore.inputs.itemData
  dir(data)
  let label:string = getNoteLabel();
  let filePath:any = path.join(data.path,label+'.md')
  const newChild:Tree = {label: label, isFolder:false, path: filePath, isLeaf: true}
  if (!data.children) {
    data.children = []
  }
  data.children.push(newChild as Tree)
  ttsStore.inputs.notePath = filePath
  fs.writeFileSync(filePath, '', 'utf8')
}