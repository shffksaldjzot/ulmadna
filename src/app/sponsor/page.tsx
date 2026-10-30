// ─────────────────────────────────────────────────────────────
// 광고주 모집 페이지 (/sponsor) — 2026년 10월 30일 형아 확정 A안으로 다시 짬
//
// [무슨 기능인가]
//   "계산을 끝낸 사람 화면에 전화번호가 뜬다"를 첫 화면에 숫자로 보여 주고, 구획마다 실제 화면 한 장 + 한 줄로 설명한다.
//   구획: 1 첫 화면(방문자 지역 숫자) 2 누가 보나 3 얼마나 보나(시·도별 라이브 표) 4 어디에 보이나
//         5 가격·할인·첫 달 무료 6 어떻게 시작하나 7 견본 스타일 8 자주 묻는 것 9 마지막 CTA
//   숫자 출처: 일별 계산 집계 calc_runs_daily 최근 7일 합(src/server/sponsor/calcStats.ts, 1시간 캐시).
//   과장 금지: "계약 보장"·"전환율 N%" 같은 말은 쓰지 않는다. 실제 계산 수만 보여 준다.
// ─────────────────────────────────────────────────────────────
import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import BusinessInfo from '@/components/layout/BusinessInfo';
import { getBoard, remaining } from '@/server/ads/store';
import { firstFreeInfo } from '@/server/partner/store';
import { FIRST_FREE_ADVERTISERS } from '@/lib/ads/config';
import { LONG_DISCOUNT } from '@/lib/ads/pricing';
import { SIDO_CODES, REGION_NAMES } from '@/server/admin/format';
import { DESIGN_FEE, SLOT_INFO, slotPrice, type SlotKind } from '@/lib/ads/pricing';
import { BANNER_STYLES, styleImg } from '@/lib/ads/bannerStyles';
import { MarkedShot, ShotCaption, PHONE_SHOTS, PC_SHOT } from '@/components/sponsor/MarkedShots';
import RegionHero from '@/components/sponsor/RegionHero';
import { getWeekMap, pickWeek, topRegions, REGION_CHIPS } from '@/server/sponsor/calcStats';
import { regionFromHeaders } from '@/server/metrics/requestInfo';

// 남은 자리 표에 보일 자리(견적서 추천은 개수 제한이 없어 뺌, 공정 스폰서는 공정별이라 따로 안내)
const LEFT_KINDS: SlotKind[] = ['AD-H', 'AD-R', 'AD-T', 'AD-F'];

export const metadata = {
  title: '얼마드나 — 광고주 모집 | 견적을 계산한 사람에게 보이는 광고',
  description: '견적 숫자를 본 직후, 그 지역·공정 사람에게만 보이는 광고. 30일 5만원부터.',
};

/** 30일 요금 "100,000원" 표기(가격표용) — 가격 정본(SLOT_INFO·slotPrice)에서 읽는다 */
const won = (k: SlotKind, sido?: string) => `${slotPrice(k, sido).toLocaleString('ko-KR')}원`;

/** 구획 제목 + 한 줄 (긴 안내문 금지) */
function Head({ title, line }: { title: string; line?: string }) {
  return (
    <div className="text-center mb-6 px-4">
      <h2 className="text-xl lg:text-2xl font-bold text-brown">{title}</h2>
      {line && <p className="text-sm text-gray-500 mt-1.5">{line}</p>}
    </div>
  );
}

/** 휴대폰 틀 안의 실제 화면 한 장 + 한 줄 설명 */
function Phone({ src, alt, cap }: { src: string; alt: string; cap: ReactNode }) {
  return (
    <figure className="w-[220px] sm:w-auto mx-auto">
      <div className="rounded-[26px] border-[5px] border-ink bg-ink overflow-hidden shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={780} height={1688} loading="lazy" className="block w-full h-auto rounded-[20px]" />
      </div>
      <figcaption className="mt-2 text-xs text-gray-600 text-center leading-snug">{cap}</figcaption>
    </figure>
  );
}

