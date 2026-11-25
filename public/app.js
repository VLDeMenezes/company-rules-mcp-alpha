const $ = (id) => document.getElementById(id)

const ICONS = {
  plus: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M10 4v12M4 10h12" /></svg>',
  edit: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 14.5V16h1.5L15 6.5 13.5 5 4 14.5Z" /><path d="M12.5 6l1.5 1.5" /></svg>',
  power: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M10 3v7" /><path d="M6 5.8a6 6 0 1 0 8 0" /></svg>',
  trash: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 6h12" /><path d="M8 6V4h4v2" /><path d="M6 6l.7 9.2a1 1 0 0 0 1 .8h4.6a1 1 0 0 0 1-.8L14 6" /></svg>',
  check: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 10.5l4 4 8-9" /></svg>',
  minus: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M5 10h10" /></svg>',
  alert: '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 3.5l7 13H3z" /><path d="M10 8v3.5" /><path d="M10 13.7v.1" /></svg>',
  circle: '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="6.5" /></svg>',
  square: '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><rect x="4" y="4" width="12" height="12" rx="2" /></svg>',
  info: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7" /><path d="M10 9.2v4.4" /><path d="M10 6.5v.1" /></svg>',
  book: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 5.5v15" /></svg>',
  users: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M15.5 5.4a3 3 0 0 1 0 5.2" /><path d="M17 14.2a5.5 5.5 0 0 1 3.5 4.8" /></svg>',
  key: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="8" cy="12" r="4" /><path d="M12 12h8" /><path d="M17 12v3" /><path d="M20 12v2" /></svg>',
}

const SEVERITY_LABELS = {
  mandatory: 'Obligatoria',
  recommended: 'Recomendada',
  optional: 'Opcional',
}

const ROLE_LABELS = {
  admin: 'Administrador',
  editor: 'Editor',
}

const state = {
  user: null,
  rules: [],
  users: [],
  tokens: [],
  filters: { search: '', category: '' },
  editingRuleId: null,
  activeTab: 'reglas',
  adminLoaded: false,
  passwordUserId: null,
  lastToken: null,
}

/* ---------- DOM references ---------- */

const appHeader = $('app-header')
const userEmail = $('user-email')
const userRole = $('user-role')
const logoutButton = $('logout-button')
const loginView = $('login-view')
const loginForm = $('login-form')
const loginEmail = $('login-email')
const loginPassword = $('login-password')
const loginError = $('login-error')
const loginSubmit = $('login-submit')
const appView = $('app-view')
const tabReglas = $('tab-reglas')
const tabUsuarios = $('tab-usuarios')
const tablist = document.querySelector('[role="tablist"]')
const panelReglas = $('panel-reglas')
const panelUsuarios = $('panel-usuarios')
const newRuleButton = $('new-rule-button')
const ruleSearch = $('rule-search')
const ruleCategorySelect = $('rule-category')
const clearFilters = $('clear-filters')
const rulesCount = $('rules-count')
const rulesList = $('rules-list')
const createUserForm = $('create-user-form')
const newUserEmail = $('new-user-email')
const newUserGithub = $('new-user-github')
const newUserRole = $('new-user-role')
const newUserPassword = $('new-user-password')
const createUserSubmit = $('create-user-submit')
const createUserError = $('create-user-error')
const usersList = $('users-list')
const tokenCallout = $('token-callout')
const tokenCalloutName = $('token-callout-name')
const tokenValue = $('token-value')
const dismissTokenCallout = $('dismiss-token-callout')
const copyTokenButton = $('copy-token-button')
const createTokenForm = $('create-token-form')
const newTokenName = $('new-token-name')
const createTokenSubmit = $('create-token-submit')
const createTokenError = $('create-token-error')
const tokensList = $('tokens-list')
const toast = $('toast')
const toastMessage = $('toast-message')
const toastDismiss = $('toast-dismiss')
const livePolite = $('live-polite')
const liveAssertive = $('live-assertive')
const ruleDialog = $('rule-dialog')
const ruleForm = $('rule-form')
const ruleDialogTitle = $('rule-dialog-title')
const ruleFormError = $('rule-form-error')
const ruleIdInput = $('rule-id')
const ruleIdError = $('rule-id-error')
const ruleTitleInput = $('rule-title')
const ruleTitleError = $('rule-title-error')
const ruleCategoryInput = $('rule-category-input')
const ruleCategoryOptions = $('rule-category-options')
const ruleCategoryError = $('rule-category-error')
const ruleSeveritySelect = $('rule-severity')
const ruleTagsInput = $('rule-tags')
const editorModeWrite = $('editor-mode-write')
const editorModePreview = $('editor-mode-preview')
const ruleContentField = $('rule-content-field')
const ruleContentInput = $('rule-content')
const rulePreview = $('rule-preview')
const ruleSave = $('rule-save')
const confirmDialog = $('confirm-dialog')
const confirmTitle = $('confirm-title')
const confirmMessage = $('confirm-message')
const confirmCancel = $('confirm-cancel')
const confirmAccept = $('confirm-accept')
const passwordDialog = $('password-dialog')
const passwordForm = $('password-form')
const passwordContext = $('password-context')
const passwordError = $('password-error')
const passwordNew = $('password-new')
const passwordSave = $('password-save')

