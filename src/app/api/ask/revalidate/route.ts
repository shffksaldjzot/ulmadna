// ──────────────────────────────────────────────
// 물어보기 — 화면 새로 그리기 요청(집컴 답변기 전용)
//
// POST /api/ask/revalidate   헤더: Authorization: Bearer {CRON_SECRET}
//   집컴이 Supabase에 답을 써 넣은 뒤 이 주소를 부르면, 목록·질문 화면·사이트맵을
//   60초 기다리지 않고 바로 새로 그린다. 비밀값이 맞지 않으면 401.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  // 비밀값이 서버에 없으면 아무도 못 부르게 막는다(빈 값끼리 맞아떨어지는 사고 방지)
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  revalidatePath('/ask');
  revalidatePath('/ask/[slug]', 'page');
  revalidatePath('/sitemap.xml');
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
