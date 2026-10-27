// ──────────────────────────────────────────────
// 전문가용 타일 물량 계산기 시험
//   - 사각 방 온장/컷 장 수(모서리 시작·가운데 시작)
//   - 문·창 빼기(벽 전개도 구멍)
//   - 패턴별 로스(일자 < 지그재그 ≤ 대각)
//   - 자투리 재사용, ㄱ자·자유형 방 모양, 주소 공유 왕복
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { buildRoom, polygonArea, perimeter } from '@/components/plan/geometry';
import { layoutTiles, tilesForCuts, tilesForCutsFit } from '../layout';
import { computeTilePro, regionsOf } from '../quantity';
import { DEFAULT_TILE_PRO, decodeTileProForm, encodeTileProForm, type TileProForm } from '../form';

/** 사각형 꼭짓점 */
const sq = (w: number, h: number) => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: h },
  { x: 0, y: h },
];
const T300 = { w: 300, h: 300, joint: 0 };

describe('사각 방 온장·컷 장', () => {
  it('1200×1200 에 300 타일, 모서리 시작 → 온장 16, 컷 0', () => {
    const r = layoutTiles({ outline: sq(1200, 1200), holes: [], tile: T300, pattern: 'straight', origin: 'corner' });
    expect(r.full).toBe(16);
    expect(r.cut).toBe(0);
  });
  it('1300×1200 → 끝 한 줄(100mm)이 컷 4장', () => {
    const r = layoutTiles({ outline: sq(1300, 1200), holes: [], tile: T300, pattern: 'straight', origin: 'corner' });
    expect(r.full).toBe(16);
    expect(r.cut).toBe(4);
  });
  it('1200×1200 가운데 시작 → 가운데 3×3 온장, 둘레 컷 16', () => {
    const r = layoutTiles({ outline: sq(1200, 1200), holes: [], tile: T300, pattern: 'straight', origin: 'center' });
    expect(r.full).toBe(9);
    expect(r.cut).toBe(16);
  });
  it('줄눈 3mm 를 넣으면 한 줄에 들어가는 온장이 줄어든다', () => {
    const r = layoutTiles({ outline: sq(1200, 1200), holes: [], tile: { ...T300, joint: 3 }, pattern: 'straight', origin: 'corner' });
    expect(r.full).toBe(9); // 3×3 온장 + 끝줄 컷
    expect(r.cut).toBe(7);
  });
});

describe('벽 시작 기준', () => {
  it('벽 1200 높이, 300 타일을 바닥선에서 시작 → 맨 위 줄만 컷', () => {
    const r = layoutTiles({ outline: sq(1200, 1100), holes: [], tile: T300, pattern: 'straight', origin: 'corner', anchor: 'bottom' });
    // 아래에서 300×3 = 900 까지 온장 3줄(4장씩), 맨 위 200mm 줄은 컷 4장
    expect(r.full).toBe(12);
    expect(r.cut).toBe(4);
    const cutYs = r.tiles.filter((t) => t.cut).map((t) => t.y);
    expect(Math.max(...cutYs)).toBeLessThan(0); // 컷 줄은 맨 위(위로 삐져나간 줄)
  });
});

