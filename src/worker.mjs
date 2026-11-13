// Cloudflare Workers entry point: /api/* goes to the LMS API backed by D1, everything else is served from public/.
import {createHandler} from '../server/auth.mjs';
import {createDatabase} from '../server/db.mjs';
import {verifyPage} from '../server/certs.mjs';

const SECURITY_HEADERS = {
 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
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
  // Public certificate verification page, opened from the QR code on each certificate.
  const vf = url.pathname.match(/^\/verify\/([A-Za-z0-9-]{1,40})\/?$/);
  if (vf && request.method === 'GET') {
   const html = await verifyPage(createDatabase(env.DB).query, vf[1]);
   return new Response(html, {headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS}});
  }
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  // Question images are public by unguessable id so <img> tags work everywhere.
  const img = url.pathname.match(/^\/api\/images\/([a-f0-9-]{36})$/);
  if (img && request.method === 'GET') {
   const row = await env.DB.prepare('SELECT mime,data FROM question_images WHERE id=?1').bind(img[1]).first();
   if (!row) return new Response('Not found', {status: 404});
   const bin = Uint8Array.from(atob(row.data), c => c.charCodeAt(0));
   return new Response(bin, {headers: {'Content-Type': row.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff'}});
  }
  const response = await handlerFor(env)(request, {ip: request.headers.get('CF-Connecting-IP') || ''});
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
 },
};