const tabs = [tabReglas, tabUsuarios]

/* ---------- Utilities ---------- */

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ESCAPES[character])
}

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

function formatDateTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date)
}

function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`
}

function parseTags(value) {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))]
}

function setButtonLoading(button, loading, loadingLabel) {
  if (loading) {
    if (!button.dataset.idleLabel) button.dataset.idleLabel = button.textContent
    button.disabled = true
    button.setAttribute('aria-busy', 'true')
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${escapeHtml(loadingLabel || 'Cargando…')}</span>`
    return
  }

  button.disabled = false
  button.removeAttribute('aria-busy')
  if (button.dataset.idleLabel) {
    button.textContent = button.dataset.idleLabel
    delete button.dataset.idleLabel
  }
}

function announcePolite(message) {
  livePolite.textContent = ''
  window.setTimeout(() => {
    livePolite.textContent = message
  }, 20)
}

function announceAssertive(message) {
  liveAssertive.textContent = ''
  window.setTimeout(() => {
    liveAssertive.textContent = message
  }, 20)
}

let toastTimer = null

function showToast(message, kind = 'success') {
  toastMessage.textContent = message
  toast.classList.toggle('toast-error', kind === 'error')
  toast.hidden = false

  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(hideToast, kind === 'error' ? 12000 : 6000)
}

function hideToast() {
  window.clearTimeout(toastTimer)
  toast.hidden = true
}

function notifySuccess(message) {
  announcePolite(message)
  showToast(message, 'success')
}

function notifyError(error) {
  if (error && error.silent) return
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
  announceAssertive(message)
  showToast(message, 'error')
}

function reportFormError(element, error) {
  if (error && error.silent) return
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
  showFormError(element, message)
  showToast(message, 'error')
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function showFormError(element, message) {
  // Unhide first so assistive tech announces the text as a change inside a
  // visible alert region.
  element.hidden = false
  element.textContent = message
}

function hideFormError(element) {
  element.textContent = ''
  element.hidden = true
}

/* ---------- API ---------- */

class ApiError extends Error {
  constructor(message, { status = 0, code = 'HTTP_ERROR', silent = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.silent = silent
  }
}

async function api(path, { method = 'GET', body, ignore401 = false } = {}) {
  let response

  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers:
        body === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión.', {
      code: 'NETWORK',
    })
  }

  if (response.status === 401 && path !== '/api/auth/login') {
    if (ignore401) {
      throw new ApiError('Sesión no iniciada.', {
        status: 401,
        code: 'UNAUTHORIZED',
        silent: true,
      })
    }
    handleSessionExpired()
    throw new ApiError('Tu sesión ha expirado.', {
      status: 401,
      code: 'UNAUTHORIZED',
      silent: true,
    })
  }

  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''
  let payload = null
  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null)
  }

  if (!response.ok) {
    const code = payload?.error?.code || 'HTTP_ERROR'
    const serverMessage = payload?.error?.message || ''
    let message = serverMessage || `Error ${response.status}`

    if (response.status === 400) {
      message = serverMessage
        ? `Revisa los datos ingresados: ${serverMessage}`
        : 'Revisa los datos ingresados.'
    } else if (response.status === 401) {
      message = 'Credenciales incorrectas.'
    } else if (response.status === 403) {
      message = 'No tienes permisos para realizar esta acción (403).'
    } else if (response.status === 404) {
      message = 'No se encontró el recurso solicitado.'
    } else if (response.status === 409) {
      message = 'Ya existe un registro con ese identificador.'
    }

    throw new ApiError(message, { status: response.status, code })
  }

  return payload
}

