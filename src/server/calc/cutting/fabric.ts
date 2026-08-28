// ──────────────────────────────────────────────
// 재단 모듈 — fabric (원단: 커튼·속커튼)
//
// 상태: 인터페이스만. 실제 계산은 커튼 계산기 착수 때 구현한다.
//
// 구현할 재단 규칙 (설계 정본 0절·2-B절):
//   1) 폭 수 = 창 폭 × 주름 배수 ÷ 원단 폭 (올림)
//   2) 폭당 길이 = 창 높이 + 밑단·상단 여유
//   3) 필요 m = 폭 수 × 폭당 길이
//   4) 원단 폭 280cm(광폭)이면 세로 재단이라 산식이 갈린다
//   5) 주름 배수: 나비주름 2.5 / 평주름 2.0 / 아일렛 1.8
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

import type { CuttingResult } from './types';

/** 창 하나의 치수 */
export interface WindowSize {
  /** 창 이름 (거실창·안방창 등) */
  name: string;
  /** 창 폭 (cm) */
  widthCm: number;
  /** 창 높이 (cm) */
  heightCm: number;
  /** 같은 규격 창 개수 */
  count: number;
}

/** 원단 규격 */
export interface FabricSpec {
  /** 원단 폭 (cm) — 보통 140 또는 280(광폭) */
  widthCm: number;
  /** 패턴 리피트 (cm). 0이면 무지 */
  repeatCm?: number;
}

/** fabric 재단 계산에 넣는 값들 */
export interface FabricInput {
  /** 창 목록 */
  windows: WindowSize[];
  /** 원단 규격 */
  spec: FabricSpec;
  /** 주름 배수 (2.5 / 2.0 / 1.8) */
  pleatMultiplier: number;
  /** 밑단·상단 여유 (cm) */
  hemMarginCm?: number;
}

/**
 * TODO(커튼 계산기 착수 시 구현):
 *   광폭(280cm) 세로 재단 분기가 핵심 숙제.
 */
export function calcFabric(_input: FabricInput): CuttingResult {
  throw new Error('calcFabric 미구현 — 커튼 계산기 착수 시 구현 예정 (설계 정본 2-B절)');
}
