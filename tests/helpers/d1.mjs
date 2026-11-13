// Minimal in-memory stand-in for a Cloudflare D1 binding, backed by Node's built-in SQLite.
// Only the API surface the app uses (prepare/bind/all/run/batch) is implemented.
import {DatabaseSync} from 'node:sqlite';
import {readFile, readdir} from 'node:fs/promises';
import {createDatabase} from '../../server/db.mjs';

const migrationsDir = new URL('../../migrations/', import.meta.url);

export function createD1() {
 const sqlite = new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys = ON');
 const prepare = sql => {
  let values = [];
  const statement = {
   bind: (...params) => { values = params; return statement; },
   all: async () => ({results: sqlite.prepare(sql).all(...values).map(row => ({...row})), success: true}),
   run: async () => { sqlite.prepare(sql).run(...values); return {success: true}; },
  };
  return statement;
 };
 return {sqlite, prepare, batch: async statements => Promise.all(statements.map(s => s.all())), exec: async sql => sqlite.exec(sql)};
}

// Applies migrations (all by default, or only the named files) and returns the D1 stand-in plus the app's query adapter.
export async function createTestDatabase({migrations} = {}) {
 const d1 = createD1();
 const files = migrations || (await readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();
 for (const file of files) d1.sqlite.exec(await readFile(new URL(file, migrationsDir), 'utf8'));
 const db = createDatabase(d1);
 return {d1, db, query: db.query, exec: sql => d1.sqlite.exec(sql)};
}
