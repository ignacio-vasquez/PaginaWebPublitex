import { renderSuperadmin } from './superadmin.js';

export function renderSessionNavigation(documentRoot, authenticated, session = {}, api = globalThis.fetch, navigate) {
  const staff = authenticated && ['jefe', 'trabajador', 'superadmin'].includes(session.user?.role);
  const workspaceLabel = session.user?.role === 'trabajador' ? 'Trabajos' : 'Gestión';
  renderSuperadmin(documentRoot, { ...session, authenticated }, api, navigate);
  documentRoot.querySelectorAll('[data-session-link]').forEach((link) => {
    link.textContent = authenticated ? 'Mi cuenta' : 'Ingresar';
  });
  documentRoot.querySelectorAll('[data-project-link]').forEach((link) => {
    link.textContent = staff ? workspaceLabel : authenticated ? 'Enviar presupuesto' : 'Simular proyecto';
    link.setAttribute('href', staff ? 'gestion.html' : authenticated ? 'presupuesto.html?new=1' : 'index.html#cotizacion');
  });
  documentRoot.querySelectorAll('[data-account-view] a[href="cotizaciones.html"], [data-account-workspace]').forEach(link => {
    link.dataset.accountWorkspace = '';
    link.textContent = staff ? workspaceLabel : 'Mis cotizaciones';
    link.setAttribute('href', staff ? 'gestion.html' : 'cotizaciones.html');
  });
  documentRoot.querySelectorAll('[data-quote-project]').forEach((button) => {
    button.hidden = !authenticated || staff;
  });
}

export function initSessionNavigation(documentRoot = document, api = globalThis.fetch) {
  if (typeof api !== 'function') return;

  void (async () => {
    try {
      const response = await api('/api/auth/session', { credentials: 'same-origin' });
      if (!response || (response.ok !== undefined && !response.ok)) return;
      const body = await response.json();
      renderSessionNavigation(documentRoot, body.authenticated === true, body, api);
    } catch {
      // Mantener el texto inicial permite acceder aunque la consulta falle.
    }
  })();
}