describe('문·창 빼기', () => {
  it('벽 1200×1200 아래 가운데 600×600 구멍 → 온장 12, 실면적 1.08㎡', () => {
    const r = layoutTiles({
      outline: sq(1200, 1200),
      holes: [{ x: 300, y: 600, w: 600, h: 600 }],
      tile: T300,
      pattern: 'straight',
      origin: 'corner',
    });
    expect(r.full).toBe(12);
    expect(r.cut).toBe(0);
    expect(r.netAreaMm2 / 1e6).toBeCloseTo(1.08, 5);
  });
  it('벽 모드: 문이 붙은 벽만 그 문 넓이만큼 줄어든다', () => {
    const form: TileProForm = {
      ...DEFAULT_TILE_PRO,
      surface: 'wall',
      shape: { ...DEFAULT_TILE_PRO.shape, kind: 'rect', w: 2000, h: 1500 },
      wallH: 2400,
      openings: [{ kind: 'door', wall: 2, offset: 200, width: 800, height: 2100, sill: 0 }],
    };
    const regions = regionsOf(form);
    expect(regions).toHaveLength(4);
    const res = computeTilePro(form);
    // 둘레 7m × 2.4m − 문 0.8×2.1
    expect(res.netSqm).toBeCloseTo(7 * 2.4 - 0.8 * 2.1, 5);
    // 벽 하나를 빼면 그만큼 줄어든다
    const off = computeTilePro({ ...form, wallsOff: [0] });
    expect(off.netSqm).toBeCloseTo(res.netSqm - 2 * 2.4, 5);
  });
  it('창이 시공 높이보다 위로 올라가면 시공 높이까지만 뺀다', () => {
    const form: TileProForm = {
      ...DEFAULT_TILE_PRO,
      surface: 'wall',
      shape: { ...DEFAULT_TILE_PRO.shape, kind: 'rect', w: 2000, h: 2000 },
      wallH: 1200,
      wallsOff: [1, 2, 3],
      openings: [{ kind: 'window', wall: 0, offset: 500, width: 1000, height: 1000, sill: 900 }],
    };
    const res = computeTilePro(form);
    expect(res.netSqm).toBeCloseTo(2 * 1.2 - 1 * 0.3, 5);
  });
});

describe('패턴별 로스', () => {
  // 타일 배수로 딱 떨어지는 방(2400×1800, 600×300, 줄눈 0, 모서리 시작) — 일자는 로스 0 이어야 한다
  const base: TileProForm = {
    ...DEFAULT_TILE_PRO,
    reuse: 'off',
    spare: 0,
    joint: 0,
    origin: 'corner',
    shape: { ...DEFAULT_TILE_PRO.shape, kind: 'rect', w: 2400, h: 1800 },
  };
  const loss = (pattern: TileProForm['pattern']) => computeTilePro({ ...base, pattern }).lossPct;
  it('대각은 일자보다 로스가 크다', () => {
    expect(loss('diagonal')).toBeGreaterThan(loss('straight'));
  });
  it('딱 떨어지는 방: 일자 로스 0, 지그재그는 줄 끝 컷 때문에 로스가 생긴다', () => {
    expect(loss('straight')).toBeCloseTo(0, 5);
    expect(loss('half')).toBeGreaterThan(0);
    expect(loss('third')).toBeGreaterThan(0);
  });
  it('로스가 0 이상이고 필요 장 수 × 장당 면적 ≥ 실면적', () => {
    for (const p of ['straight', 'half', 'third', 'diagonal'] as const) {
      const r = computeTilePro({ ...base, pattern: p });
      expect(r.lossPct).toBeGreaterThanOrEqual(0);
      expect(r.total * 0.18).toBeGreaterThanOrEqual(r.netSqm);
    }
  });
  it('박스 수 = 올림(필요 장 수 ÷ 박스당)', () => {
    const r = computeTilePro(base);
    expect(r.boxes).toBe(Math.ceil(r.total / base.perBox));
  });
});

describe('자투리 재사용', () => {
  it('반 장 조각 둘은 한 장에서 나온다(칼날 몫 포함해도 0.49 + 0.49)', () => {
    expect(tilesForCuts([0.49, 0.49], true)).toBe(1);
    expect(tilesForCuts([0.49, 0.49], false)).toBe(2);
  });
  it('큰 조각끼리는 못 합친다', () => {
    expect(tilesForCuts([0.7, 0.7, 0.2], true)).toBe(2);
  });
});

describe('방 모양', () => {
  it('ㄱ자: 넓이 = 전체 − 따낸 부분, 둘레는 사각형과 같다', () => {
    const room = buildRoom({ ...DEFAULT_TILE_PRO.shape, kind: 'L', w: 3000, h: 2000, nw: 1000, nh: 800, corner: 'tr' });
    expect(room).toHaveLength(6);
    expect(polygonArea(room)).toBe(3000 * 2000 - 1000 * 800);
    expect(perimeter(room)).toBe(10000);
  });
  it('자유형: 기본 벽 5개로 닫힌 ㄱ자가 된다', () => {
    const room = buildRoom({ ...DEFAULT_TILE_PRO.shape, kind: 'free' });
    // 3000 → 꺾어 1200 → 1000 → 1800 → 4000 → 자동으로 닫는 벽
    expect(room.length).toBe(6);
    expect(polygonArea(room)).toBe(3000 * 1200 + 4000 * 1800);
  });
});

