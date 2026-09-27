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
// 2026-09-27 지휘관 촬영본 지적(배포 전) — "숫자 칸 안에 주황 네모가 하나 더 그려진다":
// 예전엔 "어떤 키든 누르면 키보드 조작"으로 봐서, 숫자 칸에 글자를 치는 것(키보드로
// 숫자를 눌러 입력)까지 "키보드 조작"으로 기록해 버렸다. 그러면 그 칸 자신도
// globals.css의 .flowFocusScope 키보드 테두리 규칙 대상이 돼, 칸을 감싸는 틀의 테두리
// (기존 초점 표시)에 더해 칸 안쪽에 강조색 네모가 하나 더 그려지는 사고가 났다(폰에서도
// 화면 자판으로 글자를 치는 순간 똑같이 생긴다 — 손가락 입력이라고 안심할 수 없었다).
// 고침: "키보드 조작"으로 볼 키를 이동·실행 키(Tab·Shift+Tab·방향키·Enter·Space·Escape)
// 로만 좁히고, 그중에서도 글자 입력 칸(input·textarea·select) 안에 초점이 있을 때는
// Enter·방향키·Space도 "칸 안 조작"(커서 이동·값 확정·글자 입력)으로 보아 제외한다.
// Tab·Escape는 칸 안에서 눌러도 그대로 인정한다 — 초점이 칸 밖으로 옮겨 가는 진짜
// 키보드 이동이므로, 다음에 초점 받는 요소는 정상적으로 테두리를 보여줘야 한다.
// ──────────────────────────────────────────────

let attached = false;

/** "키보드로 조작했다"고 볼 이동·실행 키 전체 — 이 목록에 없는 키(문자·숫자·백스페이스
 *  등 실제로 "치는" 키)는 어디서 눌러도 절대 입력 방식을 안 바꾼다 */
const NAV_ACTION_KEYS = new Set(['Tab', 'Enter', ' ', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
/** 글자 입력 칸(input·textarea·select) 안에서는 "칸 안 조작"이라 이동 키 취급을 안 하는 것들
 *  (커서 이동용 방향키·값 확정용 Enter·글자로서의 스페이스) — Tab·Escape는 여기 없다 */
const IN_BOX_ONLY_KEYS = new Set(['Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** 지금 이 요소가 글자를 직접 치는 칸인지(input·textarea·select) */
function isTextEntryElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

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

  // 이동·실행 키(Tab·Shift+Tab·방향키·Enter·Space·Escape)만 "지금은 키보드로 조작 중"으로
  // 본다. 문자를 치는 키(숫자·글자·백스페이스 등)는 NAV_ACTION_KEYS에 아예 없으니 여기서
  // 걸러진다. 그중에서도 글자 입력 칸(input·textarea·select) 안에 초점이 있을 때는
  // Enter·방향키·Space를 "칸 안 조작"으로 보아 제외한다(IN_BOX_ONLY_KEYS) — Tab·Escape는
  // 칸 안에서 눌러도 초점이 칸 밖으로 옮겨 가는 진짜 이동이라 그대로 인정한다.
  // capture: true로 붙여서, 이벤트를 누가 가로채 stopPropagation을 부르더라도 놓치지 않는다.
  document.addEventListener(
    'keydown',
    (e) => {
      if (!NAV_ACTION_KEYS.has(e.key)) return;
      if (isTextEntryElement(e.target) && IN_BOX_ONLY_KEYS.has(e.key)) return;
      setModality('keyboard');
    },
    { capture: true },
  );
  // 손가락·마우스로 누르면 그 즉시 "포인터로 조작 중"으로 되돌린다 — 뒤이어 스크립트가
  // .focus()를 불러도(단계 전환 자동 초점 등) 이 값 그대로 유지된다.
  document.addEventListener('pointerdown', () => setModality('pointer'), { capture: true });
  document.addEventListener('touchstart', () => setModality('pointer'), { capture: true });
}
