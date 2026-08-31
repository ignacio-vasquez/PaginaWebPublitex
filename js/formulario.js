import {
  addRequest,
  createRequestState,
  getActiveRequest,
  getOtherRequests,
  removeRequest,
  selectRequest,
  updateRequest,
} from './solicitudes.js';
import { clearFieldError, setFieldError, showStatus } from './mensajes.js';

const requiredFieldNames = ['nombre', 'telefono', 'correo', 'servicio', 'descripcion', 'consentimiento'];
const fieldNames = ['nombre', 'empresa', 'telefono', 'correo', 'servicio', 'descripcion', 'consentimiento'];
const fieldSelectors = {
  nombre: '[name="nombre"]',
  empresa: '[name="empresa-cliente"]',
  telefono: '[name="telefono"]',
  correo: '[name="correo"]',
  servicio: '[name="servicio"]',
  descripcion: '[name="descripcion"]',
  consentimiento: '[name="consentimiento"]',
};
const summaryLabels = {
  nombre: 'Nombre',
  empresa: 'Empresa',
  telefono: 'Teléfono',
  correo: 'Correo',
  servicio: 'Tipo de trabajo',
  descripcion: 'Descripción',
  consentimiento: 'Autorización de datos',
};

function textValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateQuote(values) {
  const errors = {};
  const nombre = textValue(values.nombre);
  const telefono = textValue(values.telefono);
  const correo = textValue(values.correo);
  const servicio = textValue(values.servicio);
  const descripcion = textValue(values.descripcion);

  if (nombre.replace(/\s/g, '').length < 2) {
    errors.nombre = 'Ingresa tu nombre con al menos dos caracteres.';
  }

  if (!telefono) {
    errors.telefono = 'Ingresa un número de teléfono.';
  } else if (!/^\+?[\d\s()-]+$/.test(telefono)) {
    errors.telefono = 'El teléfono solo puede incluir números, espacios, paréntesis, guiones y un prefijo +.';
  } else {
    const digits = telefono.replace(/[\s()-]/g, '').replace(/^\+/, '');
    if (digits.length < 8 || digits.length > 15) {
      errors.telefono = 'El teléfono debe tener entre 8 y 15 dígitos.';
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    errors.correo = 'Ingresa un correo electrónico válido.';
  }

  if (!servicio) {
    errors.servicio = 'Selecciona un tipo de trabajo.';
  }

  if (descripcion.replace(/\s/g, '').length < 20) {
    errors.descripcion = 'Describe tu proyecto con al menos 20 caracteres.';
  }

  if (values.consentimiento !== true) {
    errors.consentimiento = 'Debes autorizar el uso de tus datos para responder la solicitud.';
  }

  return errors;
}

function collectQuoteValues(fields) {
  const values = {};

  for (const name of fieldNames) {
    const field = fields[name];
    if (!field) {
      values[name] = '';
    } else if (field.type === 'checkbox') {
      values[name] = field.checked;
    } else {
      values[name] = field.value.trim();
    }
  }

  return values;
}

function clearFormErrors(fields) {
  for (const name of requiredFieldNames) {
    clearFieldError(fields[name]);
  }
}

function updateFieldError(fields, field) {
  const errors = validateQuote(collectQuoteValues(fields));
  const name = field.name === 'empresa-cliente' ? 'empresa' : field.name;
  const message = errors[name];

  if (message) {
    setFieldError(field, message);
  } else {
    clearFieldError(field);
  }
}

function resetQuoteFields(container) {
  for (const field of container.querySelectorAll('input, select, textarea')) {
    if (field.type === 'checkbox' || field.type === 'radio') {
      field.checked = field.defaultChecked;
    } else if (field.tagName === 'SELECT') {
      for (const option of field.options) option.selected = option.defaultSelected;
      if (field.selectedIndex < 0 && field.options.length) field.selectedIndex = 0;
    } else {
      field.value = field.defaultValue;
    }
  }
}

function selectedServiceLabel(field, value) {
  const option = [...field.options].find((candidate) => candidate.value === value);
  return option?.textContent || value;
}

function displayValue(name, request, fields) {
  if (name === 'consentimiento') return request.consentimiento === true ? 'Autorizado' : 'No autorizado';
  if (name === 'servicio') return selectedServiceLabel(fields.servicio, request.servicio);
  return request[name] || '';
}

function appendRequestDetails(list, request, fields) {
  list.replaceChildren();

  for (const name of fieldNames) {
    const term = list.ownerDocument.createElement('dt');
    const detail = list.ownerDocument.createElement('dd');
    term.textContent = summaryLabels[name];
    detail.textContent = displayValue(name, request, fields);
    list.append(term, detail);
  }
}

function appendButton(documentRoot, parent, label, attribute, requestId) {
  const button = documentRoot.createElement('button');
  button.type = 'button';
  button.dataset[attribute] = '';
  button.dataset.requestId = requestId;
  button.textContent = label;
  parent.append(button);
  return button;
}

function appendHistoryItem(list, request, fields) {
  const documentRoot = list.ownerDocument;
  const item = documentRoot.createElement('li');
  item.dataset.requestItem = '';

  const content = documentRoot.createElement('span');
  content.textContent = `${request.nombre} — ${displayValue('servicio', request, fields)} — ${request.createdAt}`;
  item.append(content);

  const actions = documentRoot.createElement('span');
  actions.dataset.requestActions = '';
  appendButton(documentRoot, actions, 'Ver', 'viewRequest', request.id);
  appendButton(documentRoot, actions, 'Editar', 'editRequest', request.id);
  appendButton(documentRoot, actions, 'Eliminar', 'deleteRequest', request.id);
  item.append(actions);
  list.append(item);
}

export function initQuoteForm(documentRoot = document, options = {}) {
  const form = documentRoot.querySelector('[data-quote-form]');
  if (!form) return;

  const fields = Object.fromEntries(fieldNames.map((name) => [
    name,
    form.querySelector(fieldSelectors[name]),
  ]));
  const status = form.querySelector('[data-form-status]');
  const submitButton = form.querySelector('[data-submit-quote]');
  const requestsView = documentRoot.querySelector('[data-requests-view]');
  const activeRequest = documentRoot.querySelector('[data-active-request]');
  const activeRequestList = activeRequest?.querySelector('[data-active-request-list]');
  const history = documentRoot.querySelector('[data-request-history]');
  const requestList = history?.querySelector('[data-request-list]');
  const requestsStatus = requestsView?.querySelector('[data-requests-status]');
  const cancelButton = documentRoot.querySelector('[data-cancel-form]');
  const deleteDialog = documentRoot.querySelector('#request-delete-dialog');
  const deleteDescription = deleteDialog?.querySelector('[data-delete-description]');
  const confirmDelete = deleteDialog?.querySelector('[data-confirm-delete]');
  const cancelDelete = deleteDialog?.querySelector('[data-cancel-delete]');
  const formTitle = form.querySelector('[data-form-title]')
    || form.parentElement?.querySelector('[data-form-title]')
    || documentRoot.querySelector('[data-form-title]');

  if (Object.values(fields).some((field, index) => !field && requiredFieldNames.includes(fieldNames[index]))
    || !status || !submitButton || !requestsView || !activeRequest || !activeRequestList
    || !history || !requestList || !requestsStatus || !cancelButton) return;

  const firstField = fields.nombre;
  const createId = options.createId ?? (() => globalThis.crypto.randomUUID());
  const now = options.now ?? (() => new Date().toISOString());
  let state = createRequestState();
  let editingId = null;
  let pendingDeleteId = null;
  let deleteTrigger;
  let deleteBackgroundState = [];

  const deleteFocusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  function getDeleteFocusableElements() {
    return [...(deleteDialog?.querySelectorAll(deleteFocusableSelector) || [])]
      .filter((element) => !element.closest('[inert], [hidden], [aria-hidden="true"]'));
  }

  function isolateDeleteBackground() {
    deleteBackgroundState = [];

    for (let current = deleteDialog; current?.parentElement && current !== documentRoot.body; current = current.parentElement) {
      for (const sibling of current.parentElement.children) {
        if (sibling === current) continue;
        deleteBackgroundState.push({ element: sibling, wasInert: sibling.hasAttribute('inert') });
        sibling.setAttribute('inert', '');
      }
    }
  }

  function restoreDeleteBackground() {
    for (const { element, wasInert } of deleteBackgroundState) {
      if (!wasInert) element.removeAttribute('inert');
    }
    deleteBackgroundState = [];
  }

  function closeDeleteDialog({ restoreFocus = true } = {}) {
    if (!deleteDialog || deleteDialog.hidden) return;

    deleteDialog.hidden = true;
    restoreDeleteBackground();
    const trigger = deleteTrigger;
    pendingDeleteId = null;
    deleteTrigger = undefined;
    if (restoreFocus) trigger?.isConnected && trigger.focus();
  }

  function openDeleteDialog(id, trigger) {
    const request = state.requests.find((candidate) => candidate.id === id);
    if (!deleteDialog || !deleteDescription || !confirmDelete || !cancelDelete || !request) return;

    pendingDeleteId = id;
    deleteTrigger = trigger;
    deleteDescription.textContent = `¿Eliminar la solicitud preparada de ${request.nombre}?`;
    deleteDialog.hidden = false;
    isolateDeleteBackground();
    cancelDelete.focus();
  }

  function confirmPendingDelete() {
    if (pendingDeleteId === null) return;

    const id = pendingDeleteId;
    if (!state.requests.some((request) => request.id === id)) {
      closeDeleteDialog();
      return;
    }

    state = removeRequest(state, id);
    const active = getActiveRequest(state);
    closeDeleteDialog({ restoreFocus: false });
    renderRequests();
    announce(active
      ? 'Solicitud eliminada. Tus otras solicitudes preparadas no cambiaron.'
      : 'Solicitud eliminada. No quedan solicitudes preparadas.');
    if (active) focusActive();
    else beginCreate();
  }

  function setCreateMode() {
    editingId = null;
    if (formTitle) formTitle.textContent = 'Crear solicitud';
    submitButton.textContent = 'Enviar solicitud';
  }

  function setEditMode() {
    if (formTitle) formTitle.textContent = 'Editar solicitud';
    submitButton.textContent = 'Guardar cambios';
  }

  function renderRequests() {
    const active = getActiveRequest(state);
    if (!active) {
      requestsView.hidden = true;
      history.hidden = true;
      activeRequestList.replaceChildren();
      requestList.replaceChildren();
      return;
    }

    appendRequestDetails(activeRequestList, active, fields);
    const activeEdit = activeRequest.querySelector('[data-edit-active]');
    const activeDelete = activeRequest.querySelector('[data-delete-active]');
    if (activeEdit) activeEdit.dataset.requestId = active.id;
    if (activeDelete) activeDelete.dataset.requestId = active.id;

    requestList.replaceChildren();
    const others = getOtherRequests(state);
    for (const request of others) appendHistoryItem(requestList, request, fields);
    history.hidden = others.length === 0;
    requestsView.hidden = false;
  }

  function focusActive() {
    activeRequest.focus();
  }

  function restoreActiveView() {
    setCreateMode();
    resetQuoteFields(form);
    clearFormErrors(fields);
    status.hidden = true;
    form.hidden = true;
    cancelButton.hidden = true;
    renderRequests();
    if (getActiveRequest(state)) focusActive();
  }

  function beginCreate() {
    setCreateMode();
    resetQuoteFields(form);
    clearFormErrors(fields);
    status.hidden = true;
    requestsView.hidden = true;
    form.hidden = false;
    cancelButton.hidden = false;
    firstField.focus();
  }

  function beginEdit(id) {
    const request = state.requests.find((candidate) => candidate.id === id);
    if (!request) return;

    editingId = id;
    setEditMode();
    for (const name of fieldNames) {
      const field = fields[name];
      if (!field) continue;
      if (field.type === 'checkbox') field.checked = request[name] === true;
      else field.value = request[name] || '';
    }
    clearFormErrors(fields);
    status.hidden = true;
    requestsView.hidden = true;
    form.hidden = false;
    cancelButton.hidden = false;
    firstField.focus();
  }

  function announce(message) {
    showStatus(requestsStatus, message, 'success');
  }

  for (const name of requiredFieldNames) {
    const field = fields[name];
    field.addEventListener(field.type === 'checkbox' ? 'change' : 'input', () => updateFieldError(fields, field));
  }
  fields.empresa?.addEventListener('input', () => updateFieldError(fields, fields.empresa));

  submitButton.addEventListener('click', (event) => {
    event.preventDefault();
    const values = collectQuoteValues(fields);
    const errors = validateQuote(values);
    const invalidFields = [];

    for (const name of requiredFieldNames) {
      const field = fields[name];
      if (errors[name]) {
        setFieldError(field, errors[name]);
        invalidFields.push(field);
      } else {
        clearFieldError(field);
      }
    }

    if (invalidFields.length) {
      showStatus(status, 'Corrige los campos marcados para continuar.', 'error');
      invalidFields[0].focus();
      return;
    }

    if (editingId) {
      state = updateRequest(state, editingId, values);
      announce('Solicitud actualizada.');
    } else {
      state = addRequest(state, values, { id: createId(), createdAt: now() });
      announce('Solicitud creada.');
    }

    editingId = null;
    setCreateMode();
    status.hidden = true;
    form.hidden = true;
    cancelButton.hidden = true;
    renderRequests();
    focusActive();
  });

  cancelButton.addEventListener('click', () => {
    restoreActiveView();
  });

  activeRequest.querySelector('[data-edit-active]')?.addEventListener('click', () => {
    beginEdit(activeRequest.querySelector('[data-edit-active]').dataset.requestId);
  });
  requestsView.addEventListener('click', (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;

    const deleteButton = target.closest('[data-delete-active], [data-delete-request]');
    if (deleteButton) {
      openDeleteDialog(deleteButton.dataset.requestId, deleteButton);
      return;
    }

    const viewButton = target.closest('[data-view-request]');
    if (viewButton) {
      state = selectRequest(state, viewButton.dataset.requestId);
      renderRequests();
      announce('Solicitud seleccionada.');
      focusActive();
      return;
    }

    const editButton = target.closest('[data-edit-request]');
    if (editButton) {
      beginEdit(editButton.dataset.requestId);
      return;
    }

    const createButton = target.closest('[data-create-request]');
    if (createButton) beginCreate();
  });

  if (deleteDialog && confirmDelete && cancelDelete) {
    confirmDelete.addEventListener('click', confirmPendingDelete);
    cancelDelete.addEventListener('click', () => closeDeleteDialog());
    documentRoot.addEventListener('keydown', (event) => {
      if (deleteDialog.hidden) return;

      if (event.key === 'Escape') {
        closeDeleteDialog();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getDeleteFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      if (!firstElement || !lastElement) {
        event.preventDefault();
        deleteDialog.focus();
        return;
      }

      if (!deleteDialog.contains(documentRoot.activeElement)
        || (event.shiftKey && documentRoot.activeElement === firstElement)
        || (!event.shiftKey && documentRoot.activeElement === lastElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      }
    });
    documentRoot.addEventListener('focusin', (event) => {
      if (!deleteDialog.hidden && !deleteDialog.contains(event.target)) {
        (getDeleteFocusableElements()[0] || deleteDialog).focus();
      }
    });
  }
}
