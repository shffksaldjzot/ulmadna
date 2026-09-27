// ──────────────────────────────────────────────
// backLayer.ts 순수 로직 시험 — 진짜 브라우저 window 없이, history를 흉내 낸 가짜
// 객체(FakeHistory)로 createBackStack()의 동작만 확인한다.
//
// 2026-09-27 검사관 4차 지적(앞으로 가기 지원) 반영 — 전면 재작성.
// pushBackLayer·activateCalc가 이제 onForward·onForwardPastStart도 받는다. 옛 시험(2번
// 인자 API)은 전부 3번 인자로 바꿨고, "뒤로/앞으로 방향 판단·여러 칸 한 번에 이동·앞으로
// 스택 비움·짝 없는 칸 앞으로에서 back()·forward() 0회·새로 고침 뒤 순번 이어짐" 새 시험을
// 추가했다.
//
// 2026-09-27 검사관 5차 지적 반영 — 두 개 추가:
//   (가) 짝 없는 칸을 건너뛰어 시작 칸(baseSeq)에 닿으면 baseSeq도 0으로 되돌려지는지
//       (안 그러면 그 뒤 새로 쌓은 칸에서 뒤로 갈 때 시작 칸을 짝 없는 칸으로 오판해
//       한 칸 더 건너뛰는 치명 버그가 있었다).
//   (나) 시트 칸으로 앞으로 가면 다시 열기(onForward)가 1번만 불리고 새 기록 칸을 안
//       쌓는지, 뒤로·앞으로를 반복해도 층 수가 안 느는지.
//
// 2026-09-27 검사관 7차 지적 반영 — baseSeq·가상 층 개념 자체를 backLayer.ts에서 걷어
// 냈으므로, 그 값을 확인하던 시험들을 손봤다:
//   - __debugCalc가 이제 baseSeq를 안 돌려주므로, 그 필드를 기대하던 모든 toEqual을
//     { currentSeq, seqs }로 줄였다.
//   - 가상 층을 만들던 옛 동작을 확인하던 시험(짝 없는 칸으로 앞으로 가면 seqs에 그
//     칸이 남는지)은 이제 "가상 층을 안 만든다(seqs가 비어 있다)"로 뒤집었다.
//   - "짝 없는 칸 구역에서 앞으로 여러 번 뒤 뒤로"는 이제 중간 옛 칸에서 안 멈추고
//     한 번에 표식 없는 진짜 시작 칸까지 간다 — 그 새 기대값으로 고쳤다(이번 라운드
//     수리의 핵심 목표 그 자체).
//   - 새로 추가: "모드 카드에 다녀온 뒤 시트 칸 앞으로 = 다시 열기 호출"(진짜 층은
//     시작 칸에 닿아도 layers 맵에서 안 지워지고 살아남는지), "짝 없는 칸 구역에서
//     앞으로 여러 칸 간 뒤 뒤로 한 번 = 시작 칸 직행"(중간에 안 멈추는지 전용 확인).
//
// 작성일: 2026년 09월 27일
// 앞으로 가기 지원(전면 재작성): 2026년 09월 27일
// baseSeq 리셋 + 시트 다시 열기 대칭 시험 추가: 2026년 09월 27일
// baseSeq·가상 층 제거 반영 + 새 시험 2개 추가(7차 검증 수리): 2026년 09월 27일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { createBackStack, type HistoryAdapter } from '../backLayer';

/**
 * 진짜 브라우저 history를 최소한으로 흉내 낸 가짜 객체.
 * entries[0]은 "우리가 손대기 전의 원래 페이지"를 뜻하고, index가 지금 위치다.
 * pushState는 현재 위치 뒤를 잘라내고 새 항목을 추가(진짜 브라우저와 동일 동작 — 앞으로
 * 스택도 실제로 사라진다), back()은 위치를 하나 줄이고 그 자리의 popstate 리스너를 전부
 * 부른다. go(delta)는 여러 칸을 "한 번에" 이동한다(진짜 history.go(-2)처럼 popstate가
 * 딱 한 번만 온다 — 중간 칸마다 오지 않는다).
 */
class FakeHistory implements HistoryAdapter {
  entries: unknown[] = [null];
  index = 0;
  backCallCount = 0;
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
    this.backCallCount++;
    if (this.index === 0) return; // 더 갈 곳이 없으면(원래 페이지 바깥) 아무 일도 안 일어난다
    this.index--;
    const state = this.entries[this.index];
    for (const fn of this.listeners) fn(state);
  }

  /** 시험 전용 — 여러 칸을 한 번에 이동한다(음수=뒤로, 양수=앞으로). popstate는 한 번만 */
  go(delta: number): void {
    const newIndex = Math.max(0, Math.min(this.entries.length - 1, this.index + delta));
    if (newIndex === this.index) return;
    this.index = newIndex;
    const state = this.entries[this.index];
    for (const fn of this.listeners) fn(state);
  }

  onPopState(fn: (state: unknown) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  getState(): unknown {
    return this.entries[this.index];
  }
}

