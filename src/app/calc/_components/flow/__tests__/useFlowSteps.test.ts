// ──────────────────────────────────────────────
// useFlowSteps.ts의 순수 계산 부분(deriveFlowState·applyTouch·applyResetTouched) 시험.
// React 훅 자체(useState 등)는 화면 도구 없이는 못 돌리지만, 실제 판단 로직은 이 세
// 순수 함수 안에 다 있어서 여기만 확실히 맞으면 된다.
//
// 2026-09-27 배포 전 검사관 지적 5번 재현 시험:
//   "벽지 종류를 바꾸면 제품 단계가 저절로 '제품 미정' 완료가 된다."
//   resetTouched가 없던 옛 구현이라면, 종류를 바꿔도 touched[product]가 그대로 true로
//   남아 제품 단계가 계속 "완료"로 보였을 것이다.
//
// 2026-09-27 형아 결정(끝낸 단계를 접지 않기) 반영 — overrideIndex·reopen()·version은
// 순수 함수가 아니라 훅 안의 React 상태였으므로 여기 시험할 게 원래 없었다. 대신 새
// 규칙 두 개를 시험으로 추가했다:
//   (가) "한 번 나타난 단계는 계속 보임" — completeFlags[i]가 true면 activeIndex가 그
//       단계보다 앞이어도(매인 관계로 앞 단계가 미완료로 돌아가도) i번째는 여전히
//       "끝낸 단계"로 판정돼야 한다(StepRow.tsx가 complete만 보고 그리므로).
//   (나) "매인 관계로 앞 단계가 미완료가 돼도 뒤 단계는 그대로 완료로 보인다" — (가)를
//       resetTouched 흐름 전체로 재현한 시험(3단계 완료 → 종류 바꿔 제품만 되돌림).
//
// 2026-09-29 지휘관 전달 — 세 계산기 공통 결함(검사관 발견) 재현 시험 추가:
//   "정확 모드를 끝까지 하고 간단 모드로 돌아오면, 간단 모드의 면적 단계가 손댄 적
//   없는데도 완료로 잘못 보인다." touchedFlags가 순전히 자리 번호(index)로만 손댐을
//   기록하던 옛 구조라면, 두 모드가 같은 자리(예: 2번째 자리)를 서로 다른 뜻(간단
//   "면적" vs 정확 "실측")으로 쓸 때 한쪽 손댐이 다른 쪽에 새어 들어갔다. 이번 수리로
//   손댐을 자리 번호 대신 단계 이름(key)으로 묶어서, 모드가 달라도 같은 key(예: 벽지
//   종류·제품)는 손댐이 이어지고 다른 key(간단 "area" vs 정확 "measure")는 완전히
//   독립되는지 아래에서 확인한다.
//
// 작성일: 2026년 09월 27일
// 끝낸 단계를 접지 않는 결정 반영 — 새 시험 추가: 2026년 09월 27일
// 손댐을 이름(key) 기준으로 바꾸는 수리 반영 — 전면 재작성: 2026년 09월 29일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { applyResetTouched, applyTouch, deriveFlowState, type FlowStepValidity } from '../useFlowSteps';

/** 시험에서 자주 쓰는 "종류·제품·면적" 3단계 정의(도배·바닥재와 같은 모양) */
const STEPS_3: FlowStepValidity[] = [
  { key: 'type', valid: true },
  { key: 'product', valid: true },
  { key: 'area', valid: true },
];

describe('deriveFlowState — 완료 판정·현재 단계 계산(이름 기준)', () => {
  it('아무것도 안 손대면 0번째가 현재 단계다', () => {
    const steps: FlowStepValidity[] = [
      { key: 'type', valid: false },
      { key: 'product', valid: true },
      { key: 'area', valid: true },
    ];
    const r = deriveFlowState(steps, {});
    expect(r.activeIndex).toBe(0);
    expect(r.completeFlags).toEqual([false, false, false]);
    expect(r.allDone).toBe(false);
  });

  it('손댔지만 값이 무효하면 완료로 안 친다(touched && valid 둘 다 필요)', () => {
    const steps: FlowStepValidity[] = [
      { key: 'type', valid: false },
      { key: 'product', valid: true },
      { key: 'area', valid: true },
    ];
    const r = deriveFlowState(steps, { type: true, product: true, area: true });
    expect(r.completeFlags[0]).toBe(false); // valid가 false라 touched여도 미완료
    expect(r.activeIndex).toBe(0);
  });

  it('전부 손대고 유효하면 activeIndex가 배열 길이(=전부 끝)가 된다', () => {
    const r = deriveFlowState(STEPS_3, { type: true, product: true, area: true });
    expect(r.activeIndex).toBe(3);
    expect(r.allDone).toBe(true);
  });

  it('touchedMap에 없는 key는 손 안 댐(false)으로 본다', () => {
    const r = deriveFlowState(STEPS_3, { type: true }); // product·area는 아예 없음
    expect(r.completeFlags).toEqual([true, false, false]);
    expect(r.activeIndex).toBe(1);
  });
});

