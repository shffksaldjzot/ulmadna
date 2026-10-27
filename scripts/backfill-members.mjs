// ──────────────────────────────────────────────
// 회원 명부(members) — 기존 회원 채우기 (1회용)
//
// [무슨 기능인가]
//   명부 표를 만들기 전부터 있던 회원(물어보기 닉네임 표 ask_profiles 에 있는 사람)을
//   members 표로 옮긴다. 예시 글용 가짜 회원(user_id 가 "seed:" 로 시작)은 뺀다.
//
// [사장님 실행 방법] (20261027_members.sql 을 SQL Editor 에서 먼저 실행한 뒤)
//   1) 먼저 미리보기(아무것도 안 씀):  node scripts/backfill-members.mjs
//   2) 숫자 확인 후 실제로 쓰기:        node scripts/backfill-members.mjs --apply
//   .env.local 에 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY · MEMBER_HASH_SECRET 가 있어야 한다.
//   MEMBER_HASH_SECRET 은 Vercel 에 넣은 값과 반드시 같아야 한다(다르면 같은 사람이 두 줄로 생김).
//   여러 번 실행해도 안전하다(이미 있는 사람은 새 줄을 만들지 않음).
//
// [옮기는 방식]
//   - 아이디 회원("user:<번호>"): ask_users 의 가입일·마지막 로그인·상태(차단)를 같이 옮긴다.
//   - 카카오 회원(숫자 번호): 닉네임 만든 날을 첫 로그인으로.
//   - 카카오 회원(무작위 번호 모양): 로그인 라이브러리가 세션마다 새 번호를 줘서 생긴 값.
//     진짜 카카오 번호를 알 수 없어, 나중에 그 사람이 다시 로그인하면 명부에 줄이 하나 더 생길 수 있다
//     (미리보기에 몇 명인지 따로 보여 준다).
//   - 로그인 횟수는 모르므로 0 으로 넣는다(다음 로그인부터 1씩 오른다).
//   화면에는 개수만 찍고, 회원 번호·닉네임·비밀값은 찍지 않는다.
// 작성일: 2026년 10월 27일
// ──────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';

/**
 * 같은 사람 판별값 — src/lib/members/key.ts 의 memberKeyOf 와 똑같은 계산이어야 한다
 * (시험 src/lib/members/__tests__/backfill.test.ts 가 둘이 같은지 확인한다)
 */
