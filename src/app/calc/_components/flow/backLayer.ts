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
//    뒤로 가기). popstate가 오면 "이 자리가 우리 표식(calcId·seq)이 있는 칸인데 스택에는
//    짝이 없다"를 감지해서, 화면을 그대로 두는 대신 곧바로 한 번 더 history.back()을 불러
//    그 칸을 건너뛴다(무한 반복 방지 상한).
//
// 5) (2026-09-27 배포 후 검사관이 발견한 치명 회귀 — 이번에 전면 재설계로 고쳤다)
//    지난 판(bac688f)은 "주소가 계산기를 처음 열었을 때와 같으면 표식 없어도 건너뛴다"는
//    규칙을 추가했는데, 이게 두 가지 사고를 냈다:
//      (a) homePathname을 "이 스택을 만드는 순간"의 주소로 딱 한 번만 읽었다. 블로그
//          글에서 "링크를 눌러"(페이지 전체가 새로 열리지 않는 SPA 이동) 계산기로 들어오면,
//          이 모듈은 블로그 페이지가 뜬 그 시점에 이미 한 번 실행돼 있을 수 있어(다른
//          경로로 먼저 로드됐거나, Next.js가 미리 불러 두는 경우 등) homePathname이
//          "계산기 주소"가 아니라 "블로그 주소"로 잘못 굳어 버렸다 — 그러면 블로그 칸도
//          "우리 페이지"로 오판해서 건너뛰어 버려, 뒤로 가기 한 번에 블로그를 지나쳐
//          about:blank까지 나가버렸다(재현 가·나·다·라 전부 이 사고).
//      (b) popstate 처리기를 모듈이 처음 실행될 때 딱 한 번 붙이고 다시는 안 뗐다 —
//          계산기를 완전히 떠난 뒤(허브·다른 계산기·블로그)에도 이 처리기가 계속 살아서,
//          그 페이지들에서 일어나는 진짜 뒤로 가기까지 자기 논리로 건드려 버렸다.
//
//    고친 방법(주소 비교를 완전히 버리고, "우리 표식 + 지금 활성 계산기"만 본다):
//      - 표식(calcId·seq)에 "문서 수명 값"(epoch)을 추가했다 — 이 스택 인스턴스가 만들어질
//        때(=모듈이 실행될 때, 즉 페이지가 새로 열리거나 새로 고침될 때) 딱 한 번 임의로
//        만든다. 세션이 이어지는 동안(같은 문서) 찍히는 모든 표식은 같은 epoch를 갖는다.
//      - popstate 처리기는 계산기가 "지금 화면에 떠 있을 때만" 존재한다 — activateCalc()가
//        계산기가 마운트될 때 등록하고(리스너를 그제서야 붙인다), 돌려준 해지 함수를 그
//        계산기의 useEffect 정리 함수에서 불러 등록을 뗀다(마지막 계산기가 빠지면 리스너
//        자체를 제거한다). 다른 페이지(바닥재·미장·블로그·허브)에서는 이 리스너가 아예
//        없으니 뒤로 가기에 전혀 관여하지 않는다.
//      - 건너뛸지 말지는 오직: "이 칸에 우리 표식이 있고, 그 calcId가 지금 활성 계산기
//        목록에 있으면" 건너뛴다(표식이 없거나, calcId가 다른 계산기의 것이면 절대
//        건너뛰지 않고 멈춘다 — 표식 없는 칸이 블로그든 허브든 옛 계산기의 첫 진입 칸이든
//        상관없이, "우리 표식이 아니면 남의 칸"이라는 단 하나의 기준만 쓴다).
//      - 짝 없는 칸을 몇 개 건너뛴 뒤(orphanSkipCount > 0) 마침내 표식이 아예 없는 칸에
//        닿으면 — 이 칸이 "그 계산기의 첫 진입 칸"이다(계산기가 모드를 고르기 전 상태).
//        이 칸은 브라우저 주소가 그대로라 Next.js도 화면을 새로 그려주지 않으므로, 등록해
//        둔 "첫 화면으로 돌아가기" 콜백(onExitToModePicker)을 직접 불러 화면을 모드 카드로
//        되돌린다 — 이게 "눈에 보이는 변화"다. 짝 없는 칸을 하나도 안 건너뛰고(=곧바로
//        표식 없는 칸에 닿았다면, 예: 공유 링크로 들어와 아무 것도 안 쌓은 세션) 이 콜백을
//        부르지 않는다 — 그 칸은 우리 계산기와 무관한 진짜 이전 페이지이므로 브라우저가
//        알아서 그 페이지를 보여준다.
//
// 작성일: 2026년 09월 27일
// 뒤로 가기 재설계(계산기 식별값 + collapseBackLayer + clearBackLayers): 2026년 09월 27일
// 짝 없는 옛 칸 건너뛰기(새로 고침·화면 이동 후 복귀 대응): 2026년 09월 27일
// 주소 비교 방식 폐기 + 문서수명(epoch) + 계산기별 리스너 부착/해제로 전면 재설계
//   (배포 후 발견된 치명 회귀 수리): 2026년 09월 27일
// ──────────────────────────────────────────────

