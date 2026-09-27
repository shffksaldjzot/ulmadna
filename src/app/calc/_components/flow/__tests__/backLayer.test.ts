// ──────────────────────────────────────────────
// backLayer.ts 순수 로직 시험 — 진짜 브라우저 window 없이, history를 흉내 낸 가짜
// 객체(FakeHistory)로 createBackStack()의 동작만 확인한다.
//
// 2026-09-27 배포 전 검사관 지적 2번 재현 시험:
//   "시트를 뒤로 가기가 아닌 방법으로 닫으면, 그다음 진짜 뒤로 가기가 직전 단계를
//   건너뛴다." — collapseBackLayer()가 없던 옛 구현(dropBackLayer가 메모리에서만
//   빼고 history.back()을 안 부름)이라면 이 시험이 실패했을 것이다.
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { createBackStack, type HistoryAdapter } from '../backLayer';

/**
 * 진짜 브라우저 history를 최소한으로 흉내 낸 가짜 객체.
 * entries[0]은 "우리가 손대기 전의 원래 페이지"를 뜻하고, index가 지금 위치다.
 * pushState는 현재 위치 뒤를 잘라내고 새 항목을 추가(진짜 브라우저와 동일 동작),
 * back()은 위치를 하나 줄이고 그 자리의 popstate 리스너를 전부 부른다.
 *
 * pathnames: 각 칸의 주소(경로)를 같이 기억한다(5번 재수리 시험용). pushState로 쌓는 칸은
 * 항상 "지금 계산기 페이지" 주소를 그대로 물려받는다(실제로도 우리 pushState는 주소를
 * 안 바꾼다). 진짜 다른 페이지로 이동한 것을 흉내 내려면 simulateNavigateTo()를 쓴다
 * (실제 브라우저에서 링크를 눌러 다른 페이지로 간 것과 같다 — 우리 어댑터의 pushState를
 * 거치지 않는다).
 */
class FakeHistory implements HistoryAdapter {
  entries: unknown[] = [null];
  pathnames: string[] = ['/calc/wallpaper'];
  index = 0;
  private listeners: Array<(state: unknown) => void> = [];

  pushState(state: unknown): void {
    this.entries = this.entries.slice(0, this.index + 1);
    this.pathnames = this.pathnames.slice(0, this.index + 1);
    this.entries.push(state);
    this.pathnames.push(this.pathnames[this.index]); // 주소는 그대로 물려받는다
    this.index++;
  }

  /** 시험 전용 — 진짜 다른 페이지로 이동한 것을 흉내 낸다(주소가 실제로 바뀐다) */
  simulateNavigateTo(pathname: string): void {
    this.entries = this.entries.slice(0, this.index + 1);
    this.pathnames = this.pathnames.slice(0, this.index + 1);
    this.entries.push(null);
    this.pathnames.push(pathname);
    this.index++;
  }

  back(): void {
    if (this.index === 0) return; // 더 갈 곳이 없으면(원래 페이지 바깥) 아무 일도 안 일어난다
    this.index--;
    const state = this.entries[this.index];
    for (const fn of this.listeners) fn(state);
  }

