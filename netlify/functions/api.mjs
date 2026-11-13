import { getConnectionString } from '@netlify/database';
import pg from 'pg';
import { createHandler } from '../../server/auth.mjs';
let handler;
export default async (request,context) => {
 try {
  handler ||= createHandler(new pg.Pool({connectionString:getConnectionString(),max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:20000}));
  return await handler(request,context);
 } catch {
  return Response.json({error:'데이터베이스 준비 중입니다. 잠시 후 다시 시도하세요.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
};
export const config={path:'/api/*'};
