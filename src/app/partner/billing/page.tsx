// ─────────────────────────────────────────────────────────────
// /partner/billing — 결제 기록 (2026년 10월 31일)
//   주문별 카드 결제 금액·일자·상태 + [세금계산서 요청](요청 시각만 기록, 관리자 처리는 나중)
// ─────────────────────────────────────────────────────────────
import { SLOT_INFO } from '@/lib/ads/pricing';
import { regionName, won } from '@/lib/partner/rules';
import { requirePartnerPage } from '@/server/partner/session';
import { myPayments } from '@/server/partner/store';
import { Card, NotReady, PartnerShell } from '../_ui';
import TaxButton from './TaxButton';

export const dynamic = 'force-dynamic';

/** 결제 상태 글자 */
const STATUS: Record<string, string> = { paid: '결제 완료', refunded: '환불됨', failed: '결제 실패', ready: '결제 전' };

/** ISO 시각 → 2026.10.31 */
function ymd(iso: string | null): string {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(0, 10).replace(/-/g, '.');
}

export default async function PartnerBilling() {
  const s = await requirePartnerPage();
  const list = s.state === 'ok' ? await myPayments(s.partner.advertiserId) : null;

  return (
    <PartnerShell name={s.state === 'ok' ? s.partner.name : ''} active="/partner/billing">
      <h1 className="mb-4 text-[22px] font-bold text-brown">결제 기록</h1>
      {!list ? (
        <NotReady />
      ) : list.length === 0 ? (
        <Card className="py-8 text-center text-[15px] text-ink-2">결제 기록이 없어요</Card>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <Card key={p.payment_id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink">
                    {SLOT_INFO[p.slot_kind].name}
                    {p.process ? ` · ${p.process}` : ''} {p.kind === 'extend' ? '연장' : ''}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-2">
                    {regionName(p.sido)} · {p.units * 30}일 · 카드 · {ymd(p.paid_at || p.created_at)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[16px] font-bold text-ink tabular-nums">{won(p.total)}</p>
                  <p className={`text-[12px] ${p.status === 'paid' ? 'text-safe' : 'text-ink-2'}`}>{STATUS[p.status] ?? p.status}</p>
                </div>
              </div>
              <p className="mt-1 text-[12px] text-ink-2">공급가 {won(p.amount)} + 부가세 {won(p.vat)}</p>
              {p.status === 'paid' && <TaxButton paymentId={p.payment_id} requested={!!p.tax_invoice_requested_at} />}
            </Card>
          ))}
        </div>
      )}
    </PartnerShell>
  );
}
