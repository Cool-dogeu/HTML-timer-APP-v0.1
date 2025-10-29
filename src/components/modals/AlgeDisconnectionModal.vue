<template>
  <div v-if="algeStore.showConnectionLostModal" class="modal-backdrop" @click.stop>
    <div class="modal disconnection-modal" @click.stop>
      <h2>Alge GAZ Display Disconnected</h2>

      <div class="disconnect-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
          <line x1="12" y1="2" x2="12" y2="12"></line>
        </svg>
      </div>

      <p class="disconnect-message">
        The Alge GAZ display has been disconnected. This may be due to:
      </p>

      <ul class="disconnect-reasons">
        <li>USB cable was unplugged</li>
        <li>Display device was powered off</li>
        <li>Computer USB port lost power</li>
        <li>Connection was interrupted</li>
      </ul>

      <div class="modal-buttons">
        <button
          @click="handleReconnect"
          class="btn btn-primary"
          :disabled="reconnecting"
        >
          {{ reconnecting ? 'Reconnecting...' : 'Reconnect' }}
        </button>
        <button
          @click="handleClose"
          class="btn btn-secondary"
          :disabled="reconnecting"
        >
          Close
        </button>
      </div>

      <p v-if="reconnectError" class="error-message">
        {{ reconnectError }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAlgeStore } from '@stores/alge'

const algeStore = useAlgeStore()
const reconnecting = ref(false)
const reconnectError = ref('')

async function handleReconnect() {
  reconnecting.value = true
  reconnectError.value = ''

  try {
    // Use normal connect flow which triggers device selection dialog
    await algeStore.connect()

    // Successfully connected
    algeStore.showConnectionLostModal = false
  } catch (error) {
    console.error('Reconnection error:', error)

    // User likely cancelled the device selection dialog
    if (error.name === 'NotFoundError' || error.message.includes('No port selected')) {
      reconnectError.value = 'Device selection cancelled. Please try again to reconnect.'
    } else {
      reconnectError.value = `Connection failed: ${error.message}`
    }
  } finally {
    reconnecting.value = false
  }
}

function handleClose() {
  algeStore.showConnectionLostModal = false
  reconnectError.value = ''
}
</script>

<style scoped>
.disconnection-modal {
  max-width: 500px;
  text-align: center;
}

.disconnect-icon {
  margin: 1.5rem auto;
  color: #f44336;
}

.disconnect-message {
  font-size: 1rem;
  margin: 1rem 0 0.5rem;
  color: var(--text-primary);
}

.disconnect-reasons {
  text-align: left;
  margin: 0.5rem auto 1.5rem;
  max-width: 350px;
  list-style-type: disc;
  padding-left: 1.5rem;
}

.disconnect-reasons li {
  margin: 0.5rem 0;
  color: var(--text-secondary);
}

.modal-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1.5rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #2196f3;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1976d2;
}

.btn-secondary {
  background-color: #757575;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #616161;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: #ffebee;
  color: #c62828;
  border-radius: 4px;
  font-size: 0.9rem;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .error-message {
    background-color: rgba(244, 67, 54, 0.2);
    color: #ef5350;
  }
}
</style>
