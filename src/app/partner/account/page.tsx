// ─────────────────────────────────────────────────────────────
// /partner/account — 내 정보 (2026-10-30)
//   상호·지역 고치기, 사업자번호·이메일 보기, 비밀번호 변경, 로그아웃, 탈퇴 요청
// ─────────────────────────────────────────────────────────────
import { requirePartnerPage } from '@/server/partner/session';
import { myAccount } from '@/server/partner/store';
import { NotReady, PartnerShell } from '../_ui';
import AccountForms from './AccountForms';

export const dynamic = 'force-dynamic';

export default async function PartnerAccount() {
  const s = await requirePartnerPage();
  const acc = s.state === 'ok' ? await myAccount(s.partner.advertiserId) : null;
  return (
    <PartnerShell name={s.state === 'ok' ? s.partner.name : ''} active="/partner/account">
      <h1 className="mb-4 text-[22px] font-bold text-brown">내 정보</h1>
      {acc ? <AccountForms acc={acc} /> : <NotReady />}
    </PartnerShell>
  );
}
