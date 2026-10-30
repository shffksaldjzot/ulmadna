// ─────────────────────────────────────────────────────────────
// 광고주 탈퇴 요청 — POST (2026-10-30)
//   바로 지우지 않고 계정 상태를 '탈퇴 요청'으로만 바꾼다. 처리는 관리자가 광고주 화면에서 한다.
//   게재 중 광고는 끝난 뒤 처리된다.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { requestWithdraw } from '@/server/partner/store';
import { fail, partnerOr401 } from '../../_util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const me = await partnerOr401();
  if ('res' in me) return me.res;
  const r = await requestWithdraw(me.id);
  if (!r.ok) return fail(r.code === 'down' ? 503 : 409, r.error);
  return NextResponse.json({ ok: true });
}
