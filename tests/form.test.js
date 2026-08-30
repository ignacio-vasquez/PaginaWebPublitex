const test = require('node:test');
const assert = require('node:assert/strict');
const { createDom } = require('./dom');

function createQuoteDom() {
  return createDom(`
    <section>
      <form action="#" method="post" data-quote-form novalidate>
        <p><label for="nombre">Nombre</label><input id="nombre" name="nombre"></p>
        <p><label for="telefono">Teléfono</label><input id="telefono" name="telefono"></p>
        <p><label for="correo">Correo</label><input id="correo" name="correo"></p>
        <p><label for="servicio">Tipo de trabajo</label><select id="servicio" name="servicio"><option value="">Selecciona una opción</option><option value="letrero">Letrero luminoso</option></select></p>
        <p><label for="descripcion">Descripción</label><textarea id="descripcion" name="descripcion"></textarea></p>
        <p><label><input id="consentimiento" name="consentimiento" type="checkbox"> Autorizo el uso de estos datos.</label></p>
        <div class="form-status" data-form-status role="status" aria-live="polite" hidden></div>
        <button type="submit">Enviar solicitud</button>
      </form>
      <section class="quote-summary" data-quote-summary aria-labelledby="quote-summary-title" hidden>
        <h3 id="quote-summary-title">Resumen de tu solicitud</h3>
        <p><strong>Simulación: esta solicitud todavía no fue enviada a la empresa</strong></p>
        <dl data-summary-list></dl>
        <button type="button" data-edit-quote>Editar datos</button>
        <button type="button" data-clear-quote>Limpiar formulario</button>
      </section>
    </section>
  `);
}

function fillValidQuote(documentRoot) {
  documentRoot.querySelector('[name="nombre"]').value = 'Ignacio';
  documentRoot.querySelector('[name="telefono"]').value = '+56 9 1234-5678';
  documentRoot.querySelector('[name="correo"]').value = 'ignacio@example.com';
  documentRoot.querySelector('[name="servicio"]').value = 'letrero';
  documentRoot.querySelector('[name="descripcion"]').value = 'Letrero luminoso de dos metros para una fachada.';
  documentRoot.querySelector('[name="consentimiento"]').checked = true;
}

function submit(form, window) {
  const event = new window.Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  return event;
}

test('la validación exige todos los campos obligatorios', async () => {
  const { validateQuote } = await import('../js/formulario.js');

  assert.deepEqual(Object.keys(validateQuote({})).sort(), [
    'consentimiento',
    'correo',
    'descripcion',
    'nombre',
    'servicio',
    'telefono',
  ]);
});

test('la validación acepta una solicitud completa', async () => {
  const { validateQuote } = await import('../js/formulario.js');

  assert.deepEqual(validateQuote({
    nombre: 'Ignacio',
    telefono: '+56 9 1234-5678',
    correo: 'ignacio@example.com',
    servicio: 'letrero',
    descripcion: 'Letrero luminoso de dos metros para una fachada.',
    consentimiento: true,
  }), {});
});

test('la validación rechaza teléfonos fuera de ocho a quince dígitos', async () => {
  const { validateQuote } = await import('../js/formulario.js');

  assert.ok(validateQuote({ telefono: '1234567' }).telefono);
  assert.ok(validateQuote({ telefono: '1234567890123456' }).telefono);
});

test('la validación rechaza letras en el teléfono', async () => {
  const { validateQuote } = await import('../js/formulario.js');

  assert.ok(validateQuote({ telefono: '+56 9 12ab-5678' }).telefono);
});

test('la validación rechaza un correo inválido', async () => {
  const { validateQuote } = await import('../js/formulario.js');

  assert.ok(validateQuote({ correo: 'ignacio@ejemplo' }).correo);
});

test('la validación exige veinte caracteres visibles en la descripción', async () => {
  const { validateQuote } = await import('../js/formulario.js');

  assert.ok(validateQuote({ descripcion: '1234567890123456789' }).descripcion);
});

test('la inicialización ignora formularios con un contrato incompleto', async () => {
  const { initQuoteForm } = await import('../js/formulario.js');

  for (const selector of [
    '[name="telefono"]',
    '[data-form-status]',
    '[data-quote-summary]',
    '[data-summary-list]',
  ]) {
    const dom = createQuoteDom();
    const documentRoot = dom.window.document;
    const form = documentRoot.querySelector('[data-quote-form]');
    documentRoot.querySelector(selector).remove();

    assert.doesNotThrow(() => initQuoteForm(documentRoot));
    assert.equal(submit(form, dom.window).defaultPrevented, false);
  }
});

