// ─────────────────────────────────────────────────────────────
// 결제 준비 — POST /api/partner/pay/prepare (2026년 10월 31일)
//   새 광고: multipart { mode=new, kind, sido, process?, units, clickUrl, phone?, file }
//            제작 대행이면 file 대신 { design=1, intro, headline, logo? } (2026-10-29)
//   연장:   multipart { mode=extend, orderId }
//   서버가 금액을 계산해 결제 대기 한 줄을 만들고 { paymentId, orderName, total } 을 돌려준다.
//   브라우저는 이 값으로 포트원 결제창을 연다.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { prepareExtend, prepareNew } from '@/server/partner/pay';
import { fail, partnerOr401 } from '../../_util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const me = await partnerOr401();
  if ('res' in me) return me.res;
  const form = await req.formData().catch(() => null);
  if (!form) return fail(400, '보낸 내용을 읽지 못했어요');
  // 30일 연장
  if (form.get('mode') === 'extend') {
    const r = await prepareExtend(me.id, Number(form.get('orderId')));
    return r.ok ? NextResponse.json(r.data) : fail(400, r.error);
  }
  // 새 광고 — design=1 이면 배너 제작 대행(그림 대신 소개·강조 문구·로고 선택)
  const file = form.get('file');
  const logo = form.get('logo');
  const design = form.get('design') === '1'
    ? {
        intro: form.get('intro'),
        headline: form.get('headline'),
        mood: form.get('mood'),
        style: form.get('style'),
        logo: logo instanceof File && logo.size > 0 ? { bytes: new Uint8Array(await logo.arrayBuffer()), type: logo.type } : null,
      }
    : null;
  const r = await prepareNew(me.id, {
    kind: form.get('kind'),
    sido: form.get('sido'),
    process: form.get('process'),
    units: form.get('units'),
    clickUrl: form.get('clickUrl'),
    phone: form.get('phone'),
    file: !design && file instanceof File ? { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type } : null,
    design,
  }, me.name);
  return r.ok ? NextResponse.json(r.data) : fail(400, r.error);
}
