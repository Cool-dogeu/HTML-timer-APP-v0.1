<template>
  <div v-if="settingsStore.showClearConfirmation" class="modal-backdrop" @click="settingsStore.cancelClearResults">
    <div class="modal confirmation-modal" @click.stop>
      <h2>Clear Results</h2>
      <p>
        Are you sure you want to clear all results? This action cannot be
        undone.
      </p>
      <div class="modal-buttons">
        <button @click="handleClearResults" class="btn btn-danger">
          Clear All Results
        </button>
        <button @click="settingsStore.cancelClearResults" class="btn btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useSettingsStore } from '@stores/settings';
import { useTimerStore } from '@stores/timer';

const settingsStore = useSettingsStore();
const timerStore = useTimerStore();

const handleClearResults = () => {
  timerStore.clearResults();
  settingsStore.confirmClearResults();
};
</script>
