import { api } from '../api.js'
import { ICONS } from '../constants.js'
import { openDialog } from '../dialogs.js'
import {
  newUserEmail,
  passwordContext,
  passwordDialog,
  passwordError,
  passwordForm,
  passwordNew,
  usersList,
} from '../dom.js'
import { notifyError, notifySuccess } from '../feedback.js'
import { emptyState, skeletonMarkup } from '../render.js'
import { state } from '../state.js'
import { escapeHtml, formatDate, hideFormError } from '../utils.js'

export function renderUsersLoading() {
  usersList.setAttribute('aria-busy', 'true')
  usersList.innerHTML = skeletonMarkup('Cargando usuarios')
}

export function renderUsers() {
  usersList.setAttribute('aria-busy', 'false')

  if (state.users.length === 0) {
    usersList.innerHTML = emptyState({
      icon: ICONS.users,
      title: 'No hay usuarios',
      message: 'Crea el primer usuario interno con el formulario de arriba.',
    })
    return
  }

  const selfNoteId = 'self-account-note'
  const selfUser = state.users.find((user) => user.id === state.user?.id)

  const rows = state.users
    .map((user) => {
      const isSelf = user.id === state.user?.id
      const roleSelect = `
        <label class="sr-only" for="role-${escapeHtml(user.id)}">Rol de ${escapeHtml(user.email)}</label>
        <select
          id="role-${escapeHtml(user.id)}"
          class="role-select"
          data-action="change-role"
          data-id="${escapeHtml(user.id)}"
          ${isSelf ? `disabled aria-describedby="${selfNoteId}"` : ''}
        >
          <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option>
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option>
        </select>
      `

      return `
        <tr>
          <td data-label="Correo">
            <span class="cell-stack">
              <span>${escapeHtml(user.email)}</span>
              ${isSelf ? '<span class="cell-sub">Tu cuenta</span>' : ''}
            </span>
          </td>
          <td data-label="GitHub">${user.githubUsername ? escapeHtml(user.githubUsername) : '<span class="cell-muted">—</span>'}</td>
          <td data-label="Rol">${roleSelect}</td>
          <td data-label="Estado">
            <span class="status ${user.active ? 'status-active' : 'status-inactive'}">${user.active ? ICONS.check : ICONS.minus}${user.active ? 'Activa' : 'Inactiva'}</span>
          </td>
          <td data-label="Creado"><time datetime="${escapeHtml(user.createdAt)}">${escapeHtml(formatDate(user.createdAt))}</time></td>
          <td data-label="Acciones" class="cell-actions">
            <div class="row-actions">
              <button
                class="btn btn-small btn-secondary"
                type="button"
                data-action="toggle-user"
                data-id="${escapeHtml(user.id)}"
                data-active="${user.active}"
                aria-label="${user.active ? 'Desactivar' : 'Activar'} usuario ${escapeHtml(user.email)}"
                ${isSelf ? `disabled aria-describedby="${selfNoteId}"` : ''}
              >${ICONS.power}<span>${user.active ? 'Desactivar' : 'Activar'}</span></button>
              <button class="btn btn-small btn-secondary" type="button" data-action="reset-password" data-id="${escapeHtml(user.id)}" aria-label="Restablecer contraseña de ${escapeHtml(user.email)}">
                Restablecer contraseña
              </button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  usersList.innerHTML = `
    <div class="table-scroll" role="region" aria-label="Listado de usuarios" tabindex="0">
      <table class="data-table" aria-label="Usuarios internos">
        <caption class="table-caption">Usuarios internos</caption>
        <thead>
          <tr>
            <th scope="col">Correo</th>
            <th scope="col">GitHub</th>
            <th scope="col">Rol</th>
            <th scope="col">Estado</th>
            <th scope="col">Creado</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${
      selfUser
        ? `<p class="table-note" id="${selfNoteId}">${ICONS.info}<span>No puedes desactivar tu propia cuenta ni cambiar tu rol.</span></p>`
        : ''
    }
  `
}

export async function refreshUsers() {
  state.users = await api('/api/users')
  renderUsers()
}

export async function updateUserRole(userId, role, select) {
  const previousRole = state.users.find((user) => user.id === userId)?.role

  try {
    const updated = await api(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: { role },
    })
    const index = state.users.findIndex((user) => user.id === userId)
    if (index !== -1) state.users[index] = updated
    notifySuccess('Rol actualizado.')
  } catch (error) {
    if (previousRole && select) select.value = previousRole
    notifyError(error)
  }
}

function focusUserButton(userId, action = 'toggle-user') {
  for (const button of usersList.querySelectorAll('button[data-action]')) {
    if (button.dataset.id === userId && button.dataset.action === action) {
      button.focus()
      return
    }
  }
  newUserEmail.focus()
}

export async function toggleUser(userId, active) {
  if (!active && userId === state.user?.id) {
    notifyError(new Error('No puedes desactivar tu propia cuenta.'))
    return
  }

  try {
    await api(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: { active },
    })
    await refreshUsers()
    notifySuccess(active ? 'Usuario activado.' : 'Usuario desactivado.')
    focusUserButton(userId, 'toggle-user')
  } catch (error) {
    notifyError(error)
  }
}

export function openPasswordDialog(user, trigger = document.activeElement) {
  state.passwordUserId = user.id
  passwordForm.reset()
  hideFormError(passwordError)
  passwordNew.removeAttribute('aria-invalid')
  passwordContext.textContent = `Define una nueva contraseña para ${user.email}.`
  openDialog(passwordDialog, passwordNew, trigger)
}
