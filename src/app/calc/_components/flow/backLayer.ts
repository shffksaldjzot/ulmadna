// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 뒤로·앞으로 가기 스택
//
// 지시서 4-3절 규칙(2026-09-27 "끝낸 단계를 접지 않기" 결정으로 갱신):
//   - 모드를 고르면(ModePicker → 단계 화면) 한 칸 쌓는다 → 뒤로 가기 = 모드 카드로,
//     앞으로 가기 = 골랐던 모드 화면으로.
//   - 제품 시트가 열리면 한 칸 쌓는다 → 뒤로 가기 = 시트만 닫힘, 앞으로 가기 = 다시 열림.
//   - **단계 진행 자체는 이제 여기 안 쌓는다** — 끝낸 단계도 화면에서 안 접히므로(계속
//     펼쳐진 채 바로 고칠 수 있다) "뒤로 = 직전 단계 다시 열기"는 눈에 보이는 변화가
//     없어져서, 그 개념 자체를 없앴다(useFlowBackNav.ts에서 단계용 코드를 전부 걷어냄).
//     이 파일(backLayer.ts)의 큰 틀(짝 없는 칸 건너뛰기·방향 판단·처리기 부착/해제·
//     문서 수명)은 그대로 두고, 계산기 쪽 "부르는 곳"만 모드·시트 두 가지로 줄었다.
//
// (지난 수리 이력 요약 — 전부 2026년 09월 27일)
//   1) 시트를 뒤로 가기가 아닌 방법으로 닫으면 collapseBackLayer()가 history.back()을
//      직접 불러 브라우저 엔트리 자체를 줄인다(무반응 칸 방지, suppressCount로 표시).
//   2) 계산기 화면이 사라질 때(clearBackLayers) 그 계산기 몫만 걷어간다(calcId 구분).
//   3) 시트가 닫히며 동시에 다음 단계가 쌓이는 경쟁 — collapseBackLayer가 마이크로태스크
//      한 틱을 기다려, 같은 계산기 몫 pushBackLayer가 바로 들어오면 "교체"로 처리한다.
//   4) 새로 고침·화면 이동 후 복귀 — 브라우저 기록엔 남은 옛 표식 칸을, 메모리에 짝이
//      없으면 history.back()으로 건너뛴다(무한 반복 방지 상한).
//   5) (배포 후 치명 회귀 수리) 주소 비교 방식을 폐기하고, 표식에 "문서 수명"(epoch)을
//      추가 + popstate 처리기를 계산기가 마운트돼 있을 때만(activateCalc) 붙인다.
//
// 6) (2026-09-27 검사관 4차 지적 — 이번 수리) **앞으로 가기가 뒤로 가기와 구분이 안 됐다.**
//    옛 처리기는 popstate가 오면 무조건 "스택 맨 위를 꺼내 되돌리기"만 했다 — 방향(뒤로인지
//    앞으로인지)을 아예 안 봤다. 그래서 3단계 완료 → 뒤로 2번(1단계가 열림) → 앞으로 하면
//    스택엔 이미 아무것도 없어서(뒤로 갈 때 이미 다 꺼내 썼으므로) 짝 없는 칸으로 오판해
//    모드 카드로 끌려가는 사고가 났다.
//
//    고친 방법 — **표식의 순번(seq)으로 방향을 스스로 판단한다:**
//      - 계산기마다 "지금 서 있는 칸의 순번"(currentSeq)을 따로 기억한다. 계산기가 붙을 때
//        (activateCalc) 그 순간의 history.state에 우리 표식이 있으면 그 순번으로 시작하고
//        (baseSeq에도 같이 저장 — "이 계산기가 시작한 자리"), 없으면 0부터 시작한다.
//      - 새 칸을 쌓을 때 순번은 언제나 "지금 순번 + 1"이다(새로 고침 뒤에도 그 시점 순번에
//        이어서 늘어난다 — 옛 순번과 절대 안 겹친다).
//      - popstate가 오면 도착한 칸의 순번(target — 표식 있으면 그 순번, 없으면 0)과
//        currentSeq를 비교해서 "뒤로"(target < currentSeq)인지 "앞으로"(target > currentSeq)
//        인지를 스스로 정한다. 브라우저가 알려주는 방향 정보는 없으므로(popstate 이벤트
//        자체엔 방향이 없다) 오직 순번 비교로만 판단한다.
//      - 각 칸(층)은 이제 되돌리기(onBack)와 다시 하기(onForward) 둘 다 갖는다. 단계 칸의
//        onForward = 그 전이가 도달했던 자리로 다시 돌아감. 모드 칸의 onForward = 골랐던
//        모드 화면으로. 제품 시트 칸의 onForward = 시트를 다시 연다(뒤로=닫힘과 대칭,
//        7번 설명 참고 — "다시 안 연다"였던 지시가 실기기 검증 뒤 바뀌었다).
//      - **같은 문서 수명, 메모리에 짝이 있는 칸**(그 순번이 이 계산기가 이번 세션에 실제로
//        쌓은 층에 있거나, 계산기가 시작한 자리(baseSeq) 그 자체) — 건너뛴 칸들의
//        onBack/onForward를 순번 순서대로 전부 불러 주고 currentSeq = target. 이땐
//        history.back()·forward()를 우리가 따로 부르지 않는다(브라우저가 이미 그 자리로
//        옮겨 놓은 뒤 오는 popstate이므로).
//      - **짝 없는 칸**(다른 문서 수명의 표식, 또는 이번 세션에 쌓은 적 없는 순번):
//          · 뒤로(target < currentSeq) — 예전처럼 표식 없는 칸까지 history.back()으로
//            건너뛴다. 닿으면 "첫 화면으로"(onReturnToStart) 콜백. currentSeq = 0.
//          · 앞으로(target > currentSeq) — **건너뛰지 않는다.** history.back()도
//            forward()도 안 부른다. 그 칸에 그냥 머물고, "복원된 진행 화면으로"
//            (onForwardPastStart) 콜백을 불러 화면을 바꾼다. currentSeq = target.
//            이 구역에서 앞으로를 더 눌러도 화면이 안 바뀔 수 있다(짝 없는 칸이 여러 개
//            이어질 때) — 새로 고침 + 여러 번 앞으로라는 드문 조합이라 허용한다. 단,
//            칸이 거꾸로 끌려가거나 사이트 밖으로 나가는 일은 없다.
//      - 짝 없는 칸을 건너뛰는 "연쇄"(같은 사용자 조작 한 번에 여러 popstate가 연달아
//        옴)는 뒤로 방향에만 있다(우리가 adapter.back()을 반복 호출하니까). 그 연쇄
//        도중에 오는 popstate는 방향을 다시 재지 않고 연쇄 규칙만 그대로 따른다.
//
// 7) (2026-09-27 검사관 5차 지적 — 이번 수리, 6번 배포 뒤 실기기 재검증에서 새로 발견)
//    두 가지 문제:
//    (가) 새로 고침 → 뒤로(모드 카드 도달, 6번의 orphanSkip 연쇄가 끝나는 지점) → 모드를
//        다시 고름(새 칸 쌓임, seq1부터) → 뒤로 하면 모드 카드를 건너뛰고 곧장 블로그로
//        나가 버렸다. 원인: 연쇄가 끝나 "첫 화면으로" 콜백을 부를 때 currentSeq만 0으로
//        되돌리고 baseSeq는 새로 고침 시점에 이어받은 옛 값(예: 3)을 그대로 뒀다. 그래서
//        나중에 새로 쌓은 seq1에서 뒤로 가 target=0에 닿아도 isInMemory가 "0===baseSeq(3)"
//        으로 틀리게 판정해 시작 칸을 "짝 없는 칸"으로 오판, 한 번 더 건너뛰었다. 고침:
//        시작 칸에 닿으면 baseSeq도 0으로 같이 되돌리고 layers도 비운다(activateCalc()가
//        처음 붙을 때와 완전히 같은 "새로 시작" 상태로 리셋). 문서 수명(epoch)은 layers
//        맵 자체가 이번 세션에 쌓은 것만 담고 있어(다른 문서의 옛 칸은 애초에 이 맵에
//        없다) 순번이 같은 옛 칸과 새 칸이 섞일 위험이 없다 — Map이 곧 "이번 문서 수명"의
//        경계 역할을 한다.
//    (나) 제품 시트 칸의 onForward가 빈 함수였다("다시 안 연다"는 지시가 있었다 — 이제
//        바뀌었다). 시트를 열고 뒤로(닫힘) → 앞으로(빈 함수라 화면 그대로, 칸만 이동)
//        → 뒤로 하면, 이 칸의 onBack(닫기)이 다시 실행되지만 시트는 이미 닫혀 있어
//        "닫기"를 또 해도 눈에 보이는 변화가 없다("죽은 칸"). 이 죽은 칸에서 시트를 다시
//        열면 pushBackLayer가 새 칸을 또 쌓아 기록이 계속 늘어난다. 고침: 시트 칸의
//        onForward가 이제 실제로 시트를 다시 연다(ProductSheet.tsx의 onReopen prop).
//        이미 그 기록 칸에 서 있는 것이므로 다시 열릴 때 새 칸을 쌓지 않는다
//        (reopenedByForwardRef로 표시해 막는다). 뒤로=닫힘/앞으로=열림이 대칭이 되어
//        "죽은 칸"이 생기지 않는다.
//
// 8) (2026-09-27 검사관 6차 지적 — 이번 수리) 새로 고침 → 뒤로(모드 카드, 7번 수리로
//    baseSeq도 0으로 리셋됨) → 앞으로(짝 없는 칸으로, onForwardPastStart만 부르고 아무
//    층도 안 남김) → 뒤로 하면, 칸(currentSeq)은 시작 칸으로 정확히 돌아가는데 화면은
//    "모든 단계 완료" 그대로 남았다. 원인: 마지막 "뒤로"가 target(0)===baseSeq(0)라서
//    "매칭"으로 오판(우연히 참이 됨)해 layers.get(현재 순번)의 onBack을 부르려 했는데,
//    그 순번엔 진짜 층이 없어서(앞으로 갈 때 층을 안 남겼으므로) 아무 일도 안 일어났다.
//    고침: 짝 없는 칸으로 앞으로 가서 멈출 때, 그 순번에 "가상 층"을 만들어 둔다(되돌리기
//    = onReturnToStart, 다시 하기 = onForwardPastStart). 그러면 나중에 그 칸에서 뒤로
//    갈 때 이 가상 층이 실제로 불려서 화면이 모드 카드로 바뀐다. 옛 칸 구역 안에서 앞으로를
//    더 눌러 다른 옛 칸으로 가도 그때마다 같은 방식으로 가상 층이 쌓이므로, 그 구역
//    어디서 뒤로 가든 곧장 시작 칸 + 모드 카드로 이어진다(중간에 무반응 칸이 안 생긴다).
//
// 시험하기 쉽게 만들려고 "진짜 브라우저 history"에 직접 의존하지 않고, createBackStack()이
// history 흉내 객체(HistoryAdapter)를 주입받는 구조로 뺐다.
//
// 작성일: 2026년 09월 27일
// 앞으로 가기 지원(순번 기반 방향 판단으로 전면 재설계): 2026년 09월 27일
// baseSeq 리셋 + 시트 다시 열기 대칭(5차 검증 수리): 2026년 09월 27일
// 짝 없는 앞으로 칸에 가상 층 등록(6차 검증 수리): 2026년 09월 27일
// ──────────────────────────────────────────────

