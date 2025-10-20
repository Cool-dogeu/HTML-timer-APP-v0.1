<template>
  <div class="hdmi-view">
    <h1>HDMI View</h1>
    <p>HDMI output controls will go here</p>
  </div>
</template>

<script setup>
import { useHdmiStore } from '@stores/hdmi'
import { useSettingsStore } from '@stores/settings'

const hdmiStore = useHdmiStore()
const settingsStore = useSettingsStore()
</script>

<style scoped>
.hdmi-view {
  padding: 1rem;
}
</style>
