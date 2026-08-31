import { initMenu } from './menu.js';
import { initNavigation } from './navegacion.js';
import { initPortfolio } from './portafolio.js';
import { initQuoteForm } from './formulario.js';
import { initAccessPage } from './acceso.js';
import { initSessionNavigation } from './sesion-navegacion.js';

export function initApp(documentRoot = document) {
  initMenu(documentRoot);
  initNavigation(documentRoot);
  initPortfolio(documentRoot);
  initQuoteForm(documentRoot);
  initAccessPage(documentRoot);
  initSessionNavigation(documentRoot);
}

initApp();
