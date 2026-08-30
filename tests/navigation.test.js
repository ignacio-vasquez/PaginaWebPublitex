const test = require('node:test');
const assert = require('node:assert/strict');
const { createDom, loadHomepageDom } = require('./dom');

test('el HTML sin JavaScript muestra la navegación y oculta el botón móvil inactivo', async () => {
  const dom = loadHomepageDom();
  const { initMenu } = await import('../js/menu.js');
  const button = dom.window.document.querySelector('#menu-button');
  const navigation = dom.window.document.querySelector('#primary-navigation');

  assert.equal(button.hidden, true);
  assert.equal(navigation.hidden, false);

  initMenu(dom.window.document);

  assert.equal(button.hidden, false);
  assert.equal(navigation.hidden, true);
});

test('el botón abre el menú y Escape lo cierra devolviendo el foco', async () => {
  const dom = createDom('<button id="menu-button" aria-expanded="false" aria-controls="primary-navigation">Menú</button><nav id="primary-navigation" hidden><a href="#servicios">Servicios</a></nav>');
  const { initMenu } = await import('../js/menu.js');
  const button = dom.window.document.querySelector('#menu-button');
  const nav = dom.window.document.querySelector('#primary-navigation');
  initMenu(dom.window.document);
  button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(nav.hidden, false);
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(nav.hidden, true);
  assert.equal(dom.window.document.activeElement, button);
});

test('elegir un enlace cierra el menú', async () => {
  const dom = createDom('<button id="menu-button" aria-expanded="true" aria-controls="primary-navigation">Menú</button><nav id="primary-navigation"><a href="#servicios">Servicios</a></nav>');
  const { initMenu } = await import('../js/menu.js');
  initMenu(dom.window.document);
  dom.window.document.querySelector('a').click();
  assert.equal(dom.window.document.querySelector('button').getAttribute('aria-expanded'), 'false');
});

test('entrar al breakpoint de escritorio restablece el estado semántico del menú', async () => {
  const dom = createDom('<button id="menu-button" aria-expanded="false" aria-controls="primary-navigation">Menú</button><nav id="primary-navigation"><a href="#servicios">Servicios</a></nav>');
  const { initMenu } = await import('../js/menu.js');
  const button = dom.window.document.querySelector('#menu-button');
  const navigation = dom.window.document.querySelector('#primary-navigation');
  let breakpointListener;
  const originalMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = () => ({
    matches: false,
    addEventListener(type, listener) {
      if (type === 'change') breakpointListener = listener;
    },
  });

  try {
    initMenu(dom.window.document);
    button.click();
    assert.equal(button.getAttribute('aria-expanded'), 'true');

    breakpointListener({ matches: true });

    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(navigation.hidden, false);
  } finally {
    globalThis.matchMedia = originalMatchMedia;
  }
});

test('la sección visible marca únicamente su enlace de navegación', async () => {
  const dom = createDom(`
    <nav>
      <a data-section-link href="#inicio">Inicio</a>
      <a data-section-link href="#servicios">Servicios</a>
      <a data-section-link href="#trabajos">Trabajos</a>
      <a data-section-link href="#empresa">Nosotros</a>
      <a data-section-link href="#contacto">Contacto</a>
    </nav>
    <main>
      <section id="inicio"></section>
      <section id="servicios"></section>
      <section id="trabajos"></section>
      <section id="empresa"></section>
      <section id="contacto"></section>
    </main>
  `);
  const { initNavigation } = await import('../js/navegacion.js');
  let callback;

  class FakeObserver {
    constructor(observerCallback) {
      callback = observerCallback;
    }

    observe() {}
  }

  initNavigation(dom.window.document, FakeObserver);
  const section = dom.window.document.querySelector('#trabajos');
  callback([{ isIntersecting: true, target: section }]);

  const links = dom.window.document.querySelectorAll('[data-section-link]');
  assert.equal(links[2].getAttribute('aria-current'), 'location');
  assert.equal(links[0].hasAttribute('aria-current'), false);
  assert.equal(links[1].hasAttribute('aria-current'), false);
  assert.equal(links[3].hasAttribute('aria-current'), false);
  assert.equal(links[4].hasAttribute('aria-current'), false);
});

test('la navegación activa no falla sin IntersectionObserver', async () => {
  const dom = createDom('<a data-section-link href="#inicio">Inicio</a><section id="inicio"></section>');
  const { initNavigation } = await import('../js/navegacion.js');

  assert.doesNotThrow(() => initNavigation(dom.window.document, undefined));
});
