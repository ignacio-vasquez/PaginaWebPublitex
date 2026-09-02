const roleLabels = {
  cliente: 'Cliente',
  trabajador: 'Trabajador',
  jefe: 'Jefe',
  superadmin: 'Superadministrador',
};

function isSuccessful(response) {
  return response && (response.ok === undefined ? response.status < 400 : response.ok);
}

async function readBody(response) {
  if (!response || response.status === 204) return {};
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function clearPasswords(documentRoot) {
  documentRoot.querySelectorAll('input[type="password"]').forEach((field) => {
    field.value = '';
  });
}

function roleLabel(role) {
  return roleLabels[role] || 'Usuario';
}

export function initAccessPage(
  documentRoot = document,
  api = globalThis.fetch,
  locationObject = globalThis.location,
  navigate = (url) => { globalThis.location.href = url; },
) {
  const authView = documentRoot.querySelector('[data-auth-view]');
  const accountView = documentRoot.querySelector('[data-account-view]');
  const status = documentRoot.querySelector('[data-auth-status]');
  const loginForm = documentRoot.querySelector('[data-login-form]');
  const registerForm = documentRoot.querySelector('[data-register-form]');
  const logoutButton = documentRoot.querySelector('[data-logout]');

  if (!authView || !accountView || !status || !loginForm || !registerForm || !logoutButton
    || typeof api !== 'function') return;

  const sessionLink = documentRoot.querySelector('[data-session-link]');
  let sessionStateVersion = 0;
  const requestedReturn = new URLSearchParams(locationObject?.search || '').get('returnTo');
  const returnTo = new Set(['cotizaciones.html']).has(requestedReturn) ? requestedReturn : null;

  const showSessionLink = (authenticated) => {
    if (sessionLink) sessionLink.textContent = authenticated ? 'Mi cuenta' : 'Ingresar';
  };

  const showStatus = (message, kind = 'info') => {
    status.textContent = message;
    status.dataset.statusKind = kind;
    status.hidden = false;
    status.focus();
  };

  const showAccount = (user = {}) => {
    accountView.querySelector('[data-account-name]').textContent = typeof user.name === 'string' ? user.name : '';
    accountView.querySelector('[data-account-email]').textContent = typeof user.email === 'string' ? user.email : '';
    accountView.querySelector('[data-account-role]').textContent = roleLabel(user.role);
    authView.hidden = true;
    accountView.hidden = false;
  };

  const showAuth = () => {
    authView.hidden = false;
    accountView.hidden = true;
  };

  const formData = (form) => new documentRoot.defaultView.FormData(form);

  const submit = async (form, endpoint, payload, successMessage) => {
    try {
      const response = await api(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await readBody(response);
      if (!isSuccessful(response) || !body.user) {
        showStatus(body.error || 'No pudimos completar la solicitud. Inténtalo nuevamente.', 'error');
        return;
      }
      sessionStateVersion += 1;
      showAccount(body.user);
      showSessionLink(true);
      showStatus(successMessage, 'success');
      if (returnTo) navigate(returnTo);
    } catch {
      showStatus('No pudimos conectar con el servicio. Inténtalo nuevamente.', 'error');
    } finally {
      clearPasswords(documentRoot);
    }
  };

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = formData(loginForm);
    void submit(loginForm, '/api/auth/login', {
      email: data.get('login-email'),
      password: data.get('login-password'),
    }, 'Sesión iniciada.');
  });

  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = formData(registerForm);
    void submit(registerForm, '/api/auth/register', {
      name: data.get('register-name'),
      email: data.get('register-email'),
      password: data.get('register-password'),
    }, 'Cuenta creada correctamente.');
  });

  logoutButton.addEventListener('click', async () => {
    try {
      const response = await api('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!isSuccessful(response)) {
        const body = await readBody(response);
        showStatus(body.error || 'No pudimos cerrar la sesión.', 'error');
        return;
      }
      sessionStateVersion += 1;
      showAuth();
      showSessionLink(false);
      showStatus('Sesión cerrada.', 'success');
    } catch {
      showStatus('No pudimos conectar con el servicio. Inténtalo nuevamente.', 'error');
    }
  });

  void (async () => {
    const initialSessionVersion = sessionStateVersion;
    try {
      const response = await api('/api/auth/session', { credentials: 'same-origin' });
      const body = await readBody(response);
      if (initialSessionVersion !== sessionStateVersion) return;
      if (isSuccessful(response) && body.authenticated && body.user) {
        showAccount(body.user);
        showSessionLink(true);
      }
    } catch {
      // La página sigue disponible para iniciar sesión si la comprobación no responde.
    }
  })();
}
