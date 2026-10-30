// ─────────────────────────────────────────────────────────────
// 사업자번호 상태 확인 — POST /api/partner/biz-check (2026년 10월 30일)
//   받는 값: { bizNo }  →  { ok, kind('active'|'closed'|'unknown'), statusCd, statusName }
//   국세청이 안 될 때는 { ok:false } (화면은 "그대로 가입 가능"으로 안내).
//   같은 IP 분당 10회 제한. 열쇠 값은 응답에 싣지 않는다.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { isBizNo, normalizeBizNo } from '@/lib/partner/rules';
import { allowHit } from '@/server/partner/crypto';
import { checkBizNo } from '@/server/partner/ntsVerify';
import { clientIp } from '@/server/partner/session';
import { fail } from '../_util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!allowHit(`bz:${clientIp(req)}`, 10, 60_000)) return fail(429, '잠시 뒤에 다시 시도해 주세요');
  const raw = (await req.json().catch(() => null)) as { bizNo?: unknown } | null;
  const bizNo = normalizeBizNo(raw?.bizNo);
  if (!isBizNo(bizNo)) return fail(400, '사업자번호를 다시 확인해 주세요');
  const r = await checkBizNo(bizNo);
  if (!r.ok) return NextResponse.json({ ok: false });
  return NextResponse.json(r);
}
