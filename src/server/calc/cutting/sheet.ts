// ──────────────────────────────────────────────
// 재단 모듈 — sheet (장·판으로 파는 자재: 마루·데코타일·타일)
//
// 이 파일이 하는 일:
//   방 치수와 장(판) 규격을 받아서 "몇 장이 들어가고 몇 박스를 사야 하는가"를 계산한다.
//   추정 퍼센트로 때우지 않고 실제로 깔아 본다 — 이게 설계 정본 0절의 핵심 원칙이다.
//
// 계산 규칙 (설계 정본 2-C절 · 형아 엑셀 계산식_로스율 시트):
//   1) 열 수 = 방 폭 ÷ 장 폭 (올림)
//   2) 열마다 장 수 = 방 길이 ÷ 장 길이 (올림)
//   3) 끝 장 자투리가 30cm 이상이면 다음 열 첫 장으로 다시 쓴다 (엇갈림 시공)
//   4) 총 장 수 → 박스당 장 수로 나눠 박스 수 (올림)
//   5) 실제 로스 = (장 면적 합 − 방 면적) ÷ 방 면적
//   6) 가로·세로 두 방향을 다 계산해서 로스가 적은 쪽을 고른다
//
// 두 가지 모드:
//   실제 — 방마다 가로·세로를 실측으로 받았을 때. 진짜로 깔아 보고 로스를 구한다.
//   추정 — 평형만 넣었을 때. 종류·제품의 초기 로스율(마루 5% · 데코타일 7%)로 잡는다.
//
// 작성일: 2026년 08월 28일 · 구현: 2026년 09월 10일
// ──────────────────────────────────────────────

import type { CuttingResult, LossMode } from './types';
import { ceilSafe } from './round';

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
  /** 박스당 장 수. 모르면 0 을 넣으면 면적 방식으로 폴백한다 */
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
  /** 추정 모드에서 쓸 로스율 (0.05 = 5%). 안 넣으면 5% */
  lossRate?: number;
  /** 결과의 lossMode 꼬리표를 바꿔 붙이고 싶을 때 (평형 모드처럼 치수가 추정일 때) */
  lossModeLabel?: LossMode;
}

/** 소수점 1자리 반올림 */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 소수점 2자리 반올림 */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 방 하나를 한 방향으로 깔아 보고 필요한 장 수를 센다.
 *
 * @param acrossM  열이 늘어서는 쪽 길이 (m) — 이 길이를 장 폭으로 나눠 열 수를 구한다
 * @param alongM   한 열이 뻗어 가는 쪽 길이 (m) — 이 길이를 장 길이로 채운다
 * @param plankWidthM  장 폭 (m)
 * @param plankLengthM 장 길이 (m)
 * @param reuseMinM    자투리를 다시 쓸 수 있는 최소 길이 (m)
 * @returns 이 방에 들어가는 장 수
 */
function layOneWay(
  acrossM: number,
  alongM: number,
  plankWidthM: number,
  plankLengthM: number,
  reuseMinM: number,
): number {
  // 열 수 = 방 폭 ÷ 장 폭 (올림). 마지막 열은 세로로 잘라 쓰므로 한 장으로 친다.
  // 소수점 오차로 열이 한 줄 더 세어지지 않게 ceilSafe 를 쓴다 (2.145 ÷ 0.143 = 15.000000000000002 → 15열)
  const columns = Math.max(1, ceilSafe(acrossM / plankWidthM));

  let pieces = 0;
  // carry = 앞 열 끝에서 잘라 내고 남은 자투리 길이 (m). 다음 열 첫 장으로 쓴다.
  let carry = 0;

  for (let c = 0; c < columns; c += 1) {
    let need = alongM;

    // 1) 남아 있던 자투리부터 쓴다
    if (carry > 0) {
      if (carry >= need) {
        // 자투리 하나로 이 열이 다 채워진다. 쓰고 남은 건 또 다음 열로 넘긴다.
        carry = carry - need;
        need = 0;
      } else {
        need -= carry;
        carry = 0;
      }
    }

    // 2) 남은 길이를 새 장으로 채운다
    if (need > 0) {
      const n = ceilSafe(need / plankLengthM);
      pieces += n;
      const leftover = n * plankLengthM - need;
      // 자투리가 기준(기본 30cm)보다 길면 다음 열 첫 장으로 다시 쓴다
      carry = leftover >= reuseMinM ? leftover : 0;
    } else {
      // 자투리로 다 채운 열. carry 는 위에서 이미 줄여 놨다.
      if (carry < reuseMinM) carry = 0;
    }
  }

  return pieces;
}

/**
 * 장(판) 자재의 박스 수와 로스를 계산한다.
 * 실측 방 치수가 있으면 실제로 깔아 보고, 없으면 종류 로스율로 추정한다.
 */
