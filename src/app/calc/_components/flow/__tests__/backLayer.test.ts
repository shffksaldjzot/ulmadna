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
