/** Shared client-side state for the authenticated panel. */
export const state = {
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