  onPopState(fn: (state: unknown) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  getPathname(): string {
    return this.pathnames[this.index];
  }
}

describe('backLayer — 쌓임 스택 순수 로직', () => {
  it('뒤로 가기를 누르면 스택 맨 위 되돌리기 하나만 실행된다', () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    const calls: string[] = [];

    stack.pushBackLayer('wallpaper', () => calls.push('A'));
    stack.pushBackLayer('wallpaper', () => calls.push('B'));

    history.back(); // 진짜 사용자가 뒤로 가기 1번
    expect(calls).toEqual(['B']);

    history.back(); // 뒤로 가기 2번째
    expect(calls).toEqual(['B', 'A']);
  });

  it(
    '[검사관 지적 2번 재현] 시트를 뒤로 가기가 아닌 방법(제품 선택 등)으로 닫으면, ' +
      '그다음 진짜 뒤로 가기가 정확히 그 이전 단계를 되돌린다(건너뛰지 않는다)',
    async () => {
      const history = new FakeHistory();
      const stack = createBackStack(history);
      const calls: string[] = [];

      // 모드 선택(A) → 제품 시트 열림(B) 순서로 쌓인다
      stack.pushBackLayer('wallpaper', () => calls.push('모드 카드로'));
      stack.pushBackLayer('wallpaper', () => calls.push('시트 닫힘(뒤로 가기로)'));

      // 사용자가 제품을 "선택"해서 시트가 닫힘(그 뒤 곧바로 새 단계가 쌓이지 않는 경우) —
      // 뒤로 가기가 아니라 collapseBackLayer로 정리한다. 실제 history.back()은 마이크로
      // 태스크 한 틱 뒤에 실행되므로(3번 재현 시험 참고) 여기서 한 번 기다려 준다.
      stack.collapseBackLayer('wallpaper');
      await Promise.resolve();
      // 이 순간 B의 되돌리기 함수는 절대 불리면 안 된다(이미 화면이 스스로 닫았으므로)
      expect(calls).toEqual([]);

      // 이제 진짜 뒤로 가기 — B는 이미 걷혔으니 A(모드 카드로)가 실행돼야 한다.
      // 옛 구현(dropBackLayer만 있고 history.back()을 안 부름)이었다면 여기서 브라우저
      // 엔트리가 하나 더 남아 있어서 popstate가 한 번 더 필요했거나, 반대로 A가 아니라
      // 엉뚱한 타이밍에 실행됐을 것이다.
      history.back();
      expect(calls).toEqual(['모드 카드로']);
    },
  );

  it('collapseBackLayer는(아무도 이어받지 않으면) 브라우저 히스토리 엔트리 자체를 줄인다(무반응 칸이 안 남는다)', async () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);

    stack.pushBackLayer('wallpaper', () => {});
    stack.pushBackLayer('wallpaper', () => {});
    expect(history.index).toBe(2);

    stack.collapseBackLayer('wallpaper');
    // 실제 history.back()은 마이크로태스크 한 틱 뒤에 실행된다(아래 경쟁 시험 참고)
    await Promise.resolve();
    expect(history.index).toBe(1);
  });

  it(
    '[실기기 확인 중 발견한 경쟁 재현] 시트가 닫히는 것과 동시에(같은 렌더 안에서) 같은 ' +
      '계산기 몫으로 새 칸이 쌓이면, 실제로는 "교체"이므로 history를 두 번 안 건드린다 — ' +
      'collapseBackLayer 직후 곧바로 pushBackLayer가 오면 브라우저 엔트리 개수가 그대로다',
    async () => {
      const history = new FakeHistory();
      const stack = createBackStack(history);
      const calls: string[] = [];

      stack.pushBackLayer('wallpaper', () => calls.push('모드 카드로')); // A
      stack.pushBackLayer('wallpaper', () => calls.push('시트 닫힘')); // B(시트)
      expect(history.index).toBe(2);

      // 제품을 선택한 순간 — 시트가 닫히며(collapse) 동시에 제품 단계가 완료돼(push) 새
      // 되돌리기가 얹힌다. 이 둘은 같은 동기 실행 구간(같은 이벤트 핸들러) 안에서 벌어진다.
      stack.collapseBackLayer('wallpaper');
      stack.pushBackLayer('wallpaper', () => calls.push('제품 단계 재오픈')); // C(교체)
      await Promise.resolve(); // pendingCollapse가 흡수됐는지 확인하려고 한 틱 기다린다

      // 교체였으므로 history 깊이는 여전히 2(A, C)여야 한다 — 3(A,B,C)이 됐다가 back()으로
      // 2로 줄어드는 게 아니라, 애초에 한 번도 안 건드려야 한다.
      expect(history.index).toBe(2);

      // 뒤로 가기 한 번 — C(제품 단계 재오픈)가 실행돼야 한다(B는 이미 교체돼 사라졌다)
      history.back();
      expect(calls).toEqual(['제품 단계 재오픈']);

      // 뒤로 가기 두 번째 — A(모드 카드로)
      history.back();
      expect(calls).toEqual(['제품 단계 재오픈', '모드 카드로']);
    },
  );

  it(
    '[검사관 지적 3번 재현] 계산기 화면이 사라질 때(clearBackLayers) 그 계산기 몫 스택이 ' +
      '전부 걷혀서, 나중에 뒤로 가기를 눌러도 낡은 되돌리기가 실행되지 않는다',
    () => {
      const history = new FakeHistory();
      const stack = createBackStack(history);
      const calls: string[] = [];

      stack.pushBackLayer('wallpaper', () => calls.push('도배 되돌리기'));
      stack.pushBackLayer('wallpaper', () => calls.push('도배 되돌리기2'));

      // 사용자가 허브로 나가서 도배 계산기가 언마운트됨
      stack.clearBackLayers('wallpaper');
      expect(stack.__debugStack()).toEqual([]);

      // 그 뒤 브라우저 뒤로 가기를 눌러도(엔트리 자체는 남아 있을 수 있다) 아무 되돌리기도
      // 실행되지 않아야 한다 — 실행되면 이미 사라진 계산기의 상태를 조작하려는 사고다
      history.back();
      history.back();
      expect(calls).toEqual([]);
    },
  );

  it(
    '[배포 전 재검수 지적 1번 재현] 새로 고침 뒤(메모리 스택은 비었지만 브라우저 기록엔 ' +
      '옛 칸이 남아 있을 때) 뒤로 가기 한 번이 그 옛 칸들을 전부 건너뛰어 곧장 계산기 ' +
      '이전 페이지로 나간다 — 예전엔 짝 없는 칸마다 무반응이었다',
    () => {
      const history = new FakeHistory();
      // "이전 세션"에서 세 칸을 쌓아 뒀다고 흉내낸다(간단→합지→제품→완료 등) — 이 시점엔
      // 아직 createBackStack을 안 만들었으니 그 칸들을 기억하는 메모리 자체가 없다.
      history.pushState({ calcId: 'wallpaper', seq: 1 });
      history.pushState({ calcId: 'wallpaper', seq: 2 });
      history.pushState({ calcId: 'wallpaper', seq: 3 });
      expect(history.index).toBe(3);

      // 새로 고침 — 메모리 스택은 완전히 새로 만든다(비어 있다). 브라우저 history는 그대로.
      const stack = createBackStack(history);
      expect(stack.__debugStack()).toEqual([]);

      // 사용자가 뒤로 가기를 "한 번"만 누른다
      history.back();

      // 옛 칸 세 개(seq 3·2·1)를 전부 건너뛰어, 표식이 없는 원래 페이지(index 0)까지
      // 곧장 도달해야 한다 — "뒤로 가기 한 번 = 눈에 보이는 변화 한 번"
      expect(history.index).toBe(0);
    },
  );

  it(
    '[실기기 재검증 중 추가 발견 재현] 표식이 없어도 주소가 아직 계산기 페이지 그대로면 ' +
      '건너뛴다(Next.js 라우터 등이 계산기 페이지 안쪽에 만들어 둔 칸) — 그 아래 주소가 ' +
      '실제로 다른 진짜 이전 페이지(허브)에 닿아야 비로소 멈춘다',
    () => {
      const history = new FakeHistory();
      // index0: 진짜 이전 페이지(허브, /calc) — 주소가 계산기와 다르다
      history.pathnames[0] = '/calc';
      // index1: 계산기 페이지를 처음 열 때 생긴, 표식 없는 칸(주소는 계산기 그대로)
      history.simulateNavigateTo('/calc/wallpaper');
      // index2, index3: 우리가 쌓은 표식 있는 칸 두 개
      history.pushState({ calcId: 'wallpaper', seq: 1 });
      history.pushState({ calcId: 'wallpaper', seq: 2 });
      expect(history.index).toBe(3);

      // 새로 고침 흉내 — 메모리 스택은 비어서 시작한다(homePathname은 지금 주소 '/calc/wallpaper'로 잡힌다)
      createBackStack(history);

      // 사용자가 뒤로 가기를 "한 번"만 누른다
      history.back();

      // 표식 있는 칸 두 개 + 표식 없지만 같은 주소인 칸까지 전부 건너뛰어, 주소가 실제로
      // 다른 허브 페이지(index0)에 곧장 닿아야 한다 — "뒤로 가기 한 번 = 눈에 보이는 변화 한 번"
      expect(history.index).toBe(0);
    },
  );

  it('주소가 실제로 다른 진짜 이전 페이지에 닿으면(표식도 없고 계산기 주소도 아니면) 더 건너뛰지 않고 멈춘다', () => {
    const history = new FakeHistory();
    history.pathnames[0] = '/blog/some-post'; // 진짜 다른 페이지(블로그 글)
    history.simulateNavigateTo('/calc/wallpaper'); // index1: 계산기 페이지 도착(표식 없음)
    history.pushState({ calcId: 'wallpaper', seq: 1 }); // index2: 표식 있는 칸

    createBackStack(history);
    history.back();

    // index2(표식) → index1(표식 없지만 같은 주소, 건너뜀) → index0(진짜 다른 페이지, 멈춤)
    expect(history.index).toBe(0);

    // 한 번 더 눌러도(이미 진짜 원래 페이지 바깥이라 더 갈 곳이 없다) 그대로다
    history.back();
    expect(history.index).toBe(0);
  });

  it('짝 없는 옛 칸이 상한(MAX_ORPHAN_SKIP)보다 많아도 무한 반복하지 않고 멈춘다', () => {
    const history = new FakeHistory();
    // 상한을 넉넉히 넘는 40칸을 쌓아 둔다
    for (let i = 1; i <= 40; i++) history.pushState({ calcId: 'wallpaper', seq: i });
    createBackStack(history);

    history.back();

    // 상한(30개)까지만 건너뛰고 멈춰야 한다 — index가 0까지 다 안 내려가고 남아 있어야 한다
    expect(history.index).toBeGreaterThan(0);
    expect(history.index).toBe(40 - 1 - 30);
  });

  it('서로 다른 계산기(calcId) 몫은 clearBackLayers로 섞이지 않는다', () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    const calls: string[] = [];

    stack.pushBackLayer('wallpaper', () => calls.push('도배'));
    stack.pushBackLayer('flooring', () => calls.push('바닥재'));

    stack.clearBackLayers('wallpaper');
    expect(stack.__debugStack().map((l) => l.calcId)).toEqual(['flooring']);

    history.back();
    expect(calls).toEqual(['바닥재']);
  });
});
