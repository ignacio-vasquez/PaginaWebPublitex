export function initSessionNavigation(documentRoot = document, api = globalThis.fetch) {
  const link = documentRoot.querySelector('[data-session-link]');
  if (!link || typeof api !== 'function') return;

  void (async () => {
    try {
      const response = await api('/api/auth/session', { credentials: 'same-origin' });
      if (!response || (response.ok !== undefined && !response.ok)) return;
      const body = await response.json();
      if (body.authenticated === true) link.textContent = 'Mi cuenta';
    } catch {
      // Mantener el texto inicial permite acceder aunque la consulta falle.
    }
  })();
}
