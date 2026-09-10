// ──────────────────────────────────────────────
// 재단 모듈 — rollFloor (바닥에 까는 롤 자재: 장판)
//
// 이 파일이 하는 일:
//   방 치수와 롤 폭을 받아서 "장판을 몇 m 사야 하는가"를 계산한다.
//   장판은 폭이 1.83m 로 고정이라 면적을 롤 면적으로 나누면 틀린다.
//   방마다 어느 쪽으로 깔지(가로 / 세로)에 따라 필요 길이가 달라지기 때문이다.
//
// 계산 규칙 (형아 엑셀 계산식_로스율 시트 · 설계 정본 2-C절):
//   방향 A = 올림(방 가로 ÷ 롤 폭) × (방 세로 + 재단여유)
//   방향 B = 올림(방 세로 ÷ 롤 폭) × (방 가로 + 재단여유)
//   둘 중 작은 쪽을 고르고, 방마다 구한 값을 다 더한다.
//
//   엑셀 검산 예시 (3.6m × 4.2m 방 · 롤 폭 1.83m · 재단여유 0.1m)
//     A = 올림(3.6 ÷ 1.83) × (4.2 + 0.1) = 2 × 4.3 = 8.6m   ← 추천
//     B = 올림(4.2 ÷ 1.83) × (3.6 + 0.1) = 3 × 3.7 = 11.1m
//
// 로스 = (깔린 면적 − 방 면적) ÷ 방 면적.
// 이음선 수 = 한 방에 들어간 폭 수 − 1 (용착제 물량 근거로 쓴다).
//
// 작성일: 2026년 08월 28일 · 구현: 2026년 09월 10일
// ──────────────────────────────────────────────

import type { CuttingResult, LossMode } from './types';
import { ceilSafe, ceilSafe1 } from './round';
import type { RoomRect } from './sheet';

/** 바닥용 롤 자재 규격 */
export interface RollFloorSpec {
  /** 롤 폭 (m) — 장판은 보통 1.83 */
  widthM: number;
  /** 두께 (mm) — 1.8 / 2.2 / 2.7 / 3.2 / 4.5T */
  thicknessMm?: number;
}

/** rollFloor 재단 계산에 넣는 값들 */
export interface RollFloorInput {
  /** 시공 면적 (㎡). 방 치수가 아예 없을 때 쓰는 폴백 값 */
  floorSqm: number;
  /** 방 치수 목록. 평형 모드에서는 추정 치수가 들어온다 */
  rooms?: RoomRect[];
  /** 자재 규격 */
  spec: RollFloorSpec;
  /** 방마다 앞뒤로 더 두는 재단 여유 (m). 기본 0.1m */
  cutMarginM?: number;
  /** 결과의 lossMode 꼬리표를 바꿔 붙이고 싶을 때 (평형 모드처럼 치수가 추정일 때) */
  lossModeLabel?: LossMode;
}

/** 소수점 1자리 반올림 */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

// 소수점 1자리 올림은 공용 ceilSafe1 을 쓴다.
// 그냥 올리면 1.1 + 0.1 = 1.2000000000000002 가 1.3m 로 튀어 자재가 10cm씩 더 나간다.

/**
 * 장판 필요 길이(m)와 로스를 계산한다.
 * 방 치수가 있으면 방마다 두 방향을 비교해 짧은 쪽을 고른다.
 */
export function calcRollFloor(input: RollFloorInput): CuttingResult {
  const rollWidthM = input.spec.widthM;
  const margin = input.cutMarginM ?? 0.1;
  const rooms = (input.rooms ?? []).filter((r) => r.widthM > 0 && r.lengthM > 0);

  // 롤 폭이 없으면 계산 자체가 성립하지 않는다
  if (!rollWidthM || rollWidthM <= 0) {
    throw new Error('calcRollFloor — 롤 폭(widthM)이 있어야 계산할 수 있다');
  }

  const result = rooms.length > 0
    ? realCutMode(rooms, rollWidthM, margin)
    : areaFallbackMode(r1(input.floorSqm), rollWidthM);

  if (input.lossModeLabel) result.lossMode = input.lossModeLabel;
  return result;
}

