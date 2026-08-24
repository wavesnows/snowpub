
<template>
  <el-select v-model="value" placeholder="Select" @change="saveHander">
    <el-option
      v-for="item in cities"
      :key="item.value"
      :label="item.label"
      :value="item"
      :type="item.type"
    >
      <span style="float: left">{{ item.label }}</span>
      <span
        style="
          float: right;
          color: var(--el-text-color-secondary);
          font-size: 13px;
        "
        >{{ item.value }}</span
      >
    </el-option>
  </el-select>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { log } from '@/libs/logger'

const value = ref<object>({
    value: 'demo',
    label: 'Beijing',
    type:"B"
  })
const cities = [
  {
    value: 'Beijing',
    label: 'Beijing',
    type:"B"
  },
  {
    value: 'Shanghai',
    label: 'Shanghai',
    type:"B"
  },
  {
    value: 'Nanjing',
    label: 'Nanjing',
    type:"B"
  }
]

function saveHander(value:any){
  log(value )
  /*ttsStore.notebook.current = value.value;
  ttsStore.notebook.currentPath = join(ttsStore.config.savePath,"repos",ttsStore.notebook.current)
  log(ttsStore.notebook.currentPath)
  ttsStore.setNoteBookConfig();
  ttsStore.treeMenu.data = readNotes(ttsStore.notebook.currentPath) // reload file
  */
}
</script>

<!--
<template>
  <div>
    <p>Current Note Repo</p>
    <el-select v-model="value" placeholder="Select Note Repo" @change="saveHander" >
      <el-option-group
        v-for="group in options"
        :key="group.label"
        :label="group.label"
      >
        <el-option
          v-for="item in group.options"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-option-group>
    </el-select>   
  </div>
  </template>
  
  <script lang="ts" setup>
  import { ref } from 'vue'
  import { useTtsStore} from "@/store/store"
  import { readDir,readNotes} from "@/libs/fileHandler"
  import {join} from 'path'
import { log } from '@/libs/logger'

  const ttsStore = useTtsStore();
  const value = ref(ttsStore.notebook.current)
  const options =[
    {
      label: 'Local Note Repo',
      type:'local',
      options: [
        {
          value: 'default',
          label: 'default',
        },
      ],
    },
    {
      label: 'Remote Note Repo',
      type:'github',
      options: [
        {
          value: ttsStore.config.githubRepoName,
          label: ttsStore.config.githubRepoName,
        }
      ],
    },
  ]

 

  </script>


<style scoped>

.options{
  padding-left: 20px;
}


</style>
-->