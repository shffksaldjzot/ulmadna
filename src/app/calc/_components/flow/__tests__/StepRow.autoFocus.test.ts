// ──────────────────────────────────────────────
// StepRow.tsx의 자동 초점 이동 판단(shouldAutoFocusStep) 순수 함수 시험.
//
// 2026-09-30 지휘관 긴급 전달(치명 1) — 라이브에서 미장 간단 면적 칸에 "30"을 치면
// "3"만 들어가고 초점이 다음 단계(두께 칩)로 넘어가 버렸다. 숫자 하나만 쳐도 그 값이
// 이미 "유효"해서 단계가 즉시 완료되고, 다음 단계가 처음 나타나면서 옛 규칙(무조건
// 자동 초점)이 지금 타이핑 중인 칸에서 초점을 뺏어 갔다.
//
// 여기서 확인하는 것 — 입력 방식(키보드/그 외) × 지금 초점(입력 칸/그 외) × 단계 전이
// (처음 나타남/다시 지금 할 단계) 세 축을 모두 조합해, "셋 다 만족할 때만 옮긴다"를 검증.
//
// 작성일: 2026년 09월 30일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { shouldAutoFocusStep, isFocusInTextEntry } from '../StepRow';

describe('shouldAutoFocusStep — 세 조건을 모두 만족할 때만 자동 초점 이동', () => {
  it('[정상 경로] 키보드 + 입력 칸 아님 + 처음 나타남 → 옮긴다', () => {
    expect(
      shouldAutoFocusStep({ modality: 'keyboard', focusIsInTextEntry: false, appearance: 'first-appearance' }),
    ).toBe(true);
  });

  it('[검사관 재현 A·B — 핵심] 키보드 + 지금 초점이 입력 칸 안(타이핑 중) + 처음 나타남 → 절대 안 옮긴다', () => {
    expect(
      shouldAutoFocusStep({ modality: 'keyboard', focusIsInTextEntry: true, appearance: 'first-appearance' }),
    ).toBe(false);
  });

  it('[요구사항 1] 포인터(터치·마우스) 사용자는 입력 칸 밖이어도 안 옮긴다', () => {
    expect(
      shouldAutoFocusStep({ modality: 'pointer', focusIsInTextEntry: false, appearance: 'first-appearance' }),
    ).toBe(false);
  });

  it('[요구사항 1] 아직 입력 방식이 한 번도 안 정해졌으면(undefined) 안 옮긴다', () => {
    expect(
      shouldAutoFocusStep({ modality: undefined, focusIsInTextEntry: false, appearance: 'first-appearance' }),
    ).toBe(false);
  });

  it('[검사관 재현 C] 키보드 + 입력 칸 밖 + 다시 지금 할 단계로 돌아옴(재등장) → 안 옮긴다', () => {
    expect(
      shouldAutoFocusStep({ modality: 'keyboard', focusIsInTextEntry: false, appearance: 'reappeared' }),
    ).toBe(false);
  });

  it('포인터 + 입력 칸 안 + 재등장(전부 부정 조건 겹침) → 당연히 안 옮긴다', () => {
    expect(shouldAutoFocusStep({ modality: 'pointer', focusIsInTextEntry: true, appearance: 'reappeared' })).toBe(
      false,
    );
  });

  it('[전체 조합표] 8가지 경우 중 "키보드·입력칸아님·처음나타남" 딱 한 가지만 true', () => {
    const modalities = ['keyboard', 'pointer'] as const;
    const focusStates = [true, false];
    const appearances = ['first-appearance', 'reappeared'] as const;
    let trueCount = 0;
    for (const modality of modalities) {
      for (const focusIsInTextEntry of focusStates) {
        for (const appearance of appearances) {
          if (shouldAutoFocusStep({ modality, focusIsInTextEntry, appearance })) trueCount++;
        }
      }
    }
    expect(trueCount).toBe(1);
  });
});

describe('isFocusInTextEntry — 지금 초점이 글자 입력 칸 안인지(진짜 DOM 없이 순수 함수로 시험)', () => {
  it('null·undefined(초점 없음)은 입력 칸이 아니다', () => {
    expect(isFocusInTextEntry(null)).toBe(false);
    expect(isFocusInTextEntry(undefined)).toBe(false);
  });

  it('input·textarea·select 태그면 입력 칸이다', () => {
    expect(isFocusInTextEntry({ tagName: 'INPUT' })).toBe(true);
    expect(isFocusInTextEntry({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isFocusInTextEntry({ tagName: 'SELECT' })).toBe(true);
  });

  it('button·div 등은 입력 칸이 아니다(누르는 요소·일반 요소)', () => {
    expect(isFocusInTextEntry({ tagName: 'BUTTON' })).toBe(false);
    expect(isFocusInTextEntry({ tagName: 'DIV' })).toBe(false);
  });

  it('contenteditable 요소도 입력 칸으로 본다', () => {
    expect(isFocusInTextEntry({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });
});
