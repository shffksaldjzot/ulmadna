// ──────────────────────────────────────────────
// 전문가용 타일 물량 계산기 — 타일 배치 계산(순수 함수, 화면 없음)
//
// 하는 일: "구역"(바닥 모양 또는 벽 한 면, 문·창 구멍 포함) 위에 타일을 실제로 한 장씩 깔아 보고
//   - 구역 안에 통째로 들어가는 타일 = 온장
//   - 구역 끝·구멍에 걸려 잘라야 하는 타일 = 컷 장
//   으로 나눠 센다. 화면은 이 결과(타일 위치 목록)를 그대로 그린다.
//
// 계산 방법(쉽게):
//   1) 대각 패턴이면 구역을 반대로 45도 돌려 놓고, 타일은 늘 똑바로(가로·세로) 깐다고 생각한다.
//      그러면 일자·지그재그·대각이 모두 같은 방식으로 계산된다. 그림을 그릴 때 다시 45도 돌린다.
//   2) 시작 기준이 "가운데"면 구역 한가운데에 타일 한 장의 가운데를 맞추고,
//      "모서리"면 구역 왼쪽 위 모서리에 타일 한 장의 모서리를 맞춘다.
//   3) 타일 + 줄눈 간격으로 격자를 깔고, 지그재그면 줄마다 1/2 또는 1/3씩 밀어 준다.
//   4) 타일 한 장마다 "구역과 겹치는 넓이 − 구멍과 겹치는 넓이"를 구해 타일 넓이로 나눈다.
//      거의 1이면 온장, 0보다 크면 컷 장, 거의 0이면 버린다.
//
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────

import { bbox, clipPolygon, polygonArea, rectToPts, rotatePt, type Pt, type Rect } from '@/components/plan/geometry';

/** 붙이는 패턴 — 일자(정배열) · 지그재그 1/2 · 지그재그 1/3 · 대각(45도) */
export type TilePattern = 'straight' | 'half' | 'third' | 'diagonal';

/** 시작 기준 — 구역 가운데 / 왼쪽 위 모서리 */
export type TileOrigin = 'center' | 'corner';

/** 타일 규격 — 가로(w)는 화면 가로 방향, 세로(h)는 화면 세로 방향으로 놓인다 */
export interface TileSpec {
  /** 타일 가로(mm) */
  w: number;
  /** 타일 세로(mm) */
  h: number;
  /** 줄눈 폭(mm) */
  joint: number;
}

/** 배치 계산 입력 */
export interface LayoutInput {
  /** 구역 바깥 모양(꼭짓점, mm) */
  outline: Pt[];
  /** 빼는 구멍(문·창 등, 축에 나란한 사각형) */
  holes: Rect[];
  tile: TileSpec;
  pattern: TilePattern;
  origin: TileOrigin;
  /**
   * 모서리 시작일 때 위/아래 어느 모서리에 맞출지 — 기본 'top'(왼쪽 위).
   * 벽 전개도는 바닥선에서 온장으로 올라가는 게 현장 방식이라 'bottom'(왼쪽 아래)을 쓴다.
   */
  anchor?: 'top' | 'bottom';
}

/** 깔린 타일 한 장(타일 좌표계 기준 — 대각이면 돌리기 전 좌표) */
export interface PlacedTile {
  /** 타일 왼쪽 위 x(mm) */
  x: number;
  /** 타일 왼쪽 위 y(mm) */
  y: number;
  /** 구역 안에 실제로 붙는 부분의 비율(0~1) */
  ratio: number;
  /** 잘라야 하는 타일이면 true */
  cut: boolean;
}

/** 배치 계산 결과 */
export interface LayoutResult {
  /** 타일 좌표계 회전 각도(도) — 대각이면 45, 아니면 0 */
  angle: number;
  /** 회전 중심(mm) */
  pivot: Pt;
  /** 깔린 타일 목록 */
  tiles: PlacedTile[];
  /** 온장 수 */
  full: number;
  /** 컷 장 수(잘라 쓰는 자리 수) */
  cut: number;
  /** 구역 실면적(mm², 구멍 뺀 값) */
  netAreaMm2: number;
  /** 너무 많아 계산을 멈췄으면 true */
  truncated: boolean;
}

/** 온장으로 보는 기준 — 99.5% 이상 덮이면 온장(계산 오차 흡수) */
const FULL_RATIO = 0.995;
/** 버리는 기준 — 0.3% 미만으로 걸치면 타일이 닿지 않은 것으로 본다 */
const MIN_RATIO = 0.003;
/** 한 구역에 깔 수 있는 최대 장 수 — 이보다 많으면 멈춘다(모자이크로 큰 방을 넣는 경우 등) */
export const MAX_TILES = 20000;

/** 패턴별 "줄마다 미는 비율" — 일자 0, 1/2 지그재그 0.5, 1/3 지그재그 1/3 */
function rowShiftFraction(pattern: TilePattern, row: number): number {
  const r = ((row % 6) + 6) % 6; // 음수 줄 번호도 0~5로
  if (pattern === 'half') return (r % 2) * 0.5;
  if (pattern === 'third') return (r % 3) / 3;
  return 0;
}

