// ──────────────────────────────────────────────
// 물어보기 — 조회수 1 올리기
//
// POST /api/ask/view  { id }
//   질문 화면은 60초마다 새로 그려지는 정적 화면이라 서버가 볼 때마다 셀 수 없다.
//   그래서 화면이 열리면 브라우저가 이 주소를 한 번 부른다(같은 탭에서 새로 고침은
//   화면 쪽에서 한 번만 부르게 막는다). 실제 더하기는 DB 함수(ask_inc_view)가 한다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { adminOrNull } from '@/lib/ask/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const sb = adminOrNull();
  if (!sb) return NextResponse.json({ ok: false });
  try {
    const { id } = (await req.json()) as { id?: unknown };
    const n = Number(id);
    if (!Number.isSafeInteger(n) || n <= 0) return NextResponse.json({ ok: false }, { status: 400 });
    await sb.rpc('ask_inc_view', { p_id: n });
    return NextResponse.json({ ok: true });
  } catch {
    // 조회수는 못 세도 화면에는 아무 영향 없게 조용히 넘어간다
    return NextResponse.json({ ok: false });
  }
}
