<template>
  <div class="timer-view">
    <h1>Timer View</h1>
    <p>Main timer interface will go here</p>
  </div>
</template>

<script setup>
import { useTimerStore } from '@stores/timer'
import { useSerialStore } from '@stores/serial'
import { useSettingsStore } from '@stores/settings'

const timerStore = useTimerStore()
const serialStore = useSerialStore()
const settingsStore = useSettingsStore()
</script>

<style scoped>
.timer-view {
  padding: 1rem;
}
</style>
