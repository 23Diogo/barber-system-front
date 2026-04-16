export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const isSpaRoute =
      url.pathname === '/' ||
      url.pathname.startsWith('/app') ||
      url.pathname.startsWith('/client');

    const assetResponse = await env.ASSETS.fetch(request);

    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    if (isSpaRoute) {
      const indexUrl = new URL('/index.html', url.origin);
      return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }

    return assetResponse;
  },
};
