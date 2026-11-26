import { api } from '../api.js'
import {
  createUserError,
  createUserForm,
  createUserSubmit,
  newUserEmail,
  newUserGithub,
  newUserPassword,
  newUserRole,
  passwordDialog,
  passwordError,
  passwordForm,
  passwordNew,
  passwordSave,
  usersList,
} from '../dom.js'
import { notifySuccess, reportFormError } from '../feedback.js'
import { state } from '../state.js'
import { hideFormError, isValidEmail, setButtonLoading, showFormError } from '../utils.js'
import { openPasswordDialog, refreshUsers, toggleUser, updateUserRole } from '../views/users.js'

createUserForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const email = newUserEmail.value.trim()
  const githubUsername = newUserGithub.value.trim()
  const role = newUserRole.value
  const password = newUserPassword.value

  newUserEmail.removeAttribute('aria-invalid')
  newUserPassword.removeAttribute('aria-invalid')

  if (!email) {
    newUserEmail.setAttribute('aria-invalid', 'true')
    showFormError(createUserError, 'El correo electrónico es obligatorio.')
    newUserEmail.focus()
    return
  }

  if (!isValidEmail(email)) {
    newUserEmail.setAttribute('aria-invalid', 'true')
    showFormError(createUserError, 'Ingresa un correo electrónico válido.')
    newUserEmail.focus()
    return
  }

  if (password.length < 8) {
    newUserPassword.setAttribute('aria-invalid', 'true')
    showFormError(createUserError, 'La contraseña debe tener al menos 8 caracteres.')
    newUserPassword.focus()
    return
  }

  hideFormError(createUserError)
  setButtonLoading(createUserSubmit, true, 'Creando…')

  const payload = { email, role, password }
  if (githubUsername) payload.githubUsername = githubUsername

  try {
    await api('/api/users', { method: 'POST', body: payload })
    createUserForm.reset()
    await refreshUsers()
    notifySuccess(`Usuario ${email} creado.`)
  } catch (error) {
    if (error.status === 409) newUserEmail.setAttribute('aria-invalid', 'true')
    reportFormError(createUserError, error)
  } finally {
    setButtonLoading(createUserSubmit, false)
  }
})

newUserEmail.addEventListener('input', () => newUserEmail.removeAttribute('aria-invalid'))
newUserPassword.addEventListener('input', () => newUserPassword.removeAttribute('aria-invalid'))

usersList.addEventListener('change', (event) => {
  const select = event.target.closest('select[data-action="change-role"]')
  if (!select) return
  void updateUserRole(select.dataset.id, select.value, select)
})

usersList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]')
  if (!button) return

  const action = button.dataset.action
  const userId = button.dataset.id

  if (action === 'toggle-user' && userId) {
    void toggleUser(userId, button.dataset.active !== 'true')
  } else if (action === 'reset-password' && userId) {
    const user = state.users.find((candidate) => candidate.id === userId)
    if (user) openPasswordDialog(user, button)
  }
})

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const userId = state.passwordUserId
  const password = passwordNew.value

  if (!userId) return

  if (password.length < 8) {
    passwordNew.setAttribute('aria-invalid', 'true')
    showFormError(passwordError, 'La contraseña debe tener al menos 8 caracteres.')
    passwordNew.focus()
    return
  }

  passwordNew.removeAttribute('aria-invalid')
  hideFormError(passwordError)
  setButtonLoading(passwordSave, true, 'Guardando…')

  try {
    await api(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: { password },
    })
    passwordDialog.close()
    notifySuccess('Contraseña actualizada.')
  } catch (error) {
    reportFormError(passwordError, error)
  } finally {
    setButtonLoading(passwordSave, false)
  }
})

passwordNew.addEventListener('input', () => {
  passwordNew.removeAttribute('aria-invalid')
  hideFormError(passwordError)
})

passwordDialog.addEventListener('cancel', () => {
  state.passwordUserId = null
})
passwordDialog.addEventListener('close', () => {
  state.passwordUserId = null
})