/** 되돌릴 때 실행할 함수 하나 */
type BackHandler = () => void;

/** 쌓인 칸 하나 — 어느 계산기가 쌓았는지(calcId)와 순번(seq)까지 기억해 둔다 */
interface Layer {
  calcId: string;
  seq: number;
  onBack: BackHandler;
}

/** 우리가 pushState에 실어 둔 표식 모양 — calcId·seq에 더해 "문서 수명 값"(epoch)까지 갖는다 */
interface Marker {
  calcId: string;
  seq: number;
  epoch: string;
}

/** 우리가 pushState에 실어 둔 표식 모양인지 확인한다(옛 세션에서 남은 칸인지 판정용) */
function isOurMarker(state: unknown): state is Marker {
  if (!state || typeof state !== 'object') return false;
  const s = state as Record<string, unknown>;
  return typeof s.calcId === 'string' && typeof s.seq === 'number' && typeof s.epoch === 'string';
}

/** 짝 없는 옛 칸을 한 번의 사용자 조작에 몇 개까지 건너뛸지 상한(무한 반복 방지) */
const MAX_ORPHAN_SKIP = 30;

/**
 * 진짜 브라우저 history를 흉내 낸 최소 인터페이스. createBackStack()이 이것만 있으면
 * 되게 짜서, 테스트에서는 진짜 window 없이 이 모양의 가짜 객체를 넘겨 순수 로직만 돌린다.
 * (5번 재설계: 주소 비교를 버렸으므로 getPathname은 더 이상 필요 없어 뺐다.)
 */
export interface HistoryAdapter {
  /** 히스토리에 한 칸 쌓는다(주소는 그대로, state만 담는다) */
  pushState: (state: unknown) => void;
  /** 한 칸 뒤로 간다(브라우저 뒤로 가기 버튼과 동일 동작 — popstate를 유발한다) */
  back: () => void;
  /** popstate가 일어날 때마다 그 시점의 state를 받아 부른다. 해지 함수를 돌려준다 */
  onPopState: (fn: (state: unknown) => void) => () => void;
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
  };
}

