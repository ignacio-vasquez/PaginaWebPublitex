export function initQuotationAccess(documentRoot = document, api = globalThis.fetch, navigate = (url) => { globalThis.location.href = url; }) {
  const form = documentRoot.querySelector('[data-simulator][data-quotation]');
  const status = documentRoot.querySelector('[data-quotation-status]');
  if (!form || !status || typeof api !== 'function') return { ready: Promise.resolve() };
  const ready = (async () => {
    try {
      const response = await api('/api/auth/session', { credentials: 'same-origin' });
      const session = await response.json();
      if (!response.ok || !session.authenticated) { navigate('acceso.html?returnTo=cotizacion.html'); return; }
      if (session.user?.role !== 'cliente') { status.textContent = 'Esta sección está disponible para clientes de Publitex.'; return; }
      form.hidden = false; status.textContent = '';
    } catch { status.textContent = 'No pudimos comprobar tu sesión. Actualiza la página e inténtalo nuevamente.'; }
  })();
  return { ready };
}
