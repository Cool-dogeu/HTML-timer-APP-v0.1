<template>
  <div class="mled-module" :class="{ disabled: !hdmiStore.textEnabled }">
    <div class="module-toggle">
      <label>
        <input type="checkbox" v-model="hdmiStore.textEnabled" />
        Enable
      </label>
    </div>
    <div class="module-header">HDMI TEXT</div>

    <div style="padding: 1rem;">
      <div style="position: relative; margin-bottom: 1rem;">
        <textarea
          v-model="hdmiStore.textInput"
          class="mled-textarea"
          placeholder="max 64 bytes"
          maxlength="64"
          @input="updateCharCounter"
        ></textarea>
        <div class="char-counter">{{ charsLeft }} left</div>
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
  charsLeft.value = 64 - (hdmiStore.textInput?.length || 0)
}

// Watch for text input changes
watch(() => hdmiStore.textInput, () => {
  updateCharCounter()
}, { immediate: true })
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
