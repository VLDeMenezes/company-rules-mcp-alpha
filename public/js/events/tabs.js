import { tabReglas, tabUsuarios, tablist, tabs } from '../dom.js'
import { state } from '../state.js'
import { selectTab, tabFromHash } from '../views/session.js'

tabReglas.addEventListener('click', () => selectTab('reglas'))
tabUsuarios.addEventListener('click', () => selectTab('usuarios'))

tablist.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return

  const available = tabs.filter((tab) => !tab.hidden)
  const currentIndex = available.indexOf(document.activeElement)
  if (currentIndex === -1) return

  event.preventDefault()

  let nextIndex
  if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = available.length - 1
  } else if (event.key === 'ArrowLeft') {
    nextIndex = (currentIndex - 1 + available.length) % available.length
  } else {
    nextIndex = (currentIndex + 1) % available.length
  }

  selectTab(available[nextIndex].dataset.tab, { focus: true })
})

window.addEventListener('hashchange', () => {
  if (!state.user) return
  selectTab(tabFromHash(), { updateHash: false })
})
