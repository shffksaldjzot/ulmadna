// ─────────────────────────────────────────────────────────────
// Supabase 킵얼라이브 크론 — /api/cron/supabase-keepalive
//
// [무슨 기능인가]
//   Supabase 무료 프로젝트는 일정 기간(보통 7일) 동안 실제 DB 활동이
//   없으면 자동으로 "일시정지(paused)" 상태가 된다. 예전엔 집 컴퓨터의
//   윈도우 예약작업(UlmadnaKeepAlive)이 매일 접속해서 깨워줬는데,
//   집 컴퓨터가 꺼져 있으면 그대로 무용지물이었다(실제로 8/13부터
//   멈춰서 프로젝트가 일시정지됐었음).
//
//   이 라우트는 Vercel Cron(vercel.json의 crons 설정)이 매일 자동으로
//   호출한다 — 집 컴퓨터 전원과 완전히 무관하게 돌아간다.
//
// [인증]
//   Vercel Cron은 호출할 때 "Authorization: Bearer {CRON_SECRET}"
//   헤더를 자동으로 붙여준다(Vercel 표준 동작, CRON_SECRET 환경변수를
//   등록해두면 자동 적용됨). 남이 이 주소를 알아도 함부로 못 부르게
//   여기서 그 값을 직접 검증한다.
//
// [실제로 하는 일]
//   saved_estimates 테이블에서 1건만 조회(select)한다 — "읽기 요청"도
//   Supabase가 활동으로 인식하는 가장 가벼운 방법이라 이걸 씀.
//
// [기록]
//   성공/실패와 시각을 Upstash Redis에 "supabase:keepalive:last"라는
//   이름으로 남긴다 → /api/admin/health 에서 이 값을 읽어 "마지막으로
//   언제 확인됐는지" 보여줄 수 있음.
//
// [실패 시]
//   Supabase가 아예 응답을 안 주거나(타임아웃/DNS 실패), 5xx 에러를
//   주면 "일시정지됐을 가능성이 크다"고 보고 텔레그램으로 즉시 알린다.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';

// 크론은 캐시되면 안 되고 호출할 때마다 새로 실행돼야 함
export const dynamic = 'force-dynamic';

// ── 텔레그램으로 실패 알림 보내기 ──
// 실패해도(텔레그램 전송 자체가 안 돼도) 크론 응답에는 영향 주지 않음(조용히 무시)
async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // 텔레그램 환경변수 미설정 시 그냥 넘어감
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' }, // 한글 깨짐 방지
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      cache: 'no-store',
    });
  } catch {
    // 텔레그램 전송 실패는 조용히 무시 — 킵얼라이브 자체 결과가 더 중요한 정보라 여기서 막지 않음
  }
}

// ── 마지막 실행 결과를 Upstash Redis에 기록 (읽기는 /api/admin/health 에서) ──
async function recordKeepaliveResult(ok: boolean, detail: string): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return; // Upstash 미설정이면 기록만 생략(크론 실패로 치지 않음)
  const value = JSON.stringify({ at: new Date().toISOString(), ok, detail });
  try {
    await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // 다른 기록 없이 키 하나만 계속 덮어씀 — "마지막 상태"만 필요하기 때문
      body: JSON.stringify([['SET', 'supabase:keepalive:last', value]]),
      cache: 'no-store',
    });
  } catch {
    // Upstash 기록 실패해도 킵얼라이브 본연의 목적(Supabase 깨우기)은 이미 끝난 상태라 무시
  }
}

export async function GET(req: Request) {
  // ── 1) 인증: Vercel Cron 표준 헤더 검증 ──
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/supabase-keepalive] CRON_SECRET 미설정');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2) Supabase 접속 정보 확인 ──
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    const detail = 'Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) 미설정';
    console.error(`[cron/supabase-keepalive] ${detail}`);
    await recordKeepaliveResult(false, detail);
    await notifyTelegram(`[얼마드나] 킵얼라이브 실패\n${detail}`);
    return NextResponse.json({ error: detail }, { status: 500 });
  }

  // ── 3) 실제 DB 조회 1건 — Supabase REST를 service_role 키로 직접 호출 ──
  //    (supabase-js를 거치지 않고 REST를 바로 때려서 "실제 요청이 갔는지" 그대로 확인 가능)
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/saved_estimates?select=id&limit=1`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      // 응답은 왔는데 실패(5xx 등) — 프로젝트가 일시정지 중이거나 문제 있는 상태일 가능성
      const detail = `HTTP ${res.status} ${res.statusText}`;
      console.error(`[cron/supabase-keepalive] Supabase 응답 이상: ${detail}`);
      await recordKeepaliveResult(false, detail);
      await notifyTelegram(
        `[얼마드나] 킵얼라이브 실패 — Supabase 응답 이상\n${detail}\n일시정지됐을 수 있음. 대시보드에서 확인 필요.`
      );
      return NextResponse.json({ ok: false, detail }, { status: 502 });
    }

    // 성공 — Supabase가 정상 응답(활동 발생 → 일시정지 방지됨)
    await recordKeepaliveResult(true, 'OK');
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    // fetch 자체가 실패(DNS 실패, 타임아웃 등) — Supabase가 완전히 응답 불가한 상태
    const detail = e instanceof Error ? e.message : String(e);
    console.error(`[cron/supabase-keepalive] Supabase 응답 없음: ${detail}`);
    await recordKeepaliveResult(false, detail);
    await notifyTelegram(
      `[얼마드나] 킵얼라이브 실패 — Supabase 응답 없음\n${detail}\n일시정지됐을 가능성 높음. 대시보드에서 Resume 필요.`
    );
    return NextResponse.json({ ok: false, detail }, { status: 502 });
  }
}
