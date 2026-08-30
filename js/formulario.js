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

function collectQuoteValues(form) {
  const values = {};

  for (const name of fieldNames) {
    const field = form.elements.namedItem(name);
    if (field.type === 'checkbox') {
      values[name] = field.checked;
    } else {
      field.value = field.value.trim();
      values[name] = field.value;
    }
  }

  return values;
}

function renderSummary(summaryList, values, form) {
  summaryList.replaceChildren();

  for (const name of fieldNames) {
    const term = summaryList.ownerDocument.createElement('dt');
    const detail = summaryList.ownerDocument.createElement('dd');
    term.textContent = summaryLabels[name];
    detail.textContent = name === 'consentimiento'
      ? 'Autorizado'
      : name === 'servicio'
        ? form.elements.namedItem(name).selectedOptions[0].textContent
        : values[name];
    summaryList.append(term, detail);
  }
}

function clearFormErrors(form) {
  for (const name of fieldNames) {
    clearFieldError(form.elements.namedItem(name));
  }
}

function updateFieldError(form, field) {
  const errors = validateQuote(collectQuoteValues(form));
  const message = errors[field.name];

  if (message) {
    setFieldError(field, message);
  } else {
    clearFieldError(field);
  }
}

export function initQuoteForm(documentRoot) {
  const form = documentRoot.querySelector('form[data-quote-form]');
  if (!form) return;

  const status = form.querySelector('[data-form-status]');
  const summary = documentRoot.querySelector('[data-quote-summary]');
  const summaryList = summary?.querySelector('[data-summary-list]');
  const firstField = form.elements.namedItem(fieldNames[0]);

  for (const name of fieldNames) {
    const field = form.elements.namedItem(name);
    field.addEventListener(field.type === 'checkbox' ? 'change' : 'input', () => updateFieldError(form, field));
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = collectQuoteValues(form);
    const errors = validateQuote(values);
    const invalidFields = [];

    for (const name of fieldNames) {
      const field = form.elements.namedItem(name);
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
    renderSummary(summaryList, values, form);
    form.hidden = true;
    summary.hidden = false;
  });

  summary?.querySelector('[data-edit-quote]')?.addEventListener('click', () => {
    summary.hidden = true;
    form.hidden = false;
    firstField.focus();
  });

  summary?.querySelector('[data-clear-quote]')?.addEventListener('click', () => {
    form.reset();
    clearFormErrors(form);
    status.hidden = true;
    summaryList.replaceChildren();
    summary.hidden = true;
    form.hidden = false;
    firstField.focus();
  });
}
