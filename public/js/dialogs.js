import {
  $,
  confirmAccept,
  confirmCancel,
  confirmDialog,
  confirmMessage,
  confirmTitle,
} from './dom.js'

const dialogReturnFocus = new WeakMap()

function trapTabKey(event) {
  if (event.key !== 'Tab') return

  const dialog = event.currentTarget
  const focusable = Array.from(
    dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getClientRects().length > 0)

  if (focusable.length === 0) {
    event.preventDefault()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

export function openDialog(dialog, focusTarget, returnTarget) {
  const activeElement = document.activeElement
  if (returnTarget instanceof HTMLElement) {
    dialogReturnFocus.set(dialog, returnTarget)
  } else if (activeElement instanceof HTMLElement) {
    dialogReturnFocus.set(dialog, activeElement)
  }

  dialog.showModal()
  if (focusTarget) focusTarget.focus()
}

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('keydown', trapTabKey)
  dialog.addEventListener('close', () => {
    const target = dialogReturnFocus.get(dialog)
    if (target instanceof HTMLElement && document.contains(target)) {
      target.focus()
    }
  })
}

for (const button of document.querySelectorAll('[data-close-dialog]')) {
  button.addEventListener('click', () => {
    const dialog = $(button.dataset.closeDialog)
    if (dialog) dialog.close()
  })
}

let confirmResolver = null

export function askConfirm({ title, message, confirmLabel = 'Confirmar', danger = false }) {
  if (confirmResolver) resolveConfirm(false)

  return new Promise((resolve) => {
    confirmResolver = resolve
    confirmTitle.textContent = title
    confirmMessage.textContent = message
    confirmAccept.textContent = confirmLabel
    confirmAccept.className = danger ? 'btn btn-danger-solid' : 'btn btn-primary'
    openDialog(confirmDialog, confirmCancel)
  })
}

function resolveConfirm(value) {
  const resolve = confirmResolver
  confirmResolver = null
  if (confirmDialog.open) confirmDialog.close()
  if (resolve) resolve(value)
}

confirmCancel.addEventListener('click', () => resolveConfirm(false))
confirmAccept.addEventListener('click', () => resolveConfirm(true))
confirmDialog.addEventListener('cancel', (event) => {
  event.preventDefault()
  resolveConfirm(false)
})
confirmDialog.addEventListener('close', () => {
  if (confirmResolver) {
    const resolve = confirmResolver
    confirmResolver = null
    resolve(false)
  }
})
