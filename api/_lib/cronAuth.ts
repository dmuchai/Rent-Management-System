export function cronAuthorizationStatus(method: string | undefined, authorization: string | undefined, secret: string | undefined) {
  if (method !== 'GET') return 405;
  if (!secret) return 500;
  if (authorization !== `Bearer ${secret}`) return 401;
  return 200;
}
