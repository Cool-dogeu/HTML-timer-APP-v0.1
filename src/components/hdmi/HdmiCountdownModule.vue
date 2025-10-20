<template>
  <div class="mled-module" :class="{ disabled: !hdmiStore.countdown.enabled }">
    <div class="module-toggle">
      <label>
        <input type="checkbox" v-model="hdmiStore.countdown.enabled" />
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
          <select v-model="hdmiStore.countdown.upColor" class="mled-select" :disabled="!hdmiStore.countdown.enabled">
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
          <button @click="hdmiStore.startCountUp" class="btn btn-primary" :disabled="!hdmiStore.countdown.enabled">Start</button>
          <button @click="hdmiStore.stopCountUp" class="btn btn-danger" :disabled="!hdmiStore.countdown.enabled">Stop</button>
        </div>
      </div>

      <!-- Count Down Section -->
      <div class="module-section-container">
        <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
          <label class="module-label">Count down</label>
          <label class="module-section-label">hh</label>
          <input
            v-model.number="hdmiStore.countdown.downHH"
            type="number"
            min="0"
            max="1"
            style="width: 60px;"
            class="mled-select"
            :disabled="!hdmiStore.countdown.enabled"
          />
          <label class="module-label">mm</label>
          <input
            v-model.number="hdmiStore.countdown.downMM"
            type="number"
            min="0"
            max="99"
            style="width: 70px;"
            class="mled-select"
            :disabled="!hdmiStore.countdown.enabled"
          />
          <label class="module-label">ss</label>
          <input
            v-model.number="hdmiStore.countdown.downSS"
            type="number"
            min="0"
            max="59"
            style="width: 70px;"
            class="mled-select"
            :disabled="!hdmiStore.countdown.enabled"
          />
          <label class="module-label" style="margin-left: 1rem;">Color</label>
          <select v-model="hdmiStore.countdown.downColor" class="mled-select" :disabled="!hdmiStore.countdown.enabled">
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
          <select v-model.number="hdmiStore.countdown.downHold" class="mled-select" :disabled="!hdmiStore.countdown.enabled">
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
          <button @click="hdmiStore.startCountDown" class="btn btn-primary" :disabled="!hdmiStore.countdown.enabled">Start</button>
          <button @click="hdmiStore.stopCountDown" class="btn btn-danger" :disabled="!hdmiStore.countdown.enabled">Stop</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useHdmiStore } from '@stores/hdmi'

const hdmiStore = useHdmiStore()
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
