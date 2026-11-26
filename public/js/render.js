import { ICONS, ROLE_LABELS, SEVERITY_LABELS } from './constants.js'
import { escapeHtml } from './utils.js'

function severityIcon(severity) {
  if (severity === 'mandatory') return ICONS.alert
  if (severity === 'recommended') return ICONS.circle
  return ICONS.square
}

export function severityBadge(severity) {
  const label = SEVERITY_LABELS[severity] || severity
  return `<span class="badge badge-severity-${escapeHtml(severity)}">${severityIcon(severity)}${escapeHtml(label)}</span>`
}

export function statusMarkup(active) {
  return active
    ? `<span class="status status-active">${ICONS.check}Activa</span>`
    : `<span class="status status-inactive">${ICONS.minus}Inactiva</span>`
}

export function tokenStatusMarkup(active) {
  return active
    ? `<span class="status status-active">${ICONS.check}Activo</span>`
    : `<span class="status status-inactive">${ICONS.minus}Revocado</span>`
}

export function tagsMarkup(tags) {
  if (!tags || tags.length === 0) return '<span class="cell-muted">—</span>'
  return tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(' ')
}

export function roleBadge(role) {
  return `<span class="badge badge-role">${escapeHtml(ROLE_LABELS[role] || role)}</span>`
}

export function emptyState({ icon, title, message, action }) {
  return `
    <div class="empty-state">
      <span class="empty-icon">${icon}</span>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      ${action || ''}
    </div>
  `
}

export function skeletonMarkup(label) {
  return `
    <div class="skeleton-table" role="status" aria-label="${escapeHtml(label)}">
      <div class="skeleton-row"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div>
      <div class="skeleton-row"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div>
      <div class="skeleton-row"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div>
    </div>
  `
}
