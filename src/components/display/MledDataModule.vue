<template>
  <div class="mled-module" :class="{ disabled: !mledStore.dataEnabled }">
    <div class="module-toggle">
      <label>
        <input
          type="checkbox"
          v-model="mledStore.dataEnabled"
          :disabled="!mledStore.isConnected"
        />
        Enable
      </label>
    </div>
    <div class="module-header">ONLINA DATA INTEGRATOR</div>

    <div style="padding: 1rem;">
      <!-- JSON URL Section -->
      <div class="module-section-container" style="margin-bottom: 1.5rem;">
        <label class="module-label" style="display: block; margin-bottom: 0.5rem;">JSON URL:</label>
        <input
          v-model="mledStore.dataUrl"
          type="text"
          placeholder="https://www.smarteragilitysecretary.com/api/ring-jumbotron?key=...&token=..."
          class="mled-select"
          style="width: 100%; font-size: 0.85rem;"
          :disabled="!mledStore.dataEnabled"
        />
        <small style="color: #888; font-size: 0.75rem; display: block; margin-top: 0.25rem;">
          Paste full smarteragilitysecretary.com URL - will be auto-proxied to avoid CORS
        </small>
        <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
          <button
            @click="mledStore.toggleDataAutoUpdate"
            class="btn"
            :class="mledStore.dataAutoUpdate ? 'btn-danger' : 'btn-primary'"
            style="flex: 1;"
            :disabled="!mledStore.dataEnabled || !mledStore.dataUrl"
          >
            {{ mledStore.dataAutoUpdate ? 'Stop Auto-Update' : 'Start Auto-Update' }}
          </button>
        </div>

        <div class="module-section-label" style="font-size: 0.85rem; margin-top: 0.75rem;">
          {{ mledStore.dataStatus }}
        </div>
      </div>

      <!-- Zone 1: Dorsal/Draw Number -->
      <div class="module-section-container" style="margin-bottom: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <label class="module-label" style="min-width: 120px;">Dorsal (000-999)</label>
          <input
            v-model="mledStore.dataDorsal"
            type="text"
            placeholder="000-999"
            maxlength="3"
            pattern="\d{1,3}"
            class="mled-select"
            style="flex: 1; min-width: 120px;"
            :disabled="!mledStore.dataEnabled"
          />
          <label class="module-label">Line</label>
          <select v-model.number="mledStore.dataLine1" class="mled-select" style="width: 72px;" :disabled="!mledStore.dataEnabled">
            <option v-for="n in 15" :key="n" :value="n">{{ n }}</option>
          </select>
          <button @click="sendZ1" class="btn btn-success" style="min-width: 80px;" :disabled="!mledStore.dataEnabled || !mledStore.dataDorsal">Send</button>
        </div>
      </div>

      <!-- Zone 2: Handler & Dog -->
      <div class="module-section-container" style="margin-bottom: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <label class="module-label" style="min-width: 120px;">Handler / Dog</label>
          <input
            v-model="mledStore.dataHandler"
            type="text"
            placeholder="Handler"
            class="mled-select"
            style="flex: 1; min-width: 120px;"
            :disabled="!mledStore.dataEnabled"
          />
          <input
            v-model="mledStore.dataDog"
            type="text"
            placeholder="Dog"
            class="mled-select"
            style="flex: 1; min-width: 120px;"
            :disabled="!mledStore.dataEnabled"
          />
          <label class="module-label">Line</label>
          <select v-model.number="mledStore.dataLine2" class="mled-select" style="width: 72px;" :disabled="!mledStore.dataEnabled">
            <option v-for="n in 15" :key="n" :value="n">{{ n }}</option>
          </select>
          <button @click="sendZ2" class="btn btn-success" style="min-width: 80px;" :disabled="!mledStore.dataEnabled">Send</button>
        </div>
      </div>

      <!-- Zone 3: Faults, Refusals, Elimination -->
      <div class="module-section-container" style="margin-bottom: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <label class="module-label" style="min-width: 120px;">F / R / E</label>
          <input
            v-model.number="mledStore.dataFaults"
            type="number"
            min="0"
            step="1"
            placeholder="Faults"
            class="mled-select"
            style="width: 90px;"
            :disabled="!mledStore.dataEnabled"
          />
          <input
            v-model.number="mledStore.dataRefusals"
            type="number"
            min="0"
            max="3"
            step="1"
            placeholder="Refusals"
            class="mled-select"
            style="width: 90px;"
            :disabled="!mledStore.dataEnabled"
          />
          <input
            v-model="elimInput"
            type="text"
            placeholder="0/1/yes/no"
            class="mled-select"
            style="width: 110px;"
            :disabled="!mledStore.dataEnabled"
          />
          <label class="module-label">Line</label>
          <select v-model.number="mledStore.dataLine3" class="mled-select" style="width: 72px;" :disabled="!mledStore.dataEnabled">
            <option v-for="n in 15" :key="n" :value="n">{{ n }}</option>
          </select>
          <button @click="sendZ3" class="btn btn-success" style="min-width: 80px;" :disabled="!mledStore.dataEnabled">Send</button>
        </div>
      </div>

      <!-- Zone 4: Country -->
      <div class="module-section-container">
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <label class="module-label" style="min-width: 120px;">Country</label>
          <input
            v-model="mledStore.dataCountry"
            type="text"
            placeholder="Country"
            class="mled-select"
            style="flex: 1; min-width: 120px;"
            :disabled="!mledStore.dataEnabled"
          />
          <label class="module-label">Line</label>
          <select v-model.number="mledStore.dataLine4" class="mled-select" style="width: 72px;" :disabled="!mledStore.dataEnabled">
            <option v-for="n in 15" :key="n" :value="n">{{ n }}</option>
          </select>
          <button @click="sendZ4" class="btn btn-success" style="min-width: 80px;" :disabled="!mledStore.dataEnabled">Send</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useMledStore } from '@stores/mled'

