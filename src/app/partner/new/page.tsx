// ─────────────────────────────────────────────────────────────
// /partner/new — 새 광고 신청 (2026년 10월 31일)
//   서버는 로그인 확인과 결제 준비 여부(포트원 열쇠 3개)만 넘기고, 단계 화면은 NewWizard 가 그린다.
//   DB 가 안 돼도 화면은 다 그린다(신청 단추에서 "준비 중" 안내).
// ─────────────────────────────────────────────────────────────
import { payConfig } from '@/server/partner/portone';
import { requirePartnerPage } from '@/server/partner/session';
import { PartnerShell } from '../_ui';
import NewWizard from './NewWizard';

export const dynamic = 'force-dynamic';

export default async function PartnerNew() {
  const s = await requirePartnerPage();
  const cfg = payConfig();
  return (
    <PartnerShell name={s.state === 'ok' ? s.partner.name : ''} active="/partner/new">
      <NewWizard
        pay={cfg.ready ? { storeId: cfg.storeId, channelKey: cfg.channelKey } : null}
        region={s.state === 'ok' ? s.partner.region : ''}
        email={s.state === 'ok' ? s.partner.email : ''}
      />
    </PartnerShell>
  );
}
