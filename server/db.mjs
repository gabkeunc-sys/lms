// Cloudflare D1 (SQLite) adapter that keeps the `query(sql, params) -> {rows}` shape the API modules use.
// SQL in the modules is written for SQLite; `$1`-style placeholders are kept and mapped to D1's `?1`.
const JSON_COLUMNS = new Set(['student_ids', 'questions', 'answers', 'grading']);
const BOOLEAN_COLUMNS = new Set(['active', 'published', 'enabled']);

// ISO-8601 UTC text with milliseconds, identical to Date#toISOString(), so text comparison orders correctly.
export const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
export const nowPlus = modifier => `strftime('%Y-%m-%dT%H:%M:%fZ','now','${modifier}')`;
export const toTimestamp = value => value ? new Date(value).toISOString() : null;

const toParam = value => typeof value === 'boolean' ? (value ? 1 : 0) : value === undefined ? null : value;
function toRow(row) {
 for (const key of Object.keys(row)) {
  if (JSON_COLUMNS.has(key) && typeof row[key] === 'string') row[key] = JSON.parse(row[key]);
  else if (BOOLEAN_COLUMNS.has(key) && typeof row[key] === 'number') row[key] = row[key] === 1;
 }
 return row;
}

export function createD1Query(d1) {
 return async (sql, params = []) => {
  try {
   const statement = d1.prepare(sql.replace(/\$(\d+)/g, '?$1'));
   const result = await (params.length ? statement.bind(...params.map(toParam)) : statement).all();
   return { rows: (result.results || []).map(toRow) };
  } catch (error) {
   // Keep the PostgreSQL unique-violation code the handlers already check for.
   if (/UNIQUE constraint failed/i.test(String(error?.message))) error.code = '23505';
   throw error;
  }
 };
}

export const createDatabase = d1 => ({ query: createD1Query(d1) });
