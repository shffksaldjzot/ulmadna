// ──────────────────────────────────────────────
// v1 허브 — 계산기 결과 카드 "처음 다 나왔을 때" 부드럽게 보여주기 (계산기 4종 공용)
//
// 왜: 마지막 단계를 고른 뒤 결과 카드가 화면 아래(하단 바 뒤)에 생겨서 안 보였다
//     (2026-10-28 점검 2절 — 미장 m_mo_end.png). 마지막 단계까지 끝나고 결과가 보이는
//     순간 딱 한 번만 결과 카드 위치로 부드럽게 옮긴다.
//
// 규칙:
//   · 한 번만 — 그 뒤로 값을 바꿔 결과가 다시 계산돼도 움직이지 않는다
//   · 처음 화면에 들어올 때 이미 다 끝나 있으면(새로 고침 복원·공유 링크) 움직이지 않는다
//   · 사용자가 이미 결과 근처(또는 더 아래)를 보고 있으면 움직이지 않는다
//   · 숫자 칸에 글자를 치는 중이면 그 자리에서 움직이지 않고, 칸을 벗어날 때 다시 판단한다
//     (치는 도중 화면이 움직이면 안 된다 — 2026-09-30 "치는 도중 초점 뺏김" 사고 교훈)
//   · PC(1024px 이상)는 결과가 오른쪽에 붙어 있어 움직이지 않는다
//   · 중간 단계에서 결과가 먼저 떠도(타일·미장) 다음 단계로의 이동(FlowShell)과 싸우지
//     않도록, "모든 단계 완료 + 결과 보임" 둘 다일 때만 움직인다
//
// 작성일: 2026년 10월 29일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef, type RefObject } from 'react';

/** 모바일 고정 머리(사이트 헤더 56 + 제목 줄 44) + 여백 12 — FlowShell·StepRow와 같은 값 */
const HEADER_OFFSET = 112;
/** 모바일 하단 고정 바 높이(BottomBar h-14) */
const BOTTOM_BAR = 56;

/** 지금 초점이 글자 입력 칸 안에 있는지(치는 중인지) */
function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

/**
 * 결과 카드를 처음 다 보여줄 때 한 번 부드럽게 스크롤한다.
 * @param ref          결과 카드(오른쪽 패널) 묶음 요소
 * @param allDone      모든 단계가 끝났는지(useFlowSteps)
 * @param resultShown  금액 결과가 화면에 있는지(면적 고르기 전 한 줄 안내가 아니라 진짜 금액)
 */
export function useResultReveal(ref: RefObject<HTMLElement | null>, allDone: boolean, resultShown: boolean): void {
  const ready = allDone && resultShown;
  // 처음 그릴 때 이미 단계가 다 끝나 있으면(새로 고침 복원·공유 링크) "이미 보여줬다"로 치고
  // 시작한다 — 결과는 서버 계산이 끝난 뒤 늦게 오므로 ready가 아니라 allDone으로 본다
  const doneRef = useRef(allDone);

  useEffect(() => {
    if (!ready || doneRef.current) return;
    if (typeof window === 'undefined') return;

    /** 실제로 판단하고 움직이는 함수 — 바로 또는 입력 칸을 벗어날 때 부른다 */
    const reveal = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      // PC는 결과가 오른쪽 고정 패널이라 움직일 필요가 없다
      if (window.matchMedia?.('(min-width: 1024px)').matches) return;
      const node = ref.current;
      if (!node) return;
      const top = node.getBoundingClientRect().top;
      // 이미 결과 카드 윗부분이 머리 아래~하단 바 위 사이에 보이면(사용자가 이미 보고 있음) 그대로
      const visibleEnough = top >= HEADER_OFFSET - 8 && top <= window.innerHeight - BOTTOM_BAR - 120;
      // 이미 결과보다 더 아래를 보고 있으면(카드 윗부분이 머리 위로 지나감) 그대로
      const alreadyPast = top < HEADER_OFFSET - 8;
      if (visibleEnough || alreadyPast) return;
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: window.scrollY + top - HEADER_OFFSET, behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    if (!isTyping()) {
      // 결과 카드가 그려진 다음 틀(프레임)에 위치를 재야 정확하다
      const raf = requestAnimationFrame(reveal);
      return () => cancelAnimationFrame(raf);
    }

    // 치는 중 — 칸을 벗어날 때(엔터·바깥 누름·자판 닫기) 한 번 판단한다
    const onFocusOut = () => {
      // 초점이 다른 입력 칸으로 옮겨 갔으면 아직 치는 중이라 기다린다
      setTimeout(() => {
        if (isTyping()) return;
        document.removeEventListener('focusout', onFocusOut);
        reveal();
      }, 0);
    };
    document.addEventListener('focusout', onFocusOut);
    return () => document.removeEventListener('focusout', onFocusOut);
  }, [ready, ref]);
}
