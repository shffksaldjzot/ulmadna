// ──────────────────────────────────────────────
// v1 허브 — 계산기 3종 공용 "단계" 구획 부품
//
// 이 부품이 하는 일: 번호 배지(①②③) + 제목 + 상태(현재/완료/아직)만 그린다. 실제 입력
// 내용(칩·드롭다운 등)은 전부 children으로 받아서 그대로 넣는다 — 새 입력 부품을 만드는
// 게 아니라 기존 컴포넌트를 이 틀 안에 재배치하는 용도다.
//
// 상태 3종(형아 지시 그대로):
//   current  — 지금 골라야 하는 단계. 완전히 펼쳐지고, 열리는 순간 강조 애니메이션이
//              한 번 재생된다(globals.css의 .step-flow-enter — 살짝 떠오름 + 테두리
//              은은한 깜빡임 + 안의 첫 선택지가 짧게 흔들림, prefers-reduced-motion이면
//              흔들림 없이 테두리만).
//   done     — 이미 끝난 단계. 골라 둔 값 한 줄(summary)만 접혀 보이고, 탭하면(reopen)
//              다시 열린다.
//   upcoming — 아직 차례가 안 온 단계. 제목만 흐리게, 내용은 아예 숨긴다(탭 불가).
//
// keepOpen(각 흐름의 마지막 단계 전용): 도달한 뒤로는 접히지 않고 계속 펼쳐 둔다 —
//   평형·두께처럼 값을 계속 조정하면서 결과가 바로바로 바뀌는 단계라, 한 줄로 접어버리면
//   오히려 쓰기 불편해진다(옆/아래 결과 패널이 이미 "결과 카드"를 따로 보여준다).
//   이 경우 배지만 완료 여부(complete)에 따라 숫자 ↔ 체크로 바뀌고, 내용은 그대로 열려 있다.
//
// 작성일: 2026년 09월 16일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconCheck } from '@/components/v1/icons';

export interface StepFlowProps {
  /** 이 단계의 0-based 순번 (배지에는 +1로 보여준다) */
  index: number;
  /** useStepFlow가 계산해 준 "지금 열어야 하는" 단계 인덱스 */
  activeIndex: number;
  /** 구획 제목 (예: "벽지 종류") */
  title: string;
  /** 현재 단계일 때만 보여주는 안내 한 줄 (예: "벽지를 고르세요") */
  caption?: string;
  /** 완료 단계로 접혔을 때 보여주는 선택값 한 줄 (예: "합지 · GNI 개나리 스토리") */
  summary?: string;
  /** 이 단계가 끝났는지 — keepOpen 단계의 배지(숫자 ↔ 체크) 표시에 쓴다 */
  complete: boolean;
  /**
   * true면(각 계산기 흐름의 마지막 단계) 도달한 뒤로 접히지 않고 계속 펼쳐 둔다.
   * 기본 false(도중 단계 — 완료되면 한 줄로 접힌다).
   */
  keepOpen?: boolean;
  /** 완료된 단계 행("바꾸기")을 다시 열 때 부른다. keepOpen 단계에는 안 쓴다 */
  onReopen?: () => void;
  children: ReactNode;
}

export default function StepFlow({
  index,
  activeIndex,
  title,
  caption,
  summary,
  complete,
  keepOpen = false,
  onReopen,
  children,
}: StepFlowProps) {
  const reached = index <= activeIndex;
  // keepOpen 단계는 "차례가 온 뒤로는 계속 현재 상태"로 취급한다(접지 않는다)
  const state: 'current' | 'done' | 'upcoming' = keepOpen
    ? reached
      ? 'current'
      : 'upcoming'
    : index === activeIndex
      ? 'current'
      : index < activeIndex
        ? 'done'
        : 'upcoming';

  const isCurrent = state === 'current';

  // 이 단계가 방금 "현재"로 바뀐 순간(다른 상태 → current)에만 강조 애니메이션을 튼다.
  // 계속 current로 남아 있는 keepOpen 단계는 최초 1번만 재생되고, 그 뒤로는 조용하다.
  const wasCurrentRef = useRef(false);
  const [justOpened, setJustOpened] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCurrent && !wasCurrentRef.current) {
      setJustOpened(true);
      // 다음 단계가 지금 화면 밖에 있으면 그때만 최소한으로 스크롤해서 보여준다.
      // prefers-reduced-motion이면 즉시 이동(부드러운 스크롤 애니메이션 생략).
      const reduceMotion =
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      rootRef.current?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      const t = setTimeout(() => setJustOpened(false), 1000);
      wasCurrentRef.current = true;
      return () => clearTimeout(t);
    }
    wasCurrentRef.current = isCurrent;
  }, [isCurrent]);

  const badgeNum = index + 1;
  // 배지를 "완료"로 채워 보여줄지 — 접히는 단계는 state==='done'일 때, keepOpen 단계는
  // 계속 열려 있으니 complete 값 자체로 판단한다
  const badgeFilled = keepOpen ? complete : state === 'done';

  return (
    <div
      ref={rootRef}
      className={
        'flex flex-col gap-3 rounded-lg border ' +
        (justOpened ? 'step-flow-enter border-transparent' : 'border-transparent')
      }
    >
      {/* 번호 배지 + 제목. 완료 단계만 탭해서 다시 열 수 있다(아직 안 온 단계는 탭 불가) */}
      <button
        type="button"
        disabled={!(state === 'done' && onReopen)}
        onClick={state === 'done' ? onReopen : undefined}
        className={'flex items-center gap-3 text-left ' + (state === 'upcoming' ? 'opacity-40' : '')}
      >
        <span
          className={
            'flex-none w-6 h-6 rounded-full border flex items-center justify-center text-[13px] font-semibold ' +
            (badgeFilled
              ? 'bg-accent border-accent text-white'
              : isCurrent
                ? 'border-accent text-accent'
                : 'border-v1-line-3 text-v1-text-disabled')
          }
        >
          {badgeFilled ? <IconCheck /> : badgeNum}
        </span>
        <span className="text-[17px] font-bold text-foreground">{title}</span>
        {state === 'done' && <span className="ml-auto text-[13px] font-semibold text-brown">바꾸기</span>}
      </button>

      {/* 현재 단계 안내 한 줄 */}
      {isCurrent && caption && <p className="text-[13px] text-v1-text-secondary pl-9 -mt-1">{caption}</p>}
      {/* 완료 단계 접힌 요약 한 줄 */}
      {state === 'done' && summary && <p className="text-[15px] text-foreground pl-9 -mt-1">{summary}</p>}

      {/* 실제 입력 내용 — 현재 단계일 때만 그린다 */}
      {isCurrent && (
        <div className="pl-9 flex flex-col gap-3 step-flow-content">{children}</div>
      )}
    </div>
  );
}
