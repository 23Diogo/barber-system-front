export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── /client/* → portal do cliente (SPA)
    // Intercepta ANTES dos assets para evitar servir os index.html das subpastas
    if (url.pathname === '/client' || url.pathname.startsWith('/client/')) {
      const clientUrl = new URL('/client.html', url.origin);
      return env.ASSETS.fetch(new Request(clientUrl.toString(), request));
    }

    // ── Arquivos estáticos (JS, CSS, imagens, fontes)
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // ── /cadastro → onboarding da barbearia (visão dono)
    if (url.pathname === '/cadastro' || url.pathname === '/cadastro/') {
      const cadastroUrl = new URL('/cadastro/index.html', url.origin);
      return env.ASSETS.fetch(new Request(cadastroUrl.toString(), request));
    }

    // ── /app/login → login do dono
    if (url.pathname === '/app/login' || url.pathname === '/app/login/') {
      const loginUrl = new URL('/app/login/index.html', url.origin);
      return env.ASSETS.fetch(new Request(loginUrl.toString(), request));
    }

    // ── /app/* → painel do dono (SPA)
    if (url.pathname === '/' || url.pathname.startsWith('/app')) {
      const indexUrl = new URL('/index.html', url.origin);
      return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }

    return assetResponse;
  },
};
