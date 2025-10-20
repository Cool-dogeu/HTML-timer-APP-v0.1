<template>
  <div class="display-view">
    <h1>Display View</h1>
    <p>MLED display controls will go here</p>
  </div>
</template>

<script setup>
import { useMledStore } from '@stores/mled'
import { useSettingsStore } from '@stores/settings'

const mledStore = useMledStore()
const settingsStore = useSettingsStore()
</script>

<style scoped>
.display-view {
  padding: 1rem;
}
</style>
