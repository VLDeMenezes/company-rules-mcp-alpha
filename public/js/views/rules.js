import { api } from "../api.js";
import { ICONS } from "../constants.js";
import { askConfirm } from "../dialogs.js";
import {
  newRuleButton,
  ruleCategoryOptions,
  ruleCategorySelect,
  ruleSearch,
  rulesCount,
  rulesList,
} from "../dom.js";
import { notifyError, notifySuccess } from "../feedback.js";
import {
  emptyState,
  severityBadge,
  skeletonMarkup,
  statusMarkup,
  tagsMarkup,
} from "../render.js";
import { state } from "../state.js";
import {
  escapeHtml,
  formatDateTime,
  pluralize,
  capitalizeText,
} from "../utils.js";

function filteredRules() {
  const query = state.filters.search.trim().toLowerCase();

  return state.rules.filter((rule) => {
    if (state.filters.category && rule.category !== state.filters.category)
      return false;
    if (!query) return true;

    const haystack = [rule.id, rule.title, rule.category, ...(rule.tags || [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

function renderCategoryOptions() {
  const categories = [
    ...new Set(state.rules.map((rule) => rule.category)),
  ].sort((a, b) => a.localeCompare(b, "es"));

  const currentFilter = state.filters.category;
  ruleCategorySelect.innerHTML =
    '<option value="">Todas las categorías</option>' +
    categories
      .map(
        (category) =>
          `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`,
      )
      .join("");

  if (currentFilter && !categories.includes(currentFilter)) {
    state.filters.category = "";
  }
  ruleCategorySelect.value = state.filters.category;

  ruleCategoryOptions.innerHTML = categories
    .map((category) => `<option value="${escapeHtml(category)}"></option>`)
    .join("");
}

export function renderRules() {
  const rules = filteredRules();
  const hasFilters = Boolean(
    state.filters.search.trim() || state.filters.category,
  );
  const total = state.rules.length;

  rulesCount.textContent = hasFilters
    ? `${rules.length} de ${pluralize(total, "regla", "reglas")}`
    : pluralize(total, "regla", "reglas");

  if (rules.length === 0) {
    if (total === 0) {
      rulesList.innerHTML = emptyState({
        icon: ICONS.book,
        title: "Todavía no hay reglas",
        message:
          "Crea la primera regla para centralizar los estándares del equipo.",
        action: `<button class="btn btn-primary" type="button" data-action="new">${ICONS.plus}<span>Nueva regla</span></button>`,
      });
    } else {
      rulesList.innerHTML = emptyState({
        icon: ICONS.book,
        title: "Sin resultados",
        message:
          "No hay reglas que coincidan con la búsqueda o la categoría seleccionada.",
        action:
          '<button class="btn btn-secondary" type="button" data-action="clear">Limpiar filtros</button>',
      });
    }
    return;
  }

  const rows = rules
    .map((rule) => {
      const toggleLabel = rule.active ? "Desactivar" : "Reactivar";
      const toggleIcon = rule.active ? ICONS.power : ICONS.check;
      const deleteButton =
        state.user?.role === "admin"
          ? `<button class="btn btn-small btn-danger" type="button" data-action="delete" data-id="${escapeHtml(rule.id)}" aria-label="Eliminar regla ${escapeHtml(rule.id)}">${ICONS.trash}<span>Eliminar</span></button>`
          : "";

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
      `;
    })
    .join("");

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
  `;
}

export function focusRuleButton(ruleId, action = "edit") {
  for (const button of rulesList.querySelectorAll("button[data-action]")) {
    if (button.dataset.id === ruleId && button.dataset.action === action) {
      button.focus();
      return;
    }
  }
  newRuleButton.focus();
}

function renderRulesLoading() {
  rulesList.setAttribute("aria-busy", "true");
  rulesCount.textContent = "Cargando reglas…";
  rulesList.innerHTML = skeletonMarkup("Cargando reglas");
}

export async function loadRules() {
  renderRulesLoading();

  try {
    state.rules = await api("/api/rules");
    renderCategoryOptions();
    renderRules();
  } catch (error) {
    state.rules = [];
    rulesCount.textContent = "No se pudieron cargar las reglas";
    rulesList.innerHTML = emptyState({
      icon: ICONS.book,
      title: "No se pudieron cargar las reglas",
      message: error instanceof Error ? error.message : "Inténtalo de nuevo.",
      action:
        '<button class="btn btn-secondary" type="button" data-action="retry">Reintentar</button>',
    });
    notifyError(error);
  } finally {
    rulesList.setAttribute("aria-busy", "false");
  }
}

export function clearRuleFilters() {
  state.filters = { search: "", category: "" };
  ruleSearch.value = "";
  ruleCategorySelect.value = "";
  renderRules();
  ruleSearch.focus();
}

export async function toggleRule(ruleId, active) {
  try {
    await api(`/api/rules/${encodeURIComponent(ruleId)}`, {
      method: "PUT",
      body: { active },
    });
    notifySuccess(
      active ? `Regla ${ruleId} reactivada.` : `Regla ${ruleId} desactivada.`,
    );
    await loadRules();
    focusRuleButton(ruleId, "toggle");
  } catch (error) {
    notifyError(error);
  }
}

export async function deleteRule(ruleId) {
  const confirmed = await askConfirm({
    title: "Eliminar regla",
    message: `¿Eliminar permanentemente la regla ${ruleId}? Esta acción no se puede deshacer. Si solo quieres ocultarla, usa Desactivar.`,
    confirmLabel: "Eliminar definitivamente",
    danger: true,
  });
  if (!confirmed) return;

  try {
    await api(`/api/rules/${encodeURIComponent(ruleId)}?hard=true`, {
      method: "DELETE",
    });
    notifySuccess(`Regla ${ruleId} eliminada.`);
    await loadRules();
    newRuleButton.focus();
  } catch (error) {
    notifyError(error);
  }
}
