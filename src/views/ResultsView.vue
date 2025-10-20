<template>
  <div class="results-view">
    <h1>Results View</h1>
    <p>Results history will go here</p>
  </div>
</template>

<script setup>
import { useTimerStore } from '@stores/timer'
import { useSettingsStore } from '@stores/settings'

const timerStore = useTimerStore()
const settingsStore = useSettingsStore()
</script>

<style scoped>
.results-view {
  padding: 1rem;
}
</style>
