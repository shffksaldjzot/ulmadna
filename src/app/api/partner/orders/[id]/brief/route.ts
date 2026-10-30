// ─────────────────────────────────────────────────────────────
// 제작 요청 내용 고치기 — PATCH /api/partner/orders/[id]/brief (2026-10-30)
//   본인 주문 · 제작 대행 · 배너가 아직 없을 때(시안 만들기 전)만 고칠 수 있다.
//   받는 값 { intro, headline, mood? } — 상호·전화·로고는 그대로 둔다.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { BRIEF_MAX, briefProblem, cleanBrief } from '@/lib/partner/rules';
import { adminOrNull } from '@/lib/ask/server';
import { fail, partnerOr401 } from '../../../_util';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await partnerOr401();
  if ('res' in me) return me.res;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return fail(400, '광고를 찾지 못했어요');
  const raw = (await req.json().catch(() => null)) as { intro?: unknown; headline?: unknown; mood?: unknown } | null;
  if (!raw) return fail(400, '보낸 내용을 읽지 못했어요');
  const intro = cleanBrief(raw.intro, BRIEF_MAX.intro);
  const headline = cleanBrief(raw.headline, BRIEF_MAX.headline);
  const mood = cleanBrief(raw.mood, BRIEF_MAX.mood);
  const bp = briefProblem(intro, headline);
  if (bp) return fail(400, bp);
  const sb = adminOrNull();
  if (!sb) return fail(503, '준비 중이에요');
  const { data: o } = await sb
    .from('ad_orders')
    .select('id,advertiser_id,design_requested,banner_path,design_brief')
    .eq('id', id)
    .eq('advertiser_id', me.id)
    .maybeSingle();
  if (!o || o.design_requested !== true) return fail(404, '제작 대행 광고를 찾지 못했어요');
  if (o.banner_path) return fail(409, '시안 작업이 시작돼 더는 고칠 수 없어요');
  const prev = o.design_brief && typeof o.design_brief === 'object' ? (o.design_brief as Record<string, unknown>) : {};
  const { error } = await sb.from('ad_orders').update({ design_brief: { ...prev, intro, headline, mood } }).eq('id', id).eq('advertiser_id', me.id);
  if (error) return fail(500, '저장하지 못했어요');
  return NextResponse.json({ ok: true });
}