export function keyOf(stableId, secret) {
  return createHmac('sha256', secret).update(`ulmadna-member:${stableId}`).digest('hex');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 옮길 줄 계획 세우기(순수 함수 — DB 안 건드림)
 * - profiles: ask_profiles 줄들 (user_id, nickname, created_at)
 * - users:    ask_users 줄들 (id, nickname, created_at, last_login_at, status)
 * - secret:   MEMBER_HASH_SECRET
 * 돌려주는 값: rows(members 에 넣을 줄들), counts(종류별 개수)
 */
export function planRows(profiles, users, secret) {
  const userById = new Map(users.map((u) => [String(u.id).toLowerCase(), u]));
  const counts = { seed: 0, id: 0, kakaoNumeric: 0, kakaoSessionUuid: 0, idWithoutUser: 0, unknown: 0 };
  const rows = [];
  for (const p of profiles) {
    const uid = String(p.user_id ?? '');
    const nickname = String(p.nickname ?? '').trim().slice(0, 40) || null;
    if (uid.startsWith('seed:')) {
      counts.seed++;
      continue;
    }
    if (uid.startsWith('user:')) {
      // 아이디 회원 — ask_users 줄이 있어야 옮긴다(없으면 탈퇴 등으로 지워진 것)
      const uuid = uid.slice(5).toLowerCase();
      const u = userById.get(uuid);
      if (!u) {
        counts.idWithoutUser++;
        continue;
      }
      counts.id++;
      const first = u.created_at ?? p.created_at;
      rows.push({
        member_key: keyOf(uid, secret),
        provider: 'id',
        ask_user_id: uuid,
        nickname: (u.nickname ?? nickname) || null,
        has_ask_profile: true,
        first_login_at: first,
        last_login_at: u.last_login_at ?? first,
        login_count: 0,
        status: u.status === 'blocked' ? 'blocked' : 'active',
      });
      continue;
    }
    let kind = null;
    if (/^\d{1,20}$/.test(uid)) kind = 'kakaoNumeric';
    else if (UUID_RE.test(uid)) kind = 'kakaoSessionUuid';
    if (!kind) {
      counts.unknown++;
      continue;
    }
    counts[kind]++;
    rows.push({
      member_key: keyOf(uid, secret),
      provider: 'kakao',
      ask_user_id: null,
      nickname,
      has_ask_profile: true,
      first_login_at: p.created_at,
      last_login_at: p.created_at,
      login_count: 0,
      status: 'active',
    });
  }
  return { rows, counts };
}

/** .env.local 읽기(값은 화면에 찍지 않는다) */
function readEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

/** Supabase REST 로 표 전체 읽기(1000줄씩) */
async function readAll(url, key, table, cols, order) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/${table}?select=${cols}&order=${order}.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) throw new Error(`${table} 읽기 실패 HTTP ${res.status}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const env = { ...readEnv(path.resolve(process.cwd(), '.env.local')), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = (env.MEMBER_HASH_SECRET || '').trim();
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다(.env.local 확인)');
  if (secret.length < 16) throw new Error('MEMBER_HASH_SECRET 이 없거나 16글자보다 짧습니다(Vercel 값과 같은 값을 .env.local 에)');

  const profiles = await readAll(url, key, 'ask_profiles', 'user_id,nickname,created_at', 'created_at');
  const users = await readAll(url, key, 'ask_users', 'id,nickname,created_at,last_login_at,status', 'created_at');
  const existing = await readAll(url, key, 'members', 'id,member_key,first_login_at', 'created_at');
  const { rows, counts } = planRows(profiles, users, secret);

  // 이미 명부에 있는 사람은 새로 넣지 않고, 첫 로그인 시각이 더 이르면 그것만 앞당긴다
  const byKey = new Map(existing.filter((m) => m.member_key).map((m) => [m.member_key, m]));
  const toInsert = rows.filter((r) => !byKey.has(r.member_key));
  const toFix = rows
    .filter((r) => byKey.has(r.member_key))
    .map((r) => ({ id: byKey.get(r.member_key).id, first: r.first_login_at, cur: byKey.get(r.member_key).first_login_at }))
    .filter((x) => x.first && new Date(x.first) < new Date(x.cur));

  console.log('[미리보기] ask_profiles', profiles.length, '줄 / ask_users', users.length, '줄 / 지금 members', existing.length, '줄');
  console.log('  예시(seed:) 제외', counts.seed, '· 아이디 회원', counts.id, '· 카카오(숫자 번호)', counts.kakaoNumeric,
    '· 카카오(무작위 세션 번호 — 나중에 중복 가능)', counts.kakaoSessionUuid,
    '· ask_users 없는 아이디 닉네임(건너뜀)', counts.idWithoutUser, '· 알 수 없는 모양(건너뜀)', counts.unknown);
  console.log('  새로 넣을 줄', toInsert.length, '· 이미 있음', rows.length - toInsert.length, '(그중 첫 로그인 앞당김', toFix.length, ')');

  if (!apply) {
    console.log('\n미리보기만 했습니다. 실제로 쓰려면 --apply 를 붙여 다시 실행하세요.');
    return;
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500);
    // 그 사이 로그인으로 같은 사람이 생겼으면 건너뛴다(ignore-duplicates)
    const res = await fetch(`${url}/rest/v1/members?on_conflict=member_key`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) throw new Error(`members 넣기 실패 HTTP ${res.status}`);
  }
  for (const f of toFix) {
    const res = await fetch(`${url}/rest/v1/members?id=eq.${f.id}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ first_login_at: f.first, has_ask_profile: true }),
    });
    if (!res.ok) throw new Error(`members 고치기 실패 HTTP ${res.status}`);
  }
  console.log('\n완료: 새로 넣음', toInsert.length, '· 첫 로그인 앞당김', toFix.length);
}

// 직접 실행했을 때만 main 을 돈다(시험에서 함수만 불러 쓸 때는 안 돎)
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error('실패:', e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
