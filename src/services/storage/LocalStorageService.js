/**
 * LocalStorage Service
 * Provides persistent storage for app settings and data
 */

const STORAGE_KEYS = {
  RESULTS: 'agility_timer_results',
  SETTINGS: 'agility_timer_settings',
  THEME: 'theme',
  MLED_SETTINGS: 'mled_settings',
  HDMI_SETTINGS: 'hdmi_settings',
  ALGE_SETTINGS: 'alge_settings',
}

/**
 * Save results to localStorage
 * @param {Array} results - Array of result objects
 */
export function saveResults(results) {
  try {
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results))
  } catch (error) {
    console.error('Failed to save results:', error)
  }
}

/**
 * Load results from localStorage
 * @returns {Array} Array of result objects
 */
export function loadResults() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RESULTS)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Failed to load results:', error)
    return []
  }
}

/**
 * Clear all results from localStorage
 */
export function clearResults() {
  try {
    localStorage.removeItem(STORAGE_KEYS.RESULTS)
  } catch (error) {
    console.error('Failed to clear results:', error)
  }
}

/**
 * Save settings to localStorage
 * @param {Object} settings - Settings object
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

/**
 * Load settings from localStorage
 * @returns {Object|null} Settings object or null
 */
export function loadSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Failed to load settings:', error)
    return null
  }
}

/**
 * Save theme preference
 * @param {string} theme - Theme name ('light' or 'dark')
 */
export function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme)
  } catch (error) {
    console.error('Failed to save theme:', error)
  }
}

/**
 * Load theme preference
 * @returns {string} Theme name ('light' or 'dark')
 */
export function loadTheme() {
  try {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'light'
  } catch (error) {
    console.error('Failed to load theme:', error)
    return 'light'
  }
}

/**
 * Save MLED settings
 * @param {Object} mledSettings - MLED configuration
 */
export function saveMledSettings(mledSettings) {
  try {
    localStorage.setItem(STORAGE_KEYS.MLED_SETTINGS, JSON.stringify(mledSettings))
  } catch (error) {
    console.error('Failed to save MLED settings:', error)
  }
}

/**
 * Load MLED settings
 * @returns {Object|null} MLED settings or null
 */
export function loadMledSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MLED_SETTINGS)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Failed to load MLED settings:', error)
    return null
  }
}

/**
 * Save HDMI settings
 * @param {Object} hdmiSettings - HDMI configuration
 */
export function saveHdmiSettings(hdmiSettings) {
  try {
    localStorage.setItem(STORAGE_KEYS.HDMI_SETTINGS, JSON.stringify(hdmiSettings))
  } catch (error) {
    console.error('Failed to save HDMI settings:', error)
  }
}

/**
 * Load HDMI settings
 * @returns {Object|null} HDMI settings or null
 */
export function loadHdmiSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HDMI_SETTINGS)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Failed to load HDMI settings:', error)
    return null
  }
}

/**
 * Save Alge settings
 * @param {Object} algeSettings - Alge configuration
 */
export function saveAlgeSettings(algeSettings) {
  try {
    localStorage.setItem(STORAGE_KEYS.ALGE_SETTINGS, JSON.stringify(algeSettings))
  } catch (error) {
    console.error('Failed to save Alge settings:', error)
  }
}

/**
 * Load Alge settings
 * @returns {Object|null} Alge settings or null
 */
export function loadAlgeSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ALGE_SETTINGS)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Failed to load Alge settings:', error)
    return null
  }
}

/**
 * Clear all app data from localStorage
 */
export function clearAllData() {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key)
    })
  } catch (error) {
    console.error('Failed to clear all data:', error)
  }
}

export default {
  saveResults,
  loadResults,
  clearResults,
  saveSettings,
  loadSettings,
  saveTheme,
  loadTheme,
  saveMledSettings,
  loadMledSettings,
  saveHdmiSettings,
  loadHdmiSettings,
  saveAlgeSettings,
  loadAlgeSettings,
  clearAllData,
  STORAGE_KEYS,
}
