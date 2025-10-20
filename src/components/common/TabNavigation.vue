<template>
  <div class="tabs-container">
    <div class="tabs-header">
      <router-link
        v-for="tab in tabs"
        :key="tab.name"
        :to="{ name: tab.name }"
        custom
        v-slot="{ navigate, isActive }"
      >
        <button
          @click="navigate"
          class="tab-button"
          :class="{ active: isActive }"
        >
          <span class="tab-status-led" :class="tab.statusClass"></span>
          <i class="material-icons" style="vertical-align: middle; font-size: 20px;">{{ tab.icon }}</i>
          {{ tab.label }}
        </button>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSerialStore } from '@stores/serial'
import { useMledStore } from '@stores/mled'
import { useHdmiStore } from '@stores/hdmi'

const serialStore = useSerialStore()
const mledStore = useMledStore()
const hdmiStore = useHdmiStore()

// Define tabs with their routes, labels, icons, and status
const tabs = computed(() => [
  {
    name: 'timer',
    label: 'Timer',
    icon: 'timer',
    statusClass: serialStore.isConnected ? 'status-ok' : 'status-error'
  },
  {
    name: 'display',
    label: 'FDS Display',
    icon: 'tv',
    statusClass: mledStore.isConnected ? 'status-ok' : 'status-error'
  },
  {
    name: 'hdmi',
    label: 'HDMI Display',
    icon: 'cast',
    statusClass: hdmiStore.isWindowOpen ? 'status-ok' : 'status-error'
  }
])
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
