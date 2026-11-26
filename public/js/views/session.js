import {
  appHeader,
  appView,
  loginEmail,
  loginError,
  loginPassword,
  loginView,
  mainContent,
  panelReglas,
  panelUsuarios,
  tabUsuarios,
  tabs,
  tokenCallout,
  tokenValue,
  userEmail,
  userRole,
} from '../dom.js'
import { announcePolite, hideToast } from '../feedback.js'
import { ROLE_LABELS } from '../constants.js'
import { state } from '../state.js'
import { hideFormError, showFormError } from '../utils.js'
import { loadAdminData } from './admin.js'
import { loadRules } from './rules.js'

export function showLogin(message) {
  state.user = null
  state.rules = []
  state.users = []
  state.tokens = []
  state.filters = { search: '', category: '' }
  state.editingRuleId = null
  state.adminLoaded = false
  state.passwordUserId = null
  state.lastToken = null

  tokenCallout.hidden = true
  tokenValue.textContent = ''
  hideToast()
  appView.hidden = true
  appHeader.hidden = true
  loginView.hidden = false
  loginEmail.removeAttribute('aria-invalid')
  loginPassword.removeAttribute('aria-invalid')

  for (const dialog of document.querySelectorAll('dialog[open]')) {
    dialog.close()
  }

  if (message) {
    showFormError(loginError, message)
  } else {
    hideFormError(loginError)
  }

  window.history.replaceState(null, '', window.location.pathname)
  window.setTimeout(() => loginEmail.focus(), 0)
}

export async function enterApp(user) {
  state.user = user
  state.adminLoaded = false

  loginView.hidden = true
  appHeader.hidden = false
  appView.hidden = false

  userEmail.textContent = user.email
  userEmail.title = user.email
  userRole.textContent = ROLE_LABELS[user.role] || user.role
  tabUsuarios.hidden = user.role !== 'admin'
  if (user.role !== 'admin') panelUsuarios.hidden = true

  selectTab(tabFromHash(), { updateHash: false })
  window.history.replaceState(null, '', `#${state.activeTab}`)
  mainContent.focus()
  announcePolite(`Sesión iniciada como ${user.email}.`)

  await loadRules()
}

export function tabFromHash() {
  const hash = window.location.hash.replace('#', '')
  if (hash === 'usuarios' && state.user?.role === 'admin') return 'usuarios'
  return 'reglas'
}

export function selectTab(name, { focus = false, updateHash = true } = {}) {
  if (name === 'usuarios' && state.user?.role !== 'admin') name = 'reglas'
  state.activeTab = name

  for (const tab of tabs) {
    const selected = tab.dataset.tab === name
    tab.setAttribute('aria-selected', String(selected))
    tab.tabIndex = selected ? 0 : -1
    if (selected && focus) tab.focus()
  }

  panelReglas.hidden = name !== 'reglas'
  panelUsuarios.hidden = name !== 'usuarios'

  if (updateHash) {
    const nextHash = `#${name}`
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash)
    }
  }

  if (name === 'usuarios' && !state.adminLoaded) {
    void loadAdminData()
  }
}
