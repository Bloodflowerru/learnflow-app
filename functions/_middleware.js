export async function onRequest(context) {
  const { request, env, next } = context;
  const auth = request.headers.get('Authorization');

  if (!env.CFP_PASSWORD) {
    return new Response('Password not configured', { status: 500 });
  }

  if (!auth) {
    return new Response('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="LearnFlow Dev"' },
    });
  }

  const [scheme, encoded] = auth.split(' ');
  if (scheme !== 'Basic') return new Response('Bad auth', { status: 400 });

  const decoded = atob(encoded);
  const [, password] = decoded.split(':');

  if (password !== env.CFP_PASSWORD) {
    return new Response('Wrong password', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="LearnFlow Dev"' },
    });
  }

  return next();
}
