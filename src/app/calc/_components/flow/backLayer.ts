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
// 2026-09-27 배포 전 검사관 지적(2·3번) 반영 — 옛 버전의 문제 두 가지를 고쳤다:
//   1) 시트를 "뒤로 가기가 아닌 방법"(제품 선택 등)으로 닫을 때 dropBackLayer()가 그냥
//      메모리 배열에서만 빼고 실제 히스토리 엔트리는 그대로 남겨 뒀다 — 그러면 나중에
//      진짜 뒤로 가기를 누르면 "이미 죽은 칸" 하나를 그냥 건너뛰는 게 아니라, popstate가
//      한 번 더 발생해서 우리 스택의 다음 칸까지 같이 소모해 버린다(뒤로 가기 두 번 눌러야
//      할 걸 한 번에 두 단계가 넘어가 버림 / 반대로 무반응 칸이 생김). 이제
//      collapseBackLayer()가 history.back()을 직접 호출해서 브라우저 엔트리 개수 자체를
//      실제로 줄인다. 이때 발생하는 popstate는 "우리가 스스로 되감은 것"이라 표시해 두고
//      (suppressCount) 진짜 사용자 뒤로 가기처럼 처리하지 않는다.
//   2) 모듈 전역 배열이 화면(계산기)을 떠나도 안 비워졌다 — 도배 계산기에서 쌓은 칸이
//      허브로 돌아간 뒤에도 남아 있다가, 나중에 엉뚱한 시점에 팝된다. 이제 각 칸에
//      "어느 계산기가 쌓았는지"(calcId)를 같이 적어 두고, 계산기 컴포넌트가 언마운트될 때
//      clearBackLayers(calcId)로 자기 몫만 걷어간다.
//
// 3) (실기기 확인 중 추가로 발견) 시트에서 제품을 "선택"하면 같은 렌더 안에서 두 가지가
//    동시에 일어난다 — 시트가 닫히며 collapseBackLayer()가 history.back()을 예약하고,
//    같은 순간 제품 단계가 완료되며 pushBackLayer()가 history.pushState()를 부른다.
//    history.back()은 비동기(실제 이동은 나중 이벤트 루프에서 일어남)라, 그 사이에
//    pushState가 먼저 실행돼 버리면 "뒤로 감"이 방금 막 쌓은 새 칸을 도로 지워버리고,
//    그 아래 있던 시트 칸은 그대로 남아 있는 어긋남이 생겼다(실측: 뒤로 가기 세 번째가
//    바로 이전 페이지로 나가버림 — 무반응 칸이 아니라 오히려 한 칸이 사라지는 문제였다).
//    collapseBackLayer()가 history.back()을 곧장 부르지 않고 마이크로태스크 한 틱을
//    기다리게 바꿨다 — 그사이 같은 계산기 몫으로 pushBackLayer()가 들어오면(위 경우처럼
//    "닫힘과 동시에 다음 칸이 쌓이는" 상황) 실제로는 "교체"일 뿐이니 브라우저 history는
//    아예 안 건드리고 되돌리기 함수만 새 것으로 바꿔 끼운다. 아무도 안 이어받으면(진짜
//    바깥 누름·Esc 등으로 그냥 닫힌 경우) 원래대로 history.back()을 실행한다.
//
// 시험하기 쉽게 만들려고 "진짜 브라우저 history"에 직접 의존하지 않고, createBackStack()이
// history 흉내 객체(HistoryAdapter)를 주입받는 구조로 뺐다 — 앱은 실제 window에 연결된
// 싱글턴(아래 export 함수들)을 쓰고, 테스트는 가짜 어댑터로 createBackStack()을 직접
// 호출해서 순수 로직만 확인한다(__tests__/backLayer.test.ts).
//
// 4) (2026-09-27 배포 전 재검수 지적 1번) 새로 고침하거나, 계산기를 떠났다가 뒤로/앞으로
//    다시 돌아오면 메모리 스택(stack 배열)은 새로 시작하지만(자바스크립트가 다시 실행되니
//    당연히 비어 있다), 브라우저 자체의 방문 기록에는 예전에 쌓아 둔 칸(state에 우리
//    calcId·seq가 적힌 칸)이 그대로 남아 있다 — 그 칸들의 popstate를 받아도 짝이 될
//    되돌리기 함수가 메모리에 없으니 예전엔 아무 일도 안 하고 조용히 지나갔다(=무반응
//    뒤로 가기). 이제 popstate가 오면 "이 자리가 우리 표식(calcId·seq)이 있는 칸인데
//    스택에는 짝이 없다"를 감지해서, 화면을 그대로 두는 대신 곧바로 한 번 더
//    history.back()을 불러 그 칸을 건너뛴다 — 표식 없는(=우리가 만들지 않은 진짜) 칸을
//    만날 때까지 반복한다(무한 반복 방지로 한 번의 사용자 조작당 건너뛰는 횟수에 상한을 둔다).
//    이러면 새로 고침 뒤에는 "단계 되돌리기"까지 복원하진 않지만(그건 이번 지시 대상이
//    아니다), 뒤로 가기 한 번을 누르면 곧바로 계산기 이전 페이지로 나가는 "눈에 보이는
//    변화 한 번"이 된다. 입력값 자체는 세션 복원(sessionPersist.ts)이 이미 담당한다.
//
// 5) (2026-09-27 실제 브라우저 재검증 중 추가로 발견) 4번 수리를 넣고도 여전히 무반응
//    한 번이 남는 경우가 있었다 — 계산기 페이지 자체가 처음 열릴 때(주소는 안 바뀌지만)
//    Next.js 라우터가 자기 내부용으로 표식 없는 칸을 하나 만들어 두는데, 이 칸은 "우리
//    표식"도 없고 "진짜 다른 페이지"도 아니다(주소가 여전히 계산기 페이지 그대로).
//    표식 없는 칸을 만나면 무조건 멈추는 옛 규칙대로면, 짝 없는 우리 칸들을 다 건너뛴
//    다음 이 표식 없는 "같은 페이지 안쪽" 칸에서 멈춰 버려 화면이 하나도 안 바뀐다(=
//    무반응). 이제 표식이 없어도 "지금 주소가 계산기를 처음 열었을 때와 같은 주소"면
//    진짜 다른 페이지가 아니라고 보고 계속 건너뛴다 — 주소가 달라지는 진짜 이전 페이지에
//    닿아야 비로소 멈춘다. "계산기를 처음 열었을 때의 주소"는 이 스택을 만드는 그 순간의
//    주소(homePathname)로 한 번 기억해 둔다(새로 고침하면 이 값도 그 시점 주소로 다시
//    잡히니 매번 정확하다).
//
// 작성일: 2026년 09월 27일
// 뒤로 가기 재설계(계산기 식별값 + collapseBackLayer + clearBackLayers): 2026년 09월 27일
// 짝 없는 옛 칸 건너뛰기(새로 고침·화면 이동 후 복귀 대응): 2026년 09월 27일
// 같은 페이지 안쪽의 표식 없는 칸까지 마저 건너뛰기(실기기 재검증 추가 수리): 2026년 09월 27일
// ──────────────────────────────────────────────

