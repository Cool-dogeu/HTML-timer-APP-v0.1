import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Import global styles
import './styles/main.css'

// Create Vue app
const app = createApp(App)

// Create Pinia store
const pinia = createPinia()

// Use plugins
app.use(pinia)
app.use(router)

// Mount app
app.mount('#app')

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let refreshing = false

    // Reload page when new service worker takes control (only if user confirmed)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing && sessionStorage.getItem('sw-update-confirmed') === 'true') {
        refreshing = true
        sessionStorage.removeItem('sw-update-confirmed')
        console.log('Service Worker: Controller changed, reloading page')
        window.location.reload()
      }
    })

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration)

        // Check for updates periodically (every hour)
        setInterval(() => {
          console.log('Service Worker: Checking for updates...')
          registration.update()
        }, 60 * 60 * 1000)

        // Listen for new service worker being installed
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          console.log('Service Worker: Update found, installing new version')

          newWorker.addEventListener('statechange', () => {
            // When the new worker is installed and there's an existing controller
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('Service Worker: New version installed and ready')

              // Show user a confirmation dialog
              if (confirm('New version available! Reload to update?')) {
                // Mark that user confirmed the update
                sessionStorage.setItem('sw-update-confirmed', 'true')
                // Tell the new service worker to skip waiting
                newWorker.postMessage({ type: 'SKIP_WAITING' })
              }
            }
          })
        })
      })
      .catch((error) => {
        console.log('SW registration failed:', error)
      })
  })
}
