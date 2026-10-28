export async function onRequest(context) {
  const { request, env } = context;
  const backendUrl = env.BACKEND_URL;

  if (!backendUrl) {
    return new Response('BACKEND_URL not configured', { status: 500 });
  }

  const url = new URL(request.url);
  const targetPath = url.pathname.replace(/^\/api/, '') + url.search;
  const targetUrl = backendUrl.replace(/\/$/, '') + '/api' + targetPath;

  const headers = new Headers(request.headers);
  headers.delete('host');

  const init = {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual',
  };

  const response = await fetch(targetUrl, init);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}