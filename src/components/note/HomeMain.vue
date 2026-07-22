<template>
  <div class="main" :class="{ welcome: !hasNote }">
    <MarkdownEditor v-if="hasNote" />
    <Welcome v-else />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTtsStore } from '@/store/store'
import { storeToRefs } from 'pinia'
import MarkdownEditor from '../note/MarkdownEditor.vue'
import Welcome from '../note/Welcome.vue'

const store = useTtsStore()
const { cnote } = storeToRefs(store)

const hasNote = computed(() => !!cnote.value.lastPath)
</script>

<style scoped>
.main {
  width: 100%;
  height: 100%;
  margin-top: 0px;
  scroll-behavior: smooth;
  overscroll-behavior: none;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.main.welcome {
  overflow-y: hidden;
}
</style>
