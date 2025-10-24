<template>
  <div id="app" v-cloak :class="{ 'dark-mode': settingsStore.isDarkMode }">
    <AppHeader />
    <div class="app-content-wrapper">
      <TabNavigation />
      <router-view></router-view>
    </div>
    <DebugConsole v-if="serialStore.showDebugConsole" />
    <DebugToggle />

    <!-- Modals -->
    <SettingsModal v-if="settingsStore.showSettings" />
    <InfoModal v-if="settingsStore.showInfo" />
    <ClearConfirmationModal v-if="settingsStore.showClearConfirmation" />
    <RefreshConfirmationModal v-if="settingsStore.showRefreshConfirmation" />
    <DisconnectionModal v-if="serialStore.showConnectionLostModal" />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useSettingsStore } from '@stores/settings'
import { useSerialStore } from '@stores/serial'
import { useMledStore } from '@stores/mled'
import { useHdmiStore } from '@stores/hdmi'
import { useAlgeStore } from '@stores/alge'
import AppHeader from '@components/common/AppHeader.vue'
import TabNavigation from '@components/common/TabNavigation.vue'
import DebugConsole from '@components/common/DebugConsole.vue'
import DebugToggle from '@components/common/DebugToggle.vue'
import SettingsModal from '@/components/modals/SettingsModal.vue'
import InfoModal from '@/components/modals/InfoModal.vue'
import ClearConfirmationModal from '@/components/modals/ClearConfirmationModal.vue'
import RefreshConfirmationModal from '@/components/modals/RefreshConfirmationModal.vue'
import DisconnectionModal from '@/components/modals/DisconnectionModal.vue'

const settingsStore = useSettingsStore()
const serialStore = useSerialStore()
const mledStore = useMledStore()
const hdmiStore = useHdmiStore()
const algeStore = useAlgeStore()

// Initialize all stores
onMounted(() => {
  settingsStore.initialize()
  mledStore.initialize()
  hdmiStore.initialize()
  algeStore.initialize()

  // Auto-reconnect to previously authorized devices
  serialStore.autoReconnect()
  mledStore.autoReconnect()
  algeStore.autoReconnect()
})
</script>

<style>
/* Global app styles are imported in main.js */
</style>
