import { api } from '../api.js'
import { tokensList, usersList } from '../dom.js'
import { notifyError } from '../feedback.js'
import { state } from '../state.js'
import { escapeHtml } from '../utils.js'
import { renderTokens, renderTokensLoading } from './tokens.js'
import { renderUsers, renderUsersLoading } from './users.js'

/** Loads the admin-only panel data (users and MCP tokens) in parallel. */
export async function loadAdminData() {
  renderUsersLoading()
  renderTokensLoading()

  try {
    const [users, tokens] = await Promise.all([api('/api/users'), api('/api/tokens')])
    state.users = users
    state.tokens = tokens
    state.adminLoaded = true
    renderUsers()
    renderTokens()
  } catch (error) {
    state.adminLoaded = false
    const message =
      error instanceof Error ? error.message : 'No se pudieron cargar los datos de administración.'
    usersList.setAttribute('aria-busy', 'false')
    tokensList.setAttribute('aria-busy', 'false')
    usersList.innerHTML = `<p class="inline-error">${escapeHtml(message)}</p>`
    tokensList.innerHTML = `<p class="inline-error">${escapeHtml(message)}</p>`
    notifyError(error)
  }
}