/** 문서 수명을 구분하는 임의 값 하나를 만든다(모듈 실행 때, 즉 createBackStack 호출 때 한 번) */
function createEpoch(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
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
  // 지금 건너뛰고 있는 칸이 어느 계산기 몫이었는지(표식 없는 칸에 닿았을 때 그 계산기의
  // "첫 화면으로" 콜백을 부르는 데 쓴다 — 5번 설명 참고)
  let lastOrphanCalcId: string | null = null;
  // 이 스택 인스턴스(=이 문서 실행)를 구분하는 값 — 새로 고침하면 새 인스턴스가 만들어지며
  // 매번 새로 뽑힌다. 이 값이 다른 표식은 "이전 문서에서 찍힌 것"이 확실하다(5번 설명 참고)
  const epoch = createEpoch();
  // 지금 화면에 떠 있는(mount된) 계산기들 — calcId -> "첫 화면으로 돌아가기" 콜백.
  // activateCalc()로 등록되고, 그 계산기가 언마운트될 때(돌려준 함수 호출) 빠진다.
  // 이 목록이 비어 있으면(=아무 계산기도 안 떠 있으면) popstate 처리기 자체를 뗀다.
  const activeCalcs = new Map<string, BackHandler>();

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
        lastOrphanCalcId = null;
        top.onBack();
        return;
      }
      // 스택엔 짝이 없다 — 이 칸이 "지금 화면에 떠 있는 계산기"의 표식이면(우리 칸이면)
      // 건너뛴다. 표식이 없거나(진짜 다른 페이지·계산기의 첫 진입 칸) 다른 calcId(남의
      // 계산기 몫, 8번 규칙)면 절대 안 건너뛰고 멈춘다 — 주소는 더 이상 비교하지 않는다.
      if (isOurMarker(state) && activeCalcs.has(state.calcId) && orphanSkipCount < MAX_ORPHAN_SKIP) {
        orphanSkipCount++;
        lastOrphanCalcId = state.calcId;
        adapter.back();
        return;
      }
      // 여기서 멈춘다. 방금까지 어느 계산기의 짝 없는 칸을 건너뛰고 있었다면(orphanSkipCount
      // > 0) 지금 닿은 이 칸은 "그 계산기의 첫 진입 칸"(모드를 고르기 전)이다 — 주소가
      // 그대로라 화면이 저절로 안 바뀌므로, 등록된 콜백을 직접 불러 모드 카드로 되돌린다.
      // 건너뛴 게 하나도 없다면(orphanSkipCount === 0, 곧바로 표식 없는 칸에 닿았다면)
      // 이건 우리와 무관한 진짜 다른 페이지이므로 아무것도 하지 않는다(브라우저가 알아서
      // 그 페이지를 보여준다).
      if (orphanSkipCount > 0 && lastOrphanCalcId) {
        const onReturnToStart = activeCalcs.get(lastOrphanCalcId);
        onReturnToStart?.();
      }
      orphanSkipCount = 0;
      lastOrphanCalcId = null;
    });
  }

  /** activeCalcs가 비면 리스너 자체를 뗀다(다른 페이지의 뒤로 가기에 전혀 관여하지 않는다) */
  function removeListenerIfIdle() {
    if (activeCalcs.size === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  return {
    /**
     * 앞으로 한 칸 나아갈 때 부른다. calcId는 "어느 계산기가 쌓았는지" 표시(언마운트 때
     * 자기 몫만 걷어가려고 쓴다). 실제 브라우저 히스토리에 한 칸을 쌓는다(주소는 그대로).
     * 이 칸에는 지금 문서의 epoch도 같이 찍힌다.
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
      const seq = ++seqCounter;
      adapter.pushState({ calcId, seq, epoch });
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

    /**
     * (5번 재설계 핵심) 이 계산기가 "지금 화면에 떠 있다"고 등록한다 — 이때부터(그리고
     * 이때만) popstate 처리기가 실제로 붙어서, 이 calcId의 짝 없는 칸을 건너뛰는 일을
     * 한다. 계산기 컴포넌트가 마운트되는 useEffect에서 부르고, 돌려주는 해지 함수를 그
     * useEffect의 정리 함수(unmount)에서 불러야 한다 — 마지막 계산기가 빠지면 리스너
     * 자체가 제거되어(removeListenerIfIdle) 다른 페이지의 뒤로 가기에 전혀 관여하지 않는다.
     *
     * onReturnToStart: 짝 없는 칸을 건너뛴 끝에 표식 없는 칸(이 계산기의 첫 진입 칸)에
     * 닿으면 불린다 — 화면을 모드 카드(첫 화면)로 되돌리는 함수를 넘겨야 한다.
     */
    activateCalc(calcId: string, onReturnToStart: BackHandler): () => void {
      activeCalcs.set(calcId, onReturnToStart);
      ensureListener();
      return () => {
        activeCalcs.delete(calcId);
        removeListenerIfIdle();
      };
    },

    /** 시험 전용 — 지금 스택 안을 들여다본다(calcId·seq만, onBack 함수는 안 보여준다) */
    __debugStack(): Array<{ calcId: string; seq: number }> {
      return stack.map((l) => ({ calcId: l.calcId, seq: l.seq }));
    },

    /** 시험 전용 — 지금 리스너가 붙어 있는지(activateCalc/해지 동작 확인용) */
    __hasListener(): boolean {
      return unsubscribe !== null;
    },
  };
}

// ── 앱이 실제로 쓰는 싱글턴 — 진짜 window/history에 연결된다 ──
const appStack = createBackStack(createWindowAdapter());

export const pushBackLayer = appStack.pushBackLayer;
export const collapseBackLayer = appStack.collapseBackLayer;
export const clearBackLayers = appStack.clearBackLayers;
export const activateCalc = appStack.activateCalc;

/** 테스트 전용 — 모듈 전역(싱글턴) 스택을 비운다. 화면 테스트를 새로 쓸 때 계속 쓴다 */
export function __resetBackLayerStackForTest(): void {
  // 지금 스택에 남아 있는 모든 계산기 몫을 전부 걷어낸다(테스트 사이 상태가 안 새게)
  for (const l of appStack.__debugStack()) {
    appStack.clearBackLayers(l.calcId);
  }
}
