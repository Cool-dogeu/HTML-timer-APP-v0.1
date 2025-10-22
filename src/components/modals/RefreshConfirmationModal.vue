<template>
  <div v-if="settingsStore.showRefreshConfirmation" class="modal-backdrop" @click="settingsStore.cancelRefresh">
    <div class="modal confirmation-modal" @click.stop>
      <h2>Refresh Page</h2>
      <p v-if="timerStore.isRunning">
        <strong>Warning:</strong> The timer is currently running. Refreshing
        will stop the current run and the time will be lost.
      </p>
      <p v-else>
        Are you sure you want to refresh the page? Any unsaved changes will
        be lost.
      </p>
      <div class="modal-buttons">
        <button @click="settingsStore.refreshPage" class="btn btn-danger">
          {{ timerStore.isRunning ? 'Stop Timer & Refresh' : 'Refresh Page' }}
        </button>
        <button @click="settingsStore.cancelRefresh" class="btn btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useSettingsStore } from '@stores/settings'
import { useTimerStore } from '@stores/timer'

const settingsStore = useSettingsStore()
const timerStore = useTimerStore()
</script>
