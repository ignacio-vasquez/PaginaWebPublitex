const labels = { cliente: 'Cliente', jefe: 'Jefe', trabajador: 'Trabajador' };

export function renderSuperadmin(documentRoot, session) {
  documentRoot.querySelectorAll('[data-superadmin-controls], [data-simulation-banner]').forEach(node => node.remove());
  documentRoot.body.classList.remove('is-simulating');
  if (!session?.authenticated || (session.realUser || session.user)?.role !== 'superadmin') return;

  const controls = documentRoot.createElement('div');
  controls.dataset.superadminControls = '';
  const link = documentRoot.createElement('a');
  link.href = 'superadmin.html';
  link.textContent = 'Superadmin';
  controls.append(link);
  (documentRoot.querySelector('header') || documentRoot.body).append(controls);

  if (!session.simulation) return;
  const banner = documentRoot.createElement('aside');
  banner.dataset.simulationBanner = '';
  banner.setAttribute('aria-label', 'Actuando como otra persona');
  const text = documentRoot.createElement('strong');
  text.textContent = `Actuando como ${session.user.name || 'persona seleccionada'} (${labels[session.user.role] || session.user.role})`;
  const back = documentRoot.createElement('a');
  back.href = 'superadmin.html';
  back.textContent = 'Cambiar persona';
  banner.append(text, back);
  documentRoot.body.append(banner);
  documentRoot.body.classList.add('is-simulating');
}
