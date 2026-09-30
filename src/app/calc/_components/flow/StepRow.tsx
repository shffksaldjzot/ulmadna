// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 단계 한 칸 부품
//
// 2026-09-27 형아 결정(라이브 써 보고 확정) — "단계는 순서대로 나타나되, 한 번 나타난
// 단계는 접지 않고 계속 펼쳐 둔다. '바꾸기'를 누르지 않고 바로 고칠 수 있게." 지시서
// 3-2·4-2·4-3의 "완료 = 한 줄로 접힘"을 이 결정으로 완전히 바꾼다.
//
// 이제 단계는 딱 세 가지 모습만 있다(옛 "완료 = 한 줄 접힘" 모습은 없다):
//
//   지금 할 단계(맨 앞의 미완료 단계) — 흰 카드(--surface), 테두리 1px --accent,
//     모서리 16px, 안쪽 여백 16px. 첫 줄 = 번호 배지(24px 원, 테두리만) + 제목.
//   끝낸 단계 — 지금 할 단계와 "완전히 같은 자리·여백·크기"(테두리 굵기까지 똑같이
//     1px을 유지)로 펼친 채 유지한다. 다른 건 테두리색·배경색뿐 — 둘 다 투명으로 바꿔서
//     카드처럼 안 보이게 한다. 배지는 체크(accent 채움). 입력 내용은 그대로 보이고
//     바로 고칠 수 있다(inert 없음). 상태가 바뀔 때 내용이 1px도 안 움직인다.
//   아직 안 온 단계 — 카드 아님. 한 줄, 최소 높이 48px. 번호 배지(테두리만) + 제목.
//     전체 투명도 45%. 조작 불가(inert).
//
// "바꾸기" 글자와 완료 요약 한 줄(옛 "체크배지·흐린제목·굵은값·바꾸기" 한 줄)은 삭제했다.
//
// 움직임:
//   - 단계가 처음 나타날 때(아직 안 옴 → 지금 할 단계로 딱 한 번): 4px 아래에서 떠오름 +
//     투명도 + 높이 펼침 220ms(flow-step-enter, 옛 그대로).
//   - 지금 할 단계 → 끝낸 단계: 테두리·배경 색만 160ms로 바뀐다. 높이·위치는 안 바뀐다
//     (자리·여백·테두리 굵기가 두 상태에서 완전히 같으므로 색 전환 CSS transition만
//     걸면 된다 — 옛날처럼 접히는 높이 애니메이션(flow-done-enter)은 이제 없다).
//   - prefers-reduced-motion이면 전부 즉시(모션 없음).
//
// 초점(3-6): 단계가 처음 "지금 할 단계"로 나타나면 그 안의 첫 버튼/칩으로 초점을 옮긴다
// (숫자·글자 입력칸은 제외 — 폰 키보드가 멋대로 뜨는 걸 막기 위해서다). 끝낸 단계로
// 바뀔 때는 초점을 옮기지 않는다(사용자가 지금 만지고 있던 곳 그대로 둔다).
//
// 접근성: 끝낸 단계는 inert를 걸지 않는다(조작 가능해야 하므로) — 아직 안 온 단계만
// 조작 불가로 막는다. 탭 순서는 화면에 보이는 순서(DOM 순서) 그대로다.
//
// 2026-09-27 지휘관 지적(구분선 "웃는 입" 모양) 수리 — 끝낸 단계의 아래 테두리만 색을
// 넣었더니, 카드의 둥근 모서리(16px)를 따라 그 색이 곡선으로 휘어 올라갔다(제품 시트
// 구분선에서 이미 고쳤던 것과 같은 문제). 고침: 끝낸 단계도 테두리는 네 변 모두 완전히
// 투명으로 두고, 구분선은 카드 밖에 절대 위치로 따로 그리는 곧은 1px 줄로 바꿨다 —
// 단계 사이 간격(8px)의 한가운데(-4px 자리)에 놓아서 카드 자리·간격에 전혀 영향이 없다.
//
// 작성일: 2026년 09월 27일
// 끝낸 단계를 접지 않는 새 규칙으로 전면 재작성: 2026년 09월 27일
// 구분선을 절대 위치 곧은 줄로 교체(둥근 모서리 곡선 문제 수리): 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { IconCheck } from '@/components/v1/icons';

