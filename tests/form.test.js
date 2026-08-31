const test = require('node:test');
const assert = require('node:assert/strict');
const { createDom } = require('./dom');
const { loadHomepage } = require('./html');

function createQuoteDom() {
  return createDom(`
    <section>
      <div data-quote-form role="form" aria-labelledby="quote-form-title">
        <h2 id="quote-form-title" data-form-title>Cotización</h2>
        <p><label for="nombre">Nombre</label><input id="nombre" name="nombre"></p>
        <p><label for="empresa-cliente">Empresa</label><input id="empresa-cliente" name="empresa-cliente"></p>
        <p><label for="telefono">Teléfono</label><input id="telefono" name="telefono"></p>
        <p><label for="correo">Correo</label><input id="correo" name="correo"></p>
        <p><label for="servicio">Tipo de trabajo</label><select id="servicio" name="servicio"><option value="">Selecciona una opción</option><option value="letrero">Letrero luminoso</option></select></p>
        <p><label for="descripcion">Descripción</label><textarea id="descripcion" name="descripcion"></textarea></p>
        <p><label><input id="consentimiento" name="consentimiento" type="checkbox"> Autorizo el uso de estos datos.</label></p>
        <div class="form-status" data-form-status role="status" aria-live="polite" hidden></div>
        <button type="button" data-submit-quote>Enviar solicitud</button>
      </div>
      <section data-requests-view hidden>
        <article data-active-request tabindex="-1">
          <h3>Solicitud principal</h3>
          <p><strong>Simulación: estas solicitudes todavía no fueron enviadas a la empresa</strong></p>
          <dl data-active-request-list></dl>
          <button type="button" data-edit-active>Editar</button>
          <button type="button" data-delete-active>Eliminar</button>
          <button type="button" data-create-request>Crear otra solicitud</button>
        </article>
        <section data-request-history aria-labelledby="request-history-title" hidden>
          <h3 id="request-history-title">Otras solicitudes preparadas</h3>
          <ul data-request-list></ul>
        </section>
        </section>
        <div data-requests-status role="status" aria-live="polite" hidden></div>
        <div id="request-delete-dialog" role="alertdialog" aria-modal="true"
             aria-labelledby="request-delete-title" aria-describedby="request-delete-description" hidden>
          <div data-request-delete-panel>
            <h3 id="request-delete-title">Eliminar solicitud</h3>
            <p id="request-delete-description" data-delete-description></p>
            <button type="button" data-confirm-delete>Eliminar solicitud</button>
            <button type="button" data-cancel-delete>Cancelar</button>
          </div>
        </div>
      <button type="button" data-cancel-form hidden>Cancelar</button>
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

function fillQuote(documentRoot, values) {
  fillValidQuote(documentRoot);
  for (const [name, value] of Object.entries(values)) {
    const field = documentRoot.querySelector(`[name="${name}"]`);
    if (field.type === 'checkbox') field.checked = value;
    else field.value = value;
  }
}

function submit(form, window) {
  const event = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  form.querySelector('[data-submit-quote]').dispatchEvent(event);
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

test('conserva solicitudes anteriores y permite seleccionar una del historial', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const ids = ['request-ana', 'request-beto'];
  const times = ['2026-08-30T10:00:00.000Z', '2026-08-30T11:00:00.000Z'];

  initQuoteForm(documentRoot, {
    createId: () => ids.shift(),
    now: () => times.shift(),
  });
  fillQuote(documentRoot, { nombre: 'Ana', 'empresa-cliente': 'Taller Sur' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);
  documentRoot.querySelector('[data-create-request]').click();
  fillQuote(documentRoot, { nombre: 'Beto', 'empresa-cliente': 'Rótulos Norte' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);

  const active = documentRoot.querySelector('[data-active-request]');
  const history = documentRoot.querySelector('[data-request-history]');
  let historyItems = history.querySelectorAll('[data-request-item]');
  assert.match(active.querySelector('[data-active-request-list]').textContent, /Beto/);
  assert.equal(active.querySelector('strong').textContent, 'Simulación: estas solicitudes todavía no fueron enviadas a la empresa');
  assert.equal(historyItems.length, 1);
  assert.match(historyItems[0].textContent, /Ana/);
  assert.equal(historyItems[0].querySelector('[data-view-request]').textContent, 'Mostrar como principal');
  assert.match(loadHomepage(), /<h3>Solicitud principal<\/h3>/);

  historyItems[0].querySelector('[data-view-request]').click();
  historyItems = history.querySelectorAll('[data-request-item]');
  assert.match(active.querySelector('[data-active-request-list]').textContent, /Ana/);
  assert.equal(historyItems.length, 1);
  assert.match(historyItems[0].textContent, /Beto/);
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
    '[data-submit-quote]',
    '[data-requests-view]',
    '[data-active-request-list]',
  ]) {
    const dom = createQuoteDom();
    const documentRoot = dom.window.document;
    const form = documentRoot.querySelector('[data-quote-form]');
    documentRoot.querySelector(selector).remove();

    assert.doesNotThrow(() => initQuoteForm(documentRoot));
    if (selector === '[data-submit-quote]') continue;
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
  for (const field of documentRoot.querySelectorAll('[name]:not([name="empresa-cliente"])')) {
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

test('validar mientras se escribe conserva un espacio separador recién ingresado', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const name = dom.window.document.querySelector('[name="nombre"]');

  initQuoteForm(dom.window.document);
  for (const character of 'Ana ') {
    name.value += character;
    name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  }

  assert.equal(name.value, 'Ana ');
});

test('el envío válido muestra un resumen de simulación sin enviar el formulario', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const form = documentRoot.querySelector('[data-quote-form]');

  initQuoteForm(documentRoot);
  fillValidQuote(documentRoot);
  const event = submit(form, dom.window);
  const summary = documentRoot.querySelector('[data-requests-view]');

  assert.equal(event.defaultPrevented, true);
  assert.equal(form.hidden, true);
  assert.equal(summary.hidden, false);
  assert.equal(summary.querySelector('strong').textContent, 'Simulación: estas solicitudes todavía no fueron enviadas a la empresa');
  assert.match(summary.querySelector('[data-active-request-list]').textContent, /Ignacio/);
  assert.equal(documentRoot.activeElement, summary.querySelector('[data-active-request]'));
  assert.equal(dom.window.localStorage.length, 0);
});

test('crea una solicitud aunque randomUUID no esté disponible en HTTP local', async () => {
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {},
  });

  try {
    initQuoteForm(documentRoot, { now: () => '2026-08-30T10:00:00.000Z' });
    fillValidQuote(documentRoot);
    submit(documentRoot.querySelector('[data-quote-form]'), dom.window);

    assert.equal(documentRoot.querySelector('[data-quote-form]').hidden, true);
    assert.equal(documentRoot.querySelector('[data-requests-view]').hidden, false);
    assert.match(documentRoot.querySelector('[data-active-request-list]').textContent, /Ignacio/);
  } finally {
    Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
  }
});

test('Editar datos restaura el formulario y enfoca su primer campo', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const form = documentRoot.querySelector('[data-quote-form]');

  initQuoteForm(documentRoot);
  fillValidQuote(documentRoot);
  submit(form, dom.window);
  documentRoot.querySelector('[data-edit-active]').click();

  assert.equal(form.hidden, false);
  assert.equal(documentRoot.querySelector('[data-requests-view]').hidden, true);
  assert.equal(documentRoot.activeElement, documentRoot.querySelector('[name="nombre"]'));
});

test('Crear otra solicitud reinicia el flujo y enfoca el primer campo', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const form = documentRoot.querySelector('[data-quote-form]');
  initQuoteForm(documentRoot);
  fillValidQuote(documentRoot);
  submit(form, dom.window);
  documentRoot.querySelector('[data-create-request]').click();

  assert.equal(form.hidden, false);
  assert.equal(documentRoot.querySelector('[data-requests-view]').hidden, true);
  assert.equal(documentRoot.querySelector('[data-cancel-form]').hidden, false);
  assert.equal(documentRoot.querySelector('[name="nombre"]').value, '');
  assert.equal(documentRoot.querySelector('[name="consentimiento"]').checked, false);
  assert.equal(documentRoot.activeElement, documentRoot.querySelector('[name="nombre"]'));
  assert.match(loadHomepage(), /data-create-request>Crear otra solicitud<\/button>/);
});

test('oculta anuncios anteriores al entrar en crear o editar', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const ids = ['request-ana', 'request-beto'];

  initQuoteForm(documentRoot, { createId: () => ids.shift(), now: () => '2026-08-30T10:00:00.000Z' });
  fillQuote(documentRoot, { nombre: 'Ana' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);
  const requestsStatus = documentRoot.querySelector('[data-requests-status]');
  assert.equal(requestsStatus.hidden, false);

  documentRoot.querySelector('[data-create-request]').click();
  assert.equal(requestsStatus.hidden, true);

  fillQuote(documentRoot, { nombre: 'Beto' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);
  assert.equal(requestsStatus.hidden, false);
  documentRoot.querySelector('[data-request-item] [data-edit-request]').click();
  assert.equal(requestsStatus.hidden, true);
});

test('actualiza el título de modo en el contrato público al crear y editar', async () => {
  const dom = createDom(loadHomepage());
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const title = documentRoot.querySelector('[data-form-title]');
  const ids = ['request-public'];

  initQuoteForm(documentRoot, {
    createId: () => ids.shift(),
    now: () => '2026-08-30T10:00:00.000Z',
  });
  fillValidQuote(documentRoot);
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);
  assert.equal(title.textContent, 'Crear solicitud');

  documentRoot.querySelector('[data-edit-active]').click();
  assert.equal(title.textContent, 'Editar solicitud');
});

test('editar una solicitud del historial conserva aislada la otra solicitud', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const ids = ['request-ana', 'request-beto'];

  initQuoteForm(documentRoot, { createId: () => ids.shift(), now: () => '2026-08-30T10:00:00.000Z' });
  fillQuote(documentRoot, { nombre: 'Ana', 'empresa-cliente': 'Taller Sur' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);
  documentRoot.querySelector('[data-create-request]').click();
  fillQuote(documentRoot, { nombre: 'Beto', 'empresa-cliente': 'Rótulos Norte' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);

  const anaItem = documentRoot.querySelector('[data-request-item]');
  const anaId = anaItem.querySelector('[data-view-request]').dataset.requestId;
  anaItem.querySelector('[data-edit-request]').click();
  assert.equal(documentRoot.querySelector('[name="nombre"]').value, 'Ana');
  assert.equal(documentRoot.querySelector('[name="empresa-cliente"]').value, 'Taller Sur');
  documentRoot.querySelector('[name="nombre"]').value = 'Ana Editada';
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);

  const active = documentRoot.querySelector('[data-active-request-list]');
  assert.match(active.textContent, /Ana Editada/);
  assert.match(documentRoot.querySelector('[data-request-item]').textContent, /Beto/);
  assert.equal(documentRoot.querySelector('[data-edit-active]').dataset.requestId, anaId);
});

test('cancelar una edición descarta cambios y restaura la solicitud activa anterior', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const ids = ['request-ana', 'request-beto'];

  initQuoteForm(documentRoot, { createId: () => ids.shift(), now: () => '2026-08-30T10:00:00.000Z' });
  fillQuote(documentRoot, { nombre: 'Ana' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);
  documentRoot.querySelector('[data-create-request]').click();
  fillQuote(documentRoot, { nombre: 'Beto' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);

  documentRoot.querySelector('[data-request-item] [data-edit-request]').click();
  documentRoot.querySelector('[name="nombre"]').value = 'Cambio descartado';
  documentRoot.querySelector('[data-cancel-form]').click();

  assert.match(documentRoot.querySelector('[data-active-request-list]').textContent, /Beto/);
  assert.match(documentRoot.querySelector('[data-request-item]').textContent, /Ana/);
  assert.doesNotMatch(documentRoot.querySelector('[data-active-request-list]').textContent, /Cambio descartado/);
});

test('el diálogo de eliminación contiene el foco y restaura el disparador exacto al cancelar', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const ids = ['request-ana', 'request-beto'];

  initQuoteForm(documentRoot, { createId: () => ids.shift(), now: () => '2026-08-30T10:00:00.000Z' });
  fillQuote(documentRoot, { nombre: 'Ana' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);
  documentRoot.querySelector('[data-create-request]').click();
  fillQuote(documentRoot, { nombre: 'Beto' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);

  const trigger = [...documentRoot.querySelectorAll('[data-delete-request]')]
    .find((button) => button.dataset.requestId === 'request-ana');
  const dialog = documentRoot.querySelector('#request-delete-dialog');
  const confirm = dialog.querySelector('[data-confirm-delete]');
  const cancel = dialog.querySelector('[data-cancel-delete]');
  trigger.click();

  assert.equal(dialog.hidden, false);
  assert.match(dialog.querySelector('[data-delete-description]').textContent, /Ana/);
  assert.equal(documentRoot.activeElement, cancel);
  assert.equal(documentRoot.querySelector('[data-quote-form]').hasAttribute('inert'), true);

  const tabForward = new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  cancel.dispatchEvent(tabForward);
  assert.equal(tabForward.defaultPrevented, true);
  assert.equal(documentRoot.activeElement, confirm);
  const tabBackward = new dom.window.KeyboardEvent('keydown', {
    key: 'Tab', shiftKey: true, bubbles: true, cancelable: true,
  });
  confirm.dispatchEvent(tabBackward);
  assert.equal(tabBackward.defaultPrevented, true);
  assert.equal(documentRoot.activeElement, cancel);

  documentRoot.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(dialog.hidden, true);
  assert.equal(documentRoot.activeElement, trigger);
  assert.match(documentRoot.querySelector('[data-active-request-list]').textContent, /Beto/);
  assert.match(documentRoot.querySelector('[data-request-list]').textContent, /Ana/);
  assert.equal(documentRoot.querySelector('[data-quote-form]').hasAttribute('inert'), false);
});

test('eliminar una solicitud no activa conserva el detalle activo y anuncia el cambio', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const ids = ['request-ana', 'request-beto'];

  initQuoteForm(documentRoot, { createId: () => ids.shift(), now: () => '2026-08-30T10:00:00.000Z' });
  fillQuote(documentRoot, { nombre: 'Ana' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);
  documentRoot.querySelector('[data-create-request]').click();
  fillQuote(documentRoot, { nombre: 'Beto' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);

  const activeBefore = documentRoot.querySelector('[data-active-request-list]').textContent;
  documentRoot.querySelector('[data-request-item] [data-delete-request]').click();
  documentRoot.querySelector('[data-confirm-delete]').click();

  assert.equal(documentRoot.querySelector('[data-active-request-list]').textContent, activeBefore);
  assert.equal(documentRoot.querySelector('[data-request-history]').hidden, true);
  const requestsStatus = documentRoot.querySelector('[data-requests-status]');
  assert.equal(requestsStatus.hidden, false);
  assert.equal(requestsStatus.textContent, 'Solicitud eliminada. Tus otras solicitudes preparadas no cambiaron.');
  assert.equal(documentRoot.activeElement, documentRoot.querySelector('[data-active-request]'));
});

test('eliminar la solicitud activa selecciona la más reciente restante', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const ids = ['request-ana', 'request-beto'];

  initQuoteForm(documentRoot, { createId: () => ids.shift(), now: () => '2026-08-30T10:00:00.000Z' });
  fillQuote(documentRoot, { nombre: 'Ana' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);
  documentRoot.querySelector('[data-create-request]').click();
  fillQuote(documentRoot, { nombre: 'Beto' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);

  documentRoot.querySelector('[data-delete-active]').click();
  documentRoot.querySelector('[data-confirm-delete]').click();

  assert.match(documentRoot.querySelector('[data-active-request-list]').textContent, /Ana/);
  assert.equal(documentRoot.querySelector('[data-active-request]').dataset.requestId, undefined);
  assert.equal(documentRoot.activeElement, documentRoot.querySelector('[data-active-request]'));
  assert.equal(documentRoot.querySelector('[data-requests-status]').textContent,
    'Solicitud eliminada. Tus otras solicitudes preparadas no cambiaron.');
});

test('eliminar la última solicitud entra al formulario vacío y enfoca Nombre', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;

  initQuoteForm(documentRoot, { createId: () => 'request-ana', now: () => '2026-08-30T10:00:00.000Z' });
  fillQuote(documentRoot, { nombre: 'Ana' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);
  documentRoot.querySelector('[data-delete-active]').click();
  documentRoot.querySelector('[data-confirm-delete]').click();

  assert.equal(documentRoot.querySelector('[data-requests-view]').hidden, true);
  assert.equal(documentRoot.querySelector('[data-quote-form]').hidden, false);
  assert.equal(documentRoot.querySelector('[name="nombre"]').value, '');
  assert.equal(documentRoot.activeElement, documentRoot.querySelector('[name="nombre"]'));
  const requestsStatus = documentRoot.querySelector('[data-requests-status]');
  assert.equal(requestsStatus.hidden, false);
  for (let ancestor = requestsStatus.parentElement; ancestor && ancestor !== documentRoot.body; ancestor = ancestor.parentElement) {
    assert.equal(ancestor.hidden, false);
  }
  assert.equal(requestsStatus.textContent,
    'Solicitud eliminada. No quedan solicitudes preparadas.');
});

test('cancelar el formulario vacío tras eliminar la última solicitud conserva el control de creación', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;

  initQuoteForm(documentRoot, { createId: () => 'request-ana', now: () => '2026-08-30T10:00:00.000Z' });
  fillQuote(documentRoot, { nombre: 'Ana' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);
  documentRoot.querySelector('[data-delete-active]').click();
  documentRoot.querySelector('[data-confirm-delete]').click();
  documentRoot.querySelector('[data-cancel-form]').click();

  assert.equal(documentRoot.querySelector('[data-requests-view]').hidden, true);
  assert.equal(documentRoot.querySelector('[data-quote-form]').hidden, false);
  assert.equal(documentRoot.querySelector('[data-cancel-form]').hidden, false);
  assert.equal(documentRoot.activeElement, documentRoot.querySelector('[name="nombre"]'));
});

test('el diálogo de eliminación bloquea scroll y restaura la clase previa en todos sus cierres', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;
  const body = documentRoot.body;

  initQuoteForm(documentRoot, { createId: () => 'request-ana', now: () => '2026-08-30T10:00:00.000Z' });
  fillQuote(documentRoot, { nombre: 'Ana' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);
  const trigger = documentRoot.querySelector('[data-delete-active]');
  const dialog = documentRoot.querySelector('#request-delete-dialog');

  trigger.click();
  assert.equal(body.classList.contains('dialog-open'), true);
  dialog.querySelector('[data-cancel-delete]').click();
  assert.equal(body.classList.contains('dialog-open'), false);

  trigger.click();
  documentRoot.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(body.classList.contains('dialog-open'), false);

  trigger.click();
  dialog.querySelector('[data-confirm-delete]').click();
  assert.equal(body.classList.contains('dialog-open'), false);

  body.classList.add('dialog-open');
  fillValidQuote(documentRoot);
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);
  documentRoot.querySelector('[data-delete-active]').click();
  dialog.querySelector('[data-cancel-delete]').click();
  assert.equal(body.classList.contains('dialog-open'), true);
});

test('los identificadores de eliminación desconocidos no alteran la vista', async () => {
  const dom = createQuoteDom();
  const { initQuoteForm } = await import('../js/formulario.js');
  const documentRoot = dom.window.document;

  initQuoteForm(documentRoot, { createId: () => 'request-ana', now: () => '2026-08-30T10:00:00.000Z' });
  fillQuote(documentRoot, { nombre: 'Ana' });
  submit(documentRoot.querySelector('[data-quote-form]'), dom.window);
  const requestsView = documentRoot.querySelector('[data-requests-view]');
  const staleTrigger = documentRoot.createElement('button');
  staleTrigger.type = 'button';
  staleTrigger.dataset.deleteRequest = '';
  staleTrigger.dataset.requestId = 'stale-id';
  requestsView.append(staleTrigger);
  const activeBefore = documentRoot.querySelector('[data-active-request-list]').textContent;

  assert.doesNotThrow(() => staleTrigger.click());
  assert.equal(documentRoot.querySelector('#request-delete-dialog').hidden, true);
  assert.equal(documentRoot.querySelector('[data-active-request-list]').textContent, activeBefore);
  assert.equal(documentRoot.querySelector('[data-delete-active]').dataset.requestId, 'request-ana');
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
