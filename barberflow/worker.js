export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // ── /client/cadastro/:slug → salva slug em cookie e serve client.html
    // Formato: /client/cadastro/barbearia-do-henrique
    const cadastroMatch = url.pathname.match(/^\/client\/cadastro\/([^/]+)\/?$/);
    if (cadastroMatch) {
      const slug = cadastroMatch[1];
      const clientUrl = new URL('/client.html', url.origin);
      const response = await env.ASSETS.fetch(new Request(clientUrl.toString(), request));
      // Clona a resposta adicionando o cookie com o slug
      const newResponse = new Response(response.body, response);
      newResponse.headers.set(
        'Set-Cookie',
        `bf_invite_slug=${encodeURIComponent(slug)}; Path=/; SameSite=Lax; Max-Age=3600`
      );
      return newResponse;
    }
    // ── /client/* → portal do cliente (SPA) — intercepta ANTES dos assets
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
    // ── /privacidade → política de privacidade
    if (url.pathname === '/privacidade' || url.pathname === '/privacidade/') {
      const privUrl = new URL('/privacidade/index.html', url.origin);
      return env.ASSETS.fetch(new Request(privUrl.toString(), request));
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
