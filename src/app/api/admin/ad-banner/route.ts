// ──────────────────────────────────────────────
// 관리자: 배너 그림 올리기 — POST /api/admin/ad-banner  (multipart: id, file)  (2026년 10월 29일)
//
// [무슨 기능인가]
//   주문 번호와 그림 파일을 받아 규격(320x100 등 1배·2배)·용량·형식(PNG/JPG)을 검사하고
//   Supabase 보관함(ad-banners)에 올린다. 배너 용량이 작아(최대 400KB) 서버가 직접 받는다.
//   게재 중이던 주문의 배너를 바꾸면 다시 심사중으로 돌아가 승인을 받아야 한다.
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { checkBanner } from '@/lib/ads/pricing';
import { getOrderKind, saveBanner } from '@/server/ads/store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const id = Number(form?.get('id'));
  const file = form?.get('file');
  if (!form || !Number.isInteger(id) || !(file instanceof File)) {
    return NextResponse.json({ error: '주문과 그림 파일이 필요해요' }, { status: 400 });
  }
  const kind = await getOrderKind(id);
  if (!kind) return NextResponse.json({ error: '주문을 찾지 못했어요' }, { status: 404 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const why = checkBanner(kind, bytes);
  if (why) return NextResponse.json({ error: why }, { status: 400 });
  const r = await saveBanner(id, bytes, file.type === 'image/png' ? 'image/png' : 'image/jpeg');
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 500 });
}
