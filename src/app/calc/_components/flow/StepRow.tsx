// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 단계 한 칸 부품
//
// 지시서 3-2절 그대로 세 가지 모습만 그린다(옛 StepFlow.tsx의 새 버전 — 옛 것은 바닥재·
// 미장이 아직 쓰고 있어 그대로 두고, 이건 완전히 새 파일이다):
//
//   현재  — 흰 카드(--surface), 테두리 1px --accent, 모서리 16px, 안쪽 여백 16px.
//           첫 줄 = 번호 배지(24px 원) + 제목, 세로 가운데 정렬. 12px 띄우고 입력.
//           입력은 카드 안쪽 전체 폭(번호 자리만큼 들여쓰지 않는다).
//   완료  — 카드 아님. 한 줄, 최소 높이 48px. 체크 배지 · 제목(흐리게) · 값(굵게) ·
//           "바꾸기". 줄 전체가 눌린다. 아래 1px 선.
//   아직 안 옴 — 카드 아님. 한 줄, 최소 높이 48px. 번호 배지(테두리만) + 제목.
//           전체 투명도 45%. 눌리지 않는다.
//
// 움직임(3-4): 열릴 때 4px 아래에서 떠오름+투명도 220ms, 접힐 때 grid-template-rows로
// 높이가 부드럽게 줄고 내용은 120ms 만에 투명해짐, 완료 줄이 나타날 때 투명도 0→1 160ms.
// 흔들림·테두리 깜빡임은 이 판에는 아예 없다(옛 StepFlow의 shake·ring 애니메이션은 손대지 않고
// 그대로 남겨 둔다 — 바닥재·미장 전용).
//
// 초점(3-6): 현재 단계로 막 열리면 그 안의 첫 버튼/칩으로 초점을 옮긴다(숫자·글자 입력칸은
// 제외 — 폰 키보드가 멋대로 뜨는 걸 막기 위해서다).
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { IconCheck } from '@/components/v1/icons';

export interface StepRowProps {
  /** 이 단계의 0-based 순번 */
  index: number;
  /** useFlowSteps가 계산해 준 "지금 열어야 하는" 단계 인덱스 */
  activeIndex: number;
  title: string;
  /** 완료 줄에 보여줄 값 (없으면 값 없이 제목만) */
  summary?: string;
  /** 이 단계가 끝났는지(touched && valid) */
  complete: boolean;
  /** true면(마지막 단계) 완료돼도 접지 않고 계속 펼쳐 둔다 */
  keepOpen?: boolean;
  /** 완료 줄("바꾸기")을 눌렀을 때 — keepOpen 단계에는 안 쓴다 */
  onReopen?: () => void;
  /**
   * 바로 다음 단계가 지금 "카드"(테두리 있는 상자)로 보이고 있으면 true — 이때는 이 완료
   * 줄 밑에 구분선을 안 그린다(카드 자기 테두리가 이미 있어서 선이 두 개로 겹쳐 보인다,
   * 2026-09-27 검수 지적 7번). FlowShell이 이웃 단계 상태를 보고 계산해 넘겨준다.
   */
  hideDivider?: boolean;
  children: ReactNode;
}

