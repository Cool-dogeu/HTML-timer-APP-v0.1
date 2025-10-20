<template>
  <div class="mled-module" :class="{ disabled: !mledStore.text.enabled }">
    <div class="module-toggle">
      <label>
        <input
          type="checkbox"
          v-model="mledStore.text.enabled"
          :disabled="!mledStore.isConnected"
        />
        Enable
      </label>
    </div>
    <div class="module-header">MLED TEXT</div>

    <div style="padding: 1rem;">
      <div style="position: relative; margin-bottom: 1rem;">
        <textarea
          v-model="mledStore.text.input"
          class="mled-textarea"
          placeholder="max 64 bytes"
          maxlength="64"
          @input="updateCharCounter"
        ></textarea>
        <div class="char-counter">{{ charsLeft }} left</div>
      </div>

      <!-- Settings row -->
      <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
        <label class="module-label">Scroll speed</label>
        <div class="mled-radio-group">
          <label><input type="radio" v-model="mledStore.text.scrollSpeed" value="0" /> 0</label>
          <label><input type="radio" v-model="mledStore.text.scrollSpeed" value="1" /> 1</label>
          <label><input type="radio" v-model="mledStore.text.scrollSpeed" value="2" /> 2</label>
          <label><input type="radio" v-model="mledStore.text.scrollSpeed" value="3" /> 3</label>
        </div>

        <label class="module-label" style="margin-left: 1rem;">Text color</label>
        <select v-model="mledStore.text.color" class="mled-select">
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
        <button @click="mledStore.sendText" class="btn btn-primary">Send text</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useMledStore } from '@stores/mled'

const mledStore = useMledStore()
const charsLeft = ref(64)

/**
 * Update character counter
 */
function updateCharCounter() {
  charsLeft.value = 64 - (mledStore.text.input?.length || 0)
}

// Watch for text input changes
watch(() => mledStore.text.input, () => {
  updateCharCounter()
}, { immediate: true })
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
