#!/usr/bin/env node
// ──────────────────────────────────────────────
// 옛 Upstash 집계 숫자 → Supabase 일별 표로 1회 옮기기 (2026년 10월 27일)
//
// [언제 쓰나]
//   집계를 Supabase 로 옮긴 뒤(커밋 d376739~), Upstash 월 한도가 리셋되어 다시 읽을 수 있을 때
//   형아가 한 번 실행한다. Upstash 쪽은 "읽기만" 한다(지우거나 바꾸지 않음).
//
// [무엇을 옮기나]
//   views:{slug}               → page_views_daily (day 2000-01-01, region 'legacy') — 날짜 모르는 누적분
//   likes:{slug}               → post_likes (지금 Supabase 숫자 + 옛 숫자)
//   calc:run:{공정}:{날짜}:{모드} → calc_runs_daily (그 날짜, 평형대 'na', region 'legacy')
//   contact:click:{채널}:{날짜}  → contact_clicks_daily (그 날짜, page·region 'legacy')
//   (calc 의 평형대 키는 모드 키와 겹치는 숫자라 옮기지 않는다 — 합계가 두 배가 되지 않게)
//
// [여러 번 실행해도 안전한가]
//   조회·계산·문의 줄은 'legacy' 표시 칸에 "덮어쓰기"라 몇 번 돌려도 같은 값이다.
//   좋아요는 "더하기"라서, 이미 옮긴 글(page_views_daily 에 legacy 줄이 있는 글)은 건너뛴다.
//   그래서 좋아요만 있고 조회수 키가 없는 글도 조회수 0 짜리 legacy 줄을 함께 남겨 표시로 쓴다.
//
// [실행]
//   node scripts/migrate-views-from-upstash.mjs           ← 미리보기(아무것도 안 씀, 기본)
//   node scripts/migrate-views-from-upstash.mjs --apply   ← 실제로 Supabase 에 씀
//   열쇠는 이 저장소의 .env.local 에서 읽는다(UPSTASH_REDIS_REST_URL/TOKEN,
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). 열쇠 값은 화면에 찍지 않는다.
// ──────────────────────────────────────────────
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply'); // 이 표시가 있어야만 실제로 쓴다
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(path.join(ROOT, '.env.local'));
} catch {
  // 파일이 없으면 이미 환경변수에 들어 있다고 보고 계속
}

const UP_URL = process.env.UPSTASH_REDIS_REST_URL;
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!UP_URL || !UP_TOKEN || !SB_URL || !SB_KEY) {
  console.error('열쇠가 없습니다: .env.local 에 UPSTASH_REDIS_REST_URL/TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 확인');
  process.exit(1);
}

