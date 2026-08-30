const test = require('node:test');
const assert = require('node:assert/strict');
const { createDom } = require('./dom');

function createPortfolioDom() {
  return createDom(`
    <section id="trabajos">
      <div aria-label="Filtrar trabajos">
        <button type="button" data-filter="all" aria-pressed="true">Todos</button>
        <button type="button" data-filter="letreros" aria-pressed="false">Letreros</button>
        <button type="button" data-filter="vehiculos" aria-pressed="false">Vehículos</button>
        <button type="button" data-filter="adhesivos" aria-pressed="false">Adhesivos</button>
      </div>
      <figure data-category="letreros">
        <img src="letrero.svg" alt="Letrero luminoso">
        <figcaption>Letrero para local comercial</figcaption>
        <button type="button" data-portfolio-open>Ver trabajo</button>
      </figure>
      <figure data-category="vehiculos">
        <img src="camion.svg" alt="Camión rotulado">
        <figcaption>Rotulación de vehículo comercial</figcaption>
        <button type="button" data-portfolio-open>Ver trabajo</button>
      </figure>
      <figure data-category="adhesivos">
        <img src="vitrina.svg" alt="Vitrina con adhesivos">
        <figcaption>Adhesivos para vitrina</figcaption>
        <button type="button" data-portfolio-open>Ver trabajo</button>
      </figure>
    </section>
    <div id="portfolio-dialog" role="dialog" aria-modal="true" aria-labelledby="portfolio-dialog-title" hidden>
      <div data-dialog-panel>
        <button type="button" data-dialog-close>Cerrar</button>
        <img data-dialog-image alt="">
        <h3 id="portfolio-dialog-title" data-dialog-title></h3>
      </div>
    </div>
  `);
}

test('filtrar vehículos deja visible solo el trabajo correspondiente', async () => {
  const dom = createPortfolioDom();
  const { initPortfolio } = await import('../js/portafolio.js');
  const documentRoot = dom.window.document;

  initPortfolio(documentRoot);
  documentRoot.querySelector('[data-filter="vehiculos"]').click();

  const filters = documentRoot.querySelectorAll('[data-filter]');
  const figures = documentRoot.querySelectorAll('#trabajos figure');
  assert.equal(filters[0].getAttribute('aria-pressed'), 'false');
  assert.equal(filters[1].getAttribute('aria-pressed'), 'false');
  assert.equal(filters[2].getAttribute('aria-pressed'), 'true');
  assert.equal(filters[3].getAttribute('aria-pressed'), 'false');
  assert.equal(figures[0].hidden, true);
  assert.equal(figures[1].hidden, false);
  assert.equal(figures[2].hidden, true);
});

test('abrir un trabajo muestra su contenido y Escape restaura el foco', async () => {
  const dom = createPortfolioDom();
  const { initPortfolio } = await import('../js/portafolio.js');
  const documentRoot = dom.window.document;
  const trigger = documentRoot.querySelector('[data-category="vehiculos"] [data-portfolio-open]');
  const dialog = documentRoot.querySelector('#portfolio-dialog');
  const closeButton = dialog.querySelector('[data-dialog-close]');

  initPortfolio(documentRoot);
  trigger.focus();
  trigger.click();

  assert.equal(dialog.hidden, false);
  assert.equal(documentRoot.body.classList.contains('dialog-open'), true);
  assert.equal(dialog.querySelector('[data-dialog-image]').src, 'http://localhost/camion.svg');
  assert.equal(dialog.querySelector('[data-dialog-image]').getAttribute('alt'), 'Camión rotulado');
  assert.equal(dialog.querySelector('[data-dialog-title]').textContent, 'Rotulación de vehículo comercial');
  assert.equal(documentRoot.activeElement, closeButton);

  documentRoot.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  assert.equal(dialog.hidden, true);
  assert.equal(documentRoot.body.classList.contains('dialog-open'), false);
  assert.equal(documentRoot.activeElement, trigger);
});

test('el visor se cierra desde su control y al hacer clic en el fondo', async () => {
  const dom = createPortfolioDom();
  const { initPortfolio } = await import('../js/portafolio.js');
  const documentRoot = dom.window.document;
  const trigger = documentRoot.querySelector('[data-portfolio-open]');
  const dialog = documentRoot.querySelector('#portfolio-dialog');

  initPortfolio(documentRoot);
  trigger.focus();
  trigger.click();
  dialog.querySelector('[data-dialog-close]').click();
  assert.equal(dialog.hidden, true);

  trigger.focus();
  trigger.click();
  dialog.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(dialog.hidden, true);
  assert.equal(documentRoot.activeElement, trigger);
});
