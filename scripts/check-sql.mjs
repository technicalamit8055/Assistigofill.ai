/**
 * Parse-checks every migration with the real PostgreSQL grammar (pg_query compiled to WASM).
 *
 * This catches syntax errors without needing Docker. It does NOT catch semantic problems —
 * a missing table, a bad column reference or a broken policy still needs `supabase db reset`
 * or the `database` job in CI.
 *
 * Each file is parsed in its own child process: the WASM build aborts on some large inputs and
 * an aborted instance cannot be reused, so isolation keeps one awkward file from stalling the
 * whole run.
 */

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const MIGRATIONS_DIR = path.resolve('supabase/migrations');
const SELF = fileURLToPath(import.meta.url);
const STATEMENT_START =
  /\n(?=(?:create|alter|insert|update|delete|comment|grant|revoke|drop|do|set)\s)/i;

// ---------------------------------------------------------------------------
// Child mode: parse one file, print JSON, exit.
// ---------------------------------------------------------------------------
if (process.argv[2] === '--file') {
  const target = process.argv[3];
  const { default: PgQuery } = await import('pg-query-emscripten');
  const sql = await readFile(target, 'utf8');

  const parseChunk = (parser, text) => {
    const result = parser.parse(text);
    if (result.error) {
      const cursor = result.error.cursorpos ?? 0;
      return {
        ok: false,
        message: result.error.message,
        snippet: text.slice(Math.max(0, cursor - 60), cursor + 60).replace(/\s+/g, ' ').trim(),
      };
    }
    return { ok: true, statements: result.parse_tree?.stmts?.length ?? 0 };
  };

  let results;
  try {
    results = [parseChunk(await new PgQuery(), sql)];
  } catch {
    // Retry statement by statement with a fresh parser each time. Split points are line
    // starts, so indented dollar-quoted function bodies stay intact.
    const chunks = sql
      .split(STATEMENT_START)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk !== '' && !chunk.startsWith('--'));

    results = [];
    for (const chunk of chunks) {
      try {
        results.push(parseChunk(await new PgQuery(), chunk));
      } catch (error) {
        results.push({
          ok: false,
          message: `parser aborted: ${error}`,
          snippet: chunk.replace(/\s+/g, ' ').slice(0, 120),
        });
      }
    }
  }

  process.stdout.write(JSON.stringify(results));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Parent mode
// ---------------------------------------------------------------------------
const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

let failed = 0;

for (const file of files) {
  const target = path.join(MIGRATIONS_DIR, file);
  let results;
  try {
    const output = execFileSync(process.execPath, [SELF, '--file', target], {
      encoding: 'utf8',
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    results = JSON.parse(output);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${file}  parser process failed: ${error.message?.split('\n')[0]}`);
    continue;
  }

  const errors = results.filter((r) => !r.ok);
  const statements = results.reduce((sum, r) => sum + (r.ok ? r.statements : 0), 0);

  if (errors.length > 0) {
    failed += 1;
    console.error(`✗ ${file}`);
    for (const error of errors) {
      console.error(`    ${error.message}`);
      console.error(`    near: ${error.snippet}`);
    }
  } else {
    console.log(`✓ ${file}  (${statements} statements)`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} migration file(s) failed to parse.`);
  process.exit(1);
}

console.log(`\nAll ${files.length} migration files parsed cleanly.`);