const mledStore = useMledStore()

// Elimination input handling (converts yes/no/true/false/1/0 to boolean)
const elimInput = ref('0')

// Watch elim input and update store
watch(elimInput, (newVal) => {
  const val = String(newVal).trim().toLowerCase()
  mledStore.dataElim = val === '1' || val === 'yes' || val === 'true'
})

// Watch store elim and update input
watch(() => mledStore.dataElim, (newVal) => {
  elimInput.value = newVal ? '1' : '0'
}, { immediate: true })

/**
 * Send Zone 1 data (Dorsal)
 */
async function sendZ1() {
  if (!mledStore.dataDorsal) return

  const dorsal = mledStore.dataDorsal.toString().replace(/\D/g, '')
  if (!dorsal) return

  const payload = `^cp 1 4 7^${dorsal}`
  await mledStore.sendFrame(mledStore.dataLine1, mledStore.brightness, payload)
}

/**
 * Send Zone 2 data (Handler & Dog)
 * Format matches displayold/index.html: handler in color 7, dog in color 8
 */
async function sendZ2() {
  const handler = (mledStore.dataHandler || '').trim()
  const dog = (mledStore.dataDog || '').trim()

  if (!handler && !dog) return

  let payload = ''
  if (handler || dog) {
    const hl = handler.length + 1
    const dl = dog.length
    // Format: handler in color 7 (white), dog in color 8 (orange)
    payload = `^cp 1 ${hl} 7^${handler} ^cp ${hl} ${hl + dl} 8^${dog}`

    // If too long, just show handler truncated
    if (payload.length > 64) {
      payload = `^cs 7^${handler.slice(0, 58)}`
    }
  }

  // Clear line first, then send payload
  await mledStore.sendFrame(mledStore.dataLine2, mledStore.brightness, '')
  if (payload) {
    await mledStore.sendFrame(mledStore.dataLine2, mledStore.brightness, payload)
  }
}

/**
 * Send Zone 3 data (Faults, Refusals, Elimination)
 * Format matches displayold/index.html: special DIS format or F/R with colors
 */
async function sendZ3() {
  const f = Number(mledStore.dataFaults || 0)
  let r = Number(mledStore.dataRefusals || 0)
  const elim = mledStore.dataElim

  // Validate and cap refusals
  if (!Number.isInteger(r) || r < 0) r = 0
  if (r > 3) {
    r = 3
    mledStore.dataRefusals = 3
  }

  let payload = ''
  if (elim) {
    // When eliminated, show "DIS" with special formatting
    payload = '^fd 5 1^^cp 1 10 1^  DIS^ic 3 1 2^^ic 3 1 11^'
  } else {
    // Format: F in color 2 (green) if 0, color 1 (red) if faults
    //         R in color 2 (green) if 0, color 1 (red) if refusals
    const fd = (!f) ? '^cp 1 2 2^ F^ic 3 2^^cp 3 5 2^' : `^cp 1 3 1^ F${f} `
    const rd = (!r) ? '^cp 4 5 2^R^ic 3 2^' : `^cp 5 9 1^R${r}`
    payload = fd + rd
  }

  await mledStore.sendFrame(mledStore.dataLine3, mledStore.brightness, payload)
}

/**
 * Send Zone 4 data (Country)
 * Format matches displayold/index.html: ^cp 1 3 7^ with country text
 */
async function sendZ4() {
  const country = (mledStore.dataCountry || '').trim()

  // Clear line first, then send payload (matches displayold/index.html)
  await mledStore.sendFrame(mledStore.dataLine4, mledStore.brightness, '')
  const payload = country ? `^cp 1 3 7^${country}` : '^cp 1 3 7^'
  await mledStore.sendFrame(mledStore.dataLine4, mledStore.brightness, payload)
}
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