test('el envío inválido se cancela, explica los campos y enfoca el primero', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const form = documentRoot.querySelector('[data-quote-form]');

  initQuoteForm(documentRoot);
  const event = submit(form, dom.window);

  assert.equal(event.defaultPrevented, true);
  assert.equal(documentRoot.activeElement, documentRoot.querySelector('[name="nombre"]'));
  for (const field of documentRoot.querySelectorAll('[name]')) {
    assert.equal(field.getAttribute('aria-invalid'), 'true');
    assert.match(field.getAttribute('aria-describedby'), new RegExp(`${field.id}-error`));
    assert.ok(documentRoot.querySelector(`#${field.id}-error`));
  }
  const status = documentRoot.querySelector('[data-form-status]');
  assert.equal(status.hidden, false);
  assert.equal(status.dataset.statusKind, 'error');
});

test('corregir un campo elimina su error asociado', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const form = documentRoot.querySelector('[data-quote-form]');
  const name = documentRoot.querySelector('[name="nombre"]');

  initQuoteForm(documentRoot);
  submit(form, dom.window);
  name.value = 'Ignacio';
  name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

  assert.equal(name.getAttribute('aria-invalid'), 'false');
  assert.equal(documentRoot.querySelector('#nombre-error'), null);
});

test('el envío válido muestra un resumen de simulación sin enviar el formulario', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const form = documentRoot.querySelector('[data-quote-form]');

  initQuoteForm(documentRoot);
  fillValidQuote(documentRoot);
  const event = submit(form, dom.window);
  const summary = documentRoot.querySelector('[data-quote-summary]');

  assert.equal(event.defaultPrevented, true);
  assert.equal(form.hidden, true);
  assert.equal(summary.hidden, false);
  assert.equal(summary.querySelector('strong').textContent, 'Simulación: esta solicitud todavía no fue enviada a la empresa');
  assert.match(summary.querySelector('[data-summary-list]').textContent, /Ignacio/);
  assert.equal(dom.window.localStorage.length, 0);
});

test('Editar datos restaura el formulario y enfoca su primer campo', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const form = documentRoot.querySelector('[data-quote-form]');

  initQuoteForm(documentRoot);
  fillValidQuote(documentRoot);
  submit(form, dom.window);
  documentRoot.querySelector('[data-edit-quote]').click();

  assert.equal(form.hidden, false);
  assert.equal(documentRoot.querySelector('[data-quote-summary]').hidden, true);
  assert.equal(documentRoot.activeElement, documentRoot.querySelector('[name="nombre"]'));
});

test('Limpiar formulario restablece los campos y oculta el resumen', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const form = documentRoot.querySelector('[data-quote-form]');
  const nativeReset = form.reset.bind(form);
  let resetCalls = 0;
  form.reset = () => {
    resetCalls += 1;
    nativeReset();
  };

  initQuoteForm(documentRoot);
  fillValidQuote(documentRoot);
  submit(form, dom.window);
  documentRoot.querySelector('[data-clear-quote]').click();

  assert.equal(resetCalls, 1);
  assert.equal(form.hidden, false);
  assert.equal(documentRoot.querySelector('[data-quote-summary]').hidden, true);
  assert.equal(documentRoot.querySelector('[name="nombre"]').value, '');
  assert.equal(documentRoot.querySelector('[name="consentimiento"]').checked, false);
});

test('los mensajes conservan las descripciones existentes al limpiar un error', async () => {
  const dom = createDom('<input id="nombre" aria-describedby="nombre-help"><p id="nombre-help">Ayuda</p>');
  const { setFieldError, clearFieldError } = await import('../js/mensajes.js');
  const field = dom.window.document.querySelector('#nombre');

  setFieldError(field, 'Ingresa tu nombre.');
  setFieldError(field, 'Ingresa tu nombre completo.');
  assert.equal(field.getAttribute('aria-invalid'), 'true');
  assert.equal(field.getAttribute('aria-describedby'), 'nombre-help nombre-error');
  assert.equal(dom.window.document.querySelectorAll('#nombre-error').length, 1);
  clearFieldError(field);

  assert.equal(field.getAttribute('aria-invalid'), 'false');
  assert.equal(field.getAttribute('aria-describedby'), 'nombre-help');
  assert.equal(dom.window.document.querySelector('#nombre-error'), null);
});