// ──────────────────────────────────────────────
// 2026-09-30 지휘관 긴급 전달(치명 1) — 자동 초점 이동이 칸에 타이핑하는 도중 글자를
// 삼켰다. 재현: 미장 간단 면적 칸에 "30"을 치면 "3"만 들어가고 초점이 다음 단계(두께
// 칩)로 넘어갔다 — 숫자 하나만 쳐도 그 값이 이미 "유효한 값"이라 그 단계가 즉시
// 완료되고(activeIndex가 다음 칸으로 넘어감), 다음 단계가 "아직 안 옴 → 지금 할 단계"로
// 바뀌면서 옛 규칙(무조건 자동 초점)이 그 단계의 첫 버튼으로 초점을 억지로 옮겼다.
//
// 고침(전부 지켜야 한다):
//   1) 마지막 입력 방식이 키보드일 때만 자동 초점을 옮긴다(터치·마우스 사용자는 안 옮김).
//   2) 지금 초점이 글자 입력 칸(input·textarea·select·contenteditable) 안에 있으면
//      절대 안 옮긴다 — 어느 단계로 전환되는 중이든 무조건 막는다(핵심 수리).
//   3) 단계가 "처음" 나타날 때(아직 안 옴 → 지금 할 단계)만 옮긴다. 끝낸 단계의 값을
//      지워서 다시 "지금 할 단계"가 된 경우(재등장)는 옮기지 않는다.
// 화면 없이 시험할 수 있게 순수 함수로 뺐다(__tests__/StepRow.autoFocus.test.ts).
// ──────────────────────────────────────────────

/** 마지막으로 기록된 입력 방식 — focusModality.ts가 <html data-focus-modality>에 적어 둔 값 */
export type FocusModality = 'keyboard' | 'pointer' | undefined;
/** 이 단계가 "지금 할 단계"로 바뀐 게 처음 나타난 것인지, 한 번 나타났다가 다시 돌아온 것인지 */
export type StepAppearance = 'first-appearance' | 'reappeared';

/**
 * 단계가 "지금 할 단계"로 바뀌었을 때 그 안의 첫 버튼으로 초점을 자동으로 옮겨도
 * 되는지 판단하는 순수 함수(화면·DOM 없이 시험 가능). 셋 다 만족해야 옮긴다.
 */
export function shouldAutoFocusStep(params: {
  modality: FocusModality;
  focusIsInTextEntry: boolean;
  appearance: StepAppearance;
}): boolean {
  if (params.modality !== 'keyboard') return false;
  if (params.focusIsInTextEntry) return false;
  if (params.appearance !== 'first-appearance') return false;
  return true;
}

/**
 * 지금 문서의 초점이 글자를 직접 치는 칸(input·textarea·select·contenteditable) 안인지.
 * `instanceof HTMLElement`가 아니라 태그 이름·속성만 본다(모양만 맞으면 통과) — 이러면
 * 이 함수를 진짜 DOM 없이(vitest, jsdom 없이) 순수 함수로 시험할 수 있다.
 */
export function isFocusInTextEntry(active: { tagName?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!active) return false;
  const tag = active.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!active.isContentEditable;
}

export interface StepRowProps {
  /** 이 단계의 0-based 순번 */
  index: number;
  /** useFlowSteps가 계산해 준 "지금 할 단계" 인덱스 */
  activeIndex: number;
  title: string;
  /** 이 단계가 끝났는지(touched && valid) — true면 activeIndex 위치와 상관없이 "끝낸 단계"로 펼쳐 보여준다 */
  complete: boolean;
  /**
   * 바로 다음 단계가 지금 "지금 할 단계"(카드)로 보이고 있으면 true — 이때는 이 단계
   * 바로 아래에 구분선을 안 그린다(카드 자기 테두리가 이미 있어서 선이 겹쳐 보인다).
   * FlowShell이 이웃 단계 상태를 보고 계산해 넘겨준다.
   */
  hideDivider?: boolean;
  children: ReactNode;
}