function handleSessionExpired() {
  if (!state.user) return
  showLogin('Tu sesión ha expirado. Vuelve a iniciar sesión.')
}

/* ---------- Safe Markdown ---------- */

function renderInline(escapedText) {
  const codeSpans = []
  let output = escapedText.replace(/`([^`\n]+)`/g, (_match, code) => {
    codeSpans.push(code)
    return `\u0000${codeSpans.length - 1}\u0000`
  })

  output = output.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
    if (!/^(https?:\/\/|mailto:)/i.test(url)) return match
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
  })

  output = output.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  output = output.replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
  output = output.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  output = output.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>')

  output = output.replace(/\u0000(\d+)\u0000/g, (_match, index) => {
    return `<code>${codeSpans[Number(index)]}</code>`
  })

  return output
}

function isBlockStart(line) {
  return (
    /^\s*$/.test(line) ||
    /^```/.test(line) ||
    /^#{1,6}\s+/.test(line) ||
    /^\s*>\s?/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line) ||
    /^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)
  )
}

function renderMarkdown(source) {
  if (!source || !source.trim()) {
    return '<p class="empty-preview">Sin contenido todavía.</p>'
  }

  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const html = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (/^\s*$/.test(line)) {
      index += 1
      continue
    }

    const fence = line.match(/^```\s*([A-Za-z0-9_+-]*)\s*$/)
    if (fence) {
      const code = []
      index += 1
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      const language = fence[1] ? ` class="language-${fence[1]}"` : ''
      html.push(`<pre><code${language}>${escapeHtml(code.join('\n'))}</code></pre>`)
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      html.push(`<h${level}>${renderInline(escapeHtml(heading[2].trim()))}</h${level}>`)
      index += 1
      continue
    }

    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      html.push('<hr>')
      index += 1
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = []
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(renderInline(escapeHtml(lines[index].replace(/^\s*>\s?/, ''))))
        index += 1
      }
      html.push(`<blockquote><p>${quote.join('<br>')}</p></blockquote>`)
      continue
    }

    const unordered = line.match(/^\s*[-*+]\s+(.*)$/)
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (unordered || ordered) {
      const tag = unordered ? 'ul' : 'ol'
      const pattern = unordered ? /^\s*[-*+]\s+(.*)$/ : /^\s*\d+[.)]\s+(.*)$/
      const items = []
      while (index < lines.length) {
        const item = lines[index].match(pattern)
        if (!item) break
        items.push(`<li>${renderInline(escapeHtml(item[1]))}</li>`)
        index += 1
      }
      html.push(`<${tag}>${items.join('')}</${tag}>`)
      continue
    }

    const paragraph = [line]
    index += 1
    while (index < lines.length && !isBlockStart(lines[index])) {
      paragraph.push(lines[index])
      index += 1
    }
    html.push(`<p>${paragraph.map((part) => renderInline(escapeHtml(part))).join(' ')}</p>`)
  }

  return html.join('\n')
}

/* ---------- Rendering helpers ---------- */

function severityIcon(severity) {
  if (severity === 'mandatory') return ICONS.alert
  if (severity === 'recommended') return ICONS.circle
  return ICONS.square
}

function severityBadge(severity) {
  const label = SEVERITY_LABELS[severity] || severity
  return `<span class="badge badge-severity-${escapeHtml(severity)}">${severityIcon(severity)}${escapeHtml(label)}</span>`
}

function statusMarkup(active) {
  return active
    ? `<span class="status status-active">${ICONS.check}Activa</span>`
    : `<span class="status status-inactive">${ICONS.minus}Inactiva</span>`
}

function tokenStatusMarkup(active) {
  return active
    ? `<span class="status status-active">${ICONS.check}Activo</span>`
    : `<span class="status status-inactive">${ICONS.minus}Revocado</span>`
}

function tagsMarkup(tags) {
  if (!tags || tags.length === 0) return '<span class="cell-muted">—</span>'
  return tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(' ')
}

function roleBadge(role) {
  return `<span class="badge badge-role">${escapeHtml(ROLE_LABELS[role] || role)}</span>`
}

function emptyState({ icon, title, message, action }) {
  return `
    <div class="empty-state">
      <span class="empty-icon">${icon}</span>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      ${action || ''}
    </div>
  `
}

function skeletonMarkup(label) {
  return `
    <div class="skeleton-table" role="status" aria-label="${escapeHtml(label)}">
      <div class="skeleton-row"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div>
      <div class="skeleton-row"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div>
      <div class="skeleton-row"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div>
    </div>
  `
}

/* ---------- Views ---------- */

function showLogin(message) {
  state.user = null
  state.rules = []
  state.users = []
  state.tokens = []
  state.filters = { search: '', category: '' }
  state.editingRuleId = null
  state.adminLoaded = false
  state.passwordUserId = null
  state.lastToken = null

  tokenCallout.hidden = true
  tokenValue.textContent = ''
  hideToast()
  appView.hidden = true
  appHeader.hidden = true
  loginView.hidden = false
  loginEmail.removeAttribute('aria-invalid')
  loginPassword.removeAttribute('aria-invalid')

  for (const dialog of document.querySelectorAll('dialog[open]')) {
    dialog.close()
  }

  if (message) {
    showFormError(loginError, message)
  } else {
    hideFormError(loginError)
  }

  window.history.replaceState(null, '', window.location.pathname)
  window.setTimeout(() => loginEmail.focus(), 0)
}

async function enterApp(user) {
  state.user = user
  state.adminLoaded = false

  loginView.hidden = true
  appHeader.hidden = false
  appView.hidden = false

  userEmail.textContent = user.email
  userEmail.title = user.email
  userRole.textContent = ROLE_LABELS[user.role] || user.role
  tabUsuarios.hidden = user.role !== 'admin'
  if (user.role !== 'admin') panelUsuarios.hidden = true

  selectTab(tabFromHash(), { updateHash: false })
  window.history.replaceState(null, '', `#${state.activeTab}`)
  $('contenido-principal').focus()
  announcePolite(`Sesión iniciada como ${user.email}.`)

  await loadRules()
}

function tabFromHash() {
  const hash = window.location.hash.replace('#', '')
  if (hash === 'usuarios' && state.user?.role === 'admin') return 'usuarios'
  return 'reglas'
}

function selectTab(name, { focus = false, updateHash = true } = {}) {
  if (name === 'usuarios' && state.user?.role !== 'admin') name = 'reglas'
  state.activeTab = name

  for (const tab of tabs) {
    const selected = tab.dataset.tab === name
    tab.setAttribute('aria-selected', String(selected))
    tab.tabIndex = selected ? 0 : -1
    if (selected && focus) tab.focus()
  }

  panelReglas.hidden = name !== 'reglas'
  panelUsuarios.hidden = name !== 'usuarios'

  if (updateHash) {
    const nextHash = `#${name}`
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash)
    }
  }

  if (name === 'usuarios' && !state.adminLoaded) {
    void loadAdminData()
  }
}

