// ──────────────────────────────────────────────
// 재단 모듈 — sheet (장/판으로 파는 자재: 마루·데코타일·타일)
//
// 상태: 인터페이스만. 실제 계산은 바닥재 계산기 착수 때 구현한다.
//
// 구현할 재단 규칙 (설계 정본 2-C절):
//   1) 열 수 = 방 폭 ÷ 장 폭 (올림)
//   2) 열마다 장 수 = 방 길이 ÷ 장 길이 (올림)
//   3) 끝 장 자투리가 30cm 이상이면 다음 열 첫 장으로 재사용 (엇갈림 시공)
//   4) 총 장 수 → 박스당 장 수로 나눠 박스 수 (올림)
//   5) 실제 로스 = (장 면적 합 - 방 면적) ÷ 방 면적
//   6) 가로·세로 두 방향을 다 계산해서 로스가 적은 쪽을 추천
//   7) 헤링본은 별도 로스(15%) 추정
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

import type { CuttingResult } from './types';

/** 방 하나의 사각형 치수 (L자 방은 사각형 2개로 쪼개 넣는다) */
export interface RoomRect {
  /** 방 이름 */
  name: string;
  /** 가로 (m) */
  widthM: number;
  /** 세로 (m) */
  lengthM: number;
}

/** 장(판) 자재 규격 */
export interface SheetSpec {
  /** 장 폭 (mm) */
  widthMm: number;
  /** 장 길이 (mm) */
  lengthMm: number;
  /** 박스당 장 수 */
  piecesPerBox: number;
  /** 박스당 면적 (㎡) */
  sqmPerBox: number;
}

/** sheet 재단 계산에 넣는 값들 */
export interface SheetInput {
  /** 시공 면적 (㎡). 실측 방 치수가 없을 때 추정 모드로 쓴다 */
  floorSqm: number;
  /** 실측 방 치수 목록. 있으면 실제 재단 모드 */
  rooms?: RoomRect[];
  /** 자재 규격 */
  spec: SheetSpec;
  /** 자투리 재사용 최소 길이 (mm). 기본 300mm */
  reuseMinMm?: number;
  /** 시공 방향 ('가로' | '세로' | '자동' — 자동이면 로스 적은 쪽) */
  direction?: '가로' | '세로' | '자동';
}

/**
 * TODO(바닥재 계산기 착수 시 구현):
 *   현재는 호출하면 명시적으로 에러를 던진다.
 *   "안 만든 기능이 조용히 0을 돌려주는" 사고를 막기 위해 일부러 빈 결과를 주지 않는다.
 */
export function calcSheet(_input: SheetInput): CuttingResult {
  throw new Error('calcSheet 미구현 — 바닥재 계산기 착수 시 구현 예정 (설계 정본 2-C절)');
}