/** 자주 묻는 것 5개(접힘) */
const FAQ: [string, string][] = [
  ['견적만 보고 안 하는 사람도 많지 않나요?', '네, 그럴 수 있습니다. 대신 평수·공정·등급을 입력한 사람만 광고를 보고, 접속 지역으로 한정되며, 계산 수는 위 표처럼 실제 숫자를 그대로 공개합니다.'],
  ['효과가 없으면요?', '노출·클릭이 광고주 화면에 실시간으로 공개되고, 30일 단위라 맞지 않으면 다음 달에 쓰지 않으시면 됩니다.'],
  ['경쟁 업체도 같이 보이나요?', '같은 자리에 최대 3곳이 돌아가며 보입니다. 자리가 차면 대기로 접수합니다.'],
  ['배너가 없어요.', '제작 1회 무료입니다. 8가지 스타일 중에서 고르거나 섞어 드립니다.'],
  ['세금계산서는요?', '광고주 화면의 결제 기록에서 요청하실 수 있습니다.'],
];

/** 가격표 행: [상품명, -, 게재 범위, 가격 코드] — 표(PC)와 카드(휴대폰)가 같이 쓴다 */
const PRICE_ROWS: string[][] = [
                  // 금액은 가격 정본(SLOT_INFO)에서 읽는다(2026-10-29 공정 스폰서 7만원)
                  ['맨 위 띠 배너', 'AD-H', '지역(시·도)당 3개 업체 · 블로그 글 포함', 'AD-H'],
                  ['견적 결과 옆 큰 배너', 'AD-R', '지역(시·도)당 3개 업체', 'AD-R'],
                  ['공정 전문 배너', 'AD-P', '지역 · 공정당 3개 업체 · 노출 3곳', 'AD-P'],
                  ['올수리 업체 배너', 'AD-T', '지역(시·도)당 3개 업체 · 노출 4곳(견적서 포함)', 'AD-T'],
                  // 2026-10-30: 푸터 자리도 카드·캡처에 안내하므로 가격표에 같이(정본 2만원)
                  ['맨 아래 띠 배너', 'AD-F', '지역(시·도)당 3개 업체 · 블로그 글 포함 모든 페이지 맨 아래', 'AD-F'],
                  ['견적서 추천 업체 줄', 'AD-PDF', '견적서 안 공정마다 여러 업체', 'AD-PDF'],
                  // 2026-10-29: 배너 제작 대행(기간 요금이 아니라 1회 요금)
                  ['배너 제작 대행', '-', '시안 1개 + 수정 2회 · 3영업일 · 첫 1회 무료', 'DESIGN'],
];

/** 가격 3칸(서울·경기/광역시/그 외) 값 — 제작 대행·견적서 추천은 한 줄 값 */
function priceCells(code: string): { label: string; value: string }[] {
  if (code === 'DESIGN') return [{ label: '1회', value: `${DESIGN_FEE.toLocaleString('ko-KR')}원` }];
  if (code === 'AD-PDF') return [{ label: '전 지역 같음', value: won('AD-PDF') }];
  return [
    { label: '서울·경기', value: won(code as SlotKind, '11') },
    { label: '광역시', value: won(code as SlotKind, '26') },
    { label: '그 외', value: won(code as SlotKind, '51') },
  ];
}

