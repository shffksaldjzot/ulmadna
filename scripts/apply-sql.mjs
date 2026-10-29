// ─────────────────────────────────────────────────────────────
// apply-sql.mjs — 얼마드나 라이브 DB(수파베이스)에 마이그레이션 파일을 실행한다 (2026-10-29)
//   사용: node scripts/apply-sql.mjs supabase/migrations/20261030_ads_desktop_banner.sql [더 많은 파일...]
//   열쇠: .env.local 의 SUPABASE_ACCESS_TOKEN(관리 API 토큰). 프로젝트 ref 는 NEXT_PUBLIC_SUPABASE_URL 에서 읽는다.
//   파일 하나씩 순서대로 실행하고 결과 한 줄씩 찍는다. 열쇠 값은 절대 찍지 않는다.
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)?.[1];
if (!token || !ref) { console.error('SUPABASE_ACCESS_TOKEN 또는 NEXT_PUBLIC_SUPABASE_URL 없음'); process.exit(1); }

for (const f of process.argv.slice(2)) {
  const sql = fs.readFileSync(path.resolve(root, f), 'utf8');
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, read_only: false }),
  });
  const text = await res.text();
  console.log(path.basename(f), res.ok ? '실행 OK' : `실패 ${res.status}`, text.slice(0, 300));
  if (!res.ok) process.exit(1);
}