export function calcSheet(input: SheetInput): CuttingResult {
  const { spec } = input;
  const reuseMinM = (input.reuseMinMm ?? 300) / 1000;
  const direction = input.direction ?? '자동';
  const rooms = (input.rooms ?? []).filter((r) => r.widthM > 0 && r.lengthM > 0);

  // 규격이 이상하면(0 이하) 계산이 무너지므로 여기서 막는다
  if (!spec.sqmPerBox || spec.sqmPerBox <= 0) {
    throw new Error('calcSheet — 박스당 면적(sqmPerBox)이 있어야 계산할 수 있다');
  }

  const result = rooms.length > 0
    ? realLayMode(rooms, spec, reuseMinM, direction)
    : estimateMode(r1(input.floorSqm), spec, input.lossRate ?? 0.05);

  // 평형 모드처럼 치수 자체가 추정일 때는 꼬리표만 바꿔 단다
  if (input.lossModeLabel) result.lossMode = input.lossModeLabel;
  return result;
}

// ── 추정 모드: 실측 치수가 없을 때 ──────────────────
function estimateMode(floorSqm: number, spec: SheetSpec, lossRate: number): CuttingResult {
  // 필요 면적 = 바닥 면적 × (1 + 로스율)
  const needSqm = floorSqm * (1 + lossRate);
  // 박스 수 = 필요 면적 ÷ 박스당 면적 (올림)
  const units = floorSqm > 0 ? Math.max(1, ceilSafe(needSqm / spec.sqmPerBox)) : 0;

  const purchaseLossPct =
    floorSqm > 0 ? ((units * spec.sqmPerBox - floorSqm) / floorSqm) * 100 : 0;

  return {
    kind: 'sheet',
    units,
    unitName: '박스',
    lossMode: '추정',
    lossPct: r1(lossRate * 100),
    purchaseLossPct: r1(purchaseLossPct),
    workAmount: floorSqm,
    // 근거 문장은 한 줄로 짧게 (설명글 최소화 원칙)
    basis: `바닥 ${floorSqm}㎡ × 로스 ${r1(lossRate * 100)}% ÷ 박스당 ${spec.sqmPerBox}㎡ → ${units}박스`,
    detail: {
      neededSqm: r1(needSqm),
      sqmPerBox: spec.sqmPerBox,
      // 박스당 장 수를 알면 총 장 수도 같이 알려 준다
      pieces: spec.piecesPerBox > 0 ? units * spec.piecesPerBox : 0,
    },
  };
}

// ── 실제 깔아보기 모드: 방 치수를 알 때 ─────────────
function realLayMode(
  rooms: RoomRect[],
  spec: SheetSpec,
  reuseMinM: number,
  direction: '가로' | '세로' | '자동',
): CuttingResult {
  const plankWidthM = spec.widthMm / 1000;
  const plankLengthM = spec.lengthMm / 1000;
  const plankSqm = plankWidthM * plankLengthM;

  let totalPieces = 0;
  let roomsSqm = 0;
  // 두 방향 중 어느 쪽을 골랐는지 세어 근거 문장에 적는다
  let acrossCount = 0;

  for (const room of rooms) {
    roomsSqm += room.widthM * room.lengthM;

    // 방향 A(가로) — 방 폭 쪽으로 열을 늘어놓고 세로 길이를 장 길이로 채운다
    const a = layOneWay(room.widthM, room.lengthM, plankWidthM, plankLengthM, reuseMinM);
    // 방향 B(세로) — 반대로 돌려 깐다
    const b = layOneWay(room.lengthM, room.widthM, plankWidthM, plankLengthM, reuseMinM);

    let picked: number;
    if (direction === '가로') picked = a;
    else if (direction === '세로') picked = b;
    else picked = Math.min(a, b); // 자동 = 장이 덜 드는 쪽

    if (picked === a) acrossCount += 1;
    totalPieces += picked;
  }

  // 깔린 장의 면적 합 (자투리 포함)
  const cutSqm = totalPieces * plankSqm;
  const workAmount = r1(roomsSqm);

  // 박스 수 — 박스당 장 수를 알면 장 수로, 모르면 면적으로 나눈다(면적 방식 폴백)
  const units = spec.piecesPerBox > 0
    ? Math.max(1, ceilSafe(totalPieces / spec.piecesPerBox))
    : Math.max(1, ceilSafe(cutSqm / spec.sqmPerBox));

  const lossPct = roomsSqm > 0 ? ((cutSqm - roomsSqm) / roomsSqm) * 100 : 0;
  const purchaseLossPct =
    roomsSqm > 0 ? ((units * spec.sqmPerBox - roomsSqm) / roomsSqm) * 100 : 0;

  const dirLabel = direction === '자동'
    ? (acrossCount >= rooms.length - acrossCount ? '가로' : '세로')
    : direction;

  return {
    kind: 'sheet',
    units,
    unitName: '박스',
    lossMode: '실제',
    lossPct: r1(lossPct),
    purchaseLossPct: r1(purchaseLossPct),
    workAmount,
    // 근거 문장은 한 줄. 숫자는 사람이 바로 대조할 수 있는 것만 담는다.
    basis:
      `${rooms.length}개 실 ${workAmount}㎡ · ${spec.widthMm}×${spec.lengthMm}mm ${dirLabel} 시공` +
      ` → ${totalPieces}장 · 실제 로스 ${r1(lossPct)}%`,
    detail: {
      pieces: spec.piecesPerBox > 0 ? units * spec.piecesPerBox : 0,
      neededPieces: totalPieces,
      cutSqm: r2(cutSqm),
      plankSqm: r2(plankSqm),
    },
  };
}
