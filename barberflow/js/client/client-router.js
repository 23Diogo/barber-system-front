function normalizePath(pathname = '/') {
  const trimmed = String(pathname || '/').replace(/\/+$/, '');
  return trimmed || '/';
}

function getClientRouteFromPath(pathname = window.location.pathname) {
  const normalized = normalizePath(pathname);

  if (normalized === '/client' || normalized === '/client/login') return 'login';
  if (normalized === '/client/cadastro') return 'cadastro';

  return 'login';
}

function getPathForRoute(route) {
  if (route === 'cadastro') return '/client/cadastro';
  return '/client/login';
}

function renderClientPage(route) {
  const title = route === 'cadastro' ? 'Cadastro do Cliente' : 'Login do Cliente';
  const description =
    route === 'cadastro'
      ? 'Página de cadastro carregada com sucesso.'
      : 'Página de login carregada com sucesso.';

  document.body.className = 'client-area';
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#090d1d;color:#fff;font-family:DM Sans, sans-serif;padding:20px;">
      <div style="width:min(100%,480px);background:#0a0c1a;border:1px solid #1e2345;border-radius:20px;padding:24px;box-shadow:0 18px 45px rgba(0,0,0,.28);">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
          <div style="width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-weight:900;background:linear-gradient(135deg,#4fc3f7,#0066ff);">B</div>
          <div>
            <div style="font-size:16px;font-weight:800;">BarberFlow</div>
            <div style="font-size:12px;color:#7e8db4;">Portal do Cliente</div>
          </div>
        </div>

        <h1 style="margin:0 0 8px;font-size:24px;">${title}</h1>
        <p style="margin:0 0 18px;color:#7e8db4;line-height:1.6;">${description}</p>

        <div style="display:grid;gap:10px;">
          <button id="go-login" style="min-height:46px;border:0;border-radius:12px;background:linear-gradient(135deg,#4fc3f7,#0066ff);color:#fff;font-weight:800;cursor:pointer;">
            Ir para Login
          </button>

          <button id="go-register" style="min-height:46px;border-radius:12px;border:1px solid #1e2345;background:rgba(255,255,255,.05);color:#fff;font-weight:800;cursor:pointer;">
            Ir para Cadastro
          </button>
        </div>

        <div style="margin-top:18px;font-size:12px;color:#00e676;">
          Rota atual: ${window.location.pathname}
        </div>
      </div>
    </div>
  `;

  document.getElementById('go-login')?.addEventListener('click', () => {
    navigateClient('login');
  });

  document.getElementById('go-register')?.addEventListener('click', () => {
    navigateClient('cadastro');
  });
}

export function navigateClient(route, options = {}) {
  const { replace = false, skipHistory = false } = options;
  const safeRoute = route === 'cadastro' ? 'cadastro' : 'login';
  const nextPath = getPathForRoute(safeRoute);

  if (!skipHistory && window.location.pathname !== nextPath) {
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({ clientRoute: safeRoute }, '', nextPath);
  }

  renderClientPage(safeRoute);
}

export function initClientRouter() {
  console.log('[CLIENT] client-router inicializado');

  const initialRoute = getClientRouteFromPath(window.location.pathname);
  navigateClient(initialRoute, { replace: false });

  window.addEventListener('popstate', () => {
    const route = getClientRouteFromPath(window.location.pathname);
    navigateClient(route, { skipHistory: true });
  });
}
