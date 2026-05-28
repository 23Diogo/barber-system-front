export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const fetchAsset = (assetPath) => {
      const assetUrl = new URL(assetPath, url.origin);
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    };

    // ── Raiz pública → página institucional para Meta e visitantes
    if (pathname === '/') {
      return Response.redirect(`${url.origin}/institucional/`, 302);
    }

    // ── /institucional → normaliza para /institucional/
    if (pathname === '/institucional') {
      return Response.redirect(`${url.origin}/institucional/`, 301);
    }

    // ── /institucional/ → landing institucional
    if (pathname === '/institucional/' || pathname === '/institucional/index.html') {
      return fetchAsset('/institucional/index.html');
    }

    // ── /institucional/:pagina/ → páginas institucionais estáticas
    // Exemplos:
    // /institucional/empresa/
    // /institucional/politica-de-privacidade/
    // /institucional/termos-de-uso/
    // /institucional/whatsapp/
    // /institucional/suporte/
    // /institucional/exclusao-de-dados/
    const institucionalPageMatch = pathname.match(/^\/institucional\/([^/]+)\/?$/);
    if (institucionalPageMatch) {
      const page = institucionalPageMatch[1];
      return fetchAsset(`/institucional/${page}/index.html`);
    }

    // ── /client/cadastro/:slug → salva slug em cookie e serve client.html
    // Formato: /client/cadastro/barbearia-do-henrique
    const cadastroMatch = pathname.match(/^\/client\/cadastro\/([^/]+)\/?$/);
    if (cadastroMatch) {
      const slug = cadastroMatch[1];
      const response = await fetchAsset('/client.html');

      // Clona a resposta adicionando o cookie com o slug
      const newResponse = new Response(response.body, response);
      newResponse.headers.set(
        'Set-Cookie',
        `bf_invite_slug=${encodeURIComponent(slug)}; Path=/; SameSite=Lax; Max-Age=3600`
      );
      return newResponse;
    }

    // ── /client/* → portal do cliente (SPA)
    if (pathname === '/client' || pathname.startsWith('/client/')) {
      return fetchAsset('/client.html');
    }

    // ── /cadastro → onboarding da barbearia (visão dono)
    if (pathname === '/cadastro' || pathname === '/cadastro/') {
      return fetchAsset('/cadastro/index.html');
    }

    // ── /privacidade → política de privacidade antiga
    if (pathname === '/privacidade' || pathname === '/privacidade/') {
      return fetchAsset('/privacidade/index.html');
    }

    // ── /app/assinatura → Assinaturas do sistema
    if (pathname === '/app/assinatura' || pathname === '/app/assinatura/') {
      return fetchAsset('/app/assinatura/index.html');
    }

    // ── /app/login → login do dono
    if (pathname === '/app/login' || pathname === '/app/login/') {
      return fetchAsset('/app/login/index.html');
    }

    // ── Arquivos estáticos (JS, CSS, imagens, fontes, manifests etc.)
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // ── /app/* → painel do dono (SPA)
    if (pathname === '/app' || pathname.startsWith('/app/')) {
      return fetchAsset('/index.html');
    }

    return assetResponse;
  },
};
