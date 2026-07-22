
import path from "path";
import defaultConf from '../global/defaultConf';
import { log } from '@/libs/logger'

// Lazy load fs-extra only when needed (not in renderer process)
let fse: any = null;
function loadFse() {
  if (!fse) {
    fse = require('fs-extra');
  }
  return fse;
}

export function getNoteLabel(){
    var date = new Date();
    return  dateFormat('YmmddHHMMSS',date);
}

export function dateFormat(fmt:string, date:Date) {
    let ret;
    const opt: Record<string, string> = {
        "Y+": date.getFullYear().toString(),        // 年
        "m+": (date.getMonth() + 1).toString(),     // 月
        "d+": date.getDate().toString(),            // 日
        "H+": date.getHours().toString(),           // 时
        "M+": date.getMinutes().toString(),         // 分
        "S+": date.getSeconds().toString()          // 秒
        // 有其他格式化字符需求可以继续添加，必须转化成字符串
    };
    for (let k in opt) {
        ret = new RegExp("(" + k + ")").exec(fmt);
        if (ret) {
            fmt = fmt.replace(ret[1], (ret[1].length == 1) ? (opt[k]) : (opt[k].padStart(ret[1].length, "0")))
        };
    };
    return fmt;
}


export function isFolderEmpty(dir:string):boolean{
    const { readdirSync } = loadFse();
    let isEmpty = ((readdirSync(dir) as Array<string>).length > 0)? false:true;
    return isEmpty;
}

export function initDefaultNotebook(dir:string):string{
    const { ensureDirSync, statSync, existsSync, writeFileSync } = loadFse();
    let str:string = ''
    let localNotePath = path.join(dir,defaultConf.defaultRepoPath,defaultConf.defaultRepoName,"notes");
    let hasDefaultNoteBook = existsSync(localNotePath) && statSync(localNotePath).isDirectory()
    if(!existsSync(dir)||existsSync(dir)&&isFolderEmpty(dir)){
        try {
            ensureDirSync(localNotePath);
            // Create a demo markdown note
            const demoNote = `# Welcome to snowpub 👋

This is your first note. Start writing!
`;
            writeFileSync(path.join(localNotePath, 'demo.md'), demoNote, 'utf8');
            str = "create default note book"
        } catch (e: any) {
            str = "init failed: " + e.message;
            console.error('Failed to init default notebook:', e);
        }
    }
    else if(hasDefaultNoteBook){
        str = "default note folder is already there. "
    }
    else{
        str ="none empty";
    }
    log(str)
    return str;

}
