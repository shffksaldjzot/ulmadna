import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import BusinessInfo from '@/components/layout/BusinessInfo';
import { getBoard, remaining } from '@/server/ads/store';
import { SIDO_CODES, REGION_NAMES } from '@/server/admin/format';
import { DESIGN_FEE, SLOT_INFO, type SlotKind } from '@/lib/ads/pricing';
// 광고 자리 표시 캡처(가림막·테두리·꼬리표) — /sponsor/preview 와 같이 쓴다(2026-10-30)
import { MarkedShot, ShotCaption, PHONE_SHOTS, PC_SHOT } from '@/components/sponsor/MarkedShots';

// 남은 자리 숫자를 5분마다 새로 읽는다(광고 표가 비어 있으면 전부 3/3)
export const revalidate = 300;

// 남은 자리 표에 보일 자리(견적서 추천은 개수 제한이 없어 뺌, 공정 스폰서는 공정별이라 따로 안내)
// 토탈 인테리어 스폰서(AD-T)는 지역(시·도)당 3곳이라 같이 보여 준다(2026-10-29)
const LEFT_KINDS: SlotKind[] = ['AD-H', 'AD-R', 'AD-T', 'AD-F'];

export const metadata = {
  title: '얼마드나 — 광고/제휴 안내 | 인테리어 견적 계산기',
  description: '월 방문자 타겟 광고로 인테리어 고객에게 직접 도달하세요. 지역권 타겟, 공정 전문 배너, 견적서 내 광고.',
};

/** 30일 요금 "n만원" 표기 — 가격 정본(SLOT_INFO)에서 읽어 와 화면과 주문 금액이 어긋나지 않게 한다 */
const man = (k: SlotKind) => `${(SLOT_INFO[k].price / 10000).toLocaleString('ko-KR')}만원`;
/** 30일 요금 "100,000원" 표기(가격표용) */
const won = (k: SlotKind) => `${SLOT_INFO[k].price.toLocaleString('ko-KR')}원`;

/**
 * 자리 카드 오른쪽 "배너 실물" — 견본 그림(public/sponsor/banner-ad-*.png, 2배 크기)을 실제 크기로 보여 준다 (2026-10-30)
 *   형아 신고: 예전 HTML 흉내(회색 동그라미 + "○○인테리어")로는 어떤 광고가 들어가는지 감이 안 온다.
 *   PC 규격(728×90)이 따로 있는 자리(AD-H·AD-F)는 같은 디자인을 PC 폭으로 늘린 그림(-pc.png)도 같이 보여 준다.
 */
const BANNER_SRC: Partial<Record<SlotKind, { mobile: string; desktop?: string }>> = {
  'AD-H': { mobile: '/sponsor/banner-ad-h.png', desktop: '/sponsor/banner-ad-h-pc.png' },
  'AD-P': { mobile: '/sponsor/banner-ad-p.png' },
  'AD-T': { mobile: '/sponsor/banner-ad-t.png' },
  'AD-R': { mobile: '/sponsor/banner-ad-r.png' },
  'AD-F': { mobile: '/sponsor/banner-ad-f.png', desktop: '/sponsor/banner-ad-f-pc.png' },
};

/** 배너 실물 한 장: 규격 그대로의 크기(CSS px)로, 칸보다 넓으면 비율 유지하며 줄인다 */
function RealBanner({ src, w, h, label }: { src: string; w: number; h: number; label: string }) {
  return (
    <figure className="min-w-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${label} 배너 실물`} width={w} height={h} loading="lazy"
        style={{ width: w, aspectRatio: `${w} / ${h}` }}
        className="block max-w-full h-auto rounded-md border border-gray-200" />
      <figcaption className="mt-1.5 text-[11px] text-gray-500 tabular-nums">{label}</figcaption>
    </figure>
  );
}

