// ──────────────────────────────────────────────
// 재단 모듈 — linear (길이로 파는 자재: 걸레받이·몰딩·레일·문선)
//
// 상태: 인터페이스만. 실제 계산은 바닥재·커튼 계산기 착수 때 구현한다.
//
// 구현할 재단 규칙 (설계 정본 0절):
//   1) 총 필요 길이 = 둘레 - 문·개구부 폭
//   2) 자재 1본 길이로 나눠 본 수 (올림)
//   3) 이음이 적게 나오도록 본 배분 (긴 벽부터 채우기)
//   4) 실제 로스 = (본 수 × 본 길이 - 필요 길이) ÷ 필요 길이
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

import type { CuttingResult } from './types';

/** 길이형 자재 규격 */
export interface LinearSpec {
  /** 자재 1본 길이 (m) — 걸레받이 2.4m, 몰딩 2.7m 등 */
  unitLengthM: number;
}

/** 벽 한 면의 길이 (이음 배분 계산용) */
export interface WallRun {
  name: string;
  lengthM: number;
}

/** linear 재단 계산에 넣는 값들 */
export interface LinearInput {
  /** 총 필요 길이 (m). 벽 목록이 없을 때 쓰는 값 */
  totalLengthM: number;
  /** 벽 면별 길이 목록. 있으면 이음 최소화 배분까지 계산 */
  runs?: WallRun[];
  /** 자재 규격 */
  spec: LinearSpec;
  /** 문·개구부로 빠지는 길이 합계 (m) */
  openingsM?: number;
}

/**
 * TODO(바닥재·커튼 계산기 착수 시 구현):
 *   본 수만 세는 단순 버전은 쉬우나, 이음 최소화 배분이 있어야 업체 견적과 맞는다.
 */
export function calcLinear(_input: LinearInput): CuttingResult {
  throw new Error('calcLinear 미구현 — 바닥재·커튼 계산기 착수 시 구현 예정 (설계 정본 0절)');
}
