import { initMenu } from './menu.js';
import { initNavigation } from './navegacion.js';
import { initPortfolio } from './portafolio.js';
import { initSimulator } from './simulador.js';
import { initAccessPage } from './acceso.js';
import { initSessionNavigation } from './sesion-navegacion.js';
import { initQuotePage } from './cotizaciones.js';
import { initWorkPage } from './gestion.js';
import { initSuperadminPanel } from './superadmin-panel.js';
import { initInvoiceArchive } from './facturas.js';

export function initApp(documentRoot = document) {
  initMenu(documentRoot);
  initNavigation(documentRoot);
  initPortfolio(documentRoot);
  initSimulator(documentRoot);
  initAccessPage(documentRoot);
  initQuotePage(documentRoot);
  initWorkPage(documentRoot);
  initSuperadminPanel(documentRoot);
  initInvoiceArchive(documentRoot);
  if (!documentRoot.querySelector('[data-auth-view], [data-work-page], [data-superadmin-page], [data-invoice-page]')) initSessionNavigation(documentRoot);
}

initApp();
