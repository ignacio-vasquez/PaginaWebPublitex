import { renderSessionNavigation } from './sesion-navegacion.js';

export function initSuperadminPanel(documentRoot = document, api = globalThis.fetch, navigate = url => { globalThis.location.href = url; }) {
  const root = documentRoot.querySelector('[data-superadmin-page]');
  if (!root || typeof api !== 'function') return;
  const status = root.querySelector('[data-superadmin-status]');
  const list = root.querySelector('[data-actor-list]');
  const tabs = [...root.querySelectorAll('[data-actor-tab]')];
  let actors = { staff: [], clients: [] };
  let selected = 'staff';
  let busy = false;

  function render() {
    tabs.forEach(tab => {
      const active = tab.dataset.actorTab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    list.replaceChildren();
    const people = actors[selected];
    if (!people.length) {
      const empty = documentRoot.createElement('p');
      empty.textContent = selected === 'staff' ? 'Aún no hay funcionarios.' : 'Aún no hay clientes.';
      list.append(empty);
      return;
    }
    for (const person of people) {
      const row = documentRoot.createElement('article');
      row.dataset.actorRow = '';
      const info = documentRoot.createElement('div');
      const name = documentRoot.createElement('h2');
      name.textContent = person.name;
      const detail = documentRoot.createElement('p');
      detail.textContent = `${person.role === 'jefe' ? 'Jefe' : person.role === 'trabajador' ? 'Trabajador' : 'Cliente'} · ${person.email}`;
      info.append(name, detail);
      const button = documentRoot.createElement('button');
      button.type = 'button';
      button.textContent = 'Actuar como';
      button.dataset.actAs = person.id;
      button.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        root.querySelectorAll('[data-act-as]').forEach(control => { control.disabled = true; });
        status.textContent = `Entrando como ${person.name}…`;
        try {
          const response = await api('/api/superadmin/act-as', {
            method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ targetUserId: person.id }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || 'No pudimos cambiar de persona.');
          navigate(body.user.role === 'cliente' ? 'cotizaciones.html' : 'gestion.html');
        } catch (error) {
          status.textContent = error.message || 'No pudimos conectar.';
        } finally {
          busy = false;
          root.querySelectorAll('[data-act-as]').forEach(control => { control.disabled = false; });
        }
      });
      row.append(info, button);
      list.append(row);
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { selected = tab.dataset.actorTab; render(); });
    tab.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault();
      tabs[next].focus();
      selected = tabs[next].dataset.actorTab;
      render();
    });
  });
  void (async () => {
    try {
      const sessionResponse = await api('/api/auth/session', { credentials: 'same-origin' });
      const session = await sessionResponse.json();
      renderSessionNavigation(documentRoot, session.authenticated === true, session, api, navigate);
      if (!session.authenticated || (session.realUser || session.user)?.role !== 'superadmin') {
        status.textContent = 'Ingresa con tu cuenta superadmin para elegir una persona.';
        return;
      }
      const response = await api('/api/superadmin/actors', { credentials: 'same-origin' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No pudimos cargar las personas.');
      actors = body;
      render();
      status.textContent = 'Elige una persona para continuar con tu misma sesión.';
    } catch (error) { status.textContent = error.message || 'No pudimos conectar.'; }
  })();
}
