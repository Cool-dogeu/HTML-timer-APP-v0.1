<template>
  <div v-if="settingsStore.showSettings" class="modal-backdrop" @click="handleCancel">
    <div class="modal settings-modal" @click.stop>
      <h2>Settings</h2>

      <div class="settings-section">
        <h3>API Integration</h3>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="tempSettings.apiEnabled" />
            Enable API Integration
          </label>
        </div>

        <div v-if="tempSettings.apiEnabled" class="api-settings">
          <div class="form-group">
            <label for="apiProvider">API Provider</label>
            <select
              id="apiProvider"
              v-model="tempSettings.apiProvider"
              class="form-control"
              @change="updateApiEndpoint"
            >
              <option value="agigames">agigames.cz</option>
              <option value="other">Other (Custom URL)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="apiEndpoint">API Endpoint URL</label>
            <input
              type="text"
              id="apiEndpoint"
              v-model="tempSettings.apiEndpoint"
              class="form-control"
              :placeholder="tempSettings.apiProvider === 'agigames' ? 'URL will be auto-generated' : 'https://example.com/api?apikey=[key]&time=[time_no_decimal]&status=[status]'"
              :readonly="tempSettings.apiProvider === 'agigames'"
              :class="{ 'readonly': tempSettings.apiProvider === 'agigames' }"
            />
            <small class="form-help">
              <span v-if="tempSettings.apiProvider === 'agigames'">
                Using agigames.cz preset with parameters:
                <strong>[key]</strong>, <strong>[status]</strong>,
                <strong>[time_no_decimal]</strong>,
                <strong>[decimals]</strong>
              </span>
              <span v-else>
                You can use placeholders: <strong>[key]</strong>,
                <strong>[time]</strong>, <strong>[time_no_decimal]</strong>,
                <strong>[decimals]</strong>, <strong>[status]</strong>,
                <strong>[timestamp]</strong>
              </span>
            </small>
          </div>

          <div class="form-group">
            <label for="apiMethod">HTTP Method</label>
            <select
              id="apiMethod"
              v-model="tempSettings.apiMethod"
              class="form-control"
            >
              <option value="POST">POST</option>
            </select>
          </div>

          <div class="form-group">
            <label for="apiKey">API Key</label>
            <div style="position: relative">
              <input
                :type="showApiKey ? 'text' : 'password'"
                id="apiKey"
                v-model="tempSettings.apiKey"
                class="form-control"
                placeholder="Enter your API key"
                style="padding-right: 40px"
              />
              <button
                type="button"
                @click="showApiKey = !showApiKey"
                style="
                  position: absolute;
                  right: 10px;
                  top: 50%;
                  transform: translateY(-50%);
                  background: transparent;
                  border: none;
                  cursor: pointer;
                  padding: 5px;
                "
              >
                <span v-if="showApiKey">🙈</span>
                <span v-else>👁️</span>
              </button>
            </div>
          </div>

          <div class="form-group">
            <button
              @click="testApiConnection"
              class="btn btn-secondary"
              :disabled="!tempSettings.apiEndpoint || apiTestInProgress"
            >
              <i class="material-icons"
                >{{ apiTestInProgress ? 'hourglass_empty' : 'wifi_tethering'
                }}</i
              >
              {{ apiTestInProgress ? 'Testing...' : 'Test Connection' }}
            </button>
            <span
              v-if="apiTestResult"
              class="api-test-result"
              :class="{ 'success': apiTestResult.success, 'error': !apiTestResult.success }"
            >
              {{ apiTestResult.message }}
            </span>
          </div>

          <h4>Status Code Mapping</h4>
          <div class="form-group">
            <div style="display: flex; align-items: center; gap: 10px">
              <input
                type="checkbox"
                id="enableStartedApi"
                v-model="tempSettings.apiStartedEnabled"
                class="form-control"
                style="width: auto"
              />
              <label for="enableStartedApi" style="margin: 0"
                >Timer Started (Dog begins)</label
              >
            </div>
            <input
              type="number"
              id="statusStarted"
              v-model="tempSettings.statusMappings.started"
              class="form-control"
              placeholder="3"
              :disabled="!tempSettings.apiStartedEnabled"
            />
          </div>

          <div class="form-group">
            <div style="display: flex; align-items: center; gap: 10px">
              <input
                type="checkbox"
                id="enableFinishedApi"
                v-model="tempSettings.apiFinishedEnabled"
                class="form-control"
                style="width: auto"
              />
              <label for="enableFinishedApi" style="margin: 0"
                >Timer Finished (Result)</label
              >
            </div>
            <input
              type="number"
              id="statusFinished"
              v-model="tempSettings.statusMappings.finished"
              class="form-control"
              placeholder="4"
              :disabled="!tempSettings.apiFinishedEnabled"
            />
          </div>
        </div>
      </div>

      <div class="modal-buttons">
        <button @click="handleSave" class="btn btn-primary">
          Save Settings
        </button>
        <button @click="handleCancel" class="btn btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useSettingsStore } from '@stores/settings';

const settingsStore = useSettingsStore();

const tempSettings = ref({
  apiEnabled: false,
  apiProvider: 'agigames',
  apiEndpoint: '',
  apiMethod: 'POST',
  apiKey: '',
  apiStartedEnabled: false,
  apiFinishedEnabled: false,
  statusMappings: {
    started: 3,
    finished: 4
  }
});

const showApiKey = ref(false);
const apiTestInProgress = ref(false);
const apiTestResult = ref(null);

// Watch for modal opening to clone settings
watch(() => settingsStore.showSettings, (newValue) => {
  if (newValue) {
    // Clone current settings when modal opens
    tempSettings.value = JSON.parse(JSON.stringify(settingsStore.settings));
    apiTestResult.value = null;
  }
});

const updateApiEndpoint = () => {
  if (tempSettings.value.apiProvider === 'agigames') {
    tempSettings.value.apiEndpoint = 'https://new.agigames.cz/api/api_timer.php?apikey=[key]&status=[status]&time=[time_no_decimal]&dec=[decimals]';
  }
};

const testApiConnection = async () => {
  apiTestInProgress.value = true;
  apiTestResult.value = null;

  try {
    // Replace placeholders with test values
    let testUrl = tempSettings.value.apiEndpoint
      .replace('[key]', tempSettings.value.apiKey)
      .replace('[status]', '4')
      .replace('[time]', '12.34')
      .replace('[time_no_decimal]', '12')
      .replace('[decimals]', '34')
      .replace('[timestamp]', Date.now());

    const response = await fetch(testUrl, {
      method: tempSettings.value.apiMethod,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      apiTestResult.value = {
        success: true,
        message: 'Connection successful!'
      };
    } else {
      apiTestResult.value = {
        success: false,
        message: `Failed: ${response.status} ${response.statusText}`
      };
    }
  } catch (err) {
    apiTestResult.value = {
      success: false,
      message: `Error: ${err.message}`
    };
  } finally {
    apiTestInProgress.value = false;
    setTimeout(() => {
      apiTestResult.value = null;
    }, 5000);
  }
};

const handleSave = () => {
  settingsStore.saveSettings(tempSettings.value);
};

const handleCancel = () => {
  settingsStore.cancelSettings();
};
</script>