describe('applyTouch — 손댐 표시(이름 기준, 한 방향으로만)', () => {
  it('그 key를 true로 표시한 새 사전을 돌려준다', () => {
    const next = applyTouch({}, 'product');
    expect(next).toEqual({ product: true });
  });

  it('이미 true면 같은 참조를 그대로 돌려준다(불필요한 리렌더 방지)', () => {
    const prev = { product: true };
    const next = applyTouch(prev, 'product');
    expect(next).toBe(prev);
  });

  it('다른 key는 그대로 두고 새 key만 추가한다', () => {
    const prev = { type: true };
    const next = applyTouch(prev, 'area');
    expect(next).toEqual({ type: true, area: true });
    expect(prev).toEqual({ type: true }); // 원본은 안 바뀜(불변)
  });
});

describe('applyResetTouched — 매인 관계 되돌리기(이름 기준)', () => {
  it('지정한 key들만 지우고 나머지는 그대로 둔다', () => {
    const next = applyResetTouched({ type: true, product: true, area: true }, ['product']);
    expect(next).toEqual({ type: true, area: true });
  });

  it('지울 게 없으면(이미 없거나 빈 배열) 같은 참조를 그대로 돌려준다', () => {
    const prev = { type: true, area: true };
    expect(applyResetTouched(prev, ['product'])).toBe(prev); // product는 애초에 없었다
    expect(applyResetTouched(prev, [])).toBe(prev);
  });

  it(
    '[검사관 지적 5번 재현] 벽지 종류(type)를 바꿔 제품(product) 손댐을 되돌리면, ' +
      '제품 단계가 다시 "현재 단계"로 열린다(저절로 완료된 채 남지 않는다)',
    () => {
      // 사용자가 종류 → 제품(아직 안 정했어요) → 면적까지 다 손댄 상태를 흉내낸다
      let touched: Record<string, boolean> = { type: true, product: true, area: true };
      let r = deriveFlowState(STEPS_3, touched);
      expect(r.allDone).toBe(true); // 처음엔 3단계 다 끝난 상태

      // 이제 종류를 "실제로" 바꾼다 — 매인 관계로 제품 손댐을 되돌린다
      touched = applyResetTouched(touched, ['product']);
      r = deriveFlowState(STEPS_3, touched);

      // 제품 단계가 다시 미완료가 되고, 현재 단계가 1번(제품)으로 돌아와야 한다.
      expect(touched.product).toBeUndefined();
      expect(r.completeFlags[1]).toBe(false);
      expect(r.activeIndex).toBe(1);
      expect(r.allDone).toBe(false);
    },
  );
});

describe(
  '[2026-09-29 지휘관 전달] 모드 전환 시 손댐이 자리 번호가 아니라 단계 이름(key)으로 갈린다 — ' +
    '정확 모드를 끝내고 간단 모드로 돌아오면 간단 모드의 면적 단계는 손 안 댄 채로 남는다',
  () => {
    it('정확 모드(측정·measure)를 끝까지 손댄 뒤 간단 모드로 오면, 간단 모드의 area는 여전히 미완료다', () => {
      // 종류·제품은 두 모드가 공유하는 key. "실측"(정확 모드 3단계)만 따로 손댔다 —
      // 정확 모드 화면에서 실제로 일어나는 일 그대로.
      const touched: Record<string, boolean> = { type: true, product: true, measure: true };

      // 정확 모드 화면(3단계 key가 measure)에서 보면 전부 끝난 상태다
      const preciseSteps: FlowStepValidity[] = [
        { key: 'type', valid: true },
        { key: 'product', valid: true },
        { key: 'measure', valid: true },
      ];
      const preciseState = deriveFlowState(preciseSteps, touched);
      expect(preciseState.allDone).toBe(true);

      // 이제 간단 모드로 전환한다 — 3단계 key가 area로 바뀐다(폼의 기본값 34평이 있어서
      // valid는 true지만, touched에 'area'가 없으므로 완료로 치면 안 된다)
      const simpleSteps: FlowStepValidity[] = [
        { key: 'type', valid: true },
        { key: 'product', valid: true },
        { key: 'area', valid: true }, // 폼 기본값(34평)이 있어 valid=true — 하지만 touched는 없다
      ];
      const simpleState = deriveFlowState(simpleSteps, touched);

      // 옛 버그였다면(자리 번호만 봤다면) index 2가 true라서 완료로 잘못 보였을 것이다.
      // 이름 기준이면 'area'라는 key 자체가 touched에 없어서 정확히 미완료로 남는다.
      expect(simpleState.completeFlags).toEqual([true, true, false]);
      expect(simpleState.activeIndex).toBe(2); // 면적 단계가 "지금 할 단계"(강조 카드)로 보여야 한다
      expect(simpleState.allDone).toBe(false); // allDone=false → 결과 공유 버튼이 숨어야 한다
    });

    it('반대 방향도 같다 — 간단 모드를 끝내고 정확 모드로 가면 measure는 미완료로 남는다', () => {
      const touched: Record<string, boolean> = { type: true, product: true, area: true };

      const preciseSteps: FlowStepValidity[] = [
        { key: 'type', valid: true },
        { key: 'product', valid: true },
        { key: 'measure', valid: false }, // 정확 모드 실측을 아직 아무것도 안 넣음
      ];
      const preciseState = deriveFlowState(preciseSteps, touched);
      expect(preciseState.completeFlags).toEqual([true, true, false]);
      expect(preciseState.activeIndex).toBe(2);
      expect(preciseState.allDone).toBe(false);
    });

    it('공유되는 key(종류·제품)는 모드를 넘나들어도 손댐이 그대로 이어진다', () => {
      // 정확 모드에서 종류·제품만 손대고 실측은 아직 안 함
      const touched: Record<string, boolean> = { type: true, product: true };
      const simpleSteps: FlowStepValidity[] = [
        { key: 'type', valid: true },
        { key: 'product', valid: true },
        { key: 'area', valid: true },
      ];
      const r = deriveFlowState(simpleSteps, touched);
      // 종류·제품은 그대로 완료로 보인다(모드 전환과 무관) — area만 새로 손대야 한다
      expect(r.completeFlags).toEqual([true, true, false]);
      expect(r.activeIndex).toBe(2);
    });
  },
);