// ── 실제 재단 모드: 방 치수를 알 때 ─────────────────
function realCutMode(rooms: RoomRect[], rollWidthM: number, margin: number): CuttingResult {
  let needM = 0; // 사야 하는 총 길이 (m)
  let roomsSqm = 0; // 방 면적 합 (㎡)
  let seams = 0; // 이음선 수 합계 (줄)
  let seamM = 0; // 이음선 길이 합계 (m) — 용착제 물량 근거

  for (const room of rooms) {
    roomsSqm += room.widthM * room.lengthM;

    // 방향 A — 가로 쪽으로 폭을 이어 붙이고 세로로 길게 뽑는다
    const stripsA = ceilSafe(room.widthM / rollWidthM);
    const lenA = stripsA * (room.lengthM + margin);

    // 방향 B — 방을 돌려서 반대로
    const stripsB = ceilSafe(room.lengthM / rollWidthM);
    const lenB = stripsB * (room.widthM + margin);

    // 짧은 쪽 채택 (이음선도 대체로 같이 줄어든다)
    // 이음선 한 줄의 길이 = 폭을 이어 붙인 방향과 직각인 쪽 길이
    if (lenA <= lenB) {
      needM += lenA;
      seams += Math.max(0, stripsA - 1);
      seamM += Math.max(0, stripsA - 1) * room.lengthM;
    } else {
      needM += lenB;
      seams += Math.max(0, stripsB - 1);
      seamM += Math.max(0, stripsB - 1) * room.widthM;
    }
  }

  const units = ceilSafe1(needM);
  const workAmount = r1(roomsSqm);

  // 깔린 면적 = 산 길이 × 롤 폭
  const laidSqm = units * rollWidthM;
  const lossPct = roomsSqm > 0 ? ((laidSqm - roomsSqm) / roomsSqm) * 100 : 0;

  return {
    kind: 'rollFloor',
    units,
    unitName: 'm',
    lossMode: '실제',
    lossPct: r1(lossPct),
    // 장판은 m 단위로 잘라 파니까 구매 로스와 재단 로스가 사실상 같다
    purchaseLossPct: r1(lossPct),
    workAmount,
    basis:
      `${rooms.length}개 실 ${workAmount}㎡ · 롤 폭 ${rollWidthM}m 로 방마다 짧은 방향 채택` +
      ` → ${units}m · 이음선 ${seams}줄 · 실제 로스 ${r1(lossPct)}%`,
    detail: { seams, seamM: r1(seamM), laidSqm: r1(laidSqm), rollWidthM, cutMarginM: margin },
  };
}

// ── 폴백: 방 치수가 아예 없을 때 ───────────────────
// 화면에서는 평형 모드에도 추정 방 치수를 넘겨 주므로 여기까지 오는 일은 거의 없다.
// 그래도 0을 조용히 돌려주지 않도록 면적 기준 근사식을 둔다.
function areaFallbackMode(floorSqm: number, rollWidthM: number): CuttingResult {
  // 면적 ÷ 롤 폭 에 이음·재단 여유 10%를 얹는다
  const units = floorSqm > 0 ? ceilSafe1((floorSqm / rollWidthM) * 1.1) : 0;
  const laidSqm = units * rollWidthM;
  const lossPct = floorSqm > 0 ? ((laidSqm - floorSqm) / floorSqm) * 100 : 0;

  return {
    kind: 'rollFloor',
    units,
    unitName: 'm',
    lossMode: '추정',
    lossPct: r1(lossPct),
    purchaseLossPct: r1(lossPct),
    workAmount: floorSqm,
    basis: `바닥 ${floorSqm}㎡ ÷ 롤 폭 ${rollWidthM}m → ${units}m · 추정 로스 ${r1(lossPct)}%`,
    detail: { seams: 0, seamM: 0, laidSqm: r1(laidSqm), rollWidthM, cutMarginM: 0 },
  };
}
