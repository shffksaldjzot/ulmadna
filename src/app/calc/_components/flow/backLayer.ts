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
// 6) **앞으로 가기가 뒤로 가기와 구분이 안 됐다** — 표식의 순번(seq)으로 방향을 스스로
//    판단하도록 전면 재설계했다. 계산기마다 "지금 서 있는 칸의 순번"(currentSeq)을
//    기억하고, popstate가 오면 도착한 칸의 순번(target — 표식 있으면 그 순번, 없으면
//    0)과 비교해 뒤로/앞으로를 정한다. 각 칸(층)은 되돌리기(onBack)·다시 하기(onForward)
//    둘 다 갖는다.
//
// 7) 시트 칸의 onForward가 "다시 안 연다"였던 지시가 "다시 연다"(뒤로=닫힘과 대칭)로
//    바뀌었다.
//
// 8) (2026-09-27 검사관 7차 지적 — 이번 수리로 전면 재설계) 6~7번까지의 판을 "baseSeq"
//    (계산기가 붙은 순간의 순번을 따로 기억)와 "가상 층"(짝 없는 칸으로 앞으로 가서
//    멈출 때 그 순번에 onReturnToStart/onForwardPastStart를 그대로 등록)으로 고쳐
//    왔는데, 이 둘이 새로운 사고 두 가지를 냈다:
//
//    (가) 모드 카드에 다녀오면 시트 칸이 죽는다. 모드 카드로 가면 단계 화면 전체가
//        사라지며 시트를 가진 부품(PaperPicker)도 같이 사라진다. 그 부품 인스턴스
//        안에서 만든 onReopen 클로저(그 인스턴스의 useState 설정 함수를 가리킴)는
//        부품이 새로 열려도(모드를 다시 골라 화면이 다시 생겨도) 이미 죽은 옛 인스턴스를
//        가리킨 채로 backLayer.ts의 층에 남아 있어서, 불러도 아무 일이 안 났다.
//        → 이 파일 자체의 문제가 아니라 부르는 쪽(WallpaperCalculator)의 문제였다.
//        시트 열림 상태를 계산기(최상위, 모드가 바뀌어도 안 사라지는 부품)로 올리고,
//        push/collapse도 최상위에서 안정적으로 호출하게 고쳤다(아래 "공용 규칙" 참고,
//        backLayer.ts 자체는 안 바뀐다 — 부르는 쪽의 책임이었다).
//
//    (나) 짝 없는 칸 구역에서 앞으로 가기로 여러 칸을 지난 뒤 뒤로 가면, 시작 칸까지
//        한 번에 안 가고 "가상 층"이 있던 중간 옛 칸에서 멈춰 버렸다. 원인: 가상 층을
//        layers 맵에 "진짜 층과 똑같이" 넣어 뒀더니, 그 순번으로 뒤로 갈 때
//        isInMemory가 "짝 있음(매칭)"으로 오판해 "그 자리까지만" 걷는 걸어가기를
//        멈췄다 — 원래는 표식 없는 진짜 시작 칸까지 계속 건너뛰어야 하는데.
//
//    고침(baseSeq·가상 층을 걷어내고 훨씬 단순한 규칙으로 교체):
//      - **표식이 없는 칸(target은 정의상 늘 0)에 닿으면, 지금 순번이 얼마든 무조건
//        "진짜 시작 칸"이다.** 그 사이(currentSeq부터 1까지) 실제로 쌓아 둔 층이
//        있으면(같은 문서 수명에서 정상적으로 눌러 온 경우) 그 되돌리기를 순번 순서대로
//        먼저 불러 값이 단계별로 풀리는 것처럼 보이게 하고, 마지막엔 항상
//        onReturnToStart를 직접 불러 마무리한다 — 중간에 진짜 층이 없는 구간(짝 없는
//        칸 구역)이 있어도 화면이 반드시 모드 카드로 바뀐다.
//      - **표식은 있는데 짝(층)이 없으면** — 다른 문서 수명의 orphan이다. 기존처럼
//        history.back()으로 건너뛰는 연쇄를 시작한다(표식 없는 칸을 만날 때까지, 위
//        규칙으로 이어진다).
//      - 앞으로 가서 짝 없는 칸(표식은 있는데 이번 세션에 안 쌓은 순번)에 멈출 때는
//        이제 "가상 층"을 안 만든다 — 그냥 currentSeq만 옮기고 onForwardPastStart만
//        부른다. 나중에 뒤로 갈 때는 위 두 규칙(표식 있고 짝 있음=매칭, 표식 있고 짝
//        없음=orphan 연쇄, 표식 없음=시작 칸 직행)만으로 항상 올바르게 처리된다 —
//        가상 층이 없어도 표식 있는 자리는 그 자체로 "짝 없음"이 정확히 판정되어
//        orphan 연쇄를 타고, 그 연쇄는 표식 없는 진짜 시작 칸에 닿을 때까지 멈추지
//        않는다(중간에 안 멈춘다 — 이게 이번 수리의 핵심).
//      - 이제 "baseSeq"라는 값 자체가 필요 없다(표식 없음=시작 칸 규칙이 순번 값과
//        무관하게 항상 적용되므로) — CalcTrack에서 완전히 뺐다.
//      - **표식 없는 칸까지 걸어가며 실제 층을 하나라도 만나 되돌렸다면, onReturnToStart를
//        또 부르지 않는다.** 모드 층의 되돌리기 자체가 이미 onExitToModePicker와 똑같은
//        일을 하므로(같은 함수), 그 위에 onReturnToStart까지 부르면 같은 화면 전환이
//        중복 신호된다 — 시험으로 이 정확한 횟수까지 확인한다(표식이 전혀 없는 칸 시험).
//        실제 층을 하나도 못 만났을 때만(전부 짝 없는 구간이었거나 애초에 0이었을 때)
//        onReturnToStart를 직접 불러 화면 전환을 신호한다(reachStart 함수 주석 참고).
//      - **시작 칸에 닿아도 layers 맵 자체는 안 비운다(중요).** 처음엔 시작 칸 도달 때
//        마다 layers.clear()로 통째로 비웠는데, 그러면 (가)를 고치려고 최상위로 올린
//        "진짜" 시트 층까지 같이 지워져서, 그 뒤 다시 앞으로 가면 그 자리가 "짝 없는
//        칸"으로 오판되어 시트의 onForward(다시 열기) 대신 뭉뚱그린 onForwardPastStart만
//        불리는 새 사고가 났다(재현 가 시나리오). layers는 "진짜 브라우저의 앞으로
//        스택"을 흉내 낸 것이므로, 진짜 브라우저도 뒤로 갔다가 다시 앞으로 가면 그 칸이
//        그대로 복원되듯 우리도 그래야 한다 — pushBackLayer가 "진짜 새 칸을 쌓을 때"
//        하는 자연스러운 앞으로 스택 truncation(그 함수 주석 참고)만으로 충분히
//        정리된다.
//
// 시험하기 쉽게 만들려고 "진짜 브라우저 history"에 직접 의존하지 않고, createBackStack()이
// history 흉내 객체(HistoryAdapter)를 주입받는 구조로 뺐다.
//
// 작성일: 2026년 09월 27일
// 앞으로 가기 지원(순번 기반 방향 판단으로 전면 재설계): 2026년 09월 27일
// baseSeq·가상 층을 걷어내고 "표식 없음=항상 시작 칸"으로 단순화 + 시작 칸에서도 layers를
// 안 비우게(진짜 층 보존) 수정(7차 검증 수리): 2026년 09월 27일
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
  /** 이번 세션(마운트~언마운트)에 실제로 쌓은 층들 — seq를 키로 바로 찾는다 */
  layers: Map<number, Layer>;
  /** 짝 없는 칸을 뒤로 건너뛴 끝에(또는 곧장) 표식 없는 칸(첫 진입 칸)에 닿으면 부른다 — "모드 카드로" */
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

  /** 이 순번이 "이번 세션에 실제로 쌓은 층"으로 있는지 — 짝이 있는지 판정(0은 여기서 안 씀) */
  function isInMemory(calc: CalcTrack, seq: number): boolean {
    return calc.layers.has(seq);
  }

  /**
   * 표식 없는 칸(target=0)에 닿았을 때 부른다 — 순번이 얼마였든 무조건 "진짜 시작 칸"
   * 이다(7차 재설계 핵심). 중간에 실제로 쌓아 둔 층이 있으면(예: history.go(-3)처럼
   * 여러 칸을 한 번에 건너와도) 그 되돌리기를 순번 순서대로 먼저 불러 값이 단계별로
   * 풀리는 것처럼 보이게 하고, 마지막엔 항상 onReturnToStart를 직접 불러 마무리한다 —
   * 짝 없는 칸 구역을 지나왔어도(그 구간엔 진짜 층이 없으니 그냥 건너뛴다) 화면이
   * 반드시 모드 카드로 바뀐다.
   *
   * **layers는 여기서 비우지 않는다.** 처음엔(설계 초안) 시작 칸에 닿으면 이 세션이
   * 쌓아 둔 층을 통째로 지웠는데, 그러면 모드 제품 시트처럼 "진짜로 쌓아 둔 층"까지
   * 같이 지워져서, 그 뒤 다시 앞으로 가면 그 자리들이 전부 "짝 없는 칸"(orphan)으로
   * 오판되어 시트 칸의 onForward(다시 열기)가 아니라 매번 똑같은 뭉뚱그린
   * onForwardPastStart만 불리는 새 사고로 이어졌다(재현 가 시나리오 실패). layers는
   * 실제 브라우저의 "앞으로 스택"을 그대로 흉내 낸 것이라, 진짜 브라우저도 뒤로 갔다가
   * 다시 앞으로 가면 그 칸들이 그대로 복원된다 — 우리도 똑같이 둬야 한다. 이 층들은
   * pushBackLayer가 "진짜 새 칸을 쌓을 때"(currentSeq보다 큰 옛 층을 지우는 자연스러운
   * 앞으로 스택 truncation, 위 pushBackLayer 주석 참고)만 지워지면 충분하다 — 그게 실제
   * 브라우저 pushState 동작과 정확히 같다.
   */
  function reachStart(calc: CalcTrack): void {
    // 실제로 쌓아 둔 층을 하나라도 만나 되돌리기를 불렀는지 — 하나라도 불렀으면 그
    // 되돌리기 자체가 이미 "모드 카드로"와 똑같은 일을 하므로(모드 층의 onBack은
    // onExitToModePicker 그 자체다), onReturnToStart를 또 부르면 같은 화면 전환이
    // 중복으로 신호되는 것이다 — 아래에서 "하나도 없을 때만" 부르도록 가린다.
    let calledRealLayer = false;
    for (let s = calc.currentSeq; s > 0; s--) {
      const layer = calc.layers.get(s);
      if (layer) {
        calledRealLayer = true;
        layer.onBack();
      }
    }
    if (!calledRealLayer) {
      // 실제로 쌓인 층이 하나도 없었다(전부 짝 없는 칸을 건너뛰어 왔거나, 애초에 순번이
      // 0이었다) — 아무도 "모드 카드로" 전환을 신호하지 않았으므로 여기서 직접 부른다.
      calc.onReturnToStart();
    }
    calc.currentSeq = 0;
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
        if (!marked && calc) {
          reachStart(calc);
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
          if (!marked) {
            // 표식이 없다(target은 항상 0) — 순번이 얼마였든 무조건 "진짜 시작 칸"이다
            // (7차 재설계 핵심 — baseSeq 같은 값과 비교하지 않는다. 짝 없는 칸 구역을
            // 여러 칸 지나왔어도 여기서 반드시 멈추고 모드 카드로 바뀐다).
            reachStart(calc);
          } else if (isInMemory(calc, target)) {
            // 표식 있고 짝(층)도 있음 — 같은 문서 수명. currentSeq부터 target+1까지
            // 차례로 되돌린다.
            for (let s = calc.currentSeq; s > target; s--) {
              calc.layers.get(s)?.onBack();
            }
            calc.currentSeq = target;
          } else {
            // 표식은 있는데 짝이 없다 — 다른 문서 수명의 orphan. 표식 없는 칸까지
            // 건너뛰는 연쇄를 시작한다(reachStart가 그 도착점에서 마무리한다).
            orphanSkipCount = 1;
            orphanCalcId = calcId;
            adapter.back();
          }
        } else {
          // ── 앞으로 ── (target은 표식이 있을 때만 currentSeq보다 커질 수 있다)
          if (isInMemory(calc, target)) {
            // 같은 문서 수명, 짝 있음 — currentSeq+1부터 target까지 차례로 다시 한다
            for (let s = calc.currentSeq + 1; s <= target; s++) {
              calc.layers.get(s)?.onForward();
            }
            calc.currentSeq = target;
          } else {
            // 짝 없음 — 건너뛰지 않는다. back()·forward() 둘 다 안 부른다. 그 칸에 머물고
            // "복원된 진행 화면으로"만 부른다. 가상 층은 이제 안 만든다(7차 재설계 —
            // 가상 층이 있으면 나중에 뒤로 갈 때 그 자리를 "짝 있음"으로 오판해 시작 칸
            // 전에 멈춰 버렸다). 다음에 뒤로 가면 이 자리는 여전히 "표식 있고 짝 없음"
            // 이라 정상적으로 orphan 연쇄를 타고, 그 연쇄는 표식 없는 진짜 시작 칸에
            // 닿을 때까지 멈추지 않는다 — 중간에 서지 않는다.
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
     * currentSeq로 삼는다(표식이 있고 이 calcId 것이면 그 순번, 아니면 0).
     *
     * onReturnToStart: 짝 없는 칸을 뒤로 건너뛴 끝에(또는 표식 없는 칸에 곧장) 닿으면
     * 부른다 — 모드 카드로.
     * onForwardPastStart: 짝 없는 칸으로 앞으로 가서 멈출 때 부른다 — 복원된 진행 화면으로
     * (모드를 다시 고른 것처럼). 보통 onReturnToStart의 정반대 동작(같은 토글을 되돌림).
     */
    activateCalc(calcId: string, onReturnToStart: BackHandler, onForwardPastStart: BackHandler): () => void {
      const state = adapter?.getState() ?? null;
      const startSeq = isOurMarker(state) && state.calcId === calcId ? state.seq : 0;
      calcs.set(calcId, {
        currentSeq: startSeq,
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
    __debugCalc(calcId: string): { currentSeq: number; seqs: number[] } | null {
      const calc = calcs.get(calcId);
      if (!calc) return null;
      return { currentSeq: calc.currentSeq, seqs: [...calc.layers.keys()].sort((a, b) => a - b) };
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
