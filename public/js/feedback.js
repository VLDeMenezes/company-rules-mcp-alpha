import { liveAssertive, livePolite, toast, toastMessage } from './dom.js'
import { showFormError } from './utils.js'

export function announcePolite(message) {
  livePolite.textContent = ''
  window.setTimeout(() => {
    livePolite.textContent = message
  }, 20)
}

export function announceAssertive(message) {
  liveAssertive.textContent = ''
  window.setTimeout(() => {
    liveAssertive.textContent = message
  }, 20)
}

let toastTimer = null

export function showToast(message, kind = 'success') {
  toastMessage.textContent = message
  toast.classList.toggle('toast-error', kind === 'error')
  toast.hidden = false

  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(hideToast, kind === 'error' ? 12000 : 6000)
}

export function hideToast() {
  window.clearTimeout(toastTimer)
  toast.hidden = true
}

export function notifySuccess(message) {
  announcePolite(message)
  showToast(message, 'success')
}

export function notifyError(error) {
  if (error && error.silent) return
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
  announceAssertive(message)
  showToast(message, 'error')
}

export function reportFormError(element, error) {
  if (error && error.silent) return
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
  showFormError(element, message)
  showToast(message, 'error')
}
