import { api } from '../api.js'
import {
  copyTokenButton,
  createTokenError,
  createTokenForm,
  createTokenSubmit,
  dismissTokenCallout,
  newTokenName,
  tokenCallout,
  tokenCalloutName,
  tokenValue,
  tokensList,
} from '../dom.js'
import { notifyError, notifySuccess, reportFormError } from '../feedback.js'
import { state } from '../state.js'
import { hideFormError, setButtonLoading, showFormError } from '../utils.js'
import { refreshTokens, revokeToken } from '../views/tokens.js'

createTokenForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const name = newTokenName.value.trim()

  newTokenName.removeAttribute('aria-invalid')

  if (!name) {
    newTokenName.setAttribute('aria-invalid', 'true')
    showFormError(createTokenError, 'El nombre del token es obligatorio.')
    newTokenName.focus()
    return
  }

  hideFormError(createTokenError)
  setButtonLoading(createTokenSubmit, true, 'Generando…')

  try {
    const created = await api('/api/tokens', {
      method: 'POST',
      body: { name },
    })

    state.lastToken = created
    tokenCalloutName.textContent = `Nombre: ${created.name}`
    tokenValue.textContent = created.token
    tokenCallout.hidden = false
    newTokenName.value = ''

    await refreshTokens()
    notifySuccess('Token generado. Cópialo ahora; no se volverá a mostrar.')
    copyTokenButton.focus()
  } catch (error) {
    reportFormError(createTokenError, error)
  } finally {
    setButtonLoading(createTokenSubmit, false)
  }
})

newTokenName.addEventListener('input', () => newTokenName.removeAttribute('aria-invalid'))

tokensList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="revoke-token"]')
  if (!button) return
  void revokeToken(button.dataset.id, button.dataset.name)
})

dismissTokenCallout.addEventListener('click', () => {
  tokenCallout.hidden = true
  tokenValue.textContent = ''
  state.lastToken = null
})

copyTokenButton.addEventListener('click', async () => {
  const token = tokenValue.textContent || ''
  if (!token) return

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(token)
    } else {
      const range = document.createRange()
      range.selectNodeContents(tokenValue)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      document.execCommand('copy')
    }

    copyTokenButton.textContent = 'Copiado'
    notifySuccess('Token copiado al portapapeles.')
    window.setTimeout(() => {
      copyTokenButton.textContent = 'Copiar token'
    }, 2000)
  } catch {
    notifyError(new Error('No se pudo copiar el token. Selecciónalo y cópialo manualmente.'))
  }
})