/**
 * 구역 위에 타일을 깔아 온장·컷 장을 센다.
 * 순수 함수 — 같은 입력이면 늘 같은 결과(시험으로 확인 가능).
 */
export function layoutTiles(input: LayoutInput): LayoutResult {
  const { outline, holes, tile, pattern, origin, anchor = 'top' } = input;
  const angle = pattern === 'diagonal' ? 45 : 0;
  const box = bbox(outline);
  const pivot = { x: box.x + box.w / 2, y: box.y + box.h / 2 };

  // 구멍은 구역 안쪽만 의미가 있다 — 실면적 = 구역 넓이 − (구멍 ∩ 구역) 넓이
  const holePolys = holes.filter((h) => h.w > 0 && h.h > 0).map(rectToPts);
  const outerArea = polygonArea(outline);
  const holeArea = holePolys.reduce((s, hp) => s + polygonArea(clipPolygon(outline, hp)), 0);
  const netAreaMm2 = Math.max(outerArea - holeArea, 0);

  const empty: LayoutResult = { angle, pivot, tiles: [], full: 0, cut: 0, netAreaMm2, truncated: false };
  if (outline.length < 3 || tile.w <= 0 || tile.h <= 0 || netAreaMm2 <= 0) return empty;

  // 1) 타일 좌표계로 옮기기 — 구역·구멍을 −angle 만큼 돌린다(대각이 아니면 그대로)
  const rot = (p: Pt) => (angle === 0 ? p : rotatePt(p, pivot, -angle));
  const region = outline.map(rot);
  const holesRot = holePolys.map((hp) => hp.map(rot));
  const rb = bbox(region);

  // 2) 시작 기준점(타일 한 장의 왼쪽 위가 놓일 자리)
  const sx = tile.w + tile.joint; // 가로 간격(타일+줄눈)
  const sy = tile.h + tile.joint; // 세로 간격
  const x0 = origin === 'center' ? pivot.x - tile.w / 2 : rb.x;
  const y0 = origin === 'center' ? pivot.y - tile.h / 2 : anchor === 'bottom' ? rb.y + rb.h - tile.h : rb.y;

  // 3) 구역을 덮는 줄 범위
  const rowFrom = Math.floor((rb.y - y0) / sy) - 1;
  const rowTo = Math.ceil((rb.y + rb.h - y0) / sy) + 1;
  const tileArea = tile.w * tile.h;

  const tiles: PlacedTile[] = [];
  let full = 0;
  let cut = 0;
  let truncated = false;

  for (let r = rowFrom; r <= rowTo && !truncated; r++) {
    const y = y0 + r * sy;
    // 타일 세로 범위가 구역과 안 겹치면 건너뛴다
    if (y + tile.h <= rb.y || y >= rb.y + rb.h) continue;
    const shift = rowShiftFraction(pattern, r) * sx;
    const colFrom = Math.floor((rb.x - x0 - shift) / sx) - 1;
    const colTo = Math.ceil((rb.x + rb.w - x0 - shift) / sx) + 1;
    for (let c = colFrom; c <= colTo; c++) {
      const x = x0 + shift + c * sx;
      if (x + tile.w <= rb.x || x >= rb.x + rb.w) continue;
      // 4) 이 타일과 구역이 겹치는 넓이 − 구멍과 겹치는 넓이
      const tp = rectToPts({ x, y, w: tile.w, h: tile.h });
      let covered = polygonArea(clipPolygon(region, tp));
      if (covered <= 0) continue;
      for (const hp of holesRot) covered -= polygonArea(clipPolygon(hp, tp));
      const ratio = Math.min(covered / tileArea, 1);
      if (ratio < MIN_RATIO) continue;
      const isCut = ratio < FULL_RATIO;
      tiles.push({ x, y, ratio, cut: isCut });
      if (isCut) cut++;
      else full++;
      if (tiles.length >= MAX_TILES) {
        truncated = true;
        break;
      }
    }
  }

  return { angle, pivot, tiles, full, cut, netAreaMm2, truncated };
}

/**
 * 컷 장을 만들려면 타일이 몇 장 필요한지.
 * reuse=false — 컷 자리마다 새 타일 1장(가장 넉넉한 셈).
 * reuse=true  — 자르고 남은 조각이 다른 컷 자리에 들어갈 만큼 크면 그 조각을 쓴다
 *               (큰 조각부터 채우는 방식, 칼날 여유로 조각마다 1%를 더 잡는다).
 *               현장에서 반대편 벽 끝 조각을 맞춰 쓰는 것과 같다.
 */
export function tilesForCuts(ratios: number[], reuse: boolean): number {
  if (!reuse) return ratios.length;
  const KERF = 0.01; // 자를 때 날아가는 몫(약 3mm)
  const sorted = [...ratios].sort((a, b) => b - a);
  const left: number[] = []; // 타일마다 남은 비율
  for (const need of sorted) {
    const want = Math.min(need + KERF, 1);
    const i = left.findIndex((l) => l >= want);
    if (i >= 0) left[i] -= want;
    else left.push(1 - want);
  }
  return left.length;
}
