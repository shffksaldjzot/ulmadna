// ──────────────────────────────────────────────
// v1 허브 — 세그먼트(2~3칸 탭형 선택) 부품
// 높이 44, 배경 크림, 안쪽 패딩 4, 선택 칸만 흰 배경, 탭 글자 15px.
// 이 부품도 계산기 3종 화면 안에서만 쓰인다.
// 2026-09-16 형아 피드백: 모바일에서 너무 커 보여 높이 52→44, 글자 16→15로 줄였다.
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 3-10절: 계산기 제목 줄(고정) 오른쪽에 붙는
// 작은 [간단|정확] 전환은 몸통의 44px 세그먼트보다 더 작아야 한다(3-7절 표: 제목 줄 모드
// 전환은 "보이는 높이 32px / 눌리는 높이 44px"). size="sm"을 추가했다 — 기본값은 그대로
// 'md'(44/44, 손대지 않음)라 기존 화면(도배 본문 세그먼트 등)은 전혀 안 바뀐다.
//
// 2026-09-29 지시서 3-6절 다듬기 — 방향키 이동 추가. "세그먼트(role=tablist)만은
// 관례대로 옮기면 바로 고르는 방식이어도 되는데, 그러면 계산이 연달아 불리니 옮긴 뒤
// Enter·Space로 고르는 쪽으로 통일한다"는 지시대로, 방향키는 초점만 옮기고(값은 안
// 바뀜) Enter·Space를 눌러야 실제로 골라진다 — 이 부품이 감싸는 공용 틀(ChipGroup)이
// 그 규칙을 갖고 있어 그대로 가져다 쓴다. ariaLabel을 새로 받는다(스크린리더가 이
// 세그먼트 묶음을 뭐라고 소개할지 — 안 주면 빈 문자열로, 화면 모습은 안 바뀐다).
// ──────────────────────────────────────────────

'use client';

import ChipGroup from './ChipGroup';

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentProps<T extends string> {
  options: SegmentOption<T>[];
  /** 고른 값. undefined를 주면 아무 탭도 활성화하지 않는다(예: 벽지 종류 미선택 상태) */
  value: T | undefined;
  onChange: (v: T) => void;
  className?: string;
  /** 'md'(기본, 44px — 몸통용) / 'sm'(32px 보이되 44px까지 눌림 — 제목 줄 전용) */
  size?: 'md' | 'sm';
  /** 스크린리더용 묶음 이름(예: "계산 모드"). 안 주면 빈 문자열 — 모습에는 영향 없다 */
  ariaLabel?: string;
}

export default function Segment<T extends string>({
  options,
  value,
  onChange,
  className = '',
  size = 'md',
  ariaLabel = '',
}: SegmentProps<T>) {
  const isSm = size === 'sm';
  return (
    <ChipGroup
      role="tablist"
      ariaLabel={ariaLabel}
      className={`flex box-border rounded-[4px] border border-v1-line bg-cream p-1 ${isSm ? 'h-8' : 'h-11'} ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={
              // sm일 때만 relative + ::before로 위아래 6px씩 눌리는 범위를 44px까지 넓힌다(3-7절).
              // 보이는 크기(글자·패딩)는 md와 똑같이 유지 — 넓히는 건 클릭 가능 영역뿐이다.
              'flex-1 relative flex items-center justify-center rounded-[4px] transition-colors duration-150 ' +
              (isSm
                ? "text-[13px] before:absolute before:content-[''] before:inset-x-0 before:-top-[6px] before:-bottom-[6px] "
                : 'text-[15px] ') +
              (active ? 'bg-white text-brown font-semibold' : 'text-v1-text-secondary font-normal')
            }
          >
            {opt.label}
          </button>
        );
      })}
    </ChipGroup>
  );
}
