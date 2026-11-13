// One-time import of the Netlify PostgreSQL data into the D1 database. Deployed temporarily, runs on its cron
// trigger, records the outcome in _import_log, and is deleted after the import succeeds.
import pg from 'pg';
const TABLES = ['app_users','courses','assessments','assessment_attempts','assessment_results','learning_guidance'];
const value = v => v === null || v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : v;
async function run(env) {
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS _import_log (at TEXT, ok INTEGER, detail TEXT)').run();
 if ((await env.DB.prepare('SELECT 1 FROM _import_log WHERE ok=1').all()).results.length) return;
 const client = new pg.Client({connectionString: env.SOURCE_DATABASE_URL});
 await client.connect();
 const counts = {};
 try {
  const source = {};
  for (const t of TABLES) {
   const {rows} = await client.query(`SELECT * FROM ${t}`);
   if (t === 'courses') for (const r of rows) for (const k of ['start_date','end_date']) if (r[k] instanceof Date) r[k] = r[k].toISOString().slice(0,10);
   source[t] = rows;
  }
  const statements = ['auth_limits','app_sessions',...[...TABLES].reverse()].map(t => env.DB.prepare(`DELETE FROM ${t}`));
  for (const t of TABLES) {
   const cols = (await env.DB.prepare(`SELECT name FROM pragma_table_info('${t}')`).all()).results.map(c => c.name);
   for (const r of source[t]) {
    const use = cols.filter(c => c in r);
    statements.push(env.DB.prepare(`INSERT INTO ${t}(${use.join(',')}) VALUES(${use.map((_,i)=>'?'+(i+1)).join(',')})`).bind(...use.map(c => value(r[c]))));
   }
   counts[t] = source[t].length;
  }
  await env.DB.batch(statements); // one transaction: all or nothing
  await env.DB.prepare('INSERT INTO _import_log VALUES(?1,1,?2)').bind(new Date().toISOString(), JSON.stringify(counts)).run();
 } finally { await client.end(); }
}
export default {
 async scheduled(event, env, ctx) {
  try { await run(env); }
  catch (e) { await env.DB.prepare('INSERT INTO _import_log VALUES(?1,0,?2)').bind(new Date().toISOString(), String(e?.stack || e).slice(0, 2000)).run(); }
 },
};
