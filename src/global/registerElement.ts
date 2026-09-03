import {
  ElContainer,

  ElIcon,
  ElButton,
  ElButtonGroup,
  ElMenu,
  ElInput,
  ElForm,
  ElSelect,
  ElSlider,
  ElOption,
  ElSelectV2,
  ElSkeletonItem,
  ElMenuItem,
  ElMessage,
  ElMessageBox,
  ElTable,
  ElTag,
  ElTree,
  ElUpload,
  ElDialog,
  ElDivider,
  ElDrawer,
  ElTabPane,
  ElSwitch,
  ElPopconfirm,
  ElPopover,
  ElPageHeader,
  ElDropdown,
  ElRadio,
  ElRadioGroup,
  ElRadioButton,
  ElScrollbar,
  ElTooltip,
  ElTabs,
  // 发布对话框在用但此前漏注册：el-checkbox（评论开关）、el-alert（publishBlocked 提示）
  ElCheckbox,
  ElAlert,
  // 其他在用但此前漏注册：el-empty（搜索空态/版本历史）、el-timeline（版本历史）、el-card（版本历史）、el-link（AI 面板安装横幅）
  ElEmpty,
  ElTimeline,
  ElTimelineItem,
  ElCard,
  ElLink,
  // v-loading 指令（草稿箱/素材库/发布表单的加载遮罩）
  ElLoading
} from "element-plus";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/display.css";
import * as Icons from "@element-plus/icons-vue";

const components = [
  ElContainer,
  ElContainer.Header,
  ElContainer.Main,
  ElContainer.Aside,
  ElContainer.Footer,

  ElIcon,
  ElButton,
  ElButtonGroup,
  ElMenu,
  ElMenu.MenuItem,
  ElRadio,
  ElRadioGroup,
  ElRadioButton,

  ElInput,
  ElForm,
  ElForm.FormItem,
  ElSelect,
  ElSelectV2,
  ElSelect.OptionGroup,
  ElSelect.Option,
  ElSlider,
  ElTooltip,
  ElMenu,
  ElMenu.MenuItem,
  ElMessage,

  ElTable,
  ElTable.TableColumn,
  ElTag,
  ElTree,
  ElTabPane,
  ElTabs,

  ElUpload,
  ElDialog,
  ElSwitch,
  ElPopover,
  ElPageHeader,
  ElDivider,
  ElScrollbar,
  ElPopconfirm,

  ElDrawer,
  ElDropdown,
  ElDropdown.DropdownMenu,
  ElDropdown.DropdownItem,

  ElCheckbox,
  ElAlert,

  ElEmpty,
  ElTimeline,
  ElTimelineItem,
  ElCard,
  ElLink,
];

export default function (app: any) {
  for (const component of components) {
    app.component(component.name, component);
  }

  // v-loading 指令 + $loading 全局属性（ElLoading.install）
  app.use(ElLoading);

  for (const name in Icons) {
    app.component(name, (Icons as any)[name]);
  }
}
