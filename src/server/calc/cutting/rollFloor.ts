// ──────────────────────────────────────────────
// 재단 모듈 — rollFloor (바닥에 까는 롤 자재: 장판)
//
// 상태: 인터페이스만. 실제 계산은 바닥재 계산기 착수 때 구현한다.
//
// 구현할 재단 규칙 (설계 정본 0절·2-C절):
//   1) 롤 폭(1.8m / 2.0m) 대비 방 폭 → 이음선 수
//   2) 이음 방향(가로/세로) 2안 비교 → 이음선 적은 쪽
//   3) 필요 m 수 = 이음선 수 × 방 길이
//   4) 실제 로스 = (깔린 면적 - 방 면적) ÷ 방 면적
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

import type { CuttingResult } from './types';
import type { RoomRect } from './sheet';

/** 바닥용 롤 자재 규격 */
export interface RollFloorSpec {
  /** 롤 폭 (m) — 장판은 보통 1.8 또는 2.0 */
  widthM: number;
  /** 두께 (mm) — 1.8 / 2.2 / 2.7 / 3.2 / 4.5T */
  thicknessMm?: number;
}

/** rollFloor 재단 계산에 넣는 값들 */
export interface RollFloorInput {
  /** 시공 면적 (㎡) */
  floorSqm: number;
  /** 실측 방 치수 목록. 있으면 실제 재단 모드 */
  rooms?: RoomRect[];
  /** 자재 규격 */
  spec: RollFloorSpec;
}

/**
 * TODO(바닥재 계산기 착수 시 구현):
 *   장판 이음선 계산은 방 폭과 롤 폭 관계가 핵심이라 실측 치수가 있어야 의미가 있다.
 */
export function calcRollFloor(_input: RollFloorInput): CuttingResult {
  throw new Error('calcRollFloor 미구현 — 바닥재 계산기 착수 시 구현 예정 (설계 정본 2-C절)');
}
