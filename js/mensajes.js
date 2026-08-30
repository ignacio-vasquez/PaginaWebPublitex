function addDescriptionId(field, errorId) {
  const descriptionIds = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);

  if (!descriptionIds.includes(errorId)) {
    descriptionIds.push(errorId);
  }

  field.setAttribute('aria-describedby', descriptionIds.join(' '));
}

export function setFieldError(field, message) {
  const errorId = `${field.id}-error`;
  let error = field.ownerDocument.getElementById(errorId);

  if (!error) {
    error = field.ownerDocument.createElement('span');
    error.className = 'field-error';
    error.id = errorId;
    field.insertAdjacentElement('afterend', error);
  }

  error.textContent = message;
  field.setAttribute('aria-invalid', 'true');
  addDescriptionId(field, errorId);
}

export function clearFieldError(field) {
  const errorId = `${field.id}-error`;
  const descriptionIds = (field.getAttribute('aria-describedby') || '').split(/\s+/)
    .filter((id) => id && id !== errorId);
  const error = field.ownerDocument.getElementById(errorId);

  field.setAttribute('aria-invalid', 'false');
  if (descriptionIds.length) {
    field.setAttribute('aria-describedby', descriptionIds.join(' '));
  } else {
    field.removeAttribute('aria-describedby');
  }
  error?.remove();
}

export function showStatus(container, message, kind) {
  container.textContent = message;
  container.dataset.statusKind = kind;
  container.hidden = false;
}