describe('backLayer — 뒤로·앞으로 가기 순수 로직', () => {
  it('뒤로 가기를 누르면 스택 맨 위 되돌리기 하나만 실행된다', () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    stack.activateCalc('wallpaper', () => {}, () => {});
    const calls: string[] = [];

    stack.pushBackLayer('wallpaper', () => calls.push('A-back'), () => calls.push('A-forward'));
    stack.pushBackLayer('wallpaper', () => calls.push('B-back'), () => calls.push('B-forward'));

    history.back(); // 진짜 사용자가 뒤로 가기 1번
    expect(calls).toEqual(['B-back']);

    history.back(); // 뒤로 가기 2번째
    expect(calls).toEqual(['B-back', 'A-back']);
  });

  it(
    '[치명 4차 재현] 뒤로 간 뒤 앞으로 가기를 누르면 방향을 스스로 판단해 "다시 하기"를 ' +
      '차례로 실행한다 — 옛 버전은 방향을 안 봐서 짝 없는 칸으로 오판해 모드 카드로 끌려갔다',
    () => {
      const history = new FakeHistory();
      const stack = createBackStack(history);
      stack.activateCalc('wallpaper', () => {}, () => {});
      const calls: string[] = [];

      stack.pushBackLayer('wallpaper', () => calls.push('A-back'), () => calls.push('A-forward'));
      stack.pushBackLayer('wallpaper', () => calls.push('B-back'), () => calls.push('B-forward'));

      history.back();
      history.back();
      expect(calls).toEqual(['B-back', 'A-back']);

      // 이제 앞으로 가기 — A의 다시 하기부터 차례로 실행돼야 한다(모드 카드로 끌려가면 안 됨)
      history.go(1);
      expect(calls).toEqual(['B-back', 'A-back', 'A-forward']);

      history.go(1);
      expect(calls).toEqual(['B-back', 'A-back', 'A-forward', 'B-forward']);

      // 칸 번호도 누른 방향대로 정확히 움직였어야 한다
      expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(2);
    },
  );

  it('history.go(-2)처럼 여러 칸을 한 번에 뒤로 가면, 그 사이 층들의 되돌리기가 순번 순서대로(높은 것부터) 전부 실행된다', () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    stack.activateCalc('wallpaper', () => {}, () => {});
    const calls: string[] = [];

    stack.pushBackLayer('wallpaper', () => calls.push('종류-back'), () => calls.push('종류-forward')); // seq1
    stack.pushBackLayer('wallpaper', () => calls.push('제품-back'), () => calls.push('제품-forward')); // seq2
    stack.pushBackLayer('wallpaper', () => calls.push('면적-back'), () => calls.push('면적-forward')); // seq3
    expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(3);

    // 새로 고침 없이, 한 번에 두 칸 뒤로(실제 history.go(-2)와 같은 상황 — popstate 한 번만 옴)
    history.go(-2);

    // 두 단계가 되돌아간다 — 제품 칸도 면적 칸도 되돌리기가 실행된다(종류 단계가 열림)
    expect(calls).toEqual(['면적-back', '제품-back']);
    expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(1);
    // 이 과정에서 우리가 따로 history.back()을 부르지 않았어야 한다(브라우저가 이미 옮겨 놓음)
    expect(history.backCallCount).toBe(0);
  });

  it('짝 없는 칸(다른 문서 수명 또는 이번 세션에 안 쌓은 순번)으로 앞으로 가면 건너뛰지 않고 그 칸에 머물며, back()·forward()를 우리가 부르지 않는다', () => {
    const history = new FakeHistory();
    // index0(기본값) = 계산기 첫 진입 칸(표식 없음). index1~3 = "이전 세션"에서 쌓아 둔 표식
    history.pushState({ calcId: 'wallpaper', seq: 1, epoch: '옛문서' });
    history.pushState({ calcId: 'wallpaper', seq: 2, epoch: '옛문서' });
    history.pushState({ calcId: 'wallpaper', seq: 3, epoch: '옛문서' });
    // 지금 0번 칸(표식 없음)까지 뒤로 가 있다고 흉내(실제로는 재현 나처럼 뒤로 여러 번 눌러 온 상태)
    history.index = 0;

    const stack = createBackStack(history);
    let returnedToStart = 0;
    let forwardPastStart = 0;
    stack.activateCalc('wallpaper', () => returnedToStart++, () => forwardPastStart++);
    expect(stack.__debugCalc('wallpaper')).toEqual({ currentSeq: 0, seqs: [] });

    // 앞으로 한 번 — index0(currentSeq=0) -> index1(marked seq1, 이번 세션엔 없음 = 짝 없음)
    history.go(1);
    expect(history.backCallCount).toBe(0); // back()도 forward()도(애초에 없음) 안 불렀다
    expect(forwardPastStart).toBe(1); // "복원된 진행 화면으로" 콜백이 불렸다
    expect(returnedToStart).toBe(0); // "모드 카드로"는 안 불렸다(방향이 다르므로)
    expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(1); // 칸 번호는 그대로 이동했다

    // 앞으로 한 번 더 — index1 -> index2(marked seq2, 역시 짝 없음). 화면 변화가 없어도(설계상
    // 허용) 칸 번호는 계속 앞으로 움직여야 하고, 사이트 밖으로 나가거나 뒤로 끌려가면 안 된다
    history.go(1);
    expect(history.backCallCount).toBe(0);
    expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(2);
    expect(history.index).toBe(2); // 브라우저 위치도 앞으로 그대로 진행돼 있다(뒤로 안 끌려감)
  });

  it('새 칸을 쌓으면 그보다 순번이 큰 "앞으로 스택"은 비워진다(브라우저 forward 엔트리가 실제로 사라지는 것과 같다)', () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    stack.activateCalc('wallpaper', () => {}, () => {});
    const calls: string[] = [];

    stack.pushBackLayer('wallpaper', () => calls.push('A-back'), () => calls.push('A-forward')); // seq1
    stack.pushBackLayer('wallpaper', () => calls.push('B-back'), () => calls.push('B-forward')); // seq2
    history.back(); // currentSeq=2->1: 지금 자리(seq2=B)의 되돌리기가 실행된다("B-back")
    expect(calls).toEqual(['B-back']);
    expect(stack.__debugCalc('wallpaper')?.seqs).toEqual([1, 2]); // 층 자체는 안 지워짐(자리만 이동)
    calls.length = 0; // 여기서부터 "새 칸 쌓기"만 따로 확인한다

    // 이 상태(currentSeq=1)에서 새 칸을 쌓는다(예: 종류를 바꿔서 새로 진행) — 옛 B 층은 사라져야 한다
    stack.pushBackLayer('wallpaper', () => calls.push('C-back'), () => calls.push('C-forward')); // seq2 자리 재사용
    expect(stack.__debugCalc('wallpaper')?.seqs).toEqual([1, 2]);
    expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(2);

    // 지금 자리(seq2)는 이미 C다 — 뒤로 가면 옛 B가 아니라 C의 되돌리기가 실행돼야 한다
    history.back();
    expect(calls).toEqual(['C-back']);
    history.go(1);
    expect(calls).toEqual(['C-back', 'C-forward']);
  });

  it('[새로 고침 뒤 순번 이어짐] 계산기가 마운트될 때 지금 서 있는 칸의 순번을 이어받아, 새 칸은 그다음 번호로 쌓인다', () => {
    const history = new FakeHistory();
    // "이전 세션"에서 순번 3까지 쌓아 두고 새로 고침한 상황을 흉내
    history.pushState({ calcId: 'wallpaper', seq: 1, epoch: '옛문서' });
    history.pushState({ calcId: 'wallpaper', seq: 2, epoch: '옛문서' });
    history.pushState({ calcId: 'wallpaper', seq: 3, epoch: '옛문서' });
    expect(history.index).toBe(3);

    // 새로 고침 흉내 — 새 스택 인스턴스, 지금 서 있는 칸(seq3)을 그대로 이어받는다
    const stack = createBackStack(history);
    stack.activateCalc('wallpaper', () => {}, () => {});
    expect(stack.__debugCalc('wallpaper')).toEqual({ currentSeq: 3, seqs: [] });

    // 이 세션에서 새로 쌓으면 seq4부터 시작해야 한다(옛 seq 1·2·3과 안 겹친다)
    stack.pushBackLayer('wallpaper', () => {}, () => {});
    expect(stack.__debugCalc('wallpaper')?.seqs).toEqual([4]);
    expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(4);
  });

  it('[제품 시트] 시트를 열고 뒤로 가기(닫힘) 후 앞으로 가면 시트가 다시 열리지 않고(다시 하기=아무 것도 안 함) 화면은 그대로, 칸만 이동한다', () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    stack.activateCalc('wallpaper', () => {}, () => {});
    const calls: string[] = [];

    // 시트 칸: 되돌리기=닫기, 다시 하기=아무 것도 안 함(지시서 그대로)
    stack.pushBackLayer(
      'wallpaper',
      () => calls.push('시트닫힘'),
      () => {}, // 다시 열지 않는다
    );
    expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(1);

    history.back();
    expect(calls).toEqual(['시트닫힘']);
    expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(0);

    // 앞으로 — 다시 하기가 아무 것도 안 하므로 calls는 그대로여야 한다(시트가 다시 안 열림)
    history.go(1);
    expect(calls).toEqual(['시트닫힘']);
    expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(1);

    // 그 뒤 뒤로 가기가 정상 동작해야 한다
    history.back();
    expect(calls).toEqual(['시트닫힘', '시트닫힘']);
  });

  it(
    '[검사관 지적 2번 재현] 시트를 뒤로 가기가 아닌 방법(제품 선택 등)으로 닫으면, ' +
      '그다음 진짜 뒤로 가기가 정확히 그 이전 단계를 되돌린다(건너뛰지 않는다)',
    async () => {
      const history = new FakeHistory();
      const stack = createBackStack(history);
      stack.activateCalc('wallpaper', () => {}, () => {});
      const calls: string[] = [];

      stack.pushBackLayer('wallpaper', () => calls.push('모드 카드로'), () => calls.push('모드 다시')); // A
      stack.pushBackLayer('wallpaper', () => calls.push('시트 닫힘(뒤로 가기로)'), () => {}); // B(시트)

      stack.collapseBackLayer('wallpaper');
      await Promise.resolve();
      expect(calls).toEqual([]);

      history.back();
      expect(calls).toEqual(['모드 카드로']);
    },
  );

  it('collapseBackLayer는(아무도 이어받지 않으면) 브라우저 히스토리 엔트리 자체를 줄인다(무반응 칸이 안 남는다)', async () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    stack.activateCalc('wallpaper', () => {}, () => {});

    stack.pushBackLayer('wallpaper', () => {}, () => {});
    stack.pushBackLayer('wallpaper', () => {}, () => {});
    expect(history.index).toBe(2);

    stack.collapseBackLayer('wallpaper');
    await Promise.resolve();
    expect(history.index).toBe(1);
    expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(1);
  });

  it(
    '[실기기 확인 중 발견한 경쟁 재현] 시트가 닫히는 것과 동시에 같은 계산기 몫으로 새 칸이 ' +
      '쌓이면, 실제로는 "교체"이므로 history를 두 번 안 건드린다',
    async () => {
      const history = new FakeHistory();
      const stack = createBackStack(history);
      stack.activateCalc('wallpaper', () => {}, () => {});
      const calls: string[] = [];

      stack.pushBackLayer('wallpaper', () => calls.push('모드 카드로'), () => {}); // A
      stack.pushBackLayer('wallpaper', () => calls.push('시트 닫힘'), () => {}); // B(시트)
      expect(history.index).toBe(2);

      stack.collapseBackLayer('wallpaper');
      stack.pushBackLayer('wallpaper', () => calls.push('제품 단계 재오픈'), () => calls.push('제품 단계 다시')); // C(교체)
      await Promise.resolve();

      expect(history.index).toBe(2);

      history.back();
      expect(calls).toEqual(['제품 단계 재오픈']);

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
      stack.activateCalc('wallpaper', () => {}, () => {});
      const calls: string[] = [];

      stack.pushBackLayer('wallpaper', () => calls.push('도배 되돌리기'), () => {});
      stack.pushBackLayer('wallpaper', () => calls.push('도배 되돌리기2'), () => {});

      stack.clearBackLayers('wallpaper');
      expect(stack.__debugCalc('wallpaper')).toBeNull();

      history.back();
      history.back();
      expect(calls).toEqual([]);
    },
  );

  it('서로 다른 계산기(calcId) 몫은 clearBackLayers로 섞이지 않는다', () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    stack.activateCalc('wallpaper', () => {}, () => {});
    stack.activateCalc('flooring', () => {}, () => {});

    stack.pushBackLayer('wallpaper', () => {}, () => {});
    stack.pushBackLayer('flooring', () => {}, () => {});
    expect(stack.__debugCalc('wallpaper')?.seqs).toEqual([1]);
    expect(stack.__debugCalc('flooring')?.seqs).toEqual([1]);

    // wallpaper만 걷어간다 — flooring 몫은 전혀 안 건드려져야 한다
    stack.clearBackLayers('wallpaper');
    expect(stack.__debugCalc('wallpaper')).toBeNull();
    expect(stack.__debugCalc('flooring')?.seqs).toEqual([1]);
    expect(stack.__debugCalc('flooring')?.currentSeq).toBe(1);
  });

  it('표식이 전혀 없는 칸(블로그·허브 등 진짜 다른 페이지, 또는 계산기의 첫 진입 칸)은 절대 건너뛰지 않는다', () => {
    const history = new FakeHistory();
    history.simulateNavigateTo(); // index1: 계산기 첫 진입 칸(표식 없음)

    const stack = createBackStack(history);
    const calls: string[] = [];
    let returnedToStart = 0;
    stack.activateCalc('wallpaper', () => returnedToStart++, () => {});

    stack.pushBackLayer('wallpaper', () => calls.push('모드 카드로'), () => {});
    expect(history.index).toBe(2);

    history.back();
    expect(calls).toEqual(['모드 카드로']);
    expect(history.index).toBe(1);

    // 표식 없는 칸에 곧장 닿았다 — 더 건너뛰지 않고 멈추며, "돌아가기" 콜백도 안 부른다
    history.back();
    expect(history.index).toBe(0);
    expect(returnedToStart).toBe(0);
  });

  it(
    '[치명 회귀 재현] 새로 고침(메모리 스택은 비지만 브라우저 기록엔 표식 있는 옛 칸이 ' +
      '남아 있음) 뒤 뒤로 가기 한 번 — 짝 없는 표식 칸들을 전부 건너뛰어 표식 없는 계산기 ' +
      '첫 진입 칸에 닿으면, "첫 화면(모드 카드)으로" 콜백이 정확히 한 번 불린다',
    () => {
      const history = new FakeHistory();
      history.simulateNavigateTo(); // index1: 계산기 첫 진입 칸(표식 없음)
      history.pushState({ calcId: 'wallpaper', seq: 1, epoch: '옛문서' }); // index2
      history.pushState({ calcId: 'wallpaper', seq: 2, epoch: '옛문서' }); // index3
      history.pushState({ calcId: 'wallpaper', seq: 3, epoch: '옛문서' }); // index4
      expect(history.index).toBe(4);

      const stack = createBackStack(history);
      let returnedToStart = 0;
      stack.activateCalc('wallpaper', () => returnedToStart++, () => {});
      expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(3);

      history.back();

      expect(history.index).toBe(1);
      expect(returnedToStart).toBe(1);

      history.back();
      expect(history.index).toBe(0);
      expect(returnedToStart).toBe(1);
    },
  );

  it('짝 없는 칸을 하나도 안 건너뛰고 곧바로 표식 없는 칸에 닿으면(예: 공유 링크로 들어와 아무 것도 안 쌓은 세션) "돌아가기" 콜백을 부르지 않는다', () => {
    const history = new FakeHistory();
    history.simulateNavigateTo(); // index1: 계산기 진입(공유 링크, 아무것도 안 쌓음)

    const stack = createBackStack(history);
    let returnedToStart = 0;
    stack.activateCalc('wallpaper', () => returnedToStart++, () => {});

    history.back();
    expect(history.index).toBe(0);
    expect(returnedToStart).toBe(0);
  });

  it('[8번 규칙] 다른 계산기(calcId)의 표식이 있는 칸은 건너뛰지 않고 그 자리서 멈춘다', () => {
    const history = new FakeHistory();
    history.pushState({ calcId: 'flooring', seq: 1, epoch: 'e1' }); // index1
    history.pushState({ calcId: 'wallpaper', seq: 1, epoch: 'e1' }); // index2
    expect(history.index).toBe(2);

    const stack = createBackStack(history);
    let returnedToStart = 0;
    stack.activateCalc('wallpaper', () => returnedToStart++, () => {});

    history.back();

    expect(history.index).toBe(1);
    expect(returnedToStart).toBe(0);
  });

  it('계산기가 언마운트되면(해지 함수 호출) popstate 처리기 자체가 떨어져 다른 페이지의 뒤로 가기에 관여하지 않는다', () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    const deactivate = stack.activateCalc('wallpaper', () => {}, () => {});
    expect(stack.__hasListener()).toBe(true);

    const calls: string[] = [];
    stack.pushBackLayer('wallpaper', () => calls.push('되돌리기'), () => {});

    stack.clearBackLayers('wallpaper');
    deactivate();
    expect(stack.__hasListener()).toBe(false);

    history.back();
    expect(calls).toEqual([]);
  });

  it('짝 없는 표식 칸이 상한(MAX_ORPHAN_SKIP)보다 많아도 무한 반복하지 않고 멈춘다(뒤로 방향)', () => {
    const history = new FakeHistory();
    for (let i = 1; i <= 40; i++) history.pushState({ calcId: 'wallpaper', seq: i, epoch: '옛문서' });
    const stack = createBackStack(history);
    stack.activateCalc('wallpaper', () => {}, () => {});

    history.back();

    expect(history.index).toBeGreaterThan(0);
    expect(history.index).toBe(40 - 1 - 30);
  });

  it(
    '[5차 재현 — baseSeq 제거 후에도 유지] 짝 없는 칸을 건너뛰어 시작 칸(표식 없음)에 닿은 ' +
      '뒤, 그 자리에서 새로 쌓은 칸에서 다시 뒤로 가면 시작 칸에서 정확히 멈춘다(한 칸 더 ' +
      '안 건너뛰고 블로그까지 안 밀려남) — 7차 재설계로 baseSeq가 아예 없어져 이 판단 자체가 ' +
      '"표식 없음=항상 시작 칸" 규칙 하나로 단순해졌다',
    () => {
      const history = new FakeHistory();
      history.simulateNavigateTo(); // index1: 계산기 첫 진입 칸(표식 없음)
      history.pushState({ calcId: 'wallpaper', seq: 1, epoch: '옛문서' }); // index2
      history.pushState({ calcId: 'wallpaper', seq: 2, epoch: '옛문서' }); // index3
      history.pushState({ calcId: 'wallpaper', seq: 3, epoch: '옛문서' }); // index4
      expect(history.index).toBe(4);

      // 새로 고침 흉내
      const stack = createBackStack(history);
      let returnedToStart = 0;
      stack.activateCalc('wallpaper', () => returnedToStart++, () => {});
      expect(stack.__debugCalc('wallpaper')).toEqual({ currentSeq: 3, seqs: [] });

      // 뒤로 한 번 — 짝 없는 칸(seq2·1)을 건너뛰어 표식 없는 시작 칸(index1)에 닿는다
      history.back();
      expect(history.index).toBe(1);
      expect(returnedToStart).toBe(1);
      expect(stack.__debugCalc('wallpaper')).toEqual({ currentSeq: 0, seqs: [] });

      // 모드를 다시 고름 — 새 칸(seq1)이 이번 문서 수명으로 쌓인다. 브라우저는 앞쪽에
      // 남아 있던 옛 칸들(index2~4)을 pushState가 실제로 잘라낸다.
      const calls: string[] = [];
      stack.pushBackLayer('wallpaper', () => calls.push('모드 카드로'), () => {});
      expect(history.index).toBe(2);

      // 뒤로 한 번 — 시작 칸(index1, target=0)에 정확히 멈춰야 한다.
      history.back();
      expect(calls).toEqual(['모드 카드로']);
      expect(history.index).toBe(1); // index0(블로그)까지 안 밀려남
      expect(returnedToStart).toBe(1); // 추가로 안 불림(정상 매칭 처리였으므로)
    },
  );

  it('[시트 다시 열기] 시트 층으로 앞으로 가면 다시 열기(onForward)가 정확히 1번 불리고, 그 자체로는 새 기록 칸을 쌓지 않는다', () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    stack.activateCalc('wallpaper', () => {}, () => {});
    let reopenCalls = 0;

    // 시트 칸: 되돌리기=닫기, 다시 하기=다시 열기(2026-09-27 지시 변경 — 뒤로=닫힘과 대칭)
    stack.pushBackLayer(
      'wallpaper',
      () => {},
      () => {
        reopenCalls++;
      },
    );
    expect(stack.__debugCalc('wallpaper')?.seqs).toEqual([1]);

    history.back();
    expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(0);

    history.go(1);
    expect(reopenCalls).toBe(1);
    // 다시 열기 자체는 backLayer.ts가 새 칸을 쌓는 동작이 아니다 — 층은 그대로 하나
    expect(stack.__debugCalc('wallpaper')?.seqs).toEqual([1]);
    expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(1);
  });

  it('[시트 다시 열기] 뒤로·앞으로를 5번 반복해도 기록 칸 수가 늘지 않는다', () => {
    const history = new FakeHistory();
    const stack = createBackStack(history);
    stack.activateCalc('wallpaper', () => {}, () => {});
    stack.pushBackLayer('wallpaper', () => {}, () => {});
    const initialLength = history.entries.length;

    for (let i = 0; i < 5; i++) {
      history.back();
      history.go(1);
    }

    expect(history.entries.length).toBe(initialLength);
    expect(stack.__debugCalc('wallpaper')?.seqs).toEqual([1]);
    expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(1);
  });

  it(
    '[6차 재현 — 가상 층 제거 후에도 유지] 새로 고침 → 뒤로(모드 카드) → 앞으로(짝 없는 옛 ' +
      '칸) → 뒤로 하면 화면이 다시 "모드 카드로" 바뀌어야 한다. 7차 재설계로 "가상 층"을 아예 ' +
      '안 만들게 됐으므로(짝 없는 칸으로 앞으로 가도 layers는 비어 있는 채 유지), 이 자리에서 ' +
      '뒤로 가면 "표식 있고 짝 없음" 판정으로 정상 orphan 연쇄를 타고 표식 없는 시작 칸까지 ' +
      '건너뛰어 도착한다(가상 층이 있던 옛 설계처럼 그 자리에서 멈추지 않는다)',
    () => {
      const history = new FakeHistory();
      history.simulateNavigateTo(); // index1: 계산기 첫 진입 칸(표식 없음)
      history.pushState({ calcId: 'wallpaper', seq: 1, epoch: '옛문서' }); // index2
      history.pushState({ calcId: 'wallpaper', seq: 2, epoch: '옛문서' }); // index3
      history.pushState({ calcId: 'wallpaper', seq: 3, epoch: '옛문서' }); // index4
      expect(history.index).toBe(4);

      const stack = createBackStack(history);
      let returnedToStartCount = 0;
      let forwardPastStartCount = 0;
      stack.activateCalc(
        'wallpaper',
        () => returnedToStartCount++,
        () => forwardPastStartCount++,
      );

      // 새로 고침 → 뒤로(모드 카드) — 짝 없는 옛 칸(seq3·2·1)을 건너뛰어 시작 칸(index1)에 닿는다
      history.back();
      expect(history.index).toBe(1);
      expect(returnedToStartCount).toBe(1);
      expect(stack.__debugCalc('wallpaper')).toEqual({ currentSeq: 0, seqs: [] });

      // 앞으로(짝 없는 옛 칸으로) — index1 -> index2(seq1, 이번 세션엔 없던 순번)
      history.go(1);
      expect(history.index).toBe(2);
      expect(forwardPastStartCount).toBe(1);
      // 가상 층을 이제 안 만든다 — seqs는 계속 비어 있어야 한다(7차 재설계 핵심)
      expect(stack.__debugCalc('wallpaper')?.seqs).toEqual([]);
      expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(1);

      // 뒤로(문제의 그 뒤로) — index2(표식 있고 짝 없음=orphan)에서 시작해, 정상 orphan
      // 연쇄를 타고 index1(표식 없음)까지 건너뛰어 도착한다.
      history.back();
      expect(history.index).toBe(1);
      expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(0);
      // 화면이 실제로 "모드 카드로" 바뀌어야 한다(콜백이 한 번 더 불림)
      expect(returnedToStartCount).toBe(2);
    },
  );

  it(
    '[7차 재설계 핵심 — 짝 없는 칸 구역에서 뒤로는 한 번에 시작 칸까지] 짝 없는 칸 구역 ' +
      '안에서 앞으로를 여러 번 눌러 여러 옛 칸을 지난 뒤, 그 구역 어디서 뒤로 한 번을 눌러도 ' +
      '중간 옛 칸에 안 멈추고 표식 없는 진짜 시작 칸까지 한 번에 건너뛴다(모드 카드가 두 번 ' +
      '이어지던 재현 나 변형의 원인 — 가상 층이 중간에서 "매칭"으로 오판되던 것을 없앴다)',
    () => {
      const history = new FakeHistory();
      history.simulateNavigateTo(); // index1: 계산기 첫 진입 칸(표식 없음)
      history.pushState({ calcId: 'wallpaper', seq: 1, epoch: '옛문서' }); // index2
      history.pushState({ calcId: 'wallpaper', seq: 2, epoch: '옛문서' }); // index3
      history.index = 1; // 새로 고침 뒤 시작 칸에 서 있다고 흉내

      const stack = createBackStack(history);
      let returnedToStartCount = 0;
      stack.activateCalc(
        'wallpaper',
        () => returnedToStartCount++,
        () => {},
      );
      expect(stack.__debugCalc('wallpaper')).toEqual({ currentSeq: 0, seqs: [] });

      // 앞으로 두 번 — 옛 칸 두 개(seq1·seq2)를 차례로 지난다. 이제 가상 층을 안 만드므로
      // seqs는 계속 비어 있다.
      history.go(1); // index2(seq1)
      history.go(1); // index3(seq2)
      expect(stack.__debugCalc('wallpaper')?.seqs).toEqual([]);
      expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(2);

      // 뒤로 한 번 — index3(seq2, 표식 있고 짝 없음=orphan)에서 시작해 orphan 연쇄로
      // index2(seq1, 역시 짝 없음)를 지나 index1(표식 없음, 진짜 시작 칸)까지 한 번에
      // 건너뛴다. 옛 설계(가상 층)는 여기서 index2에 멈춰 "화면 변화 없음" 사고가 났었다.
      history.back();
      expect(returnedToStartCount).toBe(1);
      expect(history.index).toBe(1);
      expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(0);
    },
  );

  it(
    '[표식이 딱 하나뿐일 때] 새로 고침 직후 그 유일한 표식(모드 선택) 칸 위에서 곧장 ' +
      '부팅되면, 뒤로 한 번에 표식 없는 진짜 시작 칸을 만나면 중간에 건너뛸 표식이 하나도 ' +
      '없었어도 그 자리에서 정확히 멈추고 "모드 카드로"가 불려야 한다(더 건너뛰어 블로그까지 ' +
      '나가면 안 된다) — 7차 재설계는 baseSeq 없이 "표식 없음=항상 시작 칸" 규칙 하나로 ' +
      '이걸 자연스럽게 만족한다',
    () => {
      // 2026-09-27 형아 결정(끝낸 단계를 접지 않기)으로 단계 층이 사라져, 이제 계산기가
      // 쌓는 표식은 보통 "모드 선택" 하나뿐이다(제품 시트를 열지 않았다면). 이 상황을 그대로 흉내.
      const history = new FakeHistory();
      history.simulateNavigateTo(); // index1: 계산기 첫 진입 칸(표식 없음)
      history.pushState({ calcId: 'wallpaper', seq: 1, epoch: '옛문서' }); // index2: 모드 선택(유일한 표식)
      expect(history.index).toBe(2);

      // 새로 고침 흉내 — 이 유일한 표식 바로 위에서 부팅된다.
      const stack = createBackStack(history);
      let returnedToStartCount = 0;
      stack.activateCalc('wallpaper', () => returnedToStartCount++, () => {});
      expect(stack.__debugCalc('wallpaper')).toEqual({ currentSeq: 1, seqs: [] });

      // 뒤로 한 번 — index2(seq1)에서 index1(표식 없음, 계산기 첫 진입 칸)로 곧장 간다.
      // 건너뛸 표식 있는 칸이 중간에 하나도 없었다(바로 다음 칸이 표식 없음) — 그래도
      // 여기서 정확히 멈추고 "모드 카드로"가 불려야 한다.
      history.back();
      expect(history.index).toBe(1); // index0(블로그)까지 안 밀려남
      expect(returnedToStartCount).toBe(1);
      expect(stack.__debugCalc('wallpaper')).toEqual({ currentSeq: 0, seqs: [] });
    },
  );

  it(
    '[7차 검사관 요청 — 새 시험 1] 모드 카드에 다녀온 뒤 시트 칸으로 앞으로 가면 다시 열기가 ' +
      '호출된다 — 시트의 진짜 층이 시작 칸에 닿아도 layers 맵에서 안 지워지고 살아남아야 하는 ' +
      '것을 확인한다(이번 라운드 결함의 근본 원인 — "모드 카드에 다녀오면 시트 칸이 죽는다")',
    () => {
      const history = new FakeHistory();
      const stack = createBackStack(history);
      stack.activateCalc('wallpaper', () => {}, () => {});
      const calls: string[] = [];

      // seq1=모드 선택, seq2=제품 시트 — 실제 계산기가 같은 세션에서 실제로 쌓는 두 칸
      stack.pushBackLayer(
        'wallpaper',
        () => calls.push('모드-나가기'),
        () => calls.push('모드-들어가기'),
      );
      stack.pushBackLayer(
        'wallpaper',
        () => calls.push('시트-닫힘'),
        () => calls.push('시트-열림'),
      );
      expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(2);

      // 뒤로 두 번 — 시트 닫힘, 그다음 표식 없는 시작 칸(모드 카드)까지
      history.back();
      history.back();
      expect(calls).toEqual(['시트-닫힘', '모드-나가기']);
      expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(0);
      // 시작 칸에 닿았어도 진짜 층 두 개는 여전히 memory에 남아 있어야 한다(가상 층이
      // 아니라 이번 세션 실제 pushBackLayer로 쌓은 것이므로 — reachStart가 안 지운다)
      expect(stack.__debugCalc('wallpaper')?.seqs).toEqual([1, 2]);

      // 앞으로 두 번 — 모드 화면으로 재진입, 그다음 시트가 "다시 열기"로 정확히 열려야 한다
      history.go(1);
      expect(calls).toEqual(['시트-닫힘', '모드-나가기', '모드-들어가기']);
      history.go(1);
      expect(calls).toEqual(['시트-닫힘', '모드-나가기', '모드-들어가기', '시트-열림']);
      expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(2);
    },
  );

  it(
    '[7차 검사관 요청 — 새 시험 2] 짝 없는 칸 구역에서 앞으로 여러 칸 간 뒤 뒤로 한 번 = ' +
      '시작 칸에 한 번에 도착(중간 옛 칸에서 멈추지 않는다)',
    () => {
      const history = new FakeHistory();
      history.simulateNavigateTo(); // index1: 계산기 첫 진입 칸(표식 없음)
      history.pushState({ calcId: 'wallpaper', seq: 1, epoch: '옛문서' }); // index2
      history.pushState({ calcId: 'wallpaper', seq: 2, epoch: '옛문서' }); // index3
      history.pushState({ calcId: 'wallpaper', seq: 3, epoch: '옛문서' }); // index4
      history.index = 1; // 새로 고침 뒤 표식 없는 시작 칸에 서 있다고 흉내

      const stack = createBackStack(history);
      let returnedToStartCount = 0;
      stack.activateCalc('wallpaper', () => returnedToStartCount++, () => {});

      // 앞으로 세 칸(짝 없는 옛 칸 3개를 전부 지난다)
      history.go(1);
      history.go(1);
      history.go(1);
      expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(3);

      // 뒤로 딱 한 번 — 중간(seq2·seq1)에서 멈추지 않고 표식 없는 시작 칸까지 한 번에 간다
      history.back();
      expect(returnedToStartCount).toBe(1);
      expect(stack.__debugCalc('wallpaper')?.currentSeq).toBe(0);
      expect(history.index).toBe(1);
    },
  );
});
