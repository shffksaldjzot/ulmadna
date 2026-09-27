// ──────────────────────────────────────────────
// backLayer.ts 순수 로직 시험 — 진짜 브라우저 window 없이, history를 흉내 낸 가짜
// 객체(FakeHistory)로 createBackStack()의 동작만 확인한다.
//
// 2026-09-27 배포 후 치명 회귀(bac688f) 수리에 맞춰 전면 재작성.
// 옛 판(주소 비교로 "우리 페이지 안쪽 칸"을 판정하던 방식)을 전제로 한 시험은 전부 삭제하고,
// 새 규칙(표식 있는 칸만, 지금 활성 계산기일 때만, 리스너는 activateCalc로 붙고 뗀다)에
// 맞춘 시험으로 바꿨다. 이제부터 뒤로 가기를 건너뛰려면 반드시 activateCalc()를 먼저
// 불러야 한다(실제 앱에서도 계산기가 마운트될 때 useFlowBackNav가 이걸 대신 불러 준다).
//
// 작성일: 2026년 09월 27일
// 전면 재작성(치명 회귀 수리): 2026년 09월 27일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { createBackStack, type HistoryAdapter } from '../backLayer';

/**
 * 진짜 브라우저 history를 최소한으로 흉내 낸 가짜 객체.
 * entries[0]은 "우리가 손대기 전의 원래 페이지"를 뜻하고, index가 지금 위치다.
 * pushState는 현재 위치 뒤를 잘라내고 새 항목을 추가(진짜 브라우저와 동일 동작),
 * back()은 위치를 하나 줄이고 그 자리의 popstate 리스너를 전부 부른다.
 */
class FakeHistory implements HistoryAdapter {
  entries: unknown[] = [null];
  index = 0;
  private listeners: Array<(state: unknown) => void> = [];

  pushState(state: unknown): void {
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(state);
    this.index++;
  }

