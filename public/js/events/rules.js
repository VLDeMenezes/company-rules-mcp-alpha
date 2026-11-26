import { api } from '../api.js'
import {
  clearFilters,
  editorModePreview,
  editorModeWrite,
  newRuleButton,
  ruleCategoryError,
  ruleCategoryInput,
  ruleCategorySelect,
  ruleContentInput,
  ruleDialog,
  ruleForm,
  ruleFormError,
  ruleIdError,
  ruleIdInput,
  rulePreview,
  ruleSave,
  ruleSearch,
  ruleSeveritySelect,
  ruleTagsInput,
  ruleTitleError,
  ruleTitleInput,
  rulesList,
} from '../dom.js'
import { notifySuccess, reportFormError } from '../feedback.js'
import { state } from '../state.js'
import { hideFormError, parseTags, setButtonLoading, showFormError } from '../utils.js'
import {
  clearRuleErrors,
  openRuleEditor,
  setEditorMode,
  showRuleErrors,
  validateRuleForm,
} from '../views/rule-editor.js'
import {
  clearRuleFilters,
  deleteRule,
  focusRuleButton,
  loadRules,
  renderRules,
  toggleRule,
} from '../views/rules.js'

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

ruleDialog.addEventListener('close', () => {
  state.editingRuleId = null
  ruleForm.reset()
  clearRuleErrors()
  setEditorMode('write')
  rulePreview.innerHTML = ''
})
