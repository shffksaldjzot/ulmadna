// ──────────────────────────────────────────────
// 관리자 · 광고 자리 (실제 운영) — 2026년 10월 29일
//
// [무슨 기능인가]
//   1) 시도 17곳 x 자리 종류 판: 오늘 기준 "남은 자리 n/3"
//   2) 광고주 등록 · 주문 만들기(기간·금액·부가세 자동 계산)
//   3) 주문 목록: 입금 확인 · 배너 올리기 · 승인·게재 · 중지/종료 · 만료 7일 전 표시 · 노출·클릭 숫자
//   결제는 1차로 계좌이체 수동 입금 확인. 카드(PG)가 붙으면 같은 주문 표의 결제 방식·상태 칸을 쓴다.
//   표가 아직 없으면(SQL 미실행) 안내 한 줄만 보인다. 서버 컴포넌트라 열쇠는 브라우저로 안 나간다.
// ──────────────────────────────────────────────
import { SIDO_CODES, REGION_NAMES } from '@/server/admin/format';
import { SLOT_INFO, expiringSoon, kstToday, daysLeft, type SlotKind } from '@/lib/ads/pricing';
import { getBoard, listAdvertisers, listOrders, remaining } from '@/server/ads/store';
import { Card, PageHead, fmt } from '../_ui';
import { AdvertiserForm, OrderActions, OrderForm } from './AdsForms';

export const dynamic = 'force-dynamic';

/** 판에 보일 자리 4종(견적서 추천은 개수 제한이 없어 판에서 뺌) */
const BOARD_KINDS: SlotKind[] = ['AD-H', 'AD-R', 'AD-P', 'AD-F'];

const PAY_LABEL: Record<string, string> = { pending: '입금 대기', paid: '입금 확인', refunded: '환불' };
const RUN_LABEL: Record<string, string> = { review: '심사중', live: '게재', ended: '종료', stopped: '중지' };
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export default async function AdsPage() {
  const today = kstToday();
  const [board, advs, ord] = await Promise.all([getBoard(today), listAdvertisers(), listOrders()]);
  const sidos = SIDO_CODES.map((c) => ({ code: c, name: REGION_NAMES[c] }));

  if (!advs || !ord) {
    return (
      <div>
        <PageHead title="광고 자리" />
        <Card><p className="text-sm text-gray-500">광고 표를 읽지 못했어요. 20261029_ads_ops.sql 을 실행했는지 확인해 주세요.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHead title="광고 자리" note="오늘 기준 남은 자리 · 계좌이체 입금 확인 방식(카드 결제는 준비 중)" />

      <Card title="지역별 남은 자리">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 px-2 text-left text-[11px] font-medium text-gray-400">지역</th>
                {BOARD_KINDS.map((k) => (
                  <th key={k} className="py-2 px-2 text-center text-[11px] font-medium text-gray-400 whitespace-nowrap">
                    {k}<br /><span className="text-gray-300">{SLOT_INFO[k].name} {SLOT_INFO[k].width}×{SLOT_INFO[k].height}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SIDO_CODES.map((c) => (
                <tr key={c} className="border-b border-gray-50">
                  <td className="py-1.5 px-2 text-gray-600 whitespace-nowrap">{REGION_NAMES[c]}</td>
                  {BOARD_KINDS.map((k) => {
                    const used = board[c]?.[k] ?? 0;
                    const left = remaining(used, k) ?? 0;
                    // AD-P 는 공정마다 3곳이라 "공정 n건"으로만 보여 준다(공정별 남은 자리는 주문 만들 때 검사)
                    const text = k === 'AD-P' ? (used ? `${used}건` : '비어 있음') : `${left}/3 남음`;
                    return (
                      <td key={k} className="py-1.5 px-2 text-center">
                        <span className={`inline-block w-full rounded-md border py-1 text-[11px] ${
                          k !== 'AD-P' && left === 0 ? 'border-red-200 text-red-700 bg-red-50'
                            : used ? 'border-gray-200 text-brown' : 'border-dashed border-gray-200 text-gray-300'
                        }`}>{text}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="광고주 등록"><AdvertiserForm /></Card>
      <Card title="주문 만들기"><OrderForm advertisers={advs.map((a) => ({ id: a.id, name: a.name }))} sidos={sidos} /></Card>

      <Card title={`주문 ${ord.orders.length}건`}>
        {ord.orders.length === 0 ? (
          <p className="text-sm text-gray-400">아직 주문이 없어요</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] text-gray-400 text-left">
                  <th className="py-2 px-2">업체 · 자리</th>
                  <th className="py-2 px-2">기간</th>
                  <th className="py-2 px-2 text-right">금액</th>
                  <th className="py-2 px-2">상태</th>
                  <th className="py-2 px-2 text-right">노출 · 클릭</th>
                  <th className="py-2 px-2">작업</th>
                </tr>
              </thead>
              <tbody>
                {ord.orders.map((o) => {
                  const soon = o.run_status === 'live' && expiringSoon(o.end_date, today);
                  const ctr = o.impressions ? ((o.clicks / o.impressions) * 100).toFixed(1) : '-';
                  const img = ord.bannerBase(o.banner_path);
                  return (
                    <tr key={o.id} className="border-b border-gray-50 align-top">
                      <td className="py-2 px-2">
                        <p className="font-medium text-gray-700">{o.advertiser_name} <span className="text-[11px] text-gray-300">#{o.id}</span></p>
                        <p className="text-[11px] text-gray-500">{o.slot_kind} · {REGION_NAMES[o.sido] ?? o.sido}{o.process ? ` · ${o.process}` : ''}</p>
                        {img && <a href={img} target="_blank" rel="noreferrer" className="text-[11px] text-brown underline">배너 보기</a>}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap text-[12px] text-gray-600">
                        {o.start_date}<br />~ {o.end_date}
                        {soon && <span className="block text-[11px] text-red-600">만료 {daysLeft(o.end_date, today)}일 전</span>}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap text-[12px] text-gray-600">
                        {won(o.amount + o.vat)}<br /><span className="text-gray-400">부가세 {won(o.vat)}</span>
                        <br /><span className="text-gray-400">{o.pay_method === 'card' ? '카드' : '계좌'}</span>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap text-[12px]">
                        <span className={o.pay_status === 'paid' ? 'text-brown' : o.pay_status === 'refunded' ? 'text-red-700' : 'text-gray-500'}>{PAY_LABEL[o.pay_status]}</span>
                        <br />
                        <span className={o.run_status === 'live' ? 'text-brown font-medium' : 'text-gray-500'}>{RUN_LABEL[o.run_status]}</span>
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap text-[12px] tabular-nums text-gray-600">
                        {fmt(o.impressions)} · {fmt(o.clicks)}<br /><span className="text-gray-400">클릭률 {ctr}{ctr === '-' ? '' : '%'}</span>
                      </td>
                      <td className="py-2 px-2 min-w-[220px]">
                        <OrderActions id={o.id} kind={o.slot_kind} payStatus={o.pay_status} runStatus={o.run_status}
                          hasBanner={!!o.banner_path} clickUrl={o.click_url} phone={o.phone} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