// forwardRef: FlowShell이 "이 단계가 지금 화면에 다 보이는지"를 확인해 딱 필요할 때만
// 스크롤시켜야 해서(3-5절), 부르는 쪽이 이 부품의 맨 바깥 div를 직접 참조할 수 있게 한다.
const StepRow = forwardRef<HTMLDivElement, StepRowProps>(function StepRow(
  { index, activeIndex, title, complete, hideDivider = false, children },
  forwardedRef,
) {
  // 세 가지 모습 중 하나 — activeIndex와의 "위치" 비교보다 "완료 여부"를 먼저 본다.
  // 완료된 단계는(뒤에 있어도, 앞선 단계가 되돌아가 activeIndex가 이 단계보다 작아져도)
  // 계속 "끝낸 단계"로 펼쳐 보인다(형아 결정 — 매인 관계로 앞 단계가 미완료가 돼도
  // 이 단계 자신이 완료 상태면 그대로 보인다).
  const state: 'current' | 'done' | 'upcoming' = complete ? 'done' : index === activeIndex ? 'current' : 'upcoming';

  // "지금 할 단계"와 "끝낸 단계"는 같은 카드 자리(테두리 굵기·둥근 모서리·안쪽 여백)를 쓴다
  // — 색만 다르다(테두리·배경 전부 투명 vs accent/surface). 이래야 상태가 바뀔 때 내용이
  // 1px도 안 움직인다(형아 지시 그대로).
  const isCardLike = state === 'current' || state === 'done';
  const isExpanded = isCardLike;

  const badgeNum = index + 1;
  const badgeFilled = state === 'done';

  // ── 애니메이션: "방금 current로 처음 나타난 순간"만 잡아서 1회만 재생한다 ──
  // (끝낸 단계로 바뀌는 건 색만 CSS transition으로 바뀌므로 별도 JS 애니메이션 상태가 필요 없다)
  const prevStateRef = useRef(state);
  const [justOpened, setJustOpened] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // 바깥(FlowShell)에서 넘겨준 ref에도 같은 DOM 노드를 그대로 연결해 준다
  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLDivElement);

  useEffect(() => {
    const prev = prevStateRef.current;
    // upcoming(아직 안 옴)이었다가 처음으로 펼쳐지는 순간(current 또는 done)에만 떠오름 애니메이션
    if (prev === 'upcoming' && state !== 'upcoming') {
      setJustOpened(true);
      const t = setTimeout(() => setJustOpened(false), 240);
      prevStateRef.current = state;
      return () => clearTimeout(t);
    }
    prevStateRef.current = state;
  }, [state]);

  // 이 단계가 "지금 할 단계" 또는 "끝낸 단계"로 한 번이라도 나타난 적 있는지 — 처음
  // 나타남과 다시 돌아옴(값 지움 등)을 구분하는 데 쓴다(2026-09-30 치명 1 수리 요구사항 3)
  const everAppearedRef = useRef(false);

  // 지금 할 단계로 막 바뀌면 그 안의 첫 버튼으로 초점을 옮긴다(입력칸 제외 — 3-6절).
  // 끝낸 단계로 바뀔 때는 초점을 안 옮긴다(사용자가 지금 만지던 곳 그대로 둔다).
  // 스크롤은 여기서 시키지 않는다(부르는 쪽 FlowShell이 처리한다).
  //
  // 2026-09-30 치명 1 수리: 아래 세 조건을 shouldAutoFocusStep(순수 함수)로 전부 확인한
  // 뒤에만 옮긴다 — 특히 "지금 초점이 글자 입력 칸 안"이면(다른 단계의 숫자 칸에 한창
  // 타이핑 중이어도) 무조건 안 옮긴다. 이게 핵심이다 — 어느 단계가 지금 할 단계로
  // 바뀌든, 사용자가 어딘가에 타이핑 중이면 그 타이핑을 절대 방해하지 않는다.
  useEffect(() => {
    const appearance: StepAppearance = everAppearedRef.current ? 'reappeared' : 'first-appearance';
    if (state === 'current' || state === 'done') {
      everAppearedRef.current = true;
    }
    if (state !== 'current') return;
    if (typeof document === 'undefined') return;

    const modality = document.documentElement.dataset.focusModality as FocusModality;
    const focusIsInTextEntry = isFocusInTextEntry(document.activeElement);
    if (!shouldAutoFocusStep({ modality, focusIsInTextEntry, appearance })) return;

    const first = contentRef.current?.querySelector<HTMLElement>('button:not([disabled])');
    first?.focus({ preventScroll: true });
  }, [state]);

  return (
    <div
      ref={rootRef}
      // scroll-mt: FlowShell이 scrollIntoView 할 때 고정 헤더에 안 가리도록 여유를 둔다.
      // transition은 테두리·배경 색만 160ms로 건다(형아 지시 — 높이·위치는 안 바뀐다).
      // relative: 아래 구분선(절대 위치 요소)의 기준점이 된다.
      className={
        'relative flex flex-col scroll-mt-[112px] transition-[background-color,border-color] duration-[160ms] ease-out motion-reduce:transition-none ' +
        (isCardLike
          ? `gap-3 rounded-[16px] border p-4 ${justOpened ? 'flow-step-enter' : ''}`
          : 'min-h-[48px] opacity-45')
      }
      style={
        isCardLike
          ? {
              // 테두리·배경은 인라인 스타일로 직접 색만 바꾼다(Tailwind 유틸 조합의 우선순위
              // 문제를 피하려고). 카드(지금 할 단계)와 끝낸 단계는 굵기·모서리가 완전히
              // 같고 색만 다르다 — 그래서 내용이 1px도 안 움직인다. 끝낸 단계는 네 변 모두
              // 투명(2026-09-27 지휘관 지적 — 예전엔 테두리 하나만 색을 넣었는데, 둥근
              // 모서리(16px)와 만나면 그 색이 모서리 곡선을 따라 휘어 올라가 "웃는 입"
              // 모양이 됐다. 구분선은 이제 아래 별도의 곧은 선 요소로 그린다).
              borderColor: state === 'current' ? 'var(--accent)' : 'transparent',
              backgroundColor: state === 'current' ? 'var(--surface)' : 'transparent',
            }
          : undefined
      }
    >
      {/* 끝낸 단계 사이 구분선 — 카드(둥근 모서리) 테두리가 아니라 곧은 1px 줄을 절대 위치로
          따로 그린다(위 borderColor 설명 참고). 카드 자신의 높이·자리에는 전혀 영향을 안
          준다(간격 8px의 한가운데인 -4px 자리에 놓아서, 구분선이 있든 없든 단계 사이
          간격·각 단계 위치가 완전히 같다). 좌우는 카드 안쪽 여백(16px)에 맞춘다. 지금 할
          단계 바로 위·아래, 마지막 단계 아래는 hideDivider로 걸러 준다(FlowShell 계산). */}
      {state === 'done' && !hideDivider && (
        <div aria-hidden className="absolute -bottom-1 left-4 right-4 h-px" style={{ backgroundColor: 'var(--line)' }} />
      )}
      {/* 첫 줄 — 번호 배지(또는 체크) + 제목. 세 모습 다 이 한 줄 구조를 쓴다 */}
      <div className={'flex items-center gap-3 ' + (state === 'upcoming' ? 'min-h-[48px]' : '')}>
        <span
          className={
            'flex-none w-6 h-6 rounded-full border flex items-center justify-center text-[13px] font-semibold ' +
            (badgeFilled
              ? 'bg-accent border-accent text-white'
              : state === 'current'
                ? 'border-accent text-accent'
                : 'border-line text-ink-2')
          }
        >
          {badgeFilled ? <IconCheck /> : badgeNum}
        </span>
        <span className="t-section text-ink">{title}</span>
      </div>

      {/* 입력 내용 — "아직 안 온 단계"만 grid-template-rows로 접어서(0fr) 숨긴다. 지금 할
          단계·끝낸 단계는 둘 다 항상 펼쳐진 채(1fr)다(형아 결정 — 끝낸 단계도 안 접는다).
          카드 안쪽 여백(16px)에 그대로 맞춰야 하므로 번호 자리만큼 들여쓰지 않는다(전체 폭 사용) */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
      >
        <div
          ref={contentRef}
          // "아직 안 온 단계"만 DOM에 남아 있되 조작·포커스·낭독을 막는다(inert). 끝낸
          // 단계는 조작 가능해야 하므로 inert를 걸지 않는다(형아 지시 — 접근성 절).
          {...(!isExpanded ? { inert: true } : {})}
          aria-hidden={!isExpanded}
          className={
            'overflow-hidden flex flex-col gap-3 transition-opacity duration-[120ms] motion-reduce:transition-none ' +
            (isExpanded ? 'opacity-100' : 'opacity-0')
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
});

export default StepRow;
