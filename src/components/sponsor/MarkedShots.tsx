// ─────────────────────────────────────────────────────────────
// 광고 자리 표시 캡처 — 광고 안내(/sponsor)와 자리 미리보기(/sponsor/preview)가 같이 쓴다 (2026년 10월 30일)
//
// [무슨 기능인가]
//   실제 사이트 화면 캡처(public/sponsor/loc-*.webp) 위에서 "어디가 광고인지" 또렷하게 보여 준다.
//   형아 신고(2026-10-30): 캡처 안의 배너가 화면에 너무 자연스럽게 섞여 뭐가 광고인지 모르겠다.
//   그래서 캡처마다
//     1) 광고 영역 바깥을 반투명으로 어둡게 가리고(광고만 밝게 남음)
//     2) 광고 영역에 굵은 강조색 테두리를 두르고
//     3) 꼬리표에 "자리 코드 + 자리 이름 + 사이즈 + 30일 가격"을 적는다.
//   이름·사이즈·가격은 가격 정본(src/lib/ads/pricing.ts 의 SLOT_INFO)에서만 읽는다(하드코딩 금지).
//
// [좌표는 어떻게 정했나]
//   캡처는 정적 그림이라 광고 영역 좌표를 캡처별로 적어 둔다. 단위는 캡처 원본 픽셀
//   (휴대폰 캡처 780×1688 = 390px 화면 2배, PC 캡처 780×488)이고, 화면에 그릴 때 원본 크기로
//   나눠 % 로 바꾸므로 캡처를 어떤 폭으로 보여 줘도 영역이 그대로 맞는다.
//   좌표는 배너 실물 그림(banner-ad-*.png)을 캡처 안에서 찾아(픽셀 차이 최소 위치) 잰 값이다.
//   캡처를 새로 찍으면 이 표의 좌표도 다시 재야 한다.
// ─────────────────────────────────────────────────────────────

import { SLOT_INFO, slotPrice, type SlotKind } from '@/lib/ads/pricing';

/** 휴대폰 캡처 원본 크기(px) — 390px 화면을 2배로 찍은 것 */
const PHONE_W = 780;
const PHONE_H = 1688;
/** PC 캡처 원본 크기(px) — 1280px 화면을 줄여 찍은 것 */
const PC_W = 780;
const PC_H = 488;

/** 캡처 안 광고 영역 하나: 자리 종류 + 원본 픽셀 좌표(x·y 왼쪽 위, w·h 크기) */
type Mark = {
  kind: SlotKind;
  x: number; y: number; w: number; h: number;
  /** 'desktop' 이면 PC 규격(728×90)으로 꼬리표를 쓴다. 기본은 휴대폰 규격 */
  target?: 'mobile' | 'desktop';
  /** 꼬리표를 영역 아래에 붙인다(영역이 캡처 맨 위에 붙어 있어 위쪽에 자리가 없을 때) */
  tagBelow?: boolean;
};

/** 캡처 한 장: 그림 주소·제목·원본 크기·광고 영역들·실물 여부 */
export type Shot = {
  src: string;
  title: string;
  width: number;
  height: number;
  marks: Mark[];
  /** true=관리자 미리보기로 실제 자리에 띄워 찍은 실물, false=자리 위치에 견본 배너를 겹친 합성(캡션에 "예시") */
  real: boolean;
};

/** 휴대폰 화면 캡처 목록(390px 화면) — 광고 영역 좌표는 위 설명대로 잰 값 */
export const PHONE_SHOTS: Shot[] = [
  { src: '/sponsor/loc-home-h.webp', title: '첫 화면', width: PHONE_W, height: PHONE_H, real: true,
    marks: [{ kind: 'AD-H', x: 70, y: 138, w: 640, h: 200 }] },
  { src: '/sponsor/loc-home-result.webp', title: '견적 결과 아래', width: PHONE_W, height: PHONE_H, real: false,
    marks: [
      { kind: 'AD-T', x: 70, y: 179, w: 640, h: 100 },
      { kind: 'AD-R', x: 90, y: 1079, w: 600, h: 500 },
    ] },
  { src: '/sponsor/loc-home-process.webp', title: '홈 공정 목록', width: PHONE_W, height: PHONE_H, real: false,
    marks: [{ kind: 'AD-P', x: 70, y: 793, w: 640, h: 100 }] },
  { src: '/sponsor/loc-calc-result.webp', title: '계산기 결과', width: PHONE_W, height: PHONE_H, real: false,
    marks: [
      { kind: 'AD-P', x: 70, y: 445, w: 640, h: 100 },
      { kind: 'AD-R', x: 90, y: 745, w: 600, h: 500 },
    ] },
  { src: '/sponsor/loc-blog-mid.webp', title: '블로그 글 본문 중간', width: PHONE_W, height: PHONE_H, real: false,
    marks: [{ kind: 'AD-P', x: 70, y: 794, w: 640, h: 100 }] },
  { src: '/sponsor/loc-blog-end.webp', title: '블로그 글 끝', width: PHONE_W, height: PHONE_H, real: true,
    marks: [{ kind: 'AD-R', x: 90, y: 594, w: 600, h: 500 }] },
  { src: '/sponsor/loc-footer.webp', title: '푸터', width: PHONE_W, height: PHONE_H, real: false,
    marks: [{ kind: 'AD-F', x: 70, y: 892, w: 640, h: 100 }] },
];