/** 되돌리기·다시 하기 둘 다 인자 없는 함수 한 개 */
type BackHandler = () => void;

/** 쌓인 칸 하나 — 되돌리기와 다시 하기 둘 다 갖는다 */
interface Layer {
  calcId: string;
  seq: number;
  onBack: BackHandler;
  onForward: BackHandler;
}

/** 우리가 pushState에 실어 둔 표식 모양 — calcId·seq에 "문서 수명"(epoch)까지 갖는다 */
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

/** 짝 없는 옛 칸(뒤로 방향)을 한 번의 사용자 조작에 몇 개까지 건너뛸지 상한(무한 반복 방지) */
const MAX_ORPHAN_SKIP = 30;

/**
 * 진짜 브라우저 history를 흉내 낸 최소 인터페이스.
 */
export interface HistoryAdapter {
  /** 히스토리에 한 칸 쌓는다(주소는 그대로, state만 담는다) */
  pushState: (state: unknown) => void;
  /** 한 칸 뒤로 간다(브라우저 뒤로 가기 버튼과 동일 동작 — popstate를 유발한다) */
  back: () => void;
  /** popstate가 일어날 때마다 그 시점의 state를 받아 부른다. 해지 함수를 돌려준다 */
  onPopState: (fn: (state: unknown) => void) => () => void;
  /** 지금 서 있는 칸의 state를 읽는다(계산기가 마운트되는 그 순간의 순번을 알아내는 데 쓴다) */
  getState: () => unknown;
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
    getState: () => window.history.state,
  };
}