/** 자리 카드의 배너 실물 묶음(휴대폰 규격 + PC 규격이 있으면 둘 다. PC 규격이 없으면 PC 에서도 같은 그림이라 "휴대폰·PC") */
function SlotBanners({ kind }: { kind: SlotKind }) {
  const src = BANNER_SRC[kind];
  const info = SLOT_INFO[kind];
  if (!src) return null;
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
      <RealBanner src={src.mobile} w={info.width} h={info.height} label={`${src.desktop ? '휴대폰' : '휴대폰·PC'} ${info.width}×${info.height}`} />
      {src.desktop && info.desktop && (
        <RealBanner src={src.desktop} w={info.desktop.width} h={info.desktop.height} label={`PC ${info.desktop.width}×${info.desktop.height}`} />
      )}
    </div>
  );
}

/** 배너 예시(견본 그림, 2배 크기 PNG 를 1배 크기로 보여 줌) */
const BANNER_SAMPLES: { src: string; kind: SlotKind }[] = [
  { src: '/sponsor/banner-ad-h.png', kind: 'AD-H' },
  { src: '/sponsor/banner-ad-r.png', kind: 'AD-R' },
  { src: '/sponsor/banner-ad-p.png', kind: 'AD-P' },
  { src: '/sponsor/banner-ad-t.png', kind: 'AD-T' },
  { src: '/sponsor/banner-ad-f.png', kind: 'AD-F' },
];

/** 자리 카드 목록 — 배너 그림이 있는 자리는 실물(SlotBanners), 견적서 글자 광고는 mockup(글자 견본) */
const AD_SLOTS: { id: SlotKind; name: string; size: string; position: string; target: string; price: string; desc: string; mockup?: ReactNode }[] = [
  {
    id: 'AD-H',
    name: '맨 위 띠 배너',
    // 2026-10-29: 실제 규격 — 휴대폰 320×100, PC 728×90
    size: '휴대폰 320×100 · PC 728×90',
    position: '모든 화면 맨 위',
    target: '지역권 타겟',
    price: `30일 ${man('AD-H')} (지역(시·도)당 3개 업체, 부가세 별도)`,
    desc: '사용자가 가장 먼저 보는 위치. IP 기반으로 해당 지역 업체만 노출됩니다.',
  },
  {
    id: 'AD-P',
    name: '공정 전문 배너',
    // 2026-10-29: 실제 규격 320×50, 노출 3곳, 7만원(형아 결정)
    size: '320×50',
    position: '홈 공정 목록 · 그 공정 계산기 · 그 공정 블로그 글 (3곳)',
    target: '공정별 전문 업체',
    price: `30일 ${man('AD-P')} (지역·공정당 3개 업체, 부가세 별도)`,
    desc: '사용자가 해당 공정을 선택할 때 자연스럽게 노출. 창호 옆에 KCC, 욕실 옆에 대림 등.',
  },
  {
    id: 'AD-T',
    name: '올수리 업체 배너',
    // 2026-10-29 형아 결정: 30일 15만원, 지역당 3곳, 전 지역 판매
    size: '320×50',
    position: '홈 견적 결과 카드 아래 · 계산기 결과 페이지 · 인테리어 총론 블로그 글 · 견적서 PDF 하단 (4곳)',
    target: '지역권 종합 인테리어 업체',
    price: `30일 ${man('AD-T')} (지역(시·도)당 3개 업체, 부가세 별도)`,
    desc: '전체 견적을 확인한 사람에게 올수리·종합 시공 업체로 노출. 견적서 PDF 에는 상호·전화 한 줄이 함께 실립니다.',
  },
  {
    id: 'AD-R',
    name: '견적 결과 옆 큰 배너',
    size: '300×250',
    position: '견적 결과 영역',
    target: '지역권 타겟',
    price: `30일 ${man('AD-R')} (지역(시·도)당 3개 업체, 부가세 별도)`,
    desc: '견적 결과를 확인하는 사용자에게 노출. 가장 구매 의향이 높은 시점입니다.',
  },
  {
    // 2026-10-30: 푸터 자리도 캡처·가격 꼬리표에 나오므로 카드로 안내(가격은 정본 SLOT_INFO)
    id: 'AD-F',
    name: '맨 아래 띠 배너',
    size: '휴대폰 320×50 · PC 728×90',
    position: '모든 페이지 맨 아래',
    target: '지역권 타겟',
    price: `30일 ${man('AD-F')} (지역(시·도)당 3개 업체, 부가세 별도)`,
    desc: '어느 페이지를 보든 맨 아래에 노출됩니다. 상호·전화 한 줄 배너입니다.',
  },
  {
    id: 'AD-PDF',
    name: '견적서 추천 업체 줄',
    size: '견적서 하단',
    position: '다운로드 견적서',
    target: '지역권 추천업체',
    price: `30일 ${man('AD-PDF')} (여러 업체가 함께 실림, 부가세 별도)`,
    desc: '사용자가 다운받아 저장·공유하는 견적서 하단에 지역 추천업체 리스트가 포함됩니다. 엑셀은 별도 시트로 제공.',
    mockup: (
      <div className="border border-dashed border-brown/20 rounded-lg p-3 bg-cream/50 text-[10px]">
        <p className="text-gray-400 mb-2">📍 [남양주/구리 지역] 추천 인테리어 업체</p>
        <div className="space-y-1">
          <p className="text-gray-600">1. ○○인테리어 | 1588-XXXX | 시공사례 200건+</p>
          <p className="text-gray-600">2. △△디자인 | 010-XXXX | 강마루 전문</p>
          <p className="text-gray-600">3. □□홈 | 031-XXX | 욕실 리모델링</p>
        </div>
        <p className="text-gray-300 mt-2">※ 광고 제휴 업체입니다</p>
      </div>
    ),
  },
];

