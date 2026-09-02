import { initMenu } from './menu.js';
import { initNavigation } from './navegacion.js';
import { initPortfolio } from './portafolio.js';
import { initSimulator } from './simulador.js';
import { initAccessPage } from './acceso.js';
import { initSessionNavigation } from './sesion-navegacion.js';

export function initApp(documentRoot = document) {
  initMenu(documentRoot);
  initNavigation(documentRoot);
  initPortfolio(documentRoot);
  initSimulator(documentRoot);
  initAccessPage(documentRoot);
  if (!documentRoot.querySelector('[data-auth-view]')) initSessionNavigation(documentRoot);
}

initApp();
