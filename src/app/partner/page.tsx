// ─────────────────────────────────────────────────────────────
// /partner — 내 광고 (2026년 10월 31일)
//   위: 요약 카드 3개(게재 중 개수 · 이번 주 노출 · 이번 주 클릭)
//   아래: 광고 카드(자리·지역·상태 배지·남은 날·노출/클릭/클릭률·[30일 연장][배너 교체])
//   DB 가 안 되면 "준비 중" 한 줄. 광고가 없으면 [새 광고 신청] 단추 하나.
// ─────────────────────────────────────────────────────────────
import Link from 'next/link';
import { kstToday } from '@/lib/ads/pricing';
import { badgeOf, lastDays } from '@/lib/partner/rules';
import { payConfig } from '@/server/partner/portone';
import { requirePartnerPage } from '@/server/partner/session';
import { myAds } from '@/server/partner/store';
import { Card, NotReady, PartnerShell, primaryBtn } from './_ui';
import AdCard from './AdCard';
import DoneCard from './DoneCard';

export const dynamic = 'force-dynamic';

export default async function PartnerHome({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const s = await requirePartnerPage();
  const doneId = Number((await searchParams).done); // 결제 직후 완료 안내용 주문 번호(2026-10-30)
  const name = s.state === 'ok' ? s.partner.name : '';
  const today = kstToday();
  const data = s.state === 'ok' ? await myAds(s.partner.advertiserId, today) : null;
  const cfg = payConfig();

  // 이번 주 = 오늘 포함 최근 7일
  const week = new Set(lastDays(today, 7));
  const weekImp = data?.events.filter((e) => week.has(e.day)).reduce((a, e) => a + e.impressions, 0) ?? 0;
  const weekClk = data?.events.filter((e) => week.has(e.day)).reduce((a, e) => a + e.clicks, 0) ?? 0;
  const liveCount = data?.orders.filter((o) => badgeOf(o, today) === 'live').length ?? 0;

  // 내 주문일 때만 완료 카드(남의 번호·없는 번호면 안 뜸)
  const doneOrder = data && Number.isInteger(doneId) ? data.orders.find((o) => o.id === doneId) : undefined;
  const doneKind = doneOrder ? (doneOrder.amount === 0 ? 'free' : doneOrder.design_requested ? 'design' : 'review') : null;

  return (
    <PartnerShell name={name} active="/partner">
      {doneKind && <DoneCard kind={doneKind} design={!!doneOrder?.design_requested} />}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-brown">내 광고</h1>
        {data && data.orders.length > 0 && (
          <Link href="/partner/new" className="flex h-11 items-center px-1 text-[15px] font-semibold text-accent">+ 새 광고</Link>
        )}
      </div>

      {!data ? (
        <NotReady />
      ) : (
        <>
          {/* 요약 카드 3개 */}
          <div className="mb-5 grid grid-cols-3 gap-2">
            {[
              ['게재 중', liveCount.toLocaleString('ko-KR')],
              ['이번 주 노출', weekImp.toLocaleString('ko-KR')],
              ['이번 주 클릭', weekClk.toLocaleString('ko-KR')],
            ].map(([k, v]) => (
              <Card key={k} className="!p-3">
                <p className="text-[12px] text-ink-2">{k}</p>
                <p className="mt-1 text-[20px] font-bold text-ink tabular-nums">{v}</p>
              </Card>
            ))}
          </div>

          {data.orders.length === 0 ? (
            <Card className="py-8 text-center">
              <p className="mb-4 text-[15px] text-ink-2">아직 신청한 광고가 없어요</p>
              <Link href="/partner/new" className={`${primaryBtn} flex items-center justify-center`}>새 광고 신청</Link>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.orders.map((o) => (
                <AdCard key={o.id} order={o} today={today} pay={cfg.ready ? { storeId: cfg.storeId, channelKey: cfg.channelKey } : null} email={s.state === 'ok' ? s.partner.email : ''} name={s.state === 'ok' ? s.partner.name : ''} />
              ))}
            </div>
          )}
        </>
      )}
    </PartnerShell>
  );
}
