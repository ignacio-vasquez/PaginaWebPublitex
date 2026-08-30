import { clearFieldError, setFieldError, showStatus } from './mensajes.js';

const fieldNames = ['nombre', 'telefono', 'correo', 'servicio', 'descripcion', 'consentimiento'];
const summaryLabels = {
  nombre: 'Nombre',
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
    if (field.type === 'checkbox') {
      values[name] = field.checked;
    } else {
      values[name] = field.value.trim();
    }
  }

  return values;
}

function renderSummary(summaryList, values, fields) {
  summaryList.replaceChildren();

  for (const name of fieldNames) {
    const term = summaryList.ownerDocument.createElement('dt');
    const detail = summaryList.ownerDocument.createElement('dd');
    term.textContent = summaryLabels[name];
    detail.textContent = name === 'consentimiento'
      ? 'Autorizado'
      : name === 'servicio'
        ? fields[name].selectedOptions[0].textContent
        : values[name];
    summaryList.append(term, detail);
  }
}

function clearFormErrors(fields) {
  for (const name of fieldNames) {
    clearFieldError(fields[name]);
  }
}

function updateFieldError(fields, field) {
  const errors = validateQuote(collectQuoteValues(fields));
  const message = errors[field.name];

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

export function initQuoteForm(documentRoot) {
  const form = documentRoot.querySelector('[data-quote-form]');
  if (!form) return;

  const fields = Object.fromEntries(fieldNames.map((name) => [name, form.querySelector(`[name="${name}"]`)]));
  const status = form.querySelector('[data-form-status]');
  const submitButton = form.querySelector('[data-submit-quote]');
  const summary = documentRoot.querySelector('[data-quote-summary]');
  const summaryList = summary?.querySelector('[data-summary-list]');

  if (Object.values(fields).some((field) => !field || typeof field.addEventListener !== 'function')
    || !status || !submitButton || !summary || !summaryList) return;

  const firstField = fields.nombre;

  for (const name of fieldNames) {
    const field = fields[name];
    field.addEventListener(field.type === 'checkbox' ? 'change' : 'input', () => updateFieldError(fields, field));
  }

  submitButton.addEventListener('click', (event) => {
    event.preventDefault();
    const values = collectQuoteValues(fields);
    const errors = validateQuote(values);
    const invalidFields = [];

    for (const name of fieldNames) {
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

    status.hidden = true;
    renderSummary(summaryList, values, fields);
    form.hidden = true;
    summary.hidden = false;
    summary.focus();
  });

  summary.querySelector('[data-edit-quote]')?.addEventListener('click', () => {
    summary.hidden = true;
    form.hidden = false;
    firstField.focus();
  });

  summary.querySelector('[data-clear-quote]')?.addEventListener('click', () => {
    resetQuoteFields(form);
    clearFormErrors(fields);
    status.hidden = true;
    summaryList.replaceChildren();
    summary.hidden = true;
    form.hidden = false;
    firstField.focus();
  });
}
