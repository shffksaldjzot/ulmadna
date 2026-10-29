// ─────────────────────────────────────────────────────────────
// /partner/stats — 노출 추이 (2026년 10월 31일)
//   위: 최근 14일 노출 막대(막대 위 숫자는 클릭)  아래: 자리별 표(노출·클릭·클릭률, 14일 합계)
//   그림 라이브러리 없이 칸 높이로 막대를 그린다(가볍게).
// ─────────────────────────────────────────────────────────────
import { SLOT_INFO, kstToday } from '@/lib/ads/pricing';
import { ctr, lastDays, regionName } from '@/lib/partner/rules';
import { requirePartnerPage } from '@/server/partner/session';
import { myAds } from '@/server/partner/store';
import { Card, NotReady, PartnerShell } from '../_ui';

export const dynamic = 'force-dynamic';

export default async function PartnerStats() {
  const s = await requirePartnerPage();
  const today = kstToday();
  const data = s.state === 'ok' ? await myAds(s.partner.advertiserId, today) : null;
  const days = lastDays(today, 14);

  // 날짜별 합계
  const daily = days.map((d) => {
    const hit = data?.events.filter((e) => e.day === d) ?? [];
    return { day: d, imp: hit.reduce((a, e) => a + e.impressions, 0), clk: hit.reduce((a, e) => a + e.clicks, 0) };
  });
  const max = Math.max(1, ...daily.map((d) => d.imp));

  // 주문(자리)별 14일 합계
  const rows = (data?.orders ?? []).map((o) => {
    const ev = data?.events.filter((e) => e.order_id === o.id) ?? [];
    const imp = ev.reduce((a, e) => a + e.impressions, 0);
    const clk = ev.reduce((a, e) => a + e.clicks, 0);
    return { id: o.id, label: `${SLOT_INFO[o.slot_kind].name}${o.process ? ` · ${o.process}` : ''}`, region: regionName(o.sido), imp, clk };
  });

  return (
    <PartnerShell name={s.state === 'ok' ? s.partner.name : ''} active="/partner/stats">
      <h1 className="mb-4 text-[22px] font-bold text-brown">노출 추이</h1>
      {!data ? (
        <NotReady />
      ) : (
        <>
          <Card className="mb-4">
            <p className="mb-3 text-[13px] text-ink-2">최근 14일 노출</p>
            <div className="flex h-36 items-end gap-1" role="img" aria-label="최근 14일 노출 막대">
              {daily.map((d) => (
                <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end">
                  <div className="w-full rounded-t bg-brown/80" style={{ height: `${Math.max(2, (d.imp / max) * 100)}%` }} title={`${d.day} 노출 ${d.imp} 클릭 ${d.clk}`} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-ink-2">
              <span>{days[0].slice(5).replace('-', '.')}</span>
              <span>{days[13].slice(5).replace('-', '.')}</span>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-[14px]">
              <thead className="bg-bg text-[12px] text-ink-2">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">자리</th>
                  <th className="px-2 py-2 text-right font-medium">노출</th>
                  <th className="px-2 py-2 text-right font-medium">클릭</th>
                  <th className="px-3 py-2 text-right font-medium">클릭률</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-2">아직 숫자가 없어요</td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <td className="px-3 py-2.5">
                        <p className="text-ink">{r.label}</p>
                        <p className="text-[12px] text-ink-2">{r.region}</p>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{r.imp.toLocaleString('ko-KR')}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{r.clk.toLocaleString('ko-KR')}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{ctr(r.imp, r.clk)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </PartnerShell>
  );
}
