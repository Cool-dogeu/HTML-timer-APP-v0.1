<template>
  <div class="mled-module" :class="{ disabled: !mledStore.countdown.enabled }">
    <div class="module-toggle">
      <label>
        <input
          type="checkbox"
          v-model="mledStore.countdown.enabled"
          :disabled="!mledStore.isConnected"
        />
        Enable
      </label>
    </div>
    <div class="module-header">Countdown</div>

    <div style="padding: 1rem;">
      <!-- Count Up Section -->
      <div style="margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
          <label class="module-label">Count up</label>
          <label class="module-label" style="margin-left: 1rem;">Color</label>
          <select v-model="mledStore.countdown.upColor" class="mled-select" :disabled="!mledStore.countdown.enabled">
            <option value="Red">Red</option>
            <option value="Green">Green</option>
            <option value="Blue">Blue</option>
            <option value="Yellow">Yellow</option>
            <option value="Magenta">Magenta</option>
            <option value="Cyan">Cyan</option>
            <option value="White">White</option>
            <option value="Orange">Orange</option>
            <option value="Deep pink">Deep pink</option>
            <option value="Light Blue">Light Blue</option>
          </select>
        </div>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <button @click="mledStore.startCountUp" class="btn btn-primary" :disabled="!mledStore.countdown.enabled">Start</button>
          <button @click="mledStore.stopCountUp" class="btn btn-danger" :disabled="!mledStore.countdown.enabled">Stop</button>
        </div>
      </div>

      <!-- Count Down Section -->
      <div class="module-section-container">
        <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
          <label class="module-label">Count down</label>
          <label class="module-section-label">hh</label>
          <input
            v-model.number="mledStore.countdown.downHH"
            type="number"
            min="0"
            max="1"
            style="width: 60px;"
            class="mled-select"
            :disabled="!mledStore.countdown.enabled"
          />
          <label class="module-label">mm</label>
          <input
            v-model.number="mledStore.countdown.downMM"
            type="number"
            min="0"
            max="99"
            style="width: 70px;"
            class="mled-select"
            :disabled="!mledStore.countdown.enabled"
          />
          <label class="module-label">ss</label>
          <input
            v-model.number="mledStore.countdown.downSS"
            type="number"
            min="0"
            max="59"
            style="width: 70px;"
            class="mled-select"
            :disabled="!mledStore.countdown.enabled"
          />
          <label class="module-label" style="margin-left: 1rem;">Color</label>
          <select v-model="mledStore.countdown.downColor" class="mled-select" :disabled="!mledStore.countdown.enabled">
            <option value="Red">Red</option>
            <option value="Green">Green</option>
            <option value="Blue">Blue</option>
            <option value="Yellow">Yellow</option>
            <option value="Magenta">Magenta</option>
            <option value="Cyan">Cyan</option>
            <option value="White">White</option>
            <option value="Orange">Orange</option>
            <option value="Deep pink">Deep pink</option>
            <option value="Light Blue">Light Blue</option>
          </select>
          <label class="module-label" style="margin-left: 1rem;">Hold</label>
          <select v-model.number="mledStore.countdown.downHold" class="mled-select" :disabled="!mledStore.countdown.enabled">
            <option :value="1">1 s</option>
            <option :value="3">3 s</option>
            <option :value="5">5 s</option>
            <option :value="10">10 s</option>
            <option :value="15">15 s</option>
            <option :value="20">20 s</option>
            <option :value="30">30 s</option>
            <option :value="60">60 s</option>
          </select>
        </div>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <button @click="mledStore.startCountDown" class="btn btn-primary" :disabled="!mledStore.countdown.enabled">Start</button>
          <button @click="mledStore.stopCountDown" class="btn btn-danger" :disabled="!mledStore.countdown.enabled">Stop</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useMledStore } from '@stores/mled'

const mledStore = useMledStore()
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
