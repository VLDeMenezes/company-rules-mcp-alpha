import { api } from '../api.js'
import { openDialog } from '../dialogs.js'
import {
  editorModePreview,
  editorModeWrite,
  ruleCategoryError,
  ruleCategoryInput,
  ruleContentField,
  ruleContentInput,
  ruleDialog,
  ruleDialogTitle,
  ruleForm,
  ruleFormError,
  ruleIdError,
  ruleIdInput,
  rulePreview,
  ruleSeveritySelect,
  ruleTagsInput,
  ruleTitleError,
  ruleTitleInput,
} from '../dom.js'
import { notifyError } from '../feedback.js'
import { renderMarkdown } from '../markdown.js'
import { state } from '../state.js'
import { hideFormError, showFormError } from '../utils.js'

export function clearRuleErrors() {
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

export function setEditorMode(mode) {
  const preview = mode === 'preview'
  editorModeWrite.setAttribute('aria-pressed', String(!preview))
  editorModePreview.setAttribute('aria-pressed', String(preview))
  ruleContentField.hidden = preview
  rulePreview.hidden = !preview

  if (preview) {
    rulePreview.innerHTML = renderMarkdown(ruleContentInput.value)
  }
}

export async function openRuleEditor(ruleId, trigger = document.activeElement) {
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

export function validateRuleForm() {
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

export function showRuleErrors(errors) {
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
