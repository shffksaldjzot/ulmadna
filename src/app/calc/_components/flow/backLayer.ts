// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 뒤로 가기 스택
//
// 지시서 4-3절 규칙:
//   - 단계가 앞으로 나아갈 때마다 방문 기록에 한 칸 쌓는다(history.pushState,
//     주소 문자열은 바꾸지 않고 상태에만 정보를 담는다).
//   - 뒤로 가기 = 직전 단계를 다시 연다(값은 유지).
//   - 첫 단계에서 뒤로 가기 = 첫 화면(모드 카드).
//   - 제품 시트가 열려 있을 때 뒤로 가기 = 시트만 닫힘.
//
// 구현 방식: "쌓임(스택)" 하나로 전부 처리한다. 무언가 앞으로 나아갈 때마다
// (모드를 고를 때·단계가 넘어갈 때·시트가 열릴 때) pushBackLayer(되돌릴 때 할 일)를
// 부르면 실제 브라우저 히스토리에 한 칸이 쌓이고, 그 "되돌릴 때 할 일"이 스택에
// 쌓인다. 사용자가 브라우저 뒤로 가기를 누르면(popstate) 스택 맨 위(가장 최근에
// 쌓인 것)만 하나 꺼내 실행한다 — 시트가 열려 있으면 시트를 쌓은 게 맨 위라 시트만
// 닫히고, 시트가 없으면 그 아래 단계 되돌리기가 실행된다.
//
// 화면이 스스로(버튼 클릭 등) 그 상태를 닫을 때는 dropBackLayer()로 스택에서만
// 조용히 빼 둔다 — 이러면 나중에 사용자가 진짜 뒤로 가기를 눌러도 이미 지나간
// 항목이 다시 실행되지 않는다(주소창 URL 자체는 바뀌지 않으므로 눈에 보이는
// 변화는 없다. history 엔트리 개수만 쌓였다 줄었다 한다).
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

/** 되돌릴 때 실행할 함수 하나 */
type BackHandler = () => void;

// 모듈 전역 스택 — 이 계산기 화면 하나에서만 의미가 있는 값이라 페이지를 나가면
// 자동으로 버려진다(별도 정리 코드가 필요 없다).
const stack: BackHandler[] = [];
let listenerAttached = false;

/** popstate 리스너를 딱 한 번만 붙인다 */
function ensureListener() {
  if (listenerAttached || typeof window === 'undefined') return;
  listenerAttached = true;
  window.addEventListener('popstate', () => {
    // 스택 맨 위(가장 최근에 쌓인 "되돌리기") 하나만 꺼내 실행한다
    const handler = stack.pop();
    if (handler) handler();
  });
}

/**
 * 앞으로 한 칸 나아갈 때 부른다.
 * 실제 브라우저 히스토리에 한 칸을 쌓되(주소 문자열은 그대로), 뒤로 가기를
 * 눌렀을 때 실행할 되돌리기 함수를 스택에 같이 쌓는다.
 */
export function pushBackLayer(onBack: BackHandler): void {
  if (typeof window === 'undefined') return;
  ensureListener();
  // 주소 문자열은 절대 바꾸지 않는다 — 같은 href로 pushState해서 히스토리 칸만 늘린다
  window.history.pushState({ calcFlowLayer: stack.length + 1 }, '', window.location.href);
  stack.push(onBack);
}

/**
 * 화면이 스스로(뒤로 가기 버튼이 아니라 다른 방법으로) 그 상태를 닫을 때 부른다.
 * 브라우저 히스토리 엔트리는 그대로 남지만(주소는 안 바뀌니 눈에는 안 보인다),
 * 다음에 진짜 뒤로 가기를 누르면 그 항목은 건너뛰고 그 아래 것이 실행된다.
 */
export function dropBackLayer(): void {
  stack.pop();
}

/** 테스트 전용 — 모듈 전역 스택을 비운다 */
export function __resetBackLayerStackForTest(): void {
  stack.length = 0;
}
