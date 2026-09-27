// ──────────────────────────────────────────────
// v1 허브 — 새 틀(flow/*) 전용: 마지막 입력이 키보드였는지 손가락·마우스였는지 기억한다
//
// 왜 필요한가:
//   StepRow가 단계가 넘어갈 때 그 안의 첫 버튼으로 초점(focus)을 코드로 직접 옮겨 준다
//   (StepRow.tsx의 useEffect). 이 초점 이동은 "스크립트가 나중에 부르는 것"이라 브라우저의
//   기본 :focus-visible 판정이 실제로 손가락·마우스로 눌러서 단계가 넘어갔을 때조차
//   "키보드로 조작한 것"처럼 오판해 버려서, 눌러서 다음 단계로 넘어갔을 뿐인데 다음 버튼에
//   굵은 초점 테두리가 남는 사고가 있었다(2026-09-27 배포 전 재검수 추가 지적 5번).
//   브라우저 판정에 기대는 대신, 우리가 직접 "마지막으로 어떤 방식으로 눌렀는지"를
//   <html> 태그에 적어 두고, globals.css의 .flowFocusScope 규칙이 그 값만 보고 테두리를
//   켜고 끈다.
//
// 사용법: 새 틀이 처음 그려질 때(FlowShell 마운트 시) ensureFocusModalityTracking()을
// 한 번 부르면(여러 번 불러도 안전 — 내부에서 중복 등록을 막는다) 문서 전체에
// keydown / pointerdown / touchstart 리스너가 붙는다.
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

let attached = false;

/**
 * 문서 전체에 딱 한 번만 리스너를 붙인다. 여러 계산기 화면(도배 등)을 오가며 FlowShell이
 * 여러 번 마운트돼도 두 번째부터는 아무 일도 하지 않는다(attached 플래그로 방지).
 * SSR 중에는(document가 없음) 아무 일도 하지 않는다 — 클라이언트에서 useEffect로만 부른다.
 */
export function ensureFocusModalityTracking(): void {
  if (attached || typeof document === 'undefined') return;
  attached = true;

  const setModality = (v: 'keyboard' | 'pointer') => {
    document.documentElement.dataset.focusModality = v;
  };

  // Tab·화살표·Enter 등 어떤 키든 누르면 "지금은 키보드로 조작 중"으로 본다.
  // capture: true로 붙여서, 이벤트를 누가 가로채 stopPropagation을 부르더라도 놓치지 않는다.
  document.addEventListener('keydown', () => setModality('keyboard'), { capture: true });
  // 손가락·마우스로 누르면 그 즉시 "포인터로 조작 중"으로 되돌린다 — 뒤이어 스크립트가
  // .focus()를 불러도(단계 전환 자동 초점 등) 이 값 그대로 유지된다.
  document.addEventListener('pointerdown', () => setModality('pointer'), { capture: true });
  document.addEventListener('touchstart', () => setModality('pointer'), { capture: true });
}
