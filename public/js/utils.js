const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character],
  );
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function parseTags(value) {
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

export function setButtonLoading(button, loading, loadingLabel) {
  if (loading) {
    if (!button.dataset.idleLabel)
      button.dataset.idleLabel = button.textContent;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${escapeHtml(loadingLabel || "Cargando…")}</span>`;
    return;
  }

  button.disabled = false;
  button.removeAttribute("aria-busy");
  if (button.dataset.idleLabel) {
    button.textContent = button.dataset.idleLabel;
    delete button.dataset.idleLabel;
  }
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function showFormError(element, message) {
  // Unhide first so assistive tech announces the text as a change inside a
  // visible alert region.
  element.hidden = false;
  element.textContent = message;
}

export function hideFormError(element) {
  element.textContent = "";
  element.hidden = true;
}
