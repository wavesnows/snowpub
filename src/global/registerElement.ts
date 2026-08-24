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
  ElTabs
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
];

export default function (app: any) {
  for (const component of components) {
    app.component(component.name, component);
  }

  for (const name in Icons) {
    app.component(name, (Icons as any)[name]);
  }
}
