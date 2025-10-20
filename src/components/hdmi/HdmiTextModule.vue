<template>
  <div class="mled-module" :class="{ disabled: !hdmiStore.text.enabled }">
    <div class="module-toggle">
      <label>
        <input type="checkbox" v-model="hdmiStore.text.enabled" />
        Enable
      </label>
    </div>
    <div class="module-header">HDMI TEXT</div>

    <div style="padding: 1rem;">
      <div style="position: relative; margin-bottom: 1rem;">
        <textarea
          v-model="hdmiStore.text.input"
          class="mled-textarea"
          placeholder="max 64 bytes"
          maxlength="64"
          @input="updateCharCounter"
        ></textarea>
        <div class="char-counter">{{ charsLeft }} left</div>
      </div>

      <!-- Settings row -->
      <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
        <label class="module-label">Text color</label>
        <select v-model="hdmiStore.text.color" class="mled-select">
          <option value="Default">Default</option>
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

      <!-- Buttons row -->
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <button @click="hdmiStore.sendText" class="btn btn-primary">Send text</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useHdmiStore } from '@stores/hdmi'

const hdmiStore = useHdmiStore()
const charsLeft = ref(64)

/**
 * Update character counter
 */
function updateCharCounter() {
  charsLeft.value = 64 - (hdmiStore.text.input?.length || 0)
}

// Watch for text input changes
watch(() => hdmiStore.text.input, () => {
  updateCharCounter()
}, { immediate: true })
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