// forwardRef: FlowShell이 "이 단계가 지금 화면에 다 보이는지"를 확인해 딱 필요할 때만
// 스크롤시켜야 해서(3-5절), 부르는 쪽이 이 부품의 맨 바깥 div를 직접 참조할 수 있게 한다.
const StepRow = forwardRef<HTMLDivElement, StepRowProps>(function StepRow(
  { index, activeIndex, title, summary, complete, keepOpen = false, onReopen, hideDivider = false, children },
  forwardedRef,
) {
  // 2026-09-27 지시서 4-2절 수리: "바꾸기로 다른 단계를 다시 열어도 이미 끝난 다른 단계는
  // 흐려지지 않는다." 예전엔 index와 activeIndex의 위치만 비교했는데("바꾸기"로 activeIndex가
  // 앞 단계로 강제로 되돌아가면, 그보다 뒤에 있는 이미 끝난 단계까지 전부 "아직 안 옴"으로
  // 보여 버그였다) — 이제 실제 완료 여부(complete = touched && valid)를 그대로 써서 판단한다.
  // keepOpen 단계는 차례가 온 뒤로는(지금 current이거나 이미 끝났으면) 계속 "카드처럼" 펼쳐 둔다.
  const state: 'current' | 'done' | 'upcoming' = keepOpen
    ? index === activeIndex || complete
      ? 'current'
      : 'upcoming'
    : index === activeIndex
      ? 'current'
      : complete
        ? 'done'
        : 'upcoming';

  // 카드처럼(테두리+여백 있는 상자) 그릴지 — 보통 current만, keepOpen 단계는 완료돼도 카드 유지
  const isCardLike = state === 'current';
  // 안쪽 내용을 펼쳐서 보여줄지 — 카드 상태와 동일(완료돼 한 줄로 접힌 done/upcoming은 내용을 숨긴다)
  const isExpanded = isCardLike;
  // keepOpen 단계가 끝난 뒤엔 테두리를 강조색 대신 은은한 선 색으로 바꾼다(지시서 3-2 마지막 문단)
  const borderIsMuted = keepOpen && complete;

  const badgeNum = index + 1;
  // 배지를 체크로 채울지 — 접히는 단계는 done일 때, keepOpen 단계는 complete 값 자체로
  const badgeFilled = keepOpen ? complete : state === 'done';

  // ── 애니메이션: "방금 current로 바뀐 순간"과 "방금 done이 된 순간"만 잡아서 1회만 재생 ──
  const prevStateRef = useRef(state);
  const [justOpened, setJustOpened] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // 바깥(FlowShell)에서 넘겨준 ref에도 같은 DOM 노드를 그대로 연결해 준다
  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLDivElement);

  useEffect(() => {
    const prev = prevStateRef.current;
    if (state === 'current' && prev !== 'current') {
      setJustOpened(true);
      const t = setTimeout(() => setJustOpened(false), 240);
      prevStateRef.current = state;
      return () => clearTimeout(t);
    }
    if (state === 'done' && prev !== 'done') {
      setJustDone(true);
      const t = setTimeout(() => setJustDone(false), 180);
      prevStateRef.current = state;
      return () => clearTimeout(t);
    }
    prevStateRef.current = state;
  }, [state]);

  // 현재 단계로 열리면 그 안의 첫 버튼으로 초점을 옮긴다(입력칸 제외 — 3-6절).
  // 스크롤은 여기서 시키지 않는다(부르는 쪽 FlowShell이 activeIndex 변화만 보고 딱 한 번 처리한다).
  useEffect(() => {
    if (state !== 'current') return;
    const first = contentRef.current?.querySelector<HTMLElement>('button:not([disabled])');
    first?.focus({ preventScroll: true });
  }, [state]);

  return (
    <div
      ref={rootRef}
      // scroll-mt: FlowShell이 scrollIntoView 할 때 고정 헤더에 안 가리도록 여유를 둔다
      className={
        'flex flex-col scroll-mt-[112px] transition-[padding,margin,background-color,border-color] duration-200 ease-out ' +
        (isCardLike
          ? `gap-3 rounded-[16px] border bg-surface p-4 ${justOpened ? 'flow-step-enter' : ''} ` +
            (borderIsMuted ? 'border-line' : 'border-accent')
          : state === 'done'
            ? `min-h-[48px] ${hideDivider ? '' : 'border-b border-line'} ${justDone ? 'flow-done-enter' : ''}`
            : 'min-h-[48px] opacity-45')
      }
    >
      {/* 완료 줄은 줄 전체가 눌린다(바꾸기) — 아직 안 온 단계는 button이 아니라 그냥 div(안 눌림) */}
      {state === 'done' ? (
        <button
          type="button"
          onClick={onReopen}
          className="flex w-full min-h-[48px] items-center gap-3 text-left"
        >
          <span className="flex-none w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center">
            <IconCheck />
          </span>
          <span className="t-sub text-ink-2 flex-none">{title}</span>
          {summary && <span className="t-body font-semibold text-ink truncate min-w-0 flex-1">{summary}</span>}
          <span className="t-sub text-accent flex-none ml-auto">바꾸기</span>
        </button>
      ) : (
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
      )}

      {/* 입력 내용 — grid-template-rows로 높이를 부드럽게 접었다 편다(Collapsible.tsx와 같은 기법).
          카드 안쪽 여백(16px)에 그대로 맞춰야 하므로 번호 자리만큼 들여쓰지 않는다(전체 폭 사용) */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
      >
        <div
          ref={contentRef}
          // 접혀 있을 때(0fr)도 안의 버튼·칩은 DOM에 그대로 남아 있다(다시 펼 때 값을 그대로
          // 보여주려고 마운트 해제를 안 한다) — 그래서 눈에는 안 보여도 Tab 키나 화면 낭독기가
          // 그 안으로 들어갈 수 있는 문제가 있었다. inert 속성으로 접힌 동안은 클릭·포커스·
          // 낭독 전부 막는다(2026-09-27 검사 중 발견해 같이 수리).
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
