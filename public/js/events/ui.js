import { toastDismiss } from '../dom.js'
import { hideToast } from '../feedback.js'

toastDismiss.addEventListener('click', () => {
  hideToast()
})
