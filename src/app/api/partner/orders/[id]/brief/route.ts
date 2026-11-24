// ─────────────────────────────────────────────────────────────
// 제작 요청 내용 고치기 — PATCH /api/partner/orders/[id]/brief (2026-10-30, 2026년 11월 24일 바꿈)
//   본인 주문 · 제작 대행 · 게재 전(검토 단계)이면 고칠 수 있고, 고치면 배너를 다시 자동으로 그린다(횟수 제한 없음).
//   손으로 올린 배너가 있거나 게재가 시작됐으면 막는다. 실제 처리는 server/partner/brief.ts.
//   받는 값: JSON { intro, headline, mood?, style? } 또는 multipart(같은 칸 + logo 파일, 로고를 바꿀 때)
//   상호·전화는 그대로 둔다.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { updateBriefAndRedraw, type BriefInput } from '@/server/partner/brief';
import { fail, partnerOr401 } from '../../../_util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// 다시 그리기가 이 처리 안에서 돈다(보통 1초 안) — 최대 시간을 정해 둔다
export const maxDuration = 60;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await partnerOr401();
  if ('res' in me) return me.res;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return fail(400, '광고를 찾지 못했어요');
  let input: BriefInput | null = null;
  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    // 로고를 바꿀 때는 파일과 함께 multipart 로 온다
    const form = await req.formData().catch(() => null);
    if (form) {
      const logo = form.get('logo');
      input = {
        intro: form.get('intro'),
        headline: form.get('headline'),
        mood: form.get('mood'),
        style: form.has('style') ? form.get('style') : undefined,
        logo: logo instanceof File && logo.size > 0 ? { bytes: new Uint8Array(await logo.arrayBuffer()), type: logo.type } : null,
      };
    }
  } else {
    const raw = (await req.json().catch(() => null)) as { intro?: unknown; headline?: unknown; mood?: unknown; style?: unknown } | null;
    if (raw) input = { intro: raw.intro, headline: raw.headline, mood: raw.mood, style: 'style' in raw ? raw.style : undefined, logo: null };
  }
  if (!input) return fail(400, '보낸 내용을 읽지 못했어요');
  const r = await updateBriefAndRedraw(me.id, id, input);
  return r.ok ? NextResponse.json({ ok: true, redrawn: r.data.redrawn }) : fail(r.status, r.error);
}
