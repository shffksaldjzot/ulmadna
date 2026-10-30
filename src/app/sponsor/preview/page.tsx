// ─────────────────────────────────────────────────────────────
// 광고 자리 미리보기 캔버스 (/sponsor/preview) — 2026년 10월 30일 다시 만듦
//
// [무슨 기능인가]
//   광고주가 "내 배너가 실제 화면 어디에, 어떤 크기로, 얼마에 들어가나"를 한눈에 보는 화면.
//   실제 사이트 화면 캡처(public/sponsor/loc-*.webp) 위에 광고 영역을 또렷하게 표시한다
//   (바깥 어둡게 + 굵은 테두리 + 꼬리표 "코드 이름 / 사이즈 · 30일 가격").
//   예전에는 HTML 로 흉내 낸 가짜 화면(○○인테리어 견본, 없어진 AD-M1 같은 옛 자리 코드)이었는데,
//   형아 신고(2026-10-30)로 실제 캡처 + 영역 표시 방식으로 바꿨다.
//   이름·사이즈·가격은 가격 정본(src/lib/ads/pricing.ts)에서만 읽는다(MarkedShots 안에서).
// ─────────────────────────────────────────────────────────────

import Link from 'next/link';
import { MarkedShot, ShotCaption, PHONE_SHOTS, PC_SHOT, slotCaption, slotSize } from '@/components/sponsor/MarkedShots';
import { SLOT_INFO, SLOT_KINDS } from '@/lib/ads/pricing';

export const metadata = {
  title: '광고 자리 미리보기 | 얼마드나',
  description: '얼마드나 실제 화면에서 광고가 들어가는 자리와 크기, 30일 요금을 보여 드립니다.',
};

export default function SponsorPreview() {
  // 캡처에 한 번이라도 나오는 자리만 아래 요약에 보인다(견적서 글자 광고 AD-PDF 는 캡처가 없어 빠짐)
  const shown = SLOT_KINDS.filter((k) => [...PHONE_SHOTS, PC_SHOT].some((s) => s.marks.some((m) => m.kind === k)));

  return (
    <div className="min-h-screen bg-cream">
      {/* 위 안내 줄: 돌아가기 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <h1 className="text-sm font-bold text-brown">광고 자리 미리보기</h1>
          <Link href="/sponsor" className="text-xs text-brown underline underline-offset-2 whitespace-nowrap">광고 안내로</Link>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-sm text-gray-500 text-center mb-8">테두리 친 칸이 광고 자리입니다</p>

        {/* 휴대폰 화면 캡처들 — 폰 폭에선 한 줄에 하나(가운데), 넓어지면 2·3·4칸 */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10 justify-items-center">
          {PHONE_SHOTS.map((s) => (
            <li key={s.src} className="w-full max-w-[300px]">
              {/* 휴대폰 틀 */}
              <div className="rounded-[28px] border-[6px] border-ink bg-ink overflow-hidden shadow-sm">
                <div className="rounded-[22px] overflow-hidden">
                  <MarkedShot shot={s} />
                </div>
              </div>
              <ShotCaption shot={s} />
            </li>
          ))}
        </ul>

        {/* PC 첫 화면 — 헤더 가로 728×90 */}
        <div className="mt-14">
          <div className="rounded-xl border-[6px] border-ink bg-ink overflow-hidden max-w-3xl mx-auto">
            <MarkedShot shot={PC_SHOT} alt="PC 첫 화면 헤더 광고 자리" />
          </div>
          <ShotCaption shot={PC_SHOT} center />
        </div>

        {/* 자리 요약 — 이름·사이즈·30일 가격 (가격 정본에서 읽음) */}
        <section className="mt-14 bg-white rounded-2xl border border-gray-100 p-6 max-w-xl mx-auto">
          <h2 className="text-base font-bold text-brown mb-3">자리 요약</h2>
          <ul className="space-y-1.5 text-sm text-gray-600">
            {shown.map((k) => (
              <li key={k}>
                {slotCaption(k)}
                {/* PC 규격이 따로 있는 자리(AD-H·AD-F)는 PC 크기도 같이 */}
                {SLOT_INFO[k].desktop && <span className="text-gray-400"> (PC {slotSize(k, 'desktop')})</span>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 mt-3">모든 금액은 부가세 별도입니다.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/partner/signup" className="bg-brown text-white text-sm px-5 py-2.5 rounded-full hover:bg-brown/90 transition-colors">
              광고 신청하기
            </Link>
            <Link href="/sponsor#price" className="text-sm text-brown border border-brown px-5 py-2.5 rounded-full hover:bg-cream transition-colors">
              가격표 보기
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