  /** 시험 전용 — 표식 없는 진짜 다른 페이지로 이동한 것을 흉내 낸다(블로그·허브 등) */
  simulateNavigateTo(): void {
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(null);
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
}

describe('backLayer — 쌓임 스택 순수 로직', () => {
  it('뒤로 가기를 누르면 스택 맨 위 되돌리기 하나만 실행된다', () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    stack.activateCalc('wallpaper', () => {});
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
      stack.activateCalc('wallpaper', () => {});
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
      history.back();
      expect(calls).toEqual(['모드 카드로']);
    },
  );

  it('collapseBackLayer는(아무도 이어받지 않으면) 브라우저 히스토리 엔트리 자체를 줄인다(무반응 칸이 안 남는다)', async () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    stack.activateCalc('wallpaper', () => {});

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
      stack.activateCalc('wallpaper', () => {});
      const calls: string[] = [];

      stack.pushBackLayer('wallpaper', () => calls.push('모드 카드로')); // A
      stack.pushBackLayer('wallpaper', () => calls.push('시트 닫힘')); // B(시트)
      expect(history.index).toBe(2);

      // 제품을 선택한 순간 — 시트가 닫히며(collapse) 동시에 제품 단계가 완료돼(push) 새
      // 되돌리기가 얹힌다. 이 둘은 같은 동기 실행 구간(같은 이벤트 핸들러) 안에서 벌어진다.
      stack.collapseBackLayer('wallpaper');
      stack.pushBackLayer('wallpaper', () => calls.push('제품 단계 재오픈')); // C(교체)
      await Promise.resolve(); // pendingCollapse가 흡수됐는지 확인하려고 한 틱 기다린다

      // 교체였으므로 history 깊이는 여전히 2(A, C)여야 한다
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
      stack.activateCalc('wallpaper', () => {});
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

  it('서로 다른 계산기(calcId) 몫은 clearBackLayers로 섞이지 않는다', () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    stack.activateCalc('wallpaper', () => {});
    stack.activateCalc('flooring', () => {});
    const calls: string[] = [];

    stack.pushBackLayer('wallpaper', () => calls.push('도배'));
    stack.pushBackLayer('flooring', () => calls.push('바닥재'));

    stack.clearBackLayers('wallpaper');
    expect(stack.__debugStack().map((l) => l.calcId)).toEqual(['flooring']);

    history.back();
    expect(calls).toEqual(['바닥재']);
  });

  // ── 여기부터 배포 후 치명 회귀(bac688f) 수리에 맞춘 새 시험 ──

  it(
    '[치명 회귀 재현 1] 표식이 전혀 없는 칸(블로그·허브 등 진짜 다른 페이지, 또는 계산기의 ' +
      '첫 진입 칸)은 절대 건너뛰지 않는다 — 주소 비교는 이제 하지 않는다',
    () => {
      const history = new FakeHistory();
      // index0: 블로그 글(표식 없음) — 링크를 눌러 계산기로 들어왔다고 흉내
      history.simulateNavigateTo(); // index1: 계산기 첫 진입 칸(표식 없음, 아직 모드 안 고름)

      const stack = createBackStack(history);
      const calls: string[] = [];
      let returnedToStart = 0;
      stack.activateCalc('wallpaper', () => returnedToStart++);

      // 모드를 고름 → 표식 있는 칸 하나 쌓임(index2)
      stack.pushBackLayer('wallpaper', () => calls.push('모드 카드로'));
      expect(history.index).toBe(2);

      // 뒤로 가기 1번 — 표식 있는 칸(모드 선택)이 스택과 정확히 짝이 맞으므로 정상 처리된다
      history.back();
      expect(calls).toEqual(['모드 카드로']);
      expect(history.index).toBe(1);

      // 뒤로 가기 2번째 — index1(계산기 첫 진입 칸, 표식 없음)에 닿는다. 스택은 비었고
      // orphanSkipCount도 0(방금 정상 처리였다)이므로 "돌아가기" 콜백을 부르면 안 되고,
      // 여기서 그냥 멈춰야 한다(더 건너뛰지 않는다 — 표식이 없으므로).
      history.back();
      expect(history.index).toBe(0);
      expect(returnedToStart).toBe(0);
    },
  );

  it(
    '[치명 회귀 재현 2] 새로 고침(메모리 스택은 비지만 브라우저 기록엔 표식 있는 옛 칸이 ' +
      '남아 있음) 뒤 뒤로 가기 한 번 — 짝 없는 표식 칸들을 전부 건너뛰어 표식 없는 계산기 ' +
      '첫 진입 칸에 닿으면, "첫 화면(모드 카드)으로" 콜백이 정확히 한 번 불린다',
    () => {
      const history = new FakeHistory();
      // index0(기본값)이 "블로그 글"(표식 없음) 역할을 한다
      history.simulateNavigateTo(); // index1: 계산기 첫 진입 칸(표식 없음)
      // "이전 세션"에서 쌓아 둔 표식 칸 세 개(간단→합지→제품 등)
      history.pushState({ calcId: 'wallpaper', seq: 1, epoch: '옛문서' }); // index2
      history.pushState({ calcId: 'wallpaper', seq: 2, epoch: '옛문서' }); // index3
      history.pushState({ calcId: 'wallpaper', seq: 3, epoch: '옛문서' }); // index4
      expect(history.index).toBe(4);

      // 새로 고침 흉내 — 메모리 스택은 완전히 새로 만든다(비어 있다). epoch도 새로 뽑힌다.
      const stack = createBackStack(history);
      let returnedToStart = 0;
      stack.activateCalc('wallpaper', () => returnedToStart++);
      expect(stack.__debugStack()).toEqual([]);

      // 사용자가 뒤로 가기를 "한 번"만 누른다
      history.back();

      // 표식 있는 옛 칸 세 개(seq 3·2·1, 문서 수명이 달라도 calcId가 같으므로 전부 건너뜀)를
      // 지나 표식 없는 계산기 첫 진입 칸(index1)에 닿는다 — "돌아가기" 콜백이 정확히 1번
      expect(history.index).toBe(1);
      expect(returnedToStart).toBe(1);

      // 뒤로 가기 두 번째 — 이번엔 진짜 표식 없는 블로그 칸(index0)에 곧장 닿는다. 방금 막
      // 콜백을 부르며 멈춘 상태이므로 orphanSkipCount는 0으로 되돌아가 있어야 하고, 여기서는
      // 건너뛴 게 하나도 없으므로 콜백이 또 불리면 안 된다.
      history.back();
      expect(history.index).toBe(0);
      expect(returnedToStart).toBe(1); // 그대로 1(추가로 안 불림)
    },
  );

  it(
    '[치명 회귀 재현 3] 짝 없는 칸을 하나도 안 건너뛰고 곧바로 표식 없는 칸에 닿으면(예: ' +
      '공유 링크로 들어와 아무 것도 안 쌓은 세션) "돌아가기" 콜백을 부르지 않는다 — ' +
      '그 칸은 우리와 무관한 진짜 이전 페이지다',
    () => {
      const history = new FakeHistory();
      // index0(기본값)이 "들어오기 전 페이지"(블로그, 표식 없음) 역할을 한다
      history.simulateNavigateTo(); // index1: 계산기 진입(공유 링크로 바로 모든 게 채워진 상태, 아무것도 안 쌓음)

      const stack = createBackStack(history);
      let returnedToStart = 0;
      stack.activateCalc('wallpaper', () => returnedToStart++);

      // 뒤로 가기 한 번 — 표식 없는 칸(블로그)에 곧장 닿는다. 건너뛴 게 없으므로 콜백은 안 불림
      history.back();
      expect(history.index).toBe(0);
      expect(returnedToStart).toBe(0);
    },
  );

  it('[8번 규칙] 다른 계산기(calcId)의 표식이 있는 칸은 건너뛰지 않고 그 자리서 멈춘다', () => {
    const history = new FakeHistory();
    // index0(기본값) = 표식 없음(허브). index1 = flooring 표식(그 계산기는 이미 떠났다).
    // index2 = wallpaper 표식(지금 화면 — 메모리 스택은 새로 만들어 비어 있다고 흉내)
    history.pushState({ calcId: 'flooring', seq: 1, epoch: 'e1' });
    history.pushState({ calcId: 'wallpaper', seq: 1, epoch: 'e1' });
    expect(history.index).toBe(2);

    // 지금은 wallpaper만 화면에 떠 있다(flooring은 이미 떠났다 — activateCalc 안 함)
    const stack = createBackStack(history);
    let returnedToStart = 0;
    stack.activateCalc('wallpaper', () => returnedToStart++);

    history.back();

    // wallpaper 표식(index2, 메모리엔 짝 없음)은 건너뛰려 시도하지만, 그다음 만나는 칸이
    // flooring 표식(index1) — "남의 계산기 몫"이라 여기서 건너뛰지 않고 멈춘다(index=1에 도착)
    expect(history.index).toBe(1);
    // wallpaper의 "돌아가기" 콜백도 불리면 안 된다(표식 없는 칸에 닿은 게 아니므로)
    expect(returnedToStart).toBe(0);
  });

  it('[3번 규칙] 계산기가 언마운트되면(해지 함수 호출) popstate 처리기 자체가 떨어져 다른 페이지의 뒤로 가기에 관여하지 않는다', () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    const deactivate = stack.activateCalc('wallpaper', () => {});
    expect(stack.__hasListener()).toBe(true);

    const calls: string[] = [];
    stack.pushBackLayer('wallpaper', () => calls.push('되돌리기'));

    // 계산기가 언마운트됨(허브로 나감) — clearBackLayers는 useFlowBackNav의 별도 효과가 부르고,
    // 여기서는 activateCalc가 돌려준 해지 함수만 부른다(리스너 해제 확인용)
    stack.clearBackLayers('wallpaper');
    deactivate();
    expect(stack.__hasListener()).toBe(false);

    // 그 뒤(다른 페이지에서) 뒤로 가기가 일어나도 이 스택은 완전히 무관해야 한다
    history.back();
    expect(calls).toEqual([]);
  });

  it('짝 없는 표식 칸이 상한(MAX_ORPHAN_SKIP)보다 많아도 무한 반복하지 않고 멈춘다', () => {
    const history = new FakeHistory();
    // 상한을 넉넉히 넘는 40칸을 쌓아 둔다(전부 같은 calcId 표식)
    for (let i = 1; i <= 40; i++) history.pushState({ calcId: 'wallpaper', seq: i, epoch: '옛문서' });
    const stack = createBackStack(history);
    stack.activateCalc('wallpaper', () => {});

    history.back();

    // 상한(30개)까지만 건너뛰고 멈춰야 한다 — index가 0까지 다 안 내려가고 남아 있어야 한다
    expect(history.index).toBeGreaterThan(0);
    expect(history.index).toBe(40 - 1 - 30);
  });
});
