<template>
  <button
    @click="serialStore.toggleDebugConsole"
    class="debug-toggle"
    :class="{ active: serialStore.showDebugConsole }"
    title="Toggle Debug Console"
  >
    <i class="material-icons">
      {{ serialStore.showDebugConsole ? 'bug_report' : 'code' }}
    </i>
  </button>
</template>

<script setup>
import { useSerialStore } from '@stores/serial'

const serialStore = useSerialStore()
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
