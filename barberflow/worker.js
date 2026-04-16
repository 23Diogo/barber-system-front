export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Tenta servir arquivo estático primeiro
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // Rota do cliente → client.html
    if (url.pathname === '/client' || url.pathname.startsWith('/client/')) {
      const clientUrl = new URL('/client.html', url.origin);
      return env.ASSETS.fetch(new Request(clientUrl.toString(), request));
    }

    // Rota do admin → index.html
    if (url.pathname === '/' || url.pathname.startsWith('/app')) {
      const indexUrl = new URL('/index.html', url.origin);
      return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }

    return assetResponse;
  },
};
