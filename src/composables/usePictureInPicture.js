import { ref } from 'vue'
import { useTimerStore } from '@stores/timer'
import { useSettingsStore } from '@stores/settings'

/**
 * Composable for managing Picture-in-Picture window
 * Uses the Document Picture-in-Picture API to create a floating, always-on-top window
 */
export function usePictureInPicture() {
  const timerStore = useTimerStore()
  const settingsStore = useSettingsStore()

  const pipWindow = ref(null)
  const pipUpdateInterval = ref(null)

  /**
   * Check if Picture-in-Picture API is supported
   */
  const isSupported = () => {
    return 'documentPictureInPicture' in window
  }

  /**
   * Open Picture-in-Picture window with timer display
   */
  const openPictureInPicture = async () => {
    try {
      // Check if API is supported
      if (!isSupported()) {
        alert('Picture-in-Picture is not supported in your browser. Please use Chrome 116+ or Edge 116+.')
        return
      }

      // Close existing PiP window if open
      if (pipWindow.value && !pipWindow.value.closed) {
        pipWindow.value.close()
      }

      // Request PiP window
      pipWindow.value = await window.documentPictureInPicture.requestWindow({
        width: 400,
        height: 300,
      })

      // Copy styles from main document
      const styleSheets = Array.from(document.styleSheets)
      styleSheets.forEach((styleSheet) => {
        try {
          const cssRules = Array.from(styleSheet.cssRules).map((rule) => rule.cssText).join('\n')
          const style = pipWindow.value.document.createElement('style')
          style.textContent = cssRules
          pipWindow.value.document.head.appendChild(style)
        } catch (e) {
          // Handle cross-origin stylesheets
          const link = pipWindow.value.document.createElement('link')
          link.rel = 'stylesheet'
          link.href = styleSheet.href
          pipWindow.value.document.head.appendChild(link)
        }
      })

      // Add fonts
      const fontLink = pipWindow.value.document.createElement('link')
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono&display=swap'
      fontLink.rel = 'stylesheet'
      pipWindow.value.document.head.appendChild(fontLink)

      const iconLink = pipWindow.value.document.createElement('link')
      iconLink.href = 'https://fonts.googleapis.com/icon?family=Material+Icons'
      iconLink.rel = 'stylesheet'
      pipWindow.value.document.head.appendChild(iconLink)

      // Determine theme colors
      const isDarkMode = settingsStore.isDarkMode || false
      const bgColor = isDarkMode ? '#1e1e1e' : '#f5f5f5'
      const textColor = isDarkMode ? '#e5e7eb' : '#333'
      const displayBgColor = isDarkMode ? '#3a3a3a' : '#f8f9fa'
      const runningBgColor = isDarkMode ? '#1e3a5f' : '#e3f2fd'
      const statusTextColor = isDarkMode ? '#9ca3af' : '#666'

      // Create PiP content
      const container = pipWindow.value.document.createElement('div')
      container.style.cssText = `
        padding: 1rem;
        height: 100vh;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        font-family: 'Roboto', sans-serif;
        background: ${bgColor};
        color: ${textColor};
      `

      const title = pipWindow.value.document.createElement('h2')
      title.textContent = 'Latest Result'
      title.style.cssText = `
        margin: 0 0 1rem 0;
        text-align: center;
        font-size: 1.2rem;
        font-weight: 400;
        color: ${textColor};
      `

      const timerDisplay = pipWindow.value.document.createElement('div')
      timerDisplay.id = 'pip-timer-display'
      timerDisplay.style.cssText = `
        text-align: center;
        padding: 1.5rem 1rem;
        border-radius: 8px;
        background: ${displayBgColor};
        margin-bottom: 1rem;
        transition: all 0.3s;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
      `

      const timerValue = pipWindow.value.document.createElement('div')
      timerValue.id = 'pip-timer-value'
      timerValue.textContent = timerStore.displayTime
      timerValue.style.cssText = `
        font-size: 3rem;
        font-weight: 300;
        font-family: 'Roboto Mono', monospace;
        color: #2196f3;
        line-height: 1;
      `

      const timerStatus = pipWindow.value.document.createElement('div')
      timerStatus.id = 'pip-timer-status'
      timerStatus.textContent = timerStore.timerStatus
      timerStatus.style.cssText = `
        font-size: 0.9rem;
        color: ${statusTextColor};
        margin-top: 0.75rem;
      `

      const copyButton = pipWindow.value.document.createElement('button')
      copyButton.innerHTML = '<i class="material-icons">content_copy</i> Copy'
      copyButton.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.3s;
        text-transform: uppercase;
        font-weight: 500;
        letter-spacing: 0.5px;
        width: 100%;
        background: #2196f3;
        color: white;
        font-family: 'Roboto', sans-serif;
      `

      // Copy button handler
      copyButton.addEventListener('click', () => {
        const currentTime = pipWindow.value.document.getElementById('pip-timer-value').textContent
        pipWindow.value.navigator.clipboard.writeText(currentTime).then(() => {
          copyButton.innerHTML = '<i class="material-icons">check</i> Copied!'
          copyButton.style.background = '#4caf50'
          setTimeout(() => {
            copyButton.innerHTML = '<i class="material-icons">content_copy</i> Copy'
            copyButton.style.background = '#2196f3'
          }, 2000)
        }).catch((err) => {
          console.error('Failed to copy in PiP:', err)
          // Fallback to main window clipboard
          navigator.clipboard.writeText(currentTime).then(() => {
            copyButton.innerHTML = '<i class="material-icons">check</i> Copied!'
            copyButton.style.background = '#4caf50'
            setTimeout(() => {
              copyButton.innerHTML = '<i class="material-icons">content_copy</i> Copy'
              copyButton.style.background = '#2196f3'
            }, 2000)
          })
        })
      })

      timerDisplay.appendChild(timerValue)
      timerDisplay.appendChild(timerStatus)
      container.appendChild(title)
      container.appendChild(timerDisplay)
      container.appendChild(copyButton)
      pipWindow.value.document.body.appendChild(container)

      // Update PiP window content
      pipUpdateInterval.value = setInterval(() => {
        if (pipWindow.value && !pipWindow.value.closed) {
          const valueEl = pipWindow.value.document.getElementById('pip-timer-value')
          const statusEl = pipWindow.value.document.getElementById('pip-timer-status')
          const displayEl = pipWindow.value.document.getElementById('pip-timer-display')

          if (valueEl) valueEl.textContent = timerStore.displayTime
          if (statusEl) statusEl.textContent = timerStore.timerStatus
          if (displayEl) {
            if (timerStore.isRunning) {
              displayEl.style.background = runningBgColor
              displayEl.style.boxShadow = isDarkMode
                ? '0 0 20px rgba(33, 150, 243, 0.5)'
                : '0 0 20px rgba(33, 150, 243, 0.3)'
            } else {
              displayEl.style.background = displayBgColor
              displayEl.style.boxShadow = 'none'
            }
          }
        } else {
          clearInterval(pipUpdateInterval.value)
          pipUpdateInterval.value = null
        }
      }, 100)

      // Handle PiP window close
      pipWindow.value.addEventListener('pagehide', () => {
        if (pipUpdateInterval.value) {
          clearInterval(pipUpdateInterval.value)
          pipUpdateInterval.value = null
        }
        pipWindow.value = null
      })

    } catch (error) {
      console.error('Failed to open Picture-in-Picture:', error)
      alert('Failed to open Picture-in-Picture window. Error: ' + error.message)
    }
  }

  /**
   * Close Picture-in-Picture window
   */
  const closePictureInPicture = () => {
    if (pipWindow.value && !pipWindow.value.closed) {
      pipWindow.value.close()
    }
    if (pipUpdateInterval.value) {
      clearInterval(pipUpdateInterval.value)
      pipUpdateInterval.value = null
    }
    pipWindow.value = null
  }

  return {
    pipWindow,
    isSupported,
    openPictureInPicture,
    closePictureInPicture
  }
}
