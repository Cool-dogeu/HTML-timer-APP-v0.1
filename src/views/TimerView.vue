<template>
  <main class="main-container">
    <div class="timer-content-wrapper">
      <!-- Left column: Timer and connection controls -->
      <div class="timer-section">
        <TimerDisplay />
        <ConnectionControls />
      </div>

      <!-- Right column: Results history -->
      <ResultsHistory />
    </div>
  </main>
</template>

<script setup>
import TimerDisplay from '@/components/timer/TimerDisplay.vue'
import ConnectionControls from '@/components/timer/ConnectionControls.vue'
import ResultsHistory from '@/components/timer/ResultsHistory.vue'
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