const LEGACY_DAY = '2000-01-01'; // 날짜를 모르는 옛 누적 조회수를 담는 표시 날짜
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/; // DB 함수와 같은 글 이름 규칙
const PROCESSES = ['wallpaper', 'flooring', 'mortar', 'tile'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Upstash 명령 여러 개를 한 번에 보내고 결과 배열을 받는다(읽기 명령만 씀) */
async function redis(commands) {
  const res = await fetch(`${UP_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Upstash 응답 ${res.status} (한도 리셋 전이면 429/한도 초과 오류가 납니다)`);
  const out = await res.json();
  for (const r of out) if (r?.error) throw new Error(`Upstash 오류: ${r.error}`);
  return out.map((r) => r?.result);
}

/** 패턴에 맞는 키를 전부 모은다(SCAN 으로 조금씩 — 읽기 전용) */
async function scanKeys(pattern) {
  const keys = [];
  let cursor = '0';
  do {
    const [r] = await redis([['SCAN', cursor, 'MATCH', pattern, 'COUNT', '500']]);
    cursor = String(r[0]);
    keys.push(...r[1]);
  } while (cursor !== '0');
  return keys;
}

/** 키 목록의 값을 읽어 {키: 숫자} 로 (100개씩 끊어서) */
async function getNumbers(keys) {
  const map = {};
  for (let i = 0; i < keys.length; i += 100) {
    const part = keys.slice(i, i + 100);
    const vals = await redis(part.map((k) => ['GET', k]));
    part.forEach((k, j) => {
      const n = Number(vals[j]);
      if (Number.isFinite(n) && n > 0) map[k] = Math.floor(n);
    });
  }
  return map;
}

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

/** 표에 덮어쓰기(같은 열쇠면 새 값으로) — 미리보기 모드면 건수만 알림 */
async function upsert(table, rows, onConflict) {
  if (!rows.length) return;
  if (!APPLY) {
    console.log(`  [미리보기] ${table} ${rows.length}줄 쓸 예정`);
    return;
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table} 쓰기 실패: ${error.message}`);
  }
  console.log(`  ${table} ${rows.length}줄 썼음`);
}

async function main() {
  console.log(APPLY ? '== 실제 옮기기(--apply) ==' : '== 미리보기(쓰지 않음). 실제로 옮기려면 --apply ==');

  // 1) 글 조회수·좋아요 읽기
  const viewKeys = (await scanKeys('views:*')).filter((k) => SLUG_RE.test(k.slice(6)));
  const likeKeys = (await scanKeys('likes:*')).filter((k) => SLUG_RE.test(k.slice(6)));
  const views = await getNumbers(viewKeys);
  const likes = await getNumbers(likeKeys);
  const slugs = new Set([...Object.keys(views).map((k) => k.slice(6)), ...Object.keys(likes).map((k) => k.slice(6))]);
  console.log(`글 ${slugs.size}개 (조회수 키 ${Object.keys(views).length}, 좋아요 키 ${Object.keys(likes).length})`);

  // 이미 옮긴 글(legacy 줄 있음) — 좋아요를 두 번 더하지 않으려고 확인
  const { data: done, error: doneErr } = await sb
    .from('page_views_daily').select('slug').eq('day', LEGACY_DAY).eq('region', 'legacy');
  if (doneErr) throw new Error(`Supabase 읽기 실패(표 적용 전인가요?): ${doneErr.message}`);
  const migrated = new Set((done ?? []).map((r) => r.slug));

  // 2) 조회수 legacy 줄(덮어쓰기)
  const viewRows = [...slugs].map((slug) => ({
    day: LEGACY_DAY, slug, region: 'legacy', device: 'unknown', src: 'direct', views: views[`views:${slug}`] ?? 0,
  }));

  // 3) 좋아요 — 아직 안 옮긴 글만 "지금 숫자 + 옛 숫자"
  const likeTargets = [...slugs].filter((s) => !migrated.has(s) && likes[`likes:${s}`]);
  const likeRows = [];
  if (likeTargets.length) {
    const { data: cur, error } = await sb.from('post_likes').select('slug, likes').in('slug', likeTargets);
    if (error) throw new Error(`post_likes 읽기 실패: ${error.message}`);
    const curMap = Object.fromEntries((cur ?? []).map((r) => [r.slug, Number(r.likes) || 0]));
    for (const s of likeTargets) {
      likeRows.push({ slug: s, likes: (curMap[s] ?? 0) + likes[`likes:${s}`], updated_at: new Date().toISOString() });
    }
  }
  console.log(`좋아요 더할 글 ${likeRows.length}개 (이미 옮긴 글 ${migrated.size}개는 건너뜀)`);

  // 4) 계산기 실행 — 날짜·모드 키만
  const calcKeys = (await scanKeys('calc:run:*')).filter((k) => {
    const p = k.split(':'); // calc run {공정} {날짜} {모드}
    return p.length === 5 && PROCESSES.includes(p[2]) && DATE_RE.test(p[3]) && (p[4] === 'quick' || p[4] === 'precise');
  });
  const calc = await getNumbers(calcKeys);
  const calcRows = Object.entries(calc).map(([k, n]) => {
    const [, , process, day, mode] = k.split(':');
    return { day, process, mode, pyeong_bucket: 'na', region: 'legacy', device: 'unknown', src: 'direct', runs: n };
  });
  console.log(`계산기 실행 줄 ${calcRows.length}개 (합계 ${calcRows.reduce((a, r) => a + r.runs, 0)})`);

  // 5) 문의 클릭
  const contactKeys = (await scanKeys('contact:click:*')).filter((k) => {
    const p = k.split(':'); // contact click {채널} {날짜}
    return p.length === 4 && (p[2] === 'phone' || p[2] === 'kakao') && DATE_RE.test(p[3]);
  });
  const contact = await getNumbers(contactKeys);
  const contactRows = Object.entries(contact).map(([k, n]) => {
    const [, , kind, day] = k.split(':');
    return { day, kind, page: 'legacy', region: 'legacy', runs: n };
  });
  console.log(`문의 클릭 줄 ${contactRows.length}개 (합계 ${contactRows.reduce((a, r) => a + r.runs, 0)})`);

  // 6) 쓰기 — legacy 조회 줄(= "옮김" 표시)을 먼저 쓰고 그다음 좋아요를 더한다.
  //    중간에 끊기면 좋아요가 일부 빠질 수는 있어도 두 번 더해지지는 않는다(다시 돌리면 표시 있는 글은 건너뜀).
  //    끊겼다면 화면 출력을 그대로 토리에게 보여 줄 것.
  await upsert('page_views_daily', viewRows, 'day,slug,region,device,src');
  await upsert('post_likes', likeRows, 'slug');
  await upsert('calc_runs_daily', calcRows, 'day,process,mode,pyeong_bucket,region,device,src');
  await upsert('contact_clicks_daily', contactRows, 'day,kind,page,region');
  console.log('끝.');
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
