import { api } from '../api.js'
import { ICONS } from '../constants.js'
import { askConfirm } from '../dialogs.js'
import { newTokenName, tokensList } from '../dom.js'
import { notifyError, notifySuccess } from '../feedback.js'
import { emptyState, skeletonMarkup, tokenStatusMarkup } from '../render.js'
import { state } from '../state.js'
import { escapeHtml, formatDate, formatDateTime } from '../utils.js'

export function renderTokensLoading() {
  tokensList.setAttribute('aria-busy', 'true')
  tokensList.innerHTML = skeletonMarkup('Cargando tokens')
}

export function renderTokens() {
  tokensList.setAttribute('aria-busy', 'false')

  if (state.tokens.length === 0) {
    tokensList.innerHTML = emptyState({
      icon: ICONS.key,
      title: 'No hay tokens MCP',
      message: 'Genera un token para que un agente pueda consultar las reglas en modo lectura.',
    })
    return
  }

  const rows = state.tokens
    .map((token) => {
      const revokeButton = token.active
        ? `<button class="btn btn-small btn-danger" type="button" data-action="revoke-token" data-id="${escapeHtml(token.id)}" data-name="${escapeHtml(token.name)}" aria-label="Revocar token ${escapeHtml(token.name)}">${ICONS.trash}<span>Revocar</span></button>`
        : '<span class="cell-muted">Revocado</span>'

      return `
        <tr>
          <td data-label="Nombre"><span class="cell-title">${escapeHtml(token.name)}</span></td>
          <td data-label="Estado">${tokenStatusMarkup(token.active)}</td>
          <td data-label="Creado"><time datetime="${escapeHtml(token.createdAt)}">${escapeHtml(formatDate(token.createdAt))}</time></td>
          <td data-label="Último uso">${
            token.lastUsedAt
              ? `<time datetime="${escapeHtml(token.lastUsedAt)}">${escapeHtml(formatDateTime(token.lastUsedAt))}</time>`
              : '<span class="cell-muted">Nunca</span>'
          }</td>
          <td data-label="Acciones" class="cell-actions"><div class="row-actions">${revokeButton}</div></td>
        </tr>
      `
    })
    .join('')

  tokensList.innerHTML = `
    <div class="table-scroll" role="region" aria-label="Listado de tokens MCP" tabindex="0">
      <table class="data-table" aria-label="Tokens MCP">
        <caption class="table-caption">Tokens MCP</caption>
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Estado</th>
            <th scope="col">Creado</th>
            <th scope="col">Último uso</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `
}

export async function refreshTokens() {
  state.tokens = await api('/api/tokens')
  renderTokens()
}

export async function revokeToken(tokenId, tokenName) {
  const confirmed = await askConfirm({
    title: 'Revocar token',
    message: `¿Revocar el token "${tokenName}"? Los agentes que lo estén usando perderán el acceso de inmediato.`,
    confirmLabel: 'Revocar token',
    danger: true,
  })
  if (!confirmed) return

  try {
    await api(`/api/tokens/${encodeURIComponent(tokenId)}`, { method: 'DELETE' })
    await refreshTokens()
    notifySuccess('Token revocado.')
    newTokenName.focus()
  } catch (error) {
    notifyError(error)
  }
}
