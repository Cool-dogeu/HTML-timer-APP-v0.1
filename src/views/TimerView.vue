<template>
  <main class="main-container">
    <div class="timer-content-wrapper">
      <TimerDisplay />
      <ConnectionControls />
      <ResultsHistory />
      <ResultsActions />
    </div>
  </main>
</template>

<script setup>
import TimerDisplay from '@/components/timer/TimerDisplay.vue'
import ConnectionControls from '@/components/timer/ConnectionControls.vue'
import ResultsHistory from '@/components/timer/ResultsHistory.vue'
import ResultsActions from '@/components/timer/ResultsActions.vue'
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
