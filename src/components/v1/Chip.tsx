// ──────────────────────────────────────────────
// v1 허브 — 칩 부품 (공정·평형·범위 선택용). 이 부품은 계산기 3종(도배·바닥재·미장) 화면
// 안에서만 쓰인다(홈 베타 계산기·블로그 카테고리 칩은 이 컴포넌트를 안 쓰는 별도 마크업이라
// 영향이 없다).
//
// 크기(size)는 두 가지:
//   'md'(기본) — 높이 36 · 글자 14 · 좌우 패딩 14. 용도·베이·범위(벽/천장) 등 대부분의 선택 칩.
//   'sm'       — 높이 32 · 글자 13. 평/㎡·면적/가로×세로·m/mm처럼 값 선택이 아니라 "보기 방식"을
//                바꾸는 소형 단위 토글 전용.
// 모양(shape)은 기존과 같다 — 'pill'(알약) 기본, 'square'는 모서리 4px(도배지 색상·규격 칩용).
//
// 2026-09-16 형아 피드백: 모바일에서 알약 칩이 너무 커 보인다는 지적으로 기본 높이를
// 44 → 36으로, 글자를 16 → 14로 줄였다(칩 간격은 원래도 gap-2=8px라 그대로 둔다).
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 3-7절: "보이는 크기는 그대로 두고, 눌리는
// 범위만 44px 이상으로 넓힌다." 보이는 높이(md=36 · sm=32)는 손대지 않고, ::before
// 가상 요소로 위아래에 투명한 영역을 덧붙여서 실제 누를 수 있는 높이만 44px로 만든다
// (가상 요소는 레이아웃 크기에 영향을 안 주는 절대 위치라, 옆 칩과의 간격·줄바꿈은
// 그대로다 — 칩 사이 세로 간격이 8px 이상이면 위아래 4~6px씩 넓혀도 서로 안 겹친다).
// ──────────────────────────────────────────────

'use client';

import type { ButtonHTMLAttributes } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** 칩 모양. 기본 'pill'(알약). 'square'는 모서리 4px — 다른 화면에는 영향 없음 */
  shape?: 'pill' | 'square';
  /** 칩 크기. 기본 'md'(36/14). 'sm'(32/13)은 평/㎡·면적/가로×세로 같은 소형 단위 토글 전용 */
  size?: 'md' | 'sm';
  /**
   * 2026-09-29 지시서 3-6절 다듬기 — 이 칩이 "하나만 고르는 묶음"(ChipGroup role="radiogroup")
   * 안에 있을 때 true로 준다. true면 aria-pressed 대신 role="radio"+aria-checked를 낸다
   * (스크린리더가 "여러 개 중 하나 고르기"로 정확히 읽는다). 기본 false — 안 주면 기존
   * 그대로 aria-pressed만 낸다(여러 개를 각각 켜고 끄는 묶음, 단독 버튼 전부 안 바뀜).
   */
  asRadio?: boolean;
}

export default function Chip({ selected, shape = 'pill', size = 'md', asRadio = false, className = '', children, ...rest }: ChipProps) {
  // 모양만 다르고 선택/미선택 색상 규칙은 동일하다
  const shapeClass = shape === 'square' ? 'rounded-[4px]' : 'rounded-full';
  // 크기별 높이·좌우 패딩·글자 크기 — md(기본 선택 칩) / sm(소형 단위 토글)
  const sizeClass = size === 'sm' ? 'h-8 px-[10px] text-[13px]' : 'h-9 px-[14px] text-[14px]';
  // 눌리는 범위 확장값 — md(36→44)는 위아래 4px씩, sm(32→44)는 위아래 6px씩
  const hitExpand = size === 'sm' ? 'before:-top-[6px] before:-bottom-[6px]' : 'before:-top-[4px] before:-bottom-[4px]';
  return (
    <button
      type="button"
      className={
        // relative + ::before: 보이는 크기는 그대로 두고 누를 수 있는 영역만 위아래로 넓힌다(3-7절)
        `relative inline-flex items-center ${sizeClass} ${shapeClass} whitespace-nowrap transition-colors duration-150 ` +
        `before:absolute before:content-[''] before:inset-x-0 ${hitExpand} ` +
        // 선택 칩 채움은 강조색(accent), 눌림은 약간 어둡게 — 갈색(brown)은 글자·제목 전용이라 채움에는 쓰지 않는다
        (selected
          ? 'bg-accent active:bg-accent-press text-white font-semibold'
          : 'bg-white border border-v1-line-3 text-v1-text-secondary font-normal') +
        ' ' + className
      }
      {...(asRadio ? { role: 'radio', 'aria-checked': !!selected } : { 'aria-pressed': !!selected })}
      {...rest}
    >
      {children}
    </button>
  );
}
