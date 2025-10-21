<template>
  <div v-if="settingsStore.showCompactTimer" class="modal-backdrop" @click="settingsStore.closeCompactTimer">
    <div class="modal compact-timer-modal" @click.stop>
      <h2>Latest Result</h2>
      <div
        class="compact-timer-display"
        :class="{ running: timerStore.isRunning }"
        @dblclick="handleCopy"
        title="Double-click to copy"
      >
        <div class="compact-timer-value">{{ timerStore.displayTime }}</div>
        <div class="compact-timer-status">{{ timerStore.timerStatus }}</div>
      </div>
      <div class="modal-buttons">
        <button
          @click="handleCopy"
          class="btn btn-primary"
          :class="{ 'copy-success': copyButtonEffect }"
        >
          <i class="material-icons"
            >{{ copyButtonEffect ? 'check' : 'content_copy' }}</i
          >
          {{ copyButtonEffect ? 'Copied!' : 'Copy' }}
        </button>
        <button @click="settingsStore.closeCompactTimer" class="btn btn-secondary">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useSettingsStore } from '@stores/settings';
import { useTimerStore } from '@stores/timer';

const settingsStore = useSettingsStore();
const timerStore = useTimerStore();
const copyButtonEffect = ref(false);

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(timerStore.displayTime);
    copyButtonEffect.value = true;
    setTimeout(() => {
      copyButtonEffect.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};
</script>