/** 되돌릴 때 실행할 함수 하나 */
type BackHandler = () => void;

/** 쌓인 칸 하나 — 어느 계산기가 쌓았는지(calcId)와 순번(seq)까지 기억해 둔다 */
interface Layer {
  calcId: string;
  seq: number;
  onBack: BackHandler;
}

/** 우리가 pushState에 실어 둔 표식 모양인지 확인한다(옛 세션에서 남은 칸인지 판정용) */
function isOurMarker(state: unknown): state is { calcId: string; seq: number } {
  if (!state || typeof state !== 'object') return false;
  const s = state as Record<string, unknown>;
  return typeof s.calcId === 'string' && typeof s.seq === 'number';
}

/** 짝 없는 옛 칸을 한 번의 사용자 조작에 몇 개까지 건너뛸지 상한(무한 반복 방지) */
const MAX_ORPHAN_SKIP = 30;

/**
 * 진짜 브라우저 history를 흉내 낸 최소 인터페이스. createBackStack()이 이것만 있으면
 * 되게 짜서, 테스트에서는 진짜 window 없이 이 모양의 가짜 객체를 넘겨 순수 로직만 돌린다.
 */
export interface HistoryAdapter {
  /** 히스토리에 한 칸 쌓는다(주소는 그대로, state만 담는다) */
  pushState: (state: unknown) => void;
  /** 한 칸 뒤로 간다(브라우저 뒤로 가기 버튼과 동일 동작 — popstate를 유발한다) */
  back: () => void;
  /** popstate가 일어날 때마다 그 시점의 state를 받아 부른다. 해지 함수를 돌려준다 */
  onPopState: (fn: (state: unknown) => void) => () => void;
  /**
   * 지금 주소의 경로(pathname)를 읽는다. 표식 없는 칸이 "우리 계산기 페이지 안쪽의
   * (Next.js 라우터 등이 만든) 팬시 칸"인지 "진짜 다른 페이지"인지 구분하는 데 쓴다
   * (5번 재수리 참고).
   */
  getPathname: () => string;
}