/* ---------- Rules ---------- */

function filteredRules() {
  const query = state.filters.search.trim().toLowerCase()

  return state.rules.filter((rule) => {
    if (state.filters.category && rule.category !== state.filters.category) return false
    if (!query) return true

    const haystack = [rule.id, rule.title, rule.category, ...(rule.tags || [])]
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  })
}

function renderCategoryOptions() {
  const categories = [...new Set(state.rules.map((rule) => rule.category))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )

  const currentFilter = state.filters.category
  ruleCategorySelect.innerHTML =
    '<option value="">Todas las categorías</option>' +
    categories
      .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join('')

  if (currentFilter && !categories.includes(currentFilter)) {
    state.filters.category = ''
  }
  ruleCategorySelect.value = state.filters.category

  ruleCategoryOptions.innerHTML = categories
    .map((category) => `<option value="${escapeHtml(category)}"></option>`)
    .join('')
}

function renderRules() {
  const rules = filteredRules()
  const hasFilters = Boolean(state.filters.search.trim() || state.filters.category)
  const total = state.rules.length

  rulesCount.textContent = hasFilters
    ? `${rules.length} de ${pluralize(total, 'regla', 'reglas')}`
    : pluralize(total, 'regla', 'reglas')

  if (rules.length === 0) {
    if (total === 0) {
      rulesList.innerHTML = emptyState({
        icon: ICONS.book,
        title: 'Todavía no hay reglas',
        message: 'Crea la primera regla para centralizar los estándares del equipo.',
        action: `<button class="btn btn-primary" type="button" data-action="new">${ICONS.plus}<span>Nueva regla</span></button>`,
      })
    } else {
      rulesList.innerHTML = emptyState({
        icon: ICONS.book,
        title: 'Sin resultados',
        message: 'No hay reglas que coincidan con la búsqueda o la categoría seleccionada.',
        action: '<button class="btn btn-secondary" type="button" data-action="clear">Limpiar filtros</button>',
      })
    }
    return
  }

  const rows = rules
    .map((rule) => {
      const toggleLabel = rule.active ? 'Desactivar' : 'Reactivar'
      const toggleIcon = rule.active ? ICONS.power : ICONS.check
      const deleteButton =
        state.user?.role === 'admin'
          ? `<button class="btn btn-small btn-danger" type="button" data-action="delete" data-id="${escapeHtml(rule.id)}" aria-label="Eliminar regla ${escapeHtml(rule.id)}">${ICONS.trash}<span>Eliminar</span></button>`
          : ''

      return `
        <tr>
          <td data-label="Código">
            <span class="cell-stack">
              <span class="cell-id">${escapeHtml(rule.id)}</span>
              <span class="cell-sub">v${escapeHtml(rule.version)}</span>
            </span>
          </td>
          <td data-label="Título" class="cell-title">
            <span class="cell-rule">
              <span class="cell-title-text">${escapeHtml(rule.title)}</span>
              <span class="cell-tags">${tagsMarkup(rule.tags)}</span>
            </span>
          </td>
          <td data-label="Categoría"><span class="tag">${escapeHtml(rule.category)}</span></td>
          <td data-label="Severidad">${severityBadge(rule.severity)}</td>
          <td data-label="Estado">${statusMarkup(rule.active)}</td>
          <td data-label="Actualizada" class="cell-updated">
            <time datetime="${escapeHtml(rule.updatedAt)}">${escapeHtml(formatDateTime(rule.updatedAt))}</time>
            <span class="cell-sub">${escapeHtml(rule.updatedBy)}</span>
          </td>
          <td data-label="Acciones" class="cell-actions">
            <div class="row-actions">
              <button class="btn btn-small btn-secondary" type="button" data-action="edit" data-id="${escapeHtml(rule.id)}" aria-label="Editar regla ${escapeHtml(rule.id)}">${ICONS.edit}<span>Editar</span></button>
              <button class="btn btn-small btn-secondary" type="button" data-action="toggle" data-id="${escapeHtml(rule.id)}" data-active="${rule.active}" aria-label="${toggleLabel} regla ${escapeHtml(rule.id)}">${toggleIcon}<span>${toggleLabel}</span></button>
              ${deleteButton}
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  rulesList.innerHTML = `
    <div class="table-scroll" role="region" aria-label="Listado de reglas" tabindex="0">
      <table class="data-table" aria-label="Reglas registradas">
        <caption class="table-caption">Reglas registradas</caption>
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Título</th>
            <th scope="col">Categoría</th>
            <th scope="col">Severidad</th>
            <th scope="col">Estado</th>
            <th scope="col">Actualizada</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `
}

function focusRuleButton(ruleId, action = 'edit') {
  for (const button of rulesList.querySelectorAll('button[data-action]')) {
    if (button.dataset.id === ruleId && button.dataset.action === action) {
      button.focus()
      return
    }
  }
  newRuleButton.focus()
}

function renderRulesLoading() {
  rulesList.setAttribute('aria-busy', 'true')
  rulesCount.textContent = 'Cargando reglas…'
  rulesList.innerHTML = skeletonMarkup('Cargando reglas')
}

async function loadRules() {
  renderRulesLoading()

  try {
    state.rules = await api('/api/rules')
    renderCategoryOptions()
    renderRules()
  } catch (error) {
    state.rules = []
    rulesCount.textContent = 'No se pudieron cargar las reglas'
    rulesList.innerHTML = emptyState({
      icon: ICONS.book,
      title: 'No se pudieron cargar las reglas',
      message: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      action: '<button class="btn btn-secondary" type="button" data-action="retry">Reintentar</button>',
    })
    notifyError(error)
  } finally {
    rulesList.setAttribute('aria-busy', 'false')
  }
}

function clearRuleFilters() {
  state.filters = { search: '', category: '' }
  ruleSearch.value = ''
  ruleCategorySelect.value = ''
  renderRules()
  ruleSearch.focus()
}

async function toggleRule(ruleId, active) {
  try {
    await api(`/api/rules/${encodeURIComponent(ruleId)}`, {
      method: 'PUT',
      body: { active },
    })
    notifySuccess(active ? `Regla ${ruleId} reactivada.` : `Regla ${ruleId} desactivada.`)
    await loadRules()
    focusRuleButton(ruleId, 'toggle')
  } catch (error) {
    notifyError(error)
  }
}

async function deleteRule(ruleId) {
  const confirmed = await askConfirm({
    title: 'Eliminar regla',
    message: `¿Eliminar permanentemente la regla ${ruleId}? Esta acción no se puede deshacer. Si solo quieres ocultarla, usa Desactivar.`,
    confirmLabel: 'Eliminar definitivamente',
    danger: true,
  })
  if (!confirmed) return

  try {
    await api(`/api/rules/${encodeURIComponent(ruleId)}?hard=true`, { method: 'DELETE' })
    notifySuccess(`Regla ${ruleId} eliminada.`)
    await loadRules()
    newRuleButton.focus()
  } catch (error) {
    notifyError(error)
  }
}

/* ---------- Rule editor ---------- */

function clearRuleErrors() {
  hideFormError(ruleFormError)
  const fields = [
    [ruleIdInput, ruleIdError],
    [ruleTitleInput, ruleTitleError],
    [ruleCategoryInput, ruleCategoryError],
  ]

  for (const [input, error] of fields) {
    input.removeAttribute('aria-invalid')
    hideFormError(error)
  }
}

function setEditorMode(mode) {
  const preview = mode === 'preview'
  editorModeWrite.setAttribute('aria-pressed', String(!preview))
  editorModePreview.setAttribute('aria-pressed', String(preview))
  ruleContentField.hidden = preview
  rulePreview.hidden = !preview

  if (preview) {
    rulePreview.innerHTML = renderMarkdown(ruleContentInput.value)
  }
}

async function openRuleEditor(ruleId, trigger = document.activeElement) {
  let rule = null

  if (ruleId) {
    try {
      rule = await api(`/api/rules/${encodeURIComponent(ruleId)}`)
    } catch (error) {
      notifyError(error)
      return
    }
  }

  state.editingRuleId = ruleId || null
  ruleForm.reset()
  clearRuleErrors()

  ruleDialogTitle.textContent = ruleId ? `Editar regla ${ruleId}` : 'Nueva regla'
  ruleIdInput.disabled = Boolean(ruleId)
  ruleIdInput.value = rule ? rule.meta.id : ''
  ruleTitleInput.value = rule ? rule.meta.title : ''
  ruleCategoryInput.value = rule ? rule.meta.category : ''
  ruleTagsInput.value = rule ? rule.meta.tags.join(', ') : ''
  ruleSeveritySelect.value = rule ? rule.meta.severity : 'mandatory'
  ruleContentInput.value = rule ? rule.content : ''
  setEditorMode('write')

  openDialog(ruleDialog, ruleId ? ruleTitleInput : ruleIdInput, trigger)
  if (ruleId) {
    ruleTitleInput.setSelectionRange(0, 0)
    window.requestAnimationFrame(() => {
      ruleTitleInput.scrollLeft = 0
    })
  }
}

function validateRuleForm() {
  const errors = {}

  if (!state.editingRuleId) {
    const id = ruleIdInput.value.trim()
    if (!id) {
      errors.ruleId = 'El identificador es obligatorio.'
    } else if (id.length > 64) {
      errors.ruleId = 'El identificador no puede superar los 64 caracteres.'
    } else if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
      errors.ruleId =
        'Usa letras, números, puntos, guiones o guiones bajos, empezando por una letra o un número.'
    }
  }

  if (!ruleTitleInput.value.trim()) {
    errors.ruleTitle = 'El título es obligatorio.'
  }

  if (!ruleCategoryInput.value.trim()) {
    errors.ruleCategory = 'La categoría es obligatoria.'
  }

  return errors
}

function showRuleErrors(errors) {
  const mapping = {
    ruleId: [ruleIdInput, ruleIdError],
    ruleTitle: [ruleTitleInput, ruleTitleError],
    ruleCategory: [ruleCategoryInput, ruleCategoryError],
  }

  for (const [key, [input, errorElement]] of Object.entries(mapping)) {
    const message = errors[key]
    if (message) {
      input.setAttribute('aria-invalid', 'true')
      showFormError(errorElement, message)
    } else {
      input.removeAttribute('aria-invalid')
      hideFormError(errorElement)
    }
  }

  const firstKey = Object.keys(errors)[0]
  if (firstKey) {
    mapping[firstKey][0].focus()
  }
}

/* ---------- Admin: users ---------- */

function renderUsersLoading() {
  usersList.setAttribute('aria-busy', 'true')
  usersList.innerHTML = skeletonMarkup('Cargando usuarios')
}

function renderUsers() {
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

async function refreshUsers() {
  state.users = await api('/api/users')
  renderUsers()
}

async function updateUserRole(userId, role, select) {
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

async function toggleUser(userId, active) {
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

function openPasswordDialog(user, trigger = document.activeElement) {
  state.passwordUserId = user.id
  passwordForm.reset()
  hideFormError(passwordError)
  passwordNew.removeAttribute('aria-invalid')
  passwordContext.textContent = `Define una nueva contraseña para ${user.email}.`
  openDialog(passwordDialog, passwordNew, trigger)
}

/* ---------- Admin: tokens ---------- */

function renderTokensLoading() {
  tokensList.setAttribute('aria-busy', 'true')
  tokensList.innerHTML = skeletonMarkup('Cargando tokens')
}

function renderTokens() {
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

async function refreshTokens() {
  state.tokens = await api('/api/tokens')
  renderTokens()
}

async function loadAdminData() {
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

async function revokeToken(tokenId, tokenName) {
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

/* ---------- Dialogs ---------- */

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

function openDialog(dialog, focusTarget, returnTarget) {
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

function askConfirm({ title, message, confirmLabel = 'Confirmar', danger = false }) {
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

ruleDialog.addEventListener('close', () => {
  state.editingRuleId = null
  ruleForm.reset()
  clearRuleErrors()
  setEditorMode('write')
  rulePreview.innerHTML = ''
})

passwordDialog.addEventListener('cancel', () => {
  state.passwordUserId = null
})
passwordDialog.addEventListener('close', () => {
  state.passwordUserId = null
})

/* ---------- Login / session ---------- */

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

/* ---------- Tabs ---------- */

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

/* ---------- Rules UI events ---------- */

newRuleButton.addEventListener('click', () => {
  void openRuleEditor(null, newRuleButton)
})

ruleSearch.addEventListener('input', () => {
  state.filters.search = ruleSearch.value
  renderRules()
})

ruleCategorySelect.addEventListener('change', () => {
  state.filters.category = ruleCategorySelect.value
  renderRules()
})

clearFilters.addEventListener('click', clearRuleFilters)

rulesList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]')
  if (!button) return

  const action = button.dataset.action
  const ruleId = button.dataset.id

  if (action === 'new') {
    void openRuleEditor(null, button)
  } else if (action === 'clear') {
    clearRuleFilters()
  } else if (action === 'retry') {
    void loadRules()
  } else if (action === 'edit' && ruleId) {
    void openRuleEditor(ruleId, button)
  } else if (action === 'toggle' && ruleId) {
    void toggleRule(ruleId, button.dataset.active !== 'true')
  } else if (action === 'delete' && ruleId) {
    void deleteRule(ruleId)
  }
})

editorModeWrite.addEventListener('click', () => setEditorMode('write'))
editorModePreview.addEventListener('click', () => setEditorMode('preview'))

for (const [input, errorElement] of [
  [ruleIdInput, ruleIdError],
  [ruleTitleInput, ruleTitleError],
  [ruleCategoryInput, ruleCategoryError],
]) {
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid')
    hideFormError(errorElement)
  })
}

ruleForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const errors = validateRuleForm()
  if (Object.keys(errors).length > 0) {
    showRuleErrors(errors)
    showFormError(ruleFormError, 'Revisa los campos marcados antes de guardar.')
    return
  }

  const payload = {
    title: ruleTitleInput.value.trim(),
    category: ruleCategoryInput.value.trim(),
    tags: parseTags(ruleTagsInput.value),
    severity: ruleSeveritySelect.value,
    content: ruleContentInput.value,
  }

  const editingId = state.editingRuleId
  const savedId = editingId || ruleIdInput.value.trim()

  setButtonLoading(ruleSave, true, 'Guardando…')

  try {
    if (editingId) {
      await api(`/api/rules/${encodeURIComponent(editingId)}`, {
        method: 'PUT',
        body: payload,
      })
      notifySuccess(`Regla ${editingId} actualizada.`)
    } else {
      await api('/api/rules', {
        method: 'POST',
        body: { id: savedId, ...payload },
      })
      notifySuccess(`Regla ${savedId} creada.`)
    }

    ruleDialog.close()
    await loadRules()
    focusRuleButton(savedId, 'edit')
  } catch (error) {
    reportFormError(ruleFormError, error)
  } finally {
    setButtonLoading(ruleSave, false)
  }
})

/* ---------- Users UI events ---------- */

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

/* ---------- Tokens UI events ---------- */

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

toastDismiss.addEventListener('click', () => {
  hideToast()
})

/* ---------- Boot ---------- */

async function boot() {
  try {
    const user = await api('/api/auth/me', { ignore401: true })
    if (user) {
      await enterApp(user)
    } else {
      showLogin()
    }
  } catch {
    showLogin()
  }
}

void boot()