/** 문서 수명을 구분하는 임의 값 하나를 만든다(모듈 실행 때, 즉 createBackStack 호출 때 한 번) */
function createEpoch(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** 계산기 한 개의 뒤로·앞으로 가기 상태 */
interface CalcTrack {
  /** 지금 서 있는 칸의 순번(표식 없으면 0) */
  currentSeq: number;
  /** 이 계산기가 마운트된 "그 순간"의 순번 — 여기로 돌아오면 아무 콜백도 안 부른다(제자리) */
  baseSeq: number;
  /** 이번 세션(마운트~언마운트)에 실제로 쌓은 층들 — seq를 키로 바로 찾는다 */
  layers: Map<number, Layer>;
  /** 짝 없는 칸을 뒤로 건너뛴 끝에 표식 없는 칸(첫 진입 칸)에 닿으면 부른다 — "모드 카드로" */
  onReturnToStart: BackHandler;
  /** 짝 없는 칸으로 앞으로 가서 멈출 때 부른다 — "복원된 진행 화면으로"(모드 선택을 되돌림) */
  onForwardPastStart: BackHandler;
}

/**
 * 뒤로·앞으로 가기 스택 하나를 만든다. 앱은 이 함수를 직접 안 부르고 아래 싱글턴(진짜
 * window에 연결됨)을 쓰면 되고, 테스트만 가짜 어댑터로 직접 호출해서 로직을 확인한다.
 */
export function createBackStack(adapter: HistoryAdapter | null) {
  // calcId별 뒤로·앞으로 상태 — activateCalc로 등록되고 그 해지 함수로 빠진다
  const calcs = new Map<string, CalcTrack>();
  // 우리가 스스로 collapseBackLayer()로 history.back()을 부른 횟수 — 그만큼의 popstate는
  // "진짜 사용자가 누른 뒤로 가기"가 아니므로 조용히 무시한다.
  let suppressCount = 0;
  let unsubscribe: (() => void) | null = null;
  // collapseBackLayer()가 "이번 계산기 몫으로 진짜 거둘지, 아니면 곧이어 들어올 새
  // pushBackLayer가 자리를 이어받을지" 한 마이크로태스크만 기다리는 예약
  let pendingCollapse: { calcId: string; seq: number } | null = null;
  // 짝 없는 옛 칸을 "뒤로" 방향으로 건너뛰는 연쇄 진행 상태 — 앞으로는 연쇄가 없다(단발성)
  let orphanSkipCount = 0;
  let orphanCalcId: string | null = null;
  // 이 스택 인스턴스(=이 문서 실행)를 구분하는 값 — 새로 고침하면 새로 뽑힌다
  const epoch = createEpoch();

  /** 이 순번이 "지금 이 계산기 세션에서 실제로 오갈 수 있는 자리"인지 — 짝이 있는지 판정 */
  function isInMemory(calc: CalcTrack, seq: number): boolean {
    return seq === calc.baseSeq || calc.layers.has(seq);
  }

  function ensureListener() {
    if (unsubscribe || !adapter) return;
    unsubscribe = adapter.onPopState((state) => {
      if (suppressCount > 0) {
        suppressCount--;
        return;
      }

      // ── 뒤로 방향 짝 없는 칸 건너뛰기 "연쇄" 도중이면, 방향을 다시 재지 않고 그대로 잇는다 ──
      if (orphanSkipCount > 0 && orphanCalcId) {
        const calc = calcs.get(orphanCalcId);
        const marked = isOurMarker(state);
        const stillOrphanOfSameCalc = marked && state.calcId === orphanCalcId && calc ? !isInMemory(calc, state.seq) : false;
        if (stillOrphanOfSameCalc && orphanSkipCount < MAX_ORPHAN_SKIP) {
          orphanSkipCount++;
          adapter.back();
          return;
        }
        // 멈춘다 — 표식 없는 칸에 닿았을 때만 "첫 화면으로"를 부른다(남의 계산기 표식이면
        // 아무 것도 안 부르고 조용히 멈춘다 — 8번 규칙 그대로)
        //
        // 2026-09-27 검사관 5차 지적(치명) 수리: currentSeq만 0으로 되돌리고 baseSeq는
        // 옛 값(새로 고침 시점에 이어받은 순번, 예: 3)을 그대로 두면, 그 뒤 새로 쌓은 칸
        // (seq1부터 다시 시작)에서 뒤로 가 이 "시작 칸"(순번 0)에 닿았을 때 isInMemory가
        // "0 === baseSeq(3)"으로 틀리게 판정해 짝 없는 칸으로 오판, 한 칸 더 건너뛰어
        // 버렸다(모드 카드를 지나쳐 블로그까지 나가버림). 지금이 "진짜 시작 칸"이므로
        // baseSeq도 0으로 같이 되돌리고, 옛 문서 수명에서 남은 층(있어 봤자 이번 세션엔
        // 없지만 방어적으로) 전부 비워서 완전히 새로 시작한 것처럼 만든다. 브라우저 기록에
        // 남은 옛 표식 칸(순번 1~4)은 여기서 지우지 않아도 된다 — 새 칸을 쌓는 순간
        // history.pushState가 실제로 앞쪽(더 forward) 엔트리를 잘라내 버리고, 설령 그
        // 전에 사용자가 앞으로 가서 옛 칸에 닿아도 문서 수명(epoch)이 달라 이번 세션의
        // layers 맵에는 애초에 없으니(비어 있으므로) 옛 칸끼리 순번이 같아도 안 섞인다.
        if (!marked && calc) {
          calc.onReturnToStart();
          calc.currentSeq = 0;
          calc.baseSeq = 0;
          calc.layers.clear();
        }
        orphanSkipCount = 0;
        orphanCalcId = null;
        return;
      }

      // ── 새로 시작하는 판단: 이 칸이 어느 계산기 몫인지, 그 계산기 입장에서 순번이 뭔지 ──
      const marked = isOurMarker(state);
      for (const [calcId, calc] of calcs) {
        // 표식이 있는데 다른 계산기 것이면 이 계산기와는 무관하다 — 손대지 않는다(8번 규칙)
        if (marked && state.calcId !== calcId) continue;
        const target = marked ? state.seq : 0;
        if (target === calc.currentSeq) continue; // 이 계산기 입장에선 제자리(변화 없음)

        if (target < calc.currentSeq) {
          // ── 뒤로 ──
          if (isInMemory(calc, target)) {
            // 같은 문서 수명, 짝 있음 — currentSeq부터 target+1까지 차례로 되돌린다
            for (let s = calc.currentSeq; s > target; s--) {
              calc.layers.get(s)?.onBack();
            }
            calc.currentSeq = target;
          } else if (marked) {
            // 표식은 있는데 짝이 없다 — 진짜 짝 없는 칸(다른 문서 수명 등). 표식 없는
            // 칸까지 건너뛰는 연쇄를 시작한다(4번 설명과 동일한 방식)
            orphanSkipCount = 1;
            orphanCalcId = calcId;
            adapter.back();
          } else {
            // 표식이 없다(target은 항상 0) — 이 칸 자체가 "계산기의 진짜 시작 칸"이다.
            // 2026-09-27 검사관 6차 재검증에서 발견: 이제 모드 표식 하나만 쌓이므로(단계
            // 층이 사라졌다), 새로 고침 뒤 바로 이 모드 표식 위에서 부팅되면 baseSeq가
            // 0이 아니라 그 모드 순번(예: 1)이 된다 — 그러면 여기서 isInMemory(0)이
            // "0===baseSeq(1)"로 거짓이 되어 짝 없는 칸으로 오판, 진짜 시작 칸(표식 없는
            // 칸)인데도 더 건너뛰어 블로그까지 나가 버렸다. 표식이 없으면 순번(target)이
            // baseSeq와 같든 다르든 무조건 "여기가 시작"이라고 보고 곧장 멈춘다 — 연쇄를
            // 아예 태우지 않는다(건너뛸 표식 있는 칸이 하나도 없었으므로 건너뛴 게 없다는
            // 뜻이지만, 도착한 곳 자체가 시작 칸이므로 표시를 완전히 초기화한다).
            calc.onReturnToStart();
            calc.currentSeq = 0;
            calc.baseSeq = 0;
            calc.layers.clear();
          }
        } else {
          // ── 앞으로 ──
          if (isInMemory(calc, target)) {
            // 같은 문서 수명, 짝 있음 — currentSeq+1부터 target까지 차례로 다시 한다
            for (let s = calc.currentSeq + 1; s <= target; s++) {
              calc.layers.get(s)?.onForward();
            }
            calc.currentSeq = target;
          } else {
            // 짝 없음 — 건너뛰지 않는다. back()·forward() 둘 다 안 부른다. 그 칸에 머문다.
            //
            // 2026-09-27 검사관 6차 지적(치명) 수리: 여기서 currentSeq만 옮기고 아무 층도
            // 안 남기면, 나중에 이 칸에서 뒤로 갈 때 "0===baseSeq"처럼 우연히 매칭 판정을
            // 받아도 layers.get(target)이 없어 되돌리기가 아예 안 불린다 — 칸(currentSeq)은
            // 움직이는데 화면은 그대로인 사고가 났다. 고침: 이 순번에 "가상 층"을 만들어
            // 둔다. 되돌리기는 onReturnToStart(모드 카드로), 다시 하기는 onForwardPastStart
            // (복원된 진행 화면으로) — 둘 다 이미 계산기에 등록된 진짜 콜백이라 가상 층이
            // 몇 번이고 다시 불려도(옛 칸 구역을 여러 번 오가도) 항상 옳은 화면을 보여준다.
            // 이러면 옛 칸 구역 어디서 뒤로 가든(그 구역의 다른 순번에도 앞으로 갈 때마다
            // 같은 방식으로 가상 층이 쌓인다) 곧장 시작 칸 + 모드 카드로 정확히 이어진다.
            calc.layers.set(target, {
              calcId,
              seq: target,
              onBack: () => calc.onReturnToStart(),
              onForward: () => calc.onForwardPastStart(),
            });
            calc.currentSeq = target;
            calc.onForwardPastStart();
          }
        }
      }
    });
  }

  /** calcs가 비면 리스너 자체를 뗀다(다른 페이지의 뒤로 가기에 전혀 관여하지 않는다) */
  function removeListenerIfIdle() {
    if (calcs.size === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  return {
    /**
     * 앞으로 한 칸 나아갈 때 부른다. onBack(되돌리기)·onForward(다시 하기) 둘 다 받는다.
     * 순번은 언제나 "지금 이 계산기가 서 있는 자리 + 1"이다(새로 고침 뒤에도 그 시점
     * 순번에서 이어진다). 이 계산기보다 앞선(더 큰 순번) 층이 남아 있었다면(뒤로 갔다가
     * 새 칸을 쌓는 경우) 그 "앞으로 스택"은 여기서 비운다 — 브라우저도 실제로 그렇게 한다.
     *
     * 예약된 collapse(pendingCollapse)가 같은 계산기 몫으로 남아 있으면 — "시트가 닫히며
     * 동시에 다음 단계가 완료되는" 경우다. 이땐 실제로는 "교체"라 history를 아예 안
     * 건드리고 그 자리(seq)에 새 되돌리기·다시 하기 함수만 바꿔 끼운다.
     */
    pushBackLayer(calcId: string, onBack: BackHandler, onForward: BackHandler): void {
      if (!adapter) return;
      const calc = calcs.get(calcId);
      if (!calc) return; // activateCalc 안 된 계산기는 쌓을 수 없다(방어적 처리)

      if (pendingCollapse && pendingCollapse.calcId === calcId) {
        const seq = pendingCollapse.seq;
        pendingCollapse = null;
        calc.layers.set(seq, { calcId, seq, onBack, onForward });
        calc.currentSeq = seq; // collapse가 임시로 물려 놨던 자리를 도로 채운다
        return;
      }

      // 새 칸 — 지금 자리보다 순번이 큰 층(옛 "앞으로 스택")은 비운다(브라우저 pushState도
      // 실제로 forward 엔트리를 전부 버린다 — 우리 기억도 똑같이 맞춘다)
      for (const s of [...calc.layers.keys()]) {
        if (s > calc.currentSeq) calc.layers.delete(s);
      }
      const seq = calc.currentSeq + 1;
      adapter.pushState({ calcId, seq, epoch });
      calc.layers.set(seq, { calcId, seq, onBack, onForward });
      calc.currentSeq = seq;
    },

    /**
     * 화면이 스스로(뒤로 가기 버튼이 아니라 다른 방법) 그 상태를 닫을 때 부른다. 지금 자리
     * (currentSeq)의 층을 메모리에서 먼저 빼고 한 칸 물러난 것으로 본 뒤, 마이크로태스크
     * 한 틱을 기다렸다가 아무도 이어받지 않았으면 실제로 history.back()을 불러 브라우저
     * 엔트리 자체를 줄인다. 이때 생기는 popstate는 suppressCount로 표시해 두고 지나간다.
     */
    collapseBackLayer(calcId: string): void {
      if (!adapter) return;
      const calc = calcs.get(calcId);
      if (!calc) return;
      const seq = calc.currentSeq;
      const removed = calc.layers.get(seq);
      if (!removed) return; // 지금 자리에 이 계산기가 쌓은 층이 없다(방어적 처리)
      calc.layers.delete(seq);
      calc.currentSeq = seq - 1; // 일단 한 칸 물러난 것으로 본다(마이크로태스크 전까지 임시)
      pendingCollapse = { calcId, seq };
      queueMicrotask(() => {
        if (pendingCollapse && pendingCollapse.calcId === calcId && pendingCollapse.seq === seq) {
          pendingCollapse = null;
          suppressCount++;
          adapter.back(); // 진짜로 브라우저 엔트리를 줄인다 — currentSeq는 이미 물려 놨다
        }
      });
    },

    /**
     * 계산기 화면이 사라질 때(다른 계산기로 이동, 허브로 나가기 등) 그 계산기 몫을 완전히
     * 걷어낸다. activateCalc가 돌려주는 해지 함수와 같은 일을 한다(중복 호출해도 안전).
     */
    clearBackLayers(calcId: string): void {
      calcs.delete(calcId);
      removeListenerIfIdle();
    },

    /**
     * 이 계산기가 "지금 화면에 떠 있다"고 등록한다 — 이때부터만 popstate 처리기가 이
     * calcId의 짝 없는 칸을 건너뛰거나 방향을 판단한다. 지금 서 있는 칸의 순번을 읽어
     * currentSeq·baseSeq로 삼는다(표식이 있고 이 calcId 것이면 그 순번, 아니면 0).
     *
     * onReturnToStart: 짝 없는 칸을 뒤로 건너뛴 끝에 표식 없는 칸(첫 진입 칸)에 닿으면
     * 부른다 — 모드 카드로.
     * onForwardPastStart: 짝 없는 칸으로 앞으로 가서 멈출 때 부른다 — 복원된 진행 화면으로
     * (모드를 다시 고른 것처럼). 보통 onReturnToStart의 정반대 동작(같은 토글을 되돌림).
     */
    activateCalc(calcId: string, onReturnToStart: BackHandler, onForwardPastStart: BackHandler): () => void {
      const state = adapter?.getState() ?? null;
      const startSeq = isOurMarker(state) && state.calcId === calcId ? state.seq : 0;
      calcs.set(calcId, {
        currentSeq: startSeq,
        baseSeq: startSeq,
        layers: new Map(),
        onReturnToStart,
        onForwardPastStart,
      });
      ensureListener();
      return () => {
        calcs.delete(calcId);
        removeListenerIfIdle();
      };
    },

    /** 시험 전용 — 이 계산기의 지금 상태를 들여다본다 */
    __debugCalc(calcId: string): { currentSeq: number; baseSeq: number; seqs: number[] } | null {
      const calc = calcs.get(calcId);
      if (!calc) return null;
      return { currentSeq: calc.currentSeq, baseSeq: calc.baseSeq, seqs: [...calc.layers.keys()].sort((a, b) => a - b) };
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
