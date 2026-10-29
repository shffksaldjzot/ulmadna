// ─────────────────────────────────────────────────────────────
// 광고주 API 공용 — 로그인 확인·오류 응답 (2026년 10월 31일)
//   /api 경로는 미들웨어를 안 거치므로 API 마다 여기서 세션을 직접 확인한다.
// ─────────────────────────────────────────────────────────────
import 'server-only';
import { NextResponse } from 'next/server';
import { currentPartner } from '@/server/partner/session';

/** 오류 응답 한 줄 */
export function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/** 로그인한 업체 번호. 아니면 오류 응답 */
export async function partnerOr401(): Promise<{ id: number } | { res: NextResponse }> {
  const s = await currentPartner();
  if (s.state === 'ok') return { id: s.partner.advertiserId };
  if (s.state === 'down') return { res: fail(503, '준비 중이에요') };
  return { res: fail(401, '다시 로그인해 주세요') };
}
