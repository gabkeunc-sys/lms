// Cloudflare Workers entry point: /api/* goes to the LMS API backed by D1, everything else is served from public/.
import {createHandler} from '../server/auth.mjs';
import {createDatabase} from '../server/db.mjs';

const SECURITY_HEADERS = {
 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
 'X-Content-Type-Options': 'nosniff',
 'Referrer-Policy': 'same-origin',
 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

let cached;
const handlerFor = env => {
 if (cached?.binding !== env.DB) cached = {binding: env.DB, handler: createHandler(createDatabase(env.DB))};
 return cached.handler;
};

export default {
 async fetch(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  const response = await handlerFor(env)(request, {ip: request.headers.get('CF-Connecting-IP') || ''});
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
 },
};
