import { api } from '../api.js'
import { loginEmail, loginError, loginForm, loginPassword, loginSubmit, logoutButton } from '../dom.js'
import { announcePolite, notifyError } from '../feedback.js'
import { hideFormError, isValidEmail, setButtonLoading, showFormError } from '../utils.js'
import { enterApp, showLogin } from '../views/session.js'

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const email = loginEmail.value.trim()
  const password = loginPassword.value

  loginEmail.removeAttribute('aria-invalid')
  loginPassword.removeAttribute('aria-invalid')

  if (!email) {
    loginEmail.setAttribute('aria-invalid', 'true')
    showFormError(loginError, 'Ingresa tu correo electrónico.')
    loginEmail.focus()
    return
  }

  if (!isValidEmail(email)) {
    loginEmail.setAttribute('aria-invalid', 'true')
    showFormError(loginError, 'Ingresa un correo electrónico válido.')
    loginEmail.focus()
    return
  }

  if (!password) {
    loginPassword.setAttribute('aria-invalid', 'true')
    showFormError(loginError, 'Ingresa tu contraseña.')
    loginPassword.focus()
    return
  }

  hideFormError(loginError)
  setButtonLoading(loginSubmit, true, 'Entrando…')

  try {
    const user = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    loginPassword.value = ''
    await enterApp(user)
  } catch (error) {
    if (!error.silent) {
      if (error.status === 401) {
        loginEmail.setAttribute('aria-invalid', 'true')
        loginPassword.setAttribute('aria-invalid', 'true')
      }
      showFormError(loginError, error.message)
      loginPassword.focus()
      loginPassword.select()
    }
  } finally {
    setButtonLoading(loginSubmit, false)
  }
})

loginEmail.addEventListener('input', () => loginEmail.removeAttribute('aria-invalid'))
loginPassword.addEventListener('input', () => loginPassword.removeAttribute('aria-invalid'))

logoutButton.addEventListener('click', async () => {
  setButtonLoading(logoutButton, true, 'Saliendo…')

  try {
    await api('/api/auth/logout', { method: 'POST' })
  } catch (error) {
    if (!error.silent) notifyError(error)
  } finally {
    setButtonLoading(logoutButton, false)
    showLogin()
    announcePolite('Sesión cerrada.')
  }
})
