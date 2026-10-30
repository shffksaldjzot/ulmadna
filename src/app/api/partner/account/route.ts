// ─────────────────────────────────────────────────────────────
// 광고주 내 정보 — GET 읽기 / PATCH 상호·지역 고치기 (2026-10-30)
//   사업자번호·이메일은 고칠 수 없다(변경은 문의). 로그인 세션을 먼저 확인한다.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { isPartnerRegion } from '@/lib/partner/rules';
import { myAccount, updateProfile } from '@/server/partner/store';
import { fail, partnerOr401 } from '../_util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const me = await partnerOr401();
  if ('res' in me) return me.res;
  const acc = await myAccount(me.id);
  if (!acc) return fail(503, '준비 중이에요');
  return NextResponse.json({ account: acc });
}

export async function PATCH(req: Request) {
  const me = await partnerOr401();
  if ('res' in me) return me.res;
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
  if (name.length < 1 || name.length > 50) return fail(400, '상호는 1~50자로 적어 주세요');
  const region = raw?.region;
  if (!isPartnerRegion(region)) return fail(400, '지역을 골라 주세요');
  const r = await updateProfile(me.id, { name, region });
  if (!r.ok) return fail(503, r.error);
  return NextResponse.json({ ok: true });
}
