export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Arquivos estáticos (JS, CSS, imagens, fontes)
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // /cadastro → onboarding da barbearia
    if (url.pathname === '/cadastro' || url.pathname === '/cadastro/') {
      const cadastroUrl = new URL('/cadastro/index.html', url.origin);
      return env.ASSETS.fetch(new Request(cadastroUrl.toString(), request));
    }

    // /app/login → login do dono
    if (url.pathname === '/app/login' || url.pathname === '/app/login/') {
      const loginUrl = new URL('/app/login/index.html', url.origin);
      return env.ASSETS.fetch(new Request(loginUrl.toString(), request));
    }

    // /app/* → painel do dono (SPA)
    if (url.pathname === '/' || url.pathname.startsWith('/app')) {
      const indexUrl = new URL('/index.html', url.origin);
      return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }

    // /client/* → portal do cliente
    if (url.pathname === '/client' || url.pathname.startsWith('/client/')) {
      const segments = url.pathname.replace(/\/$/, '').split('/').filter(Boolean);
      if (segments.length >= 2) {
        const subPage = segments[1];
        const subUrl = new URL(`/client/${subPage}/index.html`, url.origin);
        const subResponse = await env.ASSETS.fetch(new Request(subUrl.toString(), request));
        if (subResponse.status !== 404) return subResponse;
      }
      const fallbackUrl = new URL('/client/login/index.html', url.origin);
      return env.ASSETS.fetch(new Request(fallbackUrl.toString(), request));
    }

    return assetResponse;
  },
};
