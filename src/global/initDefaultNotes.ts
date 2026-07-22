import path from 'path';
import os from 'os';

const Store = require('electron-store');
const store = new Store();
const homeDir = os.homedir();
const defaultDir = path.join(homeDir, 'snowpub');

interface FormConfig {
  languageSelect: string;
  voiceSelect: string;
  voiceStyleSelect: string;
  role: string;
  speed: number;
  pitch: number;
}

export default function initNote(): void {
  if (!store.has("FormConfig.默认")) {
    const defaultFormConfig: FormConfig = {
      languageSelect: "Chinese (Mandarin, Simplified)",
      voiceSelect: "zh-CN-XiaoxiaoNeural",
      voiceStyleSelect: "General",
      role: "Default",
      speed: 1.0,
      pitch: 1.0,
    };
    store.set("FormConfig.默认", defaultFormConfig);
  }

  // Ensure savePath is set
  if (!store.has("savePath")) {
    store.set("savePath", defaultDir);
  }

  // Initialize other default settings
  if (!store.has("audition")) {
    store.set(
      "audition",
      "如果你觉得这个项目还不错， 欢迎Star、Fork和PR。你的Star是对作者最好的鼓励。"
    );
  }

  if (!store.has("autoplay")) {
    store.set("autoplay", true);
  }
}

  if (!store.has("page")) {
    store.set("page", {
      asideIndex: "1"
    });
  }
