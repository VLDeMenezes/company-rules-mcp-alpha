/**
 * UI entry point.
 *
 * The panel is split by concern under `js/`:
 * - `js/views/` renders each feature and exposes its actions.
 * - `js/events/` wires DOM events to those actions.
 * - The remaining modules hold shared state, DOM refs, API access and helpers.
 */

import { api, setSessionExpiredHandler } from './js/api.js'
import { state } from './js/state.js'
import { enterApp, showLogin } from './js/views/session.js'

// Event wiring modules register their listeners as a side effect.
import './js/events/auth.js'
import './js/events/tabs.js'
import './js/events/rules.js'
import './js/events/users.js'
import './js/events/tokens.js'
import './js/events/ui.js'

setSessionExpiredHandler(() => {
  if (!state.user) return
  showLogin('Tu sesión ha expirado. Vuelve a iniciar sesión.')
})

async function boot() {
  try {
    const user = await api('/api/auth/me', { ignore401: true })
    if (user) {
      await enterApp(user)
    } else {
      showLogin()
    }
  } catch {
    showLogin()
  }
}

void boot()