const STATS = [
  { value: '24', label: '공정 카테고리' },
  { value: '51+', label: '지역권 타겟 가능' },
  { value: '12', label: '광고 자리 (PC+모바일+견적서)' },
  { value: '₩2만~', label: '30일 최소 광고비(부가세 별도)' },
];

export default async function SponsorPage() {
  // 실제 광고 표에서 오늘 기준 사용 수를 읽는다(읽기 실패·표 없음이면 빈 판 = 3/3)
  const board = await getBoard();
  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
          <Link href="/">
            <Image src="/ulmadna_logo.png" alt="얼마드나" width={100} height={34} />
          </Link>
          {/* 2026-10-29: 광고주 셀프 화면(/partner)이 생겨 상단 단추는 바로 신청으로 */}
          <Link
            href="/partner/signup"
            className="bg-brown text-white text-xs px-4 py-2 rounded-full hover:bg-brown/90 transition-colors"
          >
            광고 신청하기
          </Link>
        </div>
      </header>

      {/* 히어로 */}
      <section className="bg-cream py-16 lg:py-24 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs text-gold tracking-widest mb-4">얼마드나 광고 파트너 안내</p>
          <h1 className="text-3xl lg:text-4xl font-bold text-brown leading-tight mb-4">
            인테리어를 준비하는 고객에게<br />
            당신의 브랜드를 보여주세요
          </h1>
          <p className="text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
            얼마드나는 회원가입 없이 누구나 쓰는 무료 인테리어 견적 계산기입니다.
            매일 인테리어를 알아보는 실수요자가 방문하며,
            지역과 공정에 맞춰 당신의 광고만 보여줍니다.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <a
              href="mailto:cs870@naver.com?subject=[얼마드나] 광고 문의"
              className="bg-brown text-white text-sm px-6 py-3 rounded-full hover:bg-brown/90 transition-colors"
            >
              광고 문의하기
            </a>
            <a
              href="#slots"
              className="text-sm text-brown border border-brown px-6 py-3 rounded-full hover:bg-cream transition-colors"
            >
              광고 상품 보기
            </a>
            <a
              href="/sponsor/preview"
              className="text-sm text-gold border border-gold px-6 py-3 rounded-full hover:bg-gold/5 transition-colors"
            >
              실제 적용 미리보기 →
            </a>
          </div>
        </div>
      </section>

      {/* 왜 얼마드나인가 */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-brown text-center mb-10">왜 얼마드나에 광고하나요?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-cream rounded-2xl p-6">
              <p className="text-2xl mb-3">🎯</p>
              <h3 className="font-bold text-brown mb-2">실수요자만 방문합니다</h3>
              <p className="text-sm text-gray-500">인테리어 견적을 알아보는 사람만 옵니다. 구경하는 트래픽이 아니라 실제로 시공을 준비하는 고객입니다.</p>
            </div>
            <div className="bg-cream rounded-2xl p-6">
              <p className="text-2xl mb-3">📍</p>
              <h3 className="font-bold text-brown mb-2">지역 타겟이 됩니다</h3>
              <p className="text-sm text-gray-500">서울 강남 사용자에게는 강남 업체 광고를, 남양주 사용자에게는 남양주 업체 광고를 보여줍니다. IP 기반 자동 타겟.</p>
            </div>
            <div className="bg-cream rounded-2xl p-6">
              <p className="text-2xl mb-3">📄</p>
              <h3 className="font-bold text-brown mb-2">견적서에 함께 갑니다</h3>
              <p className="text-sm text-gray-500">PDF/엑셀 견적서를 다운받으면 하단에 추천 업체로 노출됩니다. 견적서가 공유될 때마다 자연스럽게 확산.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 통계 */}
      <section className="bg-brown py-12 px-4">
        <div className="max-w-5xl mx-auto flex justify-center gap-12 lg:gap-20">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-gold">{s.value}</p>
              <p className="text-xs text-cream/60 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 광고 상품 */}
      <section id="slots" className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-brown text-center mb-3">광고 상품 안내</h2>
          <p className="text-sm text-gray-400 text-center mb-10">모든 배너에 &ldquo;광고&rdquo; 라벨이 표시되며, 팝업/자동재생 광고는 없습니다</p>

          <div className="space-y-8">
            {AD_SLOTS.map(slot => (
              <div key={slot.id} className="bg-cream rounded-2xl p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-base font-bold text-brown">{slot.name}</h3>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600 mb-3">
                      <p><span className="text-gray-400">사이즈:</span> {slot.size}px</p>
                      <p><span className="text-gray-400">위치:</span> {slot.position}</p>
                      <p><span className="text-gray-400">타겟:</span> {slot.target}</p>
                      <p><span className="text-gray-400">가격:</span> <span className="text-gold font-medium">{slot.price}</span></p>
                    </div>
                    <p className="text-xs text-gray-500">{slot.desc}</p>
                  </div>
                  {/* 견적서 글자 광고(AD-PDF)처럼 그림이 없는 자리는 글자 견본을 옆에 */}
                  {slot.mockup && (
                    <div className="lg:w-[300px] shrink-0">
                      <p className="text-[10px] text-gray-400 mb-2">견적서 미리보기</p>
                      {slot.mockup}
                    </div>
                  )}
                </div>
                {/* 배너 실물 — 카드 폭 전체를 써서 PC 728×90 도 실제 크기로 들어간다(좁은 화면에선 비율 유지하며 줄어듦) */}
                {!slot.mockup && (
                  <div className="mt-5 pt-5 border-t border-brown/10">
                    <p className="text-[10px] text-gray-400 mb-2">배너 실물 · 실제 크기</p>
                    <SlotBanners kind={slot.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 광고가 보이는 자리 — 실제 사이트 화면(휴대폰 390px) 캡처 (2026-10-29, 기존 "광고 위치 맵" 대체)
          실물 = 관리자 미리보기로 시험 주문 배너를 실제 자리에 띄워 찍은 것, 예시 = 자리 위치에 견본 배너를 겹쳐 그린 합성 */}
      <section id="where" className="bg-cream py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-brown text-center mb-2 px-4">광고가 보이는 자리</h2>
          <p className="text-sm text-gray-400 text-center mb-8 px-4">테두리 친 칸이 광고 자리입니다</p>
          {/* 휴대폰: 옆으로 넘겨 보기 / PC: 4칸 격자 */}
          <ul className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-4 pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-8">
            {PHONE_SHOTS.map((s) => (
              <li key={s.src} className="snap-center shrink-0 w-[250px] lg:w-auto">
                {/* 휴대폰 틀 + 광고 영역 표시(바깥 어둡게·굵은 테두리·꼬리표) */}
                <div className="rounded-[28px] border-[6px] border-ink bg-ink overflow-hidden shadow-sm">
                  <div className="rounded-[22px] overflow-hidden">
                    <MarkedShot shot={s} />
                  </div>
                </div>
                <ShotCaption shot={s} />
              </li>
            ))}
          </ul>
          {/* PC 첫 화면 728×90 */}
          <div className="px-4 lg:px-8 mt-10">
            <div className="rounded-xl border-[6px] border-ink bg-ink overflow-hidden max-w-3xl mx-auto">
              <MarkedShot shot={PC_SHOT} alt="PC 첫 화면 헤더 광고 자리" />
            </div>
            <ShotCaption shot={PC_SHOT} center />
          </div>
        </div>
      </section>

      {/* 배너 예시 — 견본 그림을 실제 크기(1배)로 보여 준다 (2026-10-29) */}
      <section id="samples" className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-brown text-center mb-2">배너 예시</h2>
          <p className="text-sm text-gray-400 text-center mb-8">이 정도 수준으로 만들어 드려요</p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-6">
            {BANNER_SAMPLES.map((b) => (
              <figure key={b.src} className="flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.src} alt={`${SLOT_INFO[b.kind].name} 배너 예시`} width={SLOT_INFO[b.kind].width} height={SLOT_INFO[b.kind].height} loading="lazy"
                  style={{ width: SLOT_INFO[b.kind].width, height: SLOT_INFO[b.kind].height }} className="max-w-full rounded-md border border-gray-100" />
                <figcaption className="mt-2 text-xs text-gray-500">{SLOT_INFO[b.kind].name} · {SLOT_INFO[b.kind].width}×{SLOT_INFO[b.kind].height}</figcaption>
              </figure>
            ))}
          </div>
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

      {/* 가격표 — 2026-10-27 형아 확정(계획안 7-9). 30일 단위 일시불 카드 결제 */}
      <section id="price" className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-brown text-center mb-8">가격표 (30일 단위)</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream text-xs text-gray-500">
                <tr>
                  <th className="text-left px-5 py-3">상품</th>
                  <th className="text-left px-5 py-3">게재 범위</th>
                  <th className="text-right px-5 py-3">30일 요금</th>
                </tr>
              </thead>
              <tbody>
                {[
                  // 금액은 가격 정본(SLOT_INFO)에서 읽는다(2026-10-29 공정 스폰서 7만원)
                  ['맨 위 띠 배너', 'AD-H', '지역(시·도)당 3개 업체', won('AD-H')],
                  ['견적 결과 옆 큰 배너', 'AD-R', '지역(시·도)당 3개 업체', won('AD-R')],
                  ['공정 전문 배너', 'AD-P', '지역 · 공정당 3개 업체 · 노출 3곳', won('AD-P')],
                  ['올수리 업체 배너', 'AD-T', '지역(시·도)당 3개 업체 · 노출 4곳(견적서 포함)', won('AD-T')],
                  // 2026-10-30: 푸터 자리도 카드·캡처에 안내하므로 가격표에 같이(정본 2만원)
                  ['맨 아래 띠 배너', 'AD-F', '지역(시·도)당 3개 업체 · 모든 페이지 맨 아래', won('AD-F')],
                  ['견적서 추천 업체 줄', 'AD-PDF', '견적서 안 공정마다 여러 업체', won('AD-PDF')],
                  // 2026-10-29: 배너 제작 대행(기간 요금이 아니라 1회 요금)
                  ['배너 제작 대행', '-', '시안 1개 + 수정 2회 · 3영업일 · 첫 1회 무료', `${DESIGN_FEE.toLocaleString('ko-KR')}원(1회)`],
                ].map(([name, , target, price], i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-700">{name}</td>
                    <td className="px-5 py-3 text-gray-400">{target}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gold whitespace-nowrap">{price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="text-xs text-gray-500 text-center mt-4 space-y-1">
            {/* 2026-10-29: PG 심사 필수 항목(서비스 제공기간·취소·환불 규정을 상품 페이지에 기재) — 카드 결제로 통일 */}
            <li>모든 금액은 부가세 별도이며, 결제는 광고주 화면에서 카드로 합니다. 기간은 30일 또는 90일(30일 단위 일시불)입니다.</li>
            <li>서비스 제공기간: 결제 뒤 배너 검토(보통 1영업일)를 거쳐 게재가 시작되며, 신청한 일수 동안 노출됩니다.</li>
            <li>취소·환불: 게재 시작 전 취소는 전액 환불, 배너 반려 시 전액 자동 환불, 게재 뒤에는 남은 일수만큼 환불합니다. 자세한 내용은 <Link href="/refund" className="underline">환불 규정</Link>.</li>
            <li>배너 제작 대행 제작비는 제작 착수 뒤에는 환불되지 않습니다.</li>
            <li>한 자리를 혼자 쓰고 싶다면 3개 구좌를 모두 구매하시면 됩니다(예: 헤더 3구좌 = 300,000원/30일). 트래픽 성장에 따라 단가가 조정될 수 있습니다.</li>
          </ul>
        </div>
      </section>

      {/* 지역별 남은 자리 — 실제 광고 주문 표에서 읽는다(2026-10-29). 지역(시·도)당 3개 업체 */}
      <section id="left" className="pb-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-brown text-center mb-2">지역별 남은 자리</h2>
          <p className="text-xs text-gray-400 text-center mb-6">오늘 기준 · 한 지역 자리마다 최대 3개 업체가 돌아가며 보입니다</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream text-xs text-gray-500">
                <tr>
                  <th className="text-left px-5 py-3">지역</th>
                  {LEFT_KINDS.map((k) => (
                    <th key={k} className="text-center px-3 py-3 whitespace-nowrap">{SLOT_INFO[k].name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SIDO_CODES.map((c) => (
                  <tr key={c} className="border-t border-gray-50">
                    <td className="px-5 py-2 text-gray-700">{REGION_NAMES[c]}</td>
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

      {/* 디자인 규칙 */}
      <section className="bg-cream py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-brown text-center mb-8">광고 디자인 규칙</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold text-brown mb-3">허용</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2"><span className="text-safe">✓</span> 흰색 또는 크림 배경</li>
                <li className="flex items-start gap-2"><span className="text-safe">✓</span> 로고 + 업체명 + 한 줄 카피</li>
                <li className="flex items-start gap-2"><span className="text-safe">✓</span> CTA 버튼 1개</li>
                <li className="flex items-start gap-2"><span className="text-safe">✓</span> 시공 사례 이미지</li>
                <li className="flex items-start gap-2"><span className="text-safe">✓</span> 둥근 모서리 (8px)</li>
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold text-brown mb-3">금지</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2"><span className="text-danger">✕</span> 팝업/전면 광고</li>
                <li className="flex items-start gap-2"><span className="text-danger">✕</span> 자동 재생 동영상</li>
                <li className="flex items-start gap-2"><span className="text-danger">✕</span> 원색/형광 배경</li>
                <li className="flex items-start gap-2"><span className="text-danger">✕</span> 깜빡이는 애니메이션</li>
                <li className="flex items-start gap-2"><span className="text-danger">✕</span> 콘텐츠를 가리는 오버레이</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <h2 className="text-2xl font-bold text-brown mb-3">광고 문의</h2>
        <p className="text-sm text-gray-500 mb-6">아래 이메일로 문의해 주시면 1영업일 내 회신 드립니다</p>
        <a
          href="mailto:cs870@naver.com?subject=[얼마드나] 광고 문의"
          className="inline-block bg-brown text-white text-sm px-8 py-3 rounded-full hover:bg-brown/90 transition-colors"
        >
          cs870@naver.com 으로 문의하기
        </a>
        <p className="text-xs text-gray-300 mt-4">제출 항목: 배너 이미지 + 클릭 URL + 업체명 + 광고 지역 + 희망 광고 자리 + 게재 기간</p>
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