describe('주소 공유', () => {
  it('넣은 값이 그대로 돌아온다', () => {
    const f: TileProForm = { ...DEFAULT_TILE_PRO, pattern: 'third', joint: 1.5, surface: 'wall', wallsOff: [1] };
    expect(decodeTileProForm(encodeTileProForm(f))).toEqual(f);
  });
  it('깨진 값은 null, 엉뚱한 숫자는 범위 안으로', () => {
    expect(decodeTileProForm('!!!')).toBeNull();
    const bad = encodeTileProForm({ ...DEFAULT_TILE_PRO, tileW: -5, joint: 99 } as TileProForm);
    const back = decodeTileProForm(bad)!;
    expect(back.tileW).toBe(50);
    expect(back.joint).toBe(20);
  });
});

describe('기본 예시 방(바닥 2100×1600, 600×300, 줄눈 2, 파손 3%) — 검수 고정값', () => {
  it('고치기 전: 가운데 시작·자투리 안 씀 → 컷 20곳, 37장, 로스 98.2%', () => {
    const r = computeTilePro({ ...DEFAULT_TILE_PRO, origin: 'center', reuse: 'off' });
    expect(r.full).toBe(15);
    expect(r.cut).toBe(20);
    expect(r.total).toBe(37);
    expect(r.lossPct).toBeCloseTo(98.2, 1);
  });
  it('고친 뒤 기본값: 모서리 시작·같은 치수 자투리 → 컷 9곳을 타일 4장으로, 20장·3박스, 로스 7.1%', () => {
    expect(DEFAULT_TILE_PRO.origin).toBe('corner');
    expect(DEFAULT_TILE_PRO.reuse).toBe('fit');
    const r = computeTilePro(DEFAULT_TILE_PRO);
    expect(r.full).toBe(15);
    expect(r.cut).toBe(9);
    expect(r.cutTiles).toBe(4);
    expect(r.total).toBe(20);
    expect(r.boxes).toBe(3);
    expect(r.lossPct).toBeCloseTo(7.1, 1);
  });
});

describe('같은 치수 자투리', () => {
  const T = { w: 600, h: 300 };
  it('양끝 가장자리 띠 두 개(294×300)는 타일 1장', () => {
    expect(tilesForCutsFit([{ w: 294, h: 300 }, { w: 294, h: 300 }], T)).toBe(1);
  });
  it('칼날 몫 때문에 안 들어가면 2장(300+3+300 > 600)', () => {
    expect(tilesForCutsFit([{ w: 300, h: 300 }, { w: 300, h: 300 }], T)).toBe(2);
  });
  it('모양이 꺾인 조각(치수 없음)은 늘 새 타일', () => {
    expect(tilesForCutsFit([undefined, undefined], T)).toBe(2);
  });
  it('대각 패턴 조각은 같은 치수 재사용을 하지 않는다(전부 꺾인 조각)', () => {
    const r = layoutTiles({ outline: sq(1200, 1200), holes: [], tile: T300, pattern: 'diagonal', origin: 'corner' });
    expect(r.tiles.filter((t) => t.cut).every((t) => !t.piece)).toBe(true);
  });
  it('문틀 옆 세로 띠는 직사각형 조각으로 본다', () => {
    const r = layoutTiles({ outline: sq(1200, 1200), holes: [{ x: 400, y: 0, w: 500, h: 1200 }], tile: T300, pattern: 'straight', origin: 'corner' });
    const p = r.tiles.find((t) => t.cut && t.x === 300 && t.y === 0)?.piece;
    expect(p).toEqual({ w: 100, h: 300 });
  });
});
