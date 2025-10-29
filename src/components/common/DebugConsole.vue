<template>
  <div v-if="serialStore.showDebugConsole" class="debug-console">
    <div class="debug-header">
      <h3>Debug Console</h3>
      <button @click="serialStore.clearDebugConsole" class="btn btn-small">
        Clear
      </button>
    </div>
    <div class="debug-content">
      <div class="debug-section">
        <h4>Test Runner:</h4>
        <div class="test-controls">
          <button
            @click="serialStore.startTestRuns"
            :disabled="serialStore.testRunning"
            class="btn btn-small btn-primary"
          >
            Start Test Runs
          </button>
          <button
            @click="serialStore.stopTestRuns"
            :disabled="!serialStore.testRunning"
            class="btn btn-small btn-danger"
          >
            Stop Test Runs
          </button>
          <button
            @click="serialStore.simulateRTTestRun"
            :disabled="timerStore.isRunning"
            class="btn btn-small btn-secondary"
          >
            Test RT Signal
          </button>
          <button
            @click="serialStore.simulateLongTimeTest"
            :disabled="timerStore.isRunning"
            class="btn btn-small btn-secondary"
          >
            Test Long Time (>1min)
          </button>
          <span class="test-status">
            {{ serialStore.testRunning ? 'Running automated tests...' : 'Test runner stopped' }}
          </span>
        </div>
      </div>
      <div class="debug-section">
        <h4>Raw Data Buffer (last 1000 chars):</h4>
        <pre>{{ serialStore.rawDataBuffer || 'No data received yet...' }}</pre>
      </div>
      <div class="debug-section">
        <h4>Debug Messages:</h4>
        <div class="debug-messages">
          <div
            v-for="(msg, index) in serialStore.debugMessages"
            :key="index"
            class="debug-message"
          >
            {{ msg }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useSerialStore } from '@stores/serial'
import { useTimerStore } from '@stores/timer'

const serialStore = useSerialStore()
const timerStore = useTimerStore()
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
