export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') {
      return new Response(
        'ASSETS binding não disponível neste ambiente do Worker.',
        {
          status: 500,
          headers: {
            'content-type': 'text/plain; charset=UTF-8',
          },
        }
      );
    }

    const assetResponse = await env.ASSETS.fetch(request);

    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    if (url.pathname === '/client' || url.pathname.startsWith('/client/')) {
      const clientUrl = new URL('/client.html', url.origin);
      return env.ASSETS.fetch(new Request(clientUrl.toString(), request));
    }

    if (
      url.pathname === '/' ||
      url.pathname === '/app' ||
      url.pathname.startsWith('/app/')
    ) {
      const indexUrl = new URL('/index.html', url.origin);
      return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }

    return new Response('Not Found', { status: 404 });
  },
};
