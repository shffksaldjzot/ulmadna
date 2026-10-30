// ─────────────────────────────────────────────────────────────
// 결제 설정 — GET /api/partner/pay/config (2026-10-30)
//   [카드 결제]를 누르는 순간 브라우저가 부른다. 서버가 지금 환경변수로 결제 설정을 돌려준다.
//   (열려 있던 화면에 박힌 옛 열쇠로 결제되는 사고를 막는다. 비밀 열쇠는 주지 않는다)
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { payConfig } from '@/server/partner/portone';
import { partnerOr401 } from '../../_util';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await partnerOr401();
  if ('res' in me) return me.res;
  const c = payConfig();
  return NextResponse.json({ ready: c.ready, storeId: c.storeId, channelKey: c.channelKey }, { headers: { 'Cache-Control': 'no-store' } });
}
