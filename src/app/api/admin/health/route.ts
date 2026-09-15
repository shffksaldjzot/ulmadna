// ─────────────────────────────────────────────────────────────
// 관리자용 상태 확인 API — /api/admin/health
//
// [무슨 기능인가]
//   "지금 Supabase가 살아있나? 킵얼라이브 크론이 마지막으로 언제
//   성공했나?"를 형아가 브라우저나 curl로 바로 확인할 수 있게 해주는
//   진단용 엔드포인트. 견적 저장이 안 될 때 "Supabase가 일시정지된
//   건지 / 다른 코드 버그인지" 여기서 먼저 구분할 수 있다.
//
// [인증]
//   요청 헤더 x-admin-password 값이 서버의 ADMIN_PASSWORD 환경변수와
//   정확히 같아야 응답을 준다. 관리자 로그인 화면(쿠키 방식)과는 별개로
//   — curl/스크립트로 바로 찔러볼 수 있게 헤더 방식으로 간단히 구현.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // ── 인증 확인 ──
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('[admin/health] ADMIN_PASSWORD 미설정');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const provided = req.headers.get('x-admin-password');
  if (provided !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 1) Supabase 응답 상태 직접 확인 (가벼운 조회 1건, 킵얼라이브 크론과 동일한 방식) ──
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let supabaseStatus: { ok: boolean; detail: string };
  if (!supabaseUrl || !serviceKey) {
    supabaseStatus = { ok: false, detail: 'SUPABASE_SERVICE_ROLE_KEY 미설정' };
  } else {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/saved_estimates?select=id&limit=1`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        cache: 'no-store',
      });
      supabaseStatus = res.ok
        ? { ok: true, detail: 'OK' }
        : { ok: false, detail: `HTTP ${res.status} ${res.statusText}` };
    } catch (e) {
      supabaseStatus = { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }

  // ── 2) 킵얼라이브 크론이 Upstash에 남겨둔 "마지막 실행 기록" 읽기 ──
  let keepaliveLast: unknown = null;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) {
    try {
      const r = await fetch(`${upstashUrl}/get/supabase:keepalive:last`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
        cache: 'no-store',
      });
      const json = await r.json();
      // Upstash에는 문자열(JSON.stringify한 값) 그대로 저장돼 있어서 한 번 더 파싱 필요
      keepaliveLast = json?.result ? JSON.parse(json.result) : null;
    } catch {
      keepaliveLast = null;
    }
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    supabase: supabaseStatus,
    keepalive: keepaliveLast, // { at, ok, detail } 형태 — 크론이 기록. 한 번도 안 돌았으면 null
  });
}