describe('[형아 결정] 한 번 나타난(완료된) 단계는 activeIndex 위치와 상관없이 계속 "끝낸 단계"로 보인다', () => {
  it(
    '[가] 뒤 단계(area)가 완료된 채로 앞 단계(product)가 매인 관계로 미완료가 돼도, ' +
      'area의 completeFlags는 그대로 true다 — StepRow.tsx는 이 값만 보고 "끝낸 단계"로 그린다',
    () => {
      // 종류·제품·면적 세 단계를 전부 끝낸 상태에서 시작한다
      let touched: Record<string, boolean> = { type: true, product: true, area: true };
      let r = deriveFlowState(STEPS_3, touched);
      expect(r.completeFlags).toEqual([true, true, true]);
      expect(r.activeIndex).toBe(3); // 전부 끝(강조 카드가 없다)

      // 종류를 실제로 바꿔서 매인 관계로 제품만 미완료로 되돌린다 — 면적은 손 안 댐이
      // 아니라 "이미 손댔고 값도 그대로 유효"하므로 안 건드린다
      touched = applyResetTouched(touched, ['product']);
      r = deriveFlowState(STEPS_3, touched);

      // 제품이 "지금 할 단계"(activeIndex)가 되고, 그 뒤에 있는 면적은 activeIndex보다
      // 뒤에 있지만(2 > 1) completeFlags[2]는 여전히 true — "끝낸 단계"로 계속 펼쳐 보여야 한다
      expect(r.activeIndex).toBe(1);
      expect(r.completeFlags[0]).toBe(true); // 종류는 새로 골라서 여전히 완료
      expect(r.completeFlags[1]).toBe(false); // 제품이 지금 할 단계
      expect(r.completeFlags[2]).toBe(true); // 면적은 그대로 "끝낸 단계"(숨겨지지 않는다)
    },
  );

  it(
    '[나] 3단계까지 끝낸 뒤 종류를 바꿔 제품이 지워지는 전체 흐름 — 면적 값은 유지된 채 ' +
      '"끝낸 단계"로 남고, 제품만 강조 카드로 돌아온다(형아가 요구한 실제 시나리오 그대로)',
    () => {
      const touchedAfter3Steps: Record<string, boolean> = { type: true, product: true, area: true };
      const beforeChange = deriveFlowState(STEPS_3, touchedAfter3Steps);
      expect(beforeChange.allDone).toBe(true);

      // "1단계에서 종류를 바로 바꿈" — 제품의 손댐만 되돌리고, 면적의 손댐은 그대로
      const touchedAfterTypeChange = applyResetTouched(touchedAfter3Steps, ['product']);
      const afterChange = deriveFlowState(STEPS_3, touchedAfterTypeChange);

      expect(afterChange.activeIndex).toBe(1); // "제품이 지워지고 2단계가 강조 카드로"
      expect(afterChange.completeFlags).toEqual([true, false, true]); // "3단계는 그대로"(면적값 유지)
      expect(afterChange.allDone).toBe(false);
    },
  );
});