/** PC 첫 화면 캡처 — 헤더 가로 PC 규격(728×90). 영역이 맨 위라 꼬리표는 아래에 */
export const PC_SHOT: Shot = {
  src: '/sponsor/loc-pc-home.webp', title: 'PC 첫 화면', width: PC_W, height: PC_H, real: false,
  marks: [{ kind: 'AD-H', x: 168, y: 46, w: 443, h: 55, target: 'desktop', tagBelow: true }],
};

/** 30일 요금 "n만원" — 가격 정본에서 읽는다 */
export function priceMan(k: SlotKind): string {
  // 2026-10-30: 지역 단계 가격 — 꼬리표엔 서울·경기(1단계) 값에 "부터"(견적서 줄은 고정가라 그대로)
  const v = `${(slotPrice(k, '11') / 10000).toLocaleString('ko-KR')}만원`;
  return k === 'AD-PDF' ? v : `${v}부터`;
}

/** 자리 사이즈 "320×100" — target 'desktop' 이면 PC 규격(있을 때만) */
export function slotSize(k: SlotKind, target: 'mobile' | 'desktop' = 'mobile'): string {
  const info = SLOT_INFO[k];
  const s = target === 'desktop' && info.desktop ? info.desktop : { width: info.width, height: info.height };
  return `${s.width}×${s.height}`;
}

/** 캡션 한 줄: "맨 위 띠 배너 · 320×100 · 30일 10만원부터" (PC 는 "PC 728×90") */
export function slotCaption(k: SlotKind, target: 'mobile' | 'desktop' = 'mobile'): string {
  const size = target === 'desktop' ? `PC ${slotSize(k, 'desktop')}` : slotSize(k);
  return `${SLOT_INFO[k].name} · ${size} · 30일 ${priceMan(k)}`;
}

/** 원본 픽셀 → 캡처 폭·높이 대비 % (폰 폭이 바뀌어도 영역이 맞게) */
const pct = (v: number, total: number) => `${(v / total) * 100}%`;

/**
 * 광고 영역을 표시한 캡처 한 장
 *  - 그림 위에 같은 비율의 SVG 를 덮어 "광고 영역만 구멍 뚫린 어두운 막"을 그린다(가림)
 *  - 영역마다 굵은 테두리 + 꼬리표(코드·이름 / 사이즈·가격 두 줄)
 *  - 틀(휴대폰 테두리 등)은 부르는 쪽에서 감싼다
 */
export function MarkedShot({ shot, alt }: { shot: Shot; alt?: string }) {
  // SVG 가림막 구멍 id — 한 화면에 같은 캡처가 두 번 나와도 겹치지 않게 그림 이름으로 만든다
  const maskId = `admask-${shot.src.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shot.src} alt={alt ?? `${shot.title} 광고 자리`} width={shot.width} height={shot.height} loading="lazy" className="block w-full h-auto" />

      {/* 가림막: 광고 영역 바깥을 반투명으로 어둡게(원본 픽셀 좌표 그대로, 그림과 같이 늘어남) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${shot.width} ${shot.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <mask id={maskId}>
            {/* 흰색=가림, 검은색=구멍(광고 영역은 원래 밝기 그대로) */}
            <rect x="0" y="0" width={shot.width} height={shot.height} fill="white" />
            {shot.marks.map((m, i) => (
              <rect key={i} x={m.x} y={m.y} width={m.w} height={m.h} fill="black" />
            ))}
          </mask>
        </defs>
        <rect x="0" y="0" width={shot.width} height={shot.height} fill="rgb(20 14 10 / 0.55)" mask={`url(#${maskId})`} />
      </svg>

      {/* 영역 테두리 + 꼬리표 — % 위치라 그림 폭이 바뀌어도 맞는다 */}
      {shot.marks.map((m, i) => {
        const target = m.target ?? 'mobile';
        return (
          <div
            key={i}
            className="absolute pointer-events-none border-[3px] border-accent rounded-[3px] shadow-[0_0_0_1px_white]"
            style={{
              left: pct(m.x, shot.width),
              top: pct(m.y, shot.height),
              width: pct(m.w, shot.width),
              height: pct(m.h, shot.height),
            }}
          >
            {/* 꼬리표: 영역 바깥 위(또는 아래)에 붙는다. 1줄=코드·이름, 2줄=사이즈·30일 가격 */}
            <span
              className={`absolute left-[-3px] max-w-[calc(100%+6px)] bg-accent text-white px-1.5 py-0.5 leading-tight ${
                m.tagBelow ? 'top-full mt-[3px] rounded-b-[4px]' : 'bottom-full mb-[3px] rounded-t-[4px]'
              }`}
            >
              <span className="block text-[10px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                {SLOT_INFO[m.kind].name}
              </span>
              <span className="block text-[10px] whitespace-nowrap tabular-nums">
                {target === 'desktop' ? `PC ${slotSize(m.kind, 'desktop')}` : slotSize(m.kind)} · 30일 {priceMan(m.kind)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 캡처 아래 캡션: 제목(+예시 표시) + 자리마다 "코드 · 이름 · 사이즈 · 30일 가격" */
export function ShotCaption({ shot, center = false }: { shot: Shot; center?: boolean }) {
  return (
    <div className={center ? 'text-center' : ''}>
      <p className="mt-3 text-sm font-semibold text-brown">
        {shot.title}
        {!shot.real && <span className="ml-1.5 align-middle text-[10px] font-medium text-gray-400 border border-gray-200 rounded px-1">예시</span>}
      </p>
      {shot.marks.map((m, i) => (
        <p key={i} className="text-xs text-gray-500">{slotCaption(m.kind, m.target)}</p>
      ))}
    </div>
  );
}