/** 진짜 window/history에 연결된 어댑터 — 브라우저 환경이 아니면(SSR 등) null */
function createWindowAdapter(): HistoryAdapter | null {
  if (typeof window === 'undefined') return null;
  return {
    pushState: (state) => window.history.pushState(state, '', window.location.href),
    back: () => window.history.back(),
    onPopState: (fn) => {
      const handler = (e: PopStateEvent) => fn(e.state);
      window.addEventListener('popstate', handler);
      return () => window.removeEventListener('popstate', handler);
    },
    getPathname: () => window.location.pathname,
  };
}

/**
 * 뒤로 가기 스택 하나를 만든다. 앱은 이 함수를 직접 안 부르고 아래 싱글턴(진짜 window에
 * 연결됨)을 쓰면 되고, 테스트만 가짜 어댑터로 직접 호출해서 로직을 확인한다.
 */
export function createBackStack(adapter: HistoryAdapter | null) {
  const stack: Layer[] = [];
  let seqCounter = 0;
  // 우리가 스스로 collapseBackLayer()로 history.back()을 부른 횟수 — 그만큼의 popstate는
  // "진짜 사용자가 누른 뒤로 가기"가 아니므로 조용히 무시한다.
  let suppressCount = 0;
  let unsubscribe: (() => void) | null = null;
  // collapseBackLayer()가 "이번 계산기 몫으로 진짜 거둘지, 아니면 곧이어 들어올 새
  // pushBackLayer가 자리를 이어받을지" 한 마이크로태스크만 기다리는 예약 — 3번 설명 참고
  let pendingCollapse: { calcId: string; layer: Layer } | null = null;
  // 지금 한 번의 사용자 조작(뒤로 가기 한 번 누른 것)으로 짝 없는 옛 칸을 몇 개나 건너뛰고
  // 있는지 — 진짜 처리할 칸을 만나거나 표식 없는 칸을 만나면 0으로 되돌린다(4번 설명 참고)
  let orphanSkipCount = 0;
  // "계산기를 처음 열었을 때의 주소" — 이 스택을 만드는 이 순간의 주소를 한 번 기억해 둔다.
  // 표식 없는 칸을 만났을 때 이 주소와 같으면(=아직 계산기 페이지 안쪽) 진짜 이전 페이지가
  // 아니라고 보고 계속 건너뛴다(5번 설명 참고).
  const homePathname = adapter?.getPathname() ?? null;

  function ensureListener() {
    if (unsubscribe || !adapter) return;
    unsubscribe = adapter.onPopState((state) => {
      if (suppressCount > 0) {
        suppressCount--;
        return;
      }
      // 스택 맨 위(가장 최근에 쌓인 것) 하나만 꺼내 되돌리기를 실행한다
      const top = stack.pop();
      if (top) {
        orphanSkipCount = 0; // 정상적으로 처리됐으니 건너뛰기 카운트 초기화
        top.onBack();
        return;
      }
      // 스택엔 짝이 없다 — 이 칸을 건너뛰어야 하는지 두 가지 경우를 본다:
      //   (a) 우리 표식(calcId·seq)이 있는 칸 — 새로 고침·화면 이동으로 메모리만 비워지고
      //       브라우저 기록엔 남아 있던 "옛 칸"이다.
      //   (b) 표식은 없지만 주소가 여전히 "계산기를 처음 열었을 때"와 같은 칸 — Next.js
      //       라우터 등이 같은 페이지 안쪽에 만들어 둔 칸으로, 우리가 만들진 않았어도
      //       "진짜 다른 페이지"는 아니다(5번 설명 참고).
      // 둘 중 하나면 화면을 그대로 두지 않고 곧바로 한 번 더 뒤로 가서 건너뛴다.
      const isPhantomSamePage = homePathname !== null && adapter.getPathname() === homePathname;
      if ((isOurMarker(state) || isPhantomSamePage) && orphanSkipCount < MAX_ORPHAN_SKIP) {
        orphanSkipCount++;
        adapter.back();
        return;
      }
      // 주소가 달라진 칸(=우리가 만들지 않은 진짜 이전 페이지)에 닿았다 — 여기서 멈춘다.
      // 이 자리가 바로 "눈에 보이는 변화"(계산기 이전 페이지로 나감)다.
      orphanSkipCount = 0;
    });
  }

  // 계산기가 마운트되기도 전에 이미 옛 칸이 쌓여 있을 수 있으므로(새로 고침 등), 무언가
  // 쌓이길 기다리지 않고 만들어지는 즉시 리스너를 붙인다(4번 설명 참고 — 예전엔
  // pushBackLayer가 처음 불릴 때만 붙어서, 아무 push도 없이 시작하는 화면에서는 리스너
  // 자체가 없어 옛 칸의 popstate를 아예 못 잡았다).
  ensureListener();

  return {
    /**
     * 앞으로 한 칸 나아갈 때 부른다. calcId는 "어느 계산기가 쌓았는지" 표시(언마운트 때
     * 자기 몫만 걷어가려고 쓴다). 실제 브라우저 히스토리에 한 칸을 쌓는다(주소는 그대로).
     *
     * 예약된 collapse(pendingCollapse)가 같은 계산기 몫으로 남아 있으면 — "시트가 닫히며
     * 동시에 다음 단계가 완료되는" 경우다. 이때는 실제로는 "교체"라 history를 아예 안
     * 건드리고 되돌리기 함수만 바꿔 끼운 채 그대로 스택에 되돌려 놓는다(3번 설명 참고).
     */
    pushBackLayer(calcId: string, onBack: BackHandler): void {
      if (!adapter) return;
      if (pendingCollapse && pendingCollapse.calcId === calcId) {
        pendingCollapse = null;
        const seq = ++seqCounter;
        stack.push({ calcId, seq, onBack });
        return;
      }
      ensureListener();
      const seq = ++seqCounter;
      adapter.pushState({ calcId, seq });
      stack.push({ calcId, seq, onBack });
    },

    /**
     * 화면이 스스로(뒤로 가기 버튼이 아니라 다른 방법 — 제품 선택, 바깥 누름, 닫기 버튼,
     * Esc 등) 그 상태를 닫을 때 부른다. 메모리에서 먼저 빼 두고, 마이크로태스크 한 틱을
     * 기다렸다가 아무도 이어받지 않았으면(pendingCollapse가 그대로 남아 있으면) 그때
     * 실제로 history.back()을 불러 브라우저 엔트리 자체를 줄인다 — 그래야 다음에 진짜
     * 뒤로 가기를 눌렀을 때 "이미 닫힌 시트 칸"이 무반응으로 남지 않는다. 이때 생기는
     * popstate는 suppressCount로 표시해 두고 되돌리기 함수를 부르지 않는다.
     */
    collapseBackLayer(calcId: string): void {
      if (!adapter || stack.length === 0) return;
      const removed = stack.pop();
      if (!removed) return;
      pendingCollapse = { calcId, layer: removed };
      queueMicrotask(() => {
        // 그 사이 같은 계산기 몫으로 pushBackLayer가 안 들어왔으면(=아무도 이어받지 않았으면)
        // 진짜로 거둔다. 들어왔으면 pushBackLayer 쪽에서 이미 pendingCollapse를 비웠다.
        if (pendingCollapse && pendingCollapse.calcId === calcId) {
          pendingCollapse = null;
          suppressCount++;
          adapter.back();
        }
      });
    },

    /**
     * 계산기 화면이 사라질 때(다른 계산기로 이동, 허브로 나가기 등) 그 계산기 몫만 걷어낸다.
     * 브라우저 히스토리 엔트리 개수는 안 건드린다(사용자가 뒤로 가기를 누르면 그 칸들에서
     * popstate가 오긴 하지만, 스택에서 이미 빠졌으니 되돌리기 함수가 안 불려서 조용히
     * 지나간다 — "이미 떠난 계산기의 낡은 되돌리기"가 실행되는 사고를 막는다).
     */
    clearBackLayers(calcId: string): void {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].calcId === calcId) stack.splice(i, 1);
      }
    },

    /** 시험 전용 — 지금 스택 안을 들여다본다(calcId·seq만, onBack 함수는 안 보여준다) */
    __debugStack(): Array<{ calcId: string; seq: number }> {
      return stack.map((l) => ({ calcId: l.calcId, seq: l.seq }));
    },
  };
}

// ── 앱이 실제로 쓰는 싱글턴 — 진짜 window/history에 연결된다 ──
const appStack = createBackStack(createWindowAdapter());

export const pushBackLayer = appStack.pushBackLayer;
export const collapseBackLayer = appStack.collapseBackLayer;
export const clearBackLayers = appStack.clearBackLayers;

/** 테스트 전용 — 모듈 전역(싱글턴) 스택을 비운다. 화면 테스트를 새로 쓸 때 계속 쓴다 */
export function __resetBackLayerStackForTest(): void {
  // 지금 스택에 남아 있는 모든 계산기 몫을 전부 걷어낸다(테스트 사이 상태가 안 새게)
  for (const l of appStack.__debugStack()) {
    appStack.clearBackLayers(l.calcId);
  }
}
