<template>
    <div class="nside">
      <el-menu
        :default-active="page.asideIndex"
        class="el-menu-vertical-demo"
        @select="menuChange"
      >
        <el-menu-item index="1">
          <el-icon><notebook/></el-icon>
          <span></span>
        </el-menu-item>
        <el-menu-item index="2">
          <el-icon><StarFilled /></el-icon>
          <span></span>
        </el-menu-item>
        <el-menu-item index="3">
          <el-icon><Clock /></el-icon>
          <span></span>
        </el-menu-item>
        <el-menu-item index="4">
          <el-icon><MagicStick /></el-icon>
          <span></span>
        </el-menu-item>
      <!-- <el-menu-item index="3">
          <el-icon><Files /></el-icon>
          <span></span>
        </el-menu-item>
        <el-menu-item index="4">
          <el-icon><Menu /></el-icon>
          <span></span>
        </el-menu-item>-->
      </el-menu>
        <!--<el-divider class="divider"/>-->
      <div class="bottom-btns">
        <el-tooltip content="Home" placement="right">
          <div class="home-btn" @click="goHome">
            <el-icon><House /></el-icon>
          </div>
        </el-tooltip>
        <AConf/>
      </div>
    </div>
  </template>

  <script setup lang="ts">
  import { useTtsStore } from "@/store/store";
  import { storeToRefs } from "pinia";
  import AConf from "./AConfig.vue";
  import { StarFilled, Clock, House, MagicStick } from '@element-plus/icons-vue';

  const ttsStore = useTtsStore();
  const { page, config } = storeToRefs(ttsStore);

  const menuChange = (index: any) => {
    ttsStore.page.asideIndex = index.toString();
  };

  function goHome() {
    ttsStore.cnote.lastPath = '';
    ttsStore.inputs.notePath = '';
  }
  </script>
  
  <style scoped>
  .nside {
    height: 100%;
    width: 35px !important;
    background-color: #ccc;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border-bottom-left-radius: 10px;
  }
  .divider{
    width: 60%;
    margin: 0 7px;
  }
  .el-menu {
    border-right: unset !important;
    background-color: transparent;
  }
  .el-menu-item {
    box-sizing: border-box;
    border-color: var(--el-menu-active-color);
    padding-left: 5px !important;
    padding-right: 5px;
    height: 40px !important;
  }
  .is-active {
    border-left: 2px solid;
  }
  .bottom-btns {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 8px;
  }

  .home-btn {
    width: 35px;
    height: 35px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #909399;
    transition: color 0.2s;
    -webkit-app-region: no-drag;
  }

  .home-btn:hover {
    color: #409eff;
  }

  </style>
  