export default async function SponsorPage() {
  // 실제 광고 표에서 오늘 기준 사용 수를 읽는다(읽기 실패·표 없음이면 빈 판 = 3/3)
  const board = await getBoard();
  // 오픈 기념 첫 광고주 무료 — 남은 곳은 서버가 센다(읽기 실패·0이면 줄 숨김)
  const promo = await firstFreeInfo(null);
  // 방문자 지역(IP 시·도) → 못 읽거나 해외면 전국. 숫자는 1시간 캐시된 7일 합
  const region = regionFromHeaders(await headers());
  const weekMap = await getWeekMap();
  const pick = pickWeek(weekMap, region === 'ZZ' || region === 'unknown' ? 'all' : region);
  // 지역 숫자가 0이라 전국으로 바뀐 경우 칩 선택 상태도 전국(all)
  const first = { ...pick, key: pick.label === '전국' ? 'all' : region };
  const table = topRegions(weekMap, 8);
  return (
    <div className="min-h-screen bg-white">
      {/* 상단 띠 */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
          <Link href="/">
            <Image src="/ulmadna_logo.png" alt="얼마드나" width={100} height={34} />
          </Link>
          <Link href="/partner/signup" className="bg-brown text-white text-xs px-4 py-2 rounded-full hover:bg-brown/90 transition-colors">
            광고 신청하기
          </Link>
        </div>
      </header>

      {/* 1. 첫 화면 — 형아 확정 문구 + 지역 바꿔 보기 칩 */}
      <RegionHero initial={first} chips={REGION_CHIPS} freeLeft={promo && promo.left > 0 ? promo.left : 0} />

      {/* 2. 누가 보나 — 실제 화면 3장 */}
      <section id="who" className="py-12">
        <div className="max-w-4xl mx-auto">
          <Head title="누가 보나" />
          <div className="grid sm:grid-cols-3 gap-6 px-4">
            <Phone src="/sponsor/loc-home-result.webp" alt="평수·공정·등급 입력 뒤 견적 결과 화면" cap="평수·공정·등급을 넣고 결과가 뜬 화면" />
            <Phone src="/sponsor/flow/17.webp" alt="접속 지역 광고가 뜬 첫 화면" cap="접속 지역 사람에게만" />
            <Phone src="/sponsor/flow/03-slots.webp" alt="자리별 남은 곳 표" cap="같은 자리에 최대 3곳" />
          </div>
        </div>
      </section>

      {/* 3. 얼마나 보나 — 시·도별 이번 주 계산 수(라이브, 많은 순 8개) + 광고주 화면 */}
      <section id="how-many" className="bg-cream py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Head title="얼마나 보나" line="최근 7일 견적 계산 수 · 시·도별" />
          <div className="grid sm:grid-cols-2 gap-6 items-start">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" data-testid="week-table">
              {table.length === 0 ? (
                <p className="p-5 text-sm text-gray-500 text-center">집계를 불러오는 중입니다.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {table.map((r, i) => (
                      <tr key={r.code} className={i ? 'border-t border-gray-50' : ''}>
                        <td className="px-5 py-2.5 text-gray-700">{r.name}</td>
                        <td className="px-5 py-2.5 text-right font-semibold text-brown tabular-nums">{r.n.toLocaleString('ko-KR')}회</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <Phone src="/sponsor/flow/13.webp" alt="광고주 화면의 노출 추이" cap="노출·클릭은 광고주 화면에서 실시간" />
          </div>
        </div>
      </section>

      {/* 4. 어디에 보이나 — 실제 화면 캔버스(MarkedShots 그대로) */}
      <section id="where" className="py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl lg:text-2xl font-bold text-brown text-center mb-2 px-4">어디에 보이나</h2>
          <p className="text-sm text-gray-500 text-center mb-6 px-4">테두리 친 칸이 광고 자리입니다</p>
          <ul className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-4 pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-8">
            {PHONE_SHOTS.map((s) => (
              <li key={s.src} className="snap-center shrink-0 w-[250px] lg:w-auto">
                <div className="rounded-[28px] border-[6px] border-ink bg-ink overflow-hidden shadow-sm">
                  <div className="rounded-[22px] overflow-hidden">
                    <MarkedShot shot={s} />
                  </div>
                </div>
                <ShotCaption shot={s} />
              </li>
            ))}
          </ul>
          <div className="px-4 lg:px-8 mt-10">
            <div className="rounded-xl border-[6px] border-ink bg-ink overflow-hidden max-w-3xl mx-auto">
              <MarkedShot shot={PC_SHOT} alt="PC 첫 화면 헤더 광고 자리" />
            </div>
            <ShotCaption shot={PC_SHOT} center />
          </div>
        </div>
      </section>

      {/* 5. 가격·할인·첫 달 무료 + 제작 대행 */}
      <div className="bg-cream pt-4">
      {/* 가격표 — 2026-10-27 형아 확정(계획안 7-9). 30일 단위 일시불 카드 결제 */}
      <section id="price" className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl lg:text-2xl font-bold text-brown text-center mb-2">가격표 (30일 단위)</h2>
          {/* 위험 제거 한 줄(2026-10-30 형아 확정 A안) */}
          <p className="text-sm text-gray-600 text-center mb-8" data-testid="risk-line">반려되면 자동 환불 · 30일 단위 · 언제든 중단</p>
          {/* 휴대폰(640px 이하): 표 대신 카드 목록 */}
          <ul className="sm:hidden space-y-3" data-testid="price-cards">
            {PRICE_ROWS.map(([name, , target, code], i) => (
              <li key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-sm font-bold text-gray-700">{name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{target}</p>
                <div className="mt-3 flex gap-2">
                  {priceCells(code).map((c) => (
                    <div key={c.label} className="flex-1 min-w-0 rounded-lg bg-cream px-2 py-2 text-center">
                      <p className="text-[11px] text-gray-500">{c.label}</p>
                      <p className="text-sm font-semibold text-gold tabular-nums whitespace-nowrap">{c.value}</p>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream text-xs text-gray-500">
                <tr>
                  <th className="text-left px-5 py-3">상품</th>
                  <th className="text-left px-5 py-3">게재 범위</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">서울·경기</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">광역시</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">그 외</th>
                </tr>
              </thead>
              <tbody>
                {PRICE_ROWS.map(([name, , target, code], i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-700">{name}</td>
                    <td className="px-5 py-3 text-gray-400">{target}</td>
                    {code === 'DESIGN' ? (
                      <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gold whitespace-nowrap">{DESIGN_FEE.toLocaleString('ko-KR')}원(1회)</td>
                    ) : code === 'AD-PDF' ? (
                      <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gold whitespace-nowrap">{won('AD-PDF')} (전 지역 같음)</td>
                    ) : (
                      // 지역 단계: 서울·경기(11) / 광역시(26) / 그 외(51) 대표 값
                      [['11'], ['26'], ['51']].map(([sd]) => (
                        <td key={sd} className="px-4 py-3 text-right font-semibold text-gold whitespace-nowrap">{won(code as SlotKind, sd)}</td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* 장기 할인(2026-10-30): 정본 LONG_DISCOUNT 에서 문구를 만든다 → "90일 10% · 180일 20% 할인" */}
          <p className="text-sm font-semibold text-brown text-center mt-4" data-testid="long-discount">
            {[...LONG_DISCOUNT].reverse().map((d) => `${d.minUnits * 30}일 ${d.pct}%`).join(' · ')} 할인
          </p>
          {promo && promo.left > 0 && (
            <p className="text-sm font-semibold text-gold text-center mt-1" data-testid="promo-line">오픈 기념 · 첫 광고주 {FIRST_FREE_ADVERTISERS}곳 첫 달 무료 (남은 {promo.left}곳)</p>
          )}
          <ul className="text-xs text-gray-500 text-center mt-4 space-y-1">
            {/* 2026-10-29: PG 심사 필수 항목(서비스 제공기간·취소·환불 규정을 상품 페이지에 기재) — 카드 결제로 통일 */}
            <li>모든 금액은 부가세 별도이며, 결제는 광고주 화면에서 카드로 합니다. 기간은 30일 또는 90일(30일 단위 일시불)입니다.</li>
            <li>서비스 제공기간: 결제 뒤 배너 검토(보통 1영업일)를 거쳐 게재가 시작되며, 신청한 일수 동안 노출됩니다.</li>
            <li>취소·환불: 게재 시작 전 취소는 전액 환불, 배너 반려 시 전액 자동 환불, 게재 뒤에는 남은 일수만큼 환불합니다. 자세한 내용은 <Link href="/refund" className="underline">환불 규정</Link>.</li>
            <li>배너 제작 대행 제작비는 제작 착수 뒤에는 환불되지 않습니다.</li>
            <li>한 자리를 혼자 쓰고 싶다면 3개 구좌를 모두 구매하시면 됩니다(예: 맨 위 띠 3구좌 = 서울·경기 300,000원/30일). 트래픽 성장에 따라 단가가 조정될 수 있습니다.</li>
          </ul>
        </div>
      </section>
      {/* 배너 제작 대행 상품 (2026-10-29 형아 결정: 5만원·부가세 별도·광고주당 첫 1회 무료) */}
      <section id="design" className="pb-16 px-4">
        <div className="max-w-md mx-auto bg-cream rounded-2xl p-6 lg:p-8">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-brown">배너 제작 대행</h2>
            <span className="text-[11px] font-semibold bg-brown text-white px-2.5 py-1 rounded-full">첫 1회 무료</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gold tabular-nums">{DESIGN_FEE.toLocaleString('ko-KR')}원<span className="ml-1 text-xs font-normal text-gray-400">부가세 별도</span></p>
          <ul className="mt-4 space-y-1.5 text-sm text-gray-600">
            <li>· 시안 1개 + 수정 2회</li>
            <li>· 3영업일 안에 완성</li>
            <li>· 상호·전화·강조 문구·로고(선택)만 주세요</li>
          </ul>
          <Link href="/partner/new" className="mt-5 block text-center bg-brown text-white text-sm py-3 rounded-full hover:bg-brown/90 transition-colors">
            광고 신청하며 맡기기
          </Link>
        </div>
      </section>
      </div>

      {/* 지역별 남은 자리(오늘 고친 표 그대로) */}
      {/* 지역별 남은 자리 — 실제 광고 주문 표에서 읽는다(2026-10-29). 지역(시·도)당 3개 업체 */}
      <section id="left" className="pb-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-brown text-center mb-2">지역별 남은 자리</h2>
          <p className="text-xs text-gray-400 text-center mb-6">오늘 기준 · 한 지역 자리마다 최대 3개 업체가 돌아가며 보입니다</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream text-xs text-gray-500">
                <tr>
                  <th className="text-left px-5 py-3 whitespace-nowrap min-w-[88px]">지역</th>
                  {LEFT_KINDS.map((k) => (
                    <th key={k} className="text-center px-3 py-3 whitespace-nowrap">{SLOT_INFO[k].name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SIDO_CODES.map((c) => (
                  <tr key={c} className="border-t border-gray-50">
                    <td className="px-5 py-2 text-gray-700 whitespace-nowrap">{REGION_NAMES[c]}</td>
                    {LEFT_KINDS.map((k) => {
                      const left = remaining(board[c]?.[k], k) ?? 3;
                      return (
                        <td key={k} className={`px-3 py-2 text-center tabular-nums ${left === 0 ? 'text-gray-300' : 'text-brown font-medium'}`}>
                          {left === 0 ? '마감' : `${left}/3`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 text-center mt-3">공정 전문 배너는 지역 · 공정마다 3개 업체입니다. 공정별 자리는 문의 시 안내해 드립니다.</p>
        </div>
      </section>

      {/* 6. 어떻게 시작하나 — 3장면 */}
      <section id="start" className="py-12">
        <div className="max-w-4xl mx-auto">
          <Head title="어떻게 시작하나" />
          <div className="grid sm:grid-cols-3 gap-6 px-4">
            <Phone src="/sponsor/flow/05.webp" alt="광고주 가입 화면" cap="1. 가입" />
            <Phone src="/sponsor/flow/10.webp" alt="자리와 배너를 고르는 화면" cap="2. 자리·배너 고르기" />
            <Phone src="/sponsor/flow/12.webp" alt="검토 뒤 게재되는 주문 화면" cap="3. 검토 뒤 게재" />
          </div>
        </div>
      </section>

      {/* 7. 견본 스타일 */}
      {/* 견본 스타일 8종 — 가로로 밀어 보는 카드(2026-10-30). 제작 대행 때 이 중에서 고르거나 섞어 준다 */}
      <section id="styles" className="pb-12 pt-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl lg:text-2xl font-bold text-brown text-center mb-2 px-4">견본 스타일</h2>
          <p className="text-xs text-gray-500 text-center mb-6 px-4">제작 대행을 맡기면 이 중에서 고르거나 섞어 드려요 · 견본(가상 업체)</p>
          <div className="flex gap-3 overflow-x-auto px-4 pb-3 snap-x">
            {BANNER_STYLES.map((st) => (
              <div key={st.key} className="snap-start shrink-0 w-[300px] bg-cream rounded-2xl p-4" data-testid={`style-${st.key}`}>
                <h3 className="text-sm font-bold text-brown">{st.name}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5 mb-3 h-8">{st.desc}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={styleImg(st.key, '320x100')} alt={`${st.name} 휴대폰 띠 견본`} width={268} height={84} loading="lazy" className="block w-full h-auto rounded-md" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={styleImg(st.key, '300x250')} alt={`${st.name} 큰 배너 견본`} width={150} height={125} loading="lazy" className="block mt-2 w-[150px] h-auto rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. 자주 묻는 것 */}
      <section id="faq" className="bg-cream py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Head title="자주 묻는 것" />
          <div className="space-y-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="bg-white rounded-xl border border-gray-100 px-4 py-3 group">
                <summary className="cursor-pointer text-sm font-semibold text-brown list-none flex justify-between gap-3">
                  {q}<span className="text-gray-400 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 9. 마지막 CTA */}
      <section className="py-14 px-4 text-center">
        <h2 className="text-xl lg:text-2xl font-bold text-brown mb-5">내 지역 자리가 남아 있는지 보세요</h2>
        <div className="flex flex-col items-center gap-3">
          <a href="#left" className="inline-flex items-center justify-center h-[46px] px-7 bg-brown text-white text-sm font-semibold rounded-full hover:bg-brown/90 transition-colors">
            내 지역 남은 자리 보기
          </a>
          <a href="mailto:cs870@naver.com?subject=[얼마드나] 광고 문의" className="text-xs text-gray-500 underline underline-offset-2 py-2">
            문의 cs870@naver.com
          </a>
        </div>
      </section>

      {/* 푸터 — 판매자 정보(결제사 심사 대비, 정본은 src/lib/business.ts) */}
      <footer className="bg-brown text-cream/70 py-8 px-4">
        <div className="max-w-5xl mx-auto text-center text-xs space-y-3">
          <p>
            <Link href="/ads-terms" className="hover:text-cream">광고 서비스 이용약관</Link> ·{' '}
            <Link href="/refund" className="hover:text-cream">환불 규정</Link> ·{' '}
            <Link href="/terms" className="hover:text-cream">이용약관</Link> ·{' '}
            <Link href="/privacy" className="hover:text-cream">개인정보처리방침</Link> ·{' '}
            <Link href="/" className="hover:text-cream">견적 계산기</Link>
          </p>
          <p className="font-semibold">판매자 정보</p>
          <BusinessInfo className="text-cream/70" />
          <p>© 2026 도토리 스튜디오 · 얼마드나 · ulmadna.com</p>
        </div>
      </footer>
    </div>
  );
}
