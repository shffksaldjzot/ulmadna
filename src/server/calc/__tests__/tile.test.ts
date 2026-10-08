// ──────────────────────────────────────────────
// 타일 계산기 서버 모듈 테스트
//
// 확인하는 것(손 검산과 맞는지):
//   1) 간단 모드 욕실 1칸 — 면적(둘레×높이−문)·장 수·박스 올림
//   2) 패턴별 로스율(형아 확정 5/10/12/15/20%)과 로스율 직접 지정
//   3) 박스가 딱 떨어질 때 부동소수 오차로 한 박스 더 올라가지 않는지
//   4) 문·창·욕조 빼는 면적
//   5) 줄눈재·압착시멘트 포 수, 품 수
//   6) 맡김/셀프 비용 층(셀프는 자재+부자재만), 덧방은 철거·방수 없음
//   7) 대형 타일 덧방 경고(막지 않고 경고만), 덧방 조건·로트 확인
//   8) 등급별 자재 금액 순서, 합계 = 비용 줄 합
//   9) 가정 목록(공법·규격·평형), 거실 면적(62건 비율표)
//  10) 입력 검증(범위 밖·형식 오류 400)
//  11) 응답에 단가표 원본이 새지 않는지
//
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { calcTile, bathAreas, livingFloorSqm, TileIncompleteError } from '../tile';
import { parseInput, ValidationError } from '../validate/tile';

describe('타일 계산기 — 수량', () => {
  it('간단 욕실 1칸(공용 1.6×2.1×2.3m, 문 1개) — 벽 300×600 12박스·바닥 300×300 4박스', () => {
    const r = calcTile({ mode: 'simple', scope: 'bath1' });
    // 벽 = (1.6+2.1)×2×2.3 − 0.8×2.0 = 15.42㎡, 바닥 = 1.6×2.1 = 3.36㎡
    expect(r.quantity.wall?.netSqm).toBe(15.4);
    expect(r.quantity.floor?.netSqm).toBe(3.4);
    // 벽: 15.42×1.05 = 16.191㎡ ÷ 0.18㎡ = 89.95 → 90장 → 8장/박스 → 12박스
    expect(r.quantity.wall?.lossPct).toBe(5);
    expect(r.quantity.wall?.pieces).toBe(90);
    expect(r.quantity.wall?.boxes).toBe(12);
    // 바닥: 3.36×1.10 = 3.696㎡ ÷ 0.09㎡ = 41.07 → 42장 → 11장/박스 → 4박스
    expect(r.quantity.floor?.lossPct).toBe(10);
    expect(r.quantity.floor?.pieces).toBe(42);
    expect(r.quantity.floor?.boxes).toBe(4);
  });

  it('욕실 2칸은 안방·공용 두 실을 더하고 실별 박스 합이 전체와 같다', () => {
    const r = calcTile({ mode: 'simple', scope: 'bath2' });
    expect(r.quantity.byRoom).toHaveLength(2);
    const wallSum = r.quantity.byRoom.reduce((s, x) => s + x.wallBoxes, 0);
    const floorSum = r.quantity.byRoom.reduce((s, x) => s + x.floorBoxes, 0);
    expect(wallSum).toBe(r.quantity.wall?.boxes);
    expect(floorSum).toBe(r.quantity.floor?.boxes);
  });

  it('패턴별 로스율 — 엇배열 12%·대각 15%·헤링본 20%, 직접 지정하면 그 값', () => {
    expect(calcTile({ mode: 'simple', scope: 'bath1', pattern: 'offset' }).quantity.wall?.lossPct).toBe(12);
    expect(calcTile({ mode: 'simple', scope: 'bath1', pattern: 'diagonal' }).quantity.floor?.lossPct).toBe(15);
    const h = calcTile({ mode: 'simple', scope: 'bath1', pattern: 'herringbone' });
    // 15.42×1.2 = 18.504 ÷ 0.18 = 102.8 → 103장 → 13박스
    expect(h.quantity.wall?.lossPct).toBe(20);
    expect(h.quantity.wall?.pieces).toBe(103);
    expect(h.quantity.wall?.boxes).toBe(13);
    const zero = calcTile({ mode: 'simple', scope: 'bath1', lossRate: 0 });
    // 15.42 ÷ 0.18 = 85.67 → 86장
    expect(zero.quantity.wall?.pieces).toBe(86);
  });

  it('딱 떨어지는 면적은 한 박스 더 올라가지 않는다(1.2×1.2m 바닥, 600×600 4장/박스, 로스 0)', () => {
    const r = calcTile({
      mode: 'precise',
      rooms: [{ kind: 'floor', widthMm: 1200, depthMm: 1200 }],
      floorTile: { widthMm: 600, lengthMm: 600, piecesPerBox: 4 },
      wallTile: { widthMm: 300, lengthMm: 600 },
      lossRate: 0,
    });
    expect(r.quantity.floor?.pieces).toBe(4);
    expect(r.quantity.floor?.boxes).toBe(1);
    expect(r.quantity.wall).toBeNull();
  });

  it('박스당 장 수를 고치면 박스 수가 바뀐다', () => {
    const a = calcTile({ mode: 'simple', scope: 'bath1', wallTile: { widthMm: 300, lengthMm: 600, piecesPerBox: 8 }, floorTile: { widthMm: 300, lengthMm: 300 } });
    const b = calcTile({ mode: 'simple', scope: 'bath1', wallTile: { widthMm: 300, lengthMm: 600, piecesPerBox: 6 }, floorTile: { widthMm: 300, lengthMm: 300 } });
    expect(a.quantity.wall?.boxes).toBe(12); // 90 ÷ 8
    expect(b.quantity.wall?.boxes).toBe(15); // 90 ÷ 6
  });

  it('문·창·욕조를 빼는 면적 — 2.0×2.0×2.4m 욕실', () => {
    const a = bathAreas({ widthMm: 2000, depthMm: 2000, heightMm: 2400, doors: 1, windows: 1, tub: true });
    // 벽 = 4×2×2.4 = 19.2 − 문 1.6 − 창 0.36 − 욕조 앞판 0.825 = 16.415
    expect(a.wallSqm).toBeCloseTo(16.415, 3);
    // 바닥 = 4 − 욕조 1.05 = 2.95
    expect(a.floorSqm).toBeCloseTo(2.95, 3);
    const noOpen = bathAreas({ widthMm: 2000, depthMm: 2000, heightMm: 2400 });
    expect(noOpen.wallSqm).toBeCloseTo(19.2, 3);
  });

  it('줄눈재·압착시멘트 포 수와 품 수(욕실 1칸, 줄눈 2mm)', () => {
    const r = calcTile({ mode: 'simple', scope: 'bath1' });
    // 줄눈: 벽 15.42×0.1272 + 바닥 3.36×0.1695 = 2.53kg × 1.2 = 3.04kg → 2kg 포 2개
    expect(r.quantity.grout.kg).toBeCloseTo(3.0, 1);
    expect(r.quantity.grout.bags).toBe(2);
    // 공법 자동 추천 — 벽(도기질) 압착: 15.42㎡ × 5.5kg = 84.8kg → 20kg 포 5개
    //                  바닥(자기질) 떠붙임: 3.36㎡ × 18kg = 60.5kg → 40kg 포 2개
    expect(r.quantity.adhesives.find((a) => a.key === 'press')?.bags).toBe(5);
    expect(r.quantity.adhesives.find((a) => a.key === 'mortar')?.bags).toBe(2);
    // 기공: 벽 15.42 ÷ (12×0.6) + 바닥 3.36 ÷ (10×0.6) = 2.14 + 0.56 = 2.70 → 0.5 단위 올림 3일
    expect(r.quantity.mandays).toBe(3);
    // 조공: 2.14×0.5(압착) + 0.56×1(떠붙임) = 1.63 → 2일
    expect(r.quantity.helperDays).toBe(2);
  });
});

describe('타일 계산기 — 비용·확인 항목', () => {
  it('철거 후 새로(맡김)는 철거·방수·인건·경비가 붙고, 합계는 비용 줄 합과 같다', () => {
    const r = calcTile({ mode: 'simple', scope: 'bath1', method: 'demolish' });
    const layers = new Set(r.cost.breakdown.map((l) => l.layer));
    for (const l of ['자재', '부자재', '철거', '방수', '인건', '경비'] as const) expect(layers.has(l)).toBe(true);
    // 인건 = 기공·조공·양중
    expect(r.cost.breakdown.filter((l) => l.layer === '인건').map((l) => l.key)).toEqual(['labor', 'helper', 'lifting']);
    const sumMin = r.cost.breakdown.reduce((s, l) => s + l.amountMin, 0);
    const sumMax = r.cost.breakdown.reduce((s, l) => s + l.amountMax, 0);
    expect(Math.abs(r.cost.min - sumMin)).toBeLessThanOrEqual(500);
    expect(Math.abs(r.cost.max - sumMax)).toBeLessThanOrEqual(500);
    expect(r.cost.min).toBeLessThanOrEqual(r.cost.mid);
    expect(r.cost.mid).toBeLessThanOrEqual(r.cost.max);
  });

  it('덧방은 철거·방수가 없고, 셀프는 자재+부자재만(품 0)', () => {
    const overlay = calcTile({ mode: 'simple', scope: 'bath1', method: 'overlay' });
    expect(overlay.cost.breakdown.some((l) => l.layer === '철거' || l.layer === '방수')).toBe(false);
    const self = calcTile({ mode: 'simple', scope: 'bath1', method: 'demolish', service: 'self' });
    expect(self.cost.breakdown.every((l) => l.layer === '자재' || l.layer === '부자재')).toBe(true);
    expect(self.quantity.mandays).toBe(0);
    const pro = calcTile({ mode: 'simple', scope: 'bath1', method: 'demolish', service: 'pro' });
    expect(self.cost.max).toBeLessThan(pro.cost.min);
  });

  it('등급이 오르면 자재 금액도 오른다(보급 < 중급 < 고급)', () => {
    const mat = (grade: 'basic' | 'mid' | 'high') =>
      calcTile({ mode: 'simple', scope: 'bath1', grade }).cost.breakdown.filter((l) => l.layer === '자재').reduce((s, l) => s + l.amountMax, 0);
    expect(mat('basic')).toBeLessThan(mat('mid'));
    expect(mat('mid')).toBeLessThan(mat('high'));
  });

  it('대형 타일(600×600 이상) 덧방은 막지 않고 경고만 붙는다', () => {
    const big = calcTile({ mode: 'simple', scope: 'bath1', method: 'overlay', wallTile: { widthMm: 600, lengthMm: 600 }, floorTile: { widthMm: 600, lengthMm: 600 } });
    expect(big.checks).toContain('largeOverlay');
    expect(big.checks).toContain('overlayConditions');
    expect(big.quantity.wall?.boxes).toBeGreaterThan(0);
    const small = calcTile({ mode: 'simple', scope: 'bath1', method: 'overlay' });
    expect(small.checks).not.toContain('largeOverlay');
    const demo = calcTile({ mode: 'simple', scope: 'bath1', method: 'demolish', wallTile: { widthMm: 600, lengthMm: 600 } });
    expect(demo.checks).toEqual(['lot']);
  });

  it('안 고른 값은 가정 목록에 남는다 — 거실은 덧방이 철거 없음으로 바뀐다', () => {
    const r = calcTile({ mode: 'simple', scope: 'bath1' });
    expect(r.assumed).toEqual(expect.arrayContaining(['method', 'size', 'kind', 'setting', 'pattern', 'grade']));
    const living = calcTile({ mode: 'simple', scope: 'living', method: 'overlay' });
    expect(living.assumed).toContain('pyeong');
    expect(living.resolved.method).toBe('none');
    expect(living.resolved.pyeong).toBe(34);
    const picked = calcTile({ mode: 'simple', scope: 'living', method: 'demolish', pyeong: 24, floorTile: { widthMm: 600, lengthMm: 1200 } });
    expect(picked.assumed).not.toContain('pyeong');
    expect(picked.assumed).not.toContain('size');
  });

  it('거실 면적은 평형이 클수록 크다(34평 약 40㎡)', () => {
    const s34 = livingFloorSqm(34, 3);
    expect(s34).toBeGreaterThan(35);
    expect(s34).toBeLessThan(45);
    expect(livingFloorSqm(44, 3)).toBeGreaterThan(s34);
    expect(livingFloorSqm(24, 3)).toBeLessThan(s34);
  });

  it('응답에 단가표 원본(㎡당·인당 단가)이 없다', () => {
    const json = JSON.stringify(calcTile({ mode: 'simple', scope: 'bath2', method: 'demolish' }));
    expect(json).not.toMatch(/unitPrice/);
    expect(json).not.toContain('310000');
    expect(json).not.toContain('21500');
  });
});

describe('타일 계산기 — 정확 모드 미완성 실(2026-10-03 검사관 지적)', () => {
  it('치수가 덜 들어간 실은 빼고 완성된 실만 계산한다 — 0원이 나오지 않는다', () => {
    const r = calcTile({
      mode: 'precise',
      rooms: [
        { kind: 'bath', widthMm: 1600, depthMm: 2100, heightMm: 2300, doors: 1 },
        { kind: 'floor', widthMm: 2000 }, // 세로가 없다 → 계산에서 뺀다
      ],
      wallTile: { widthMm: 300, lengthMm: 600 },
      floorTile: { widthMm: 300, lengthMm: 300 },
    });
    expect(r.quantity.byRoom).toHaveLength(1);
    expect(r.quantity.skippedRooms).toBe(1);
    expect(r.quantity.wall?.boxes).toBe(12);
    expect(r.cost.min).toBeGreaterThan(0);
    expect(r.assumed).not.toContain('dims');
  });

  it('완성된 실이 하나도 없으면 API 검증은 400, 엔진도 계산하지 않는다', () => {
    const body = { mode: 'precise', rooms: [{ kind: 'floor', widthMm: 2000 }, { kind: 'bath', widthMm: 1600, depthMm: 2100 }] };
    expect(() => parseInput(body)).toThrow(ValidationError);
    expect(() => calcTile({ mode: 'precise', rooms: [{ kind: 'floor', widthMm: 2000 }] })).toThrow(TileIncompleteError);
  });

  it('벽면 실은 높이 300mm(주방 상판 위 벽)부터 받는다, 욕실은 1800mm부터', () => {
    expect(parseInput({ mode: 'precise', rooms: [{ kind: 'wall', widthMm: 2400, heightMm: 600 }] }).rooms?.[0].heightMm).toBe(600);
    expect(() => parseInput({ mode: 'precise', rooms: [{ kind: 'wall', widthMm: 2400, heightMm: 200 }] })).toThrow(ValidationError);
    expect(() => parseInput({ mode: 'precise', rooms: [{ kind: 'bath', widthMm: 1600, depthMm: 2100, heightMm: 600 }] })).toThrow(ValidationError);
  });
});

describe('타일 계산기 — 입력 검증', () => {
  it('정상 입력은 통과, 간단 모드에 공간이 없으면 거절', () => {
    expect(parseInput({ mode: 'simple', scope: 'bath1' }).scope).toBe('bath1');
    expect(() => parseInput({ mode: 'simple' })).toThrow(ValidationError);
    expect(() => parseInput({ mode: 'x', scope: 'bath1' })).toThrow(ValidationError);
  });

  it('범위 밖 숫자·형식 오류는 거절(설계서 §6 범위)', () => {
    expect(() => parseInput({ mode: 'simple', scope: 'living', pyeong: 5 })).toThrow(ValidationError);
    expect(() => parseInput({ mode: 'simple', scope: 'bath1', groutMm: 20 })).toThrow(ValidationError);
    expect(() => parseInput({ mode: 'simple', scope: 'bath1', lossRate: 0.5 })).toThrow(ValidationError);
    expect(() => parseInput({ mode: 'simple', scope: 'bath1', wallTile: { widthMm: 50, lengthMm: 600 } })).toThrow(ValidationError);
    expect(() => parseInput({ mode: 'precise', rooms: [{ kind: 'bath', widthMm: 1600, depthMm: 2100, heightMm: 3500 }] })).toThrow(ValidationError);
    expect(() => parseInput({ mode: 'precise', rooms: 'abc' })).toThrow(ValidationError);
    expect(() => parseInput({ mode: 'precise', rooms: Array.from({ length: 7 }, () => ({ kind: 'floor', areaSqm: 3 })) })).toThrow(ValidationError);
  });
});

describe('타일 계산기 — 2026-10-08 개편(정확 모드 공간 하나·종류·공법 추천·시공 조건)', () => {
  const bathWall = { mode: 'precise' as const, space: 'bathWall' as const, dims: { widthMm: 1600, depthMm: 2100, heightMm: 2300 } };

  it('정확 모드 욕실 벽 — 벽만 계산, 도기질·압착 추천, 문 1개 기본 차감', () => {
    const r = calcTile(bathWall);
    expect(r.quantity.floor).toBeNull();
    expect(r.quantity.wall?.netSqm).toBe(15.4);
    expect(r.resolved.tileKind).toBe('earthenware');
    expect(r.resolved.setting).toBe('press');
    expect(r.resolved.settingRecommended).toBe(true);
    // 욕실 + 철거 후 새로(기본) → 방수 켬
    expect(r.resolved.waterproof).toBe(true);
    expect(r.cost.breakdown.some((l) => l.key === 'waterproof')).toBe(true);
  });

  it('공법 추천 — 포세린 벽은 본드, 바닥은 떠붙임 / 고르면 그 값', () => {
    const wallP = calcTile({ ...bathWall, tileKind: 'porcelain', wallTile: { widthMm: 600, lengthMm: 600 } });
    expect(wallP.resolved.setting).toBe('bond');
    expect(wallP.quantity.adhesives.map((a) => a.key)).toEqual(['bond']);
    const floor = calcTile({ mode: 'precise', space: 'entrance', dims: { widthMm: 1200, depthMm: 1500 } });
    expect(floor.resolved.tileKind).toBe('porcelain');
    expect(floor.resolved.setting).toBe('mortar');
    const picked = calcTile({ mode: 'precise', space: 'entrance', dims: { widthMm: 1200, depthMm: 1500 }, setting: 'press' });
    expect(picked.resolved.setting).toBe('press');
    expect(picked.resolved.settingRecommended).toBe(false);
    expect(picked.assumed).not.toContain('setting');
  });

  it('대형 타일(600×1200)은 정배열 벽도 로스 10% 이상', () => {
    const r = calcTile({ ...bathWall, tileKind: 'largePorcelain', wallTile: { widthMm: 600, lengthMm: 1200 } });
    expect(r.quantity.wall?.lossPct).toBe(10);
    // 헤링본(20%)은 하한보다 크니 그대로
    expect(calcTile({ ...bathWall, tileKind: 'largePorcelain', wallTile: { widthMm: 600, lengthMm: 1200 }, pattern: 'herringbone' }).quantity.wall?.lossPct).toBe(20);
  });

  it('종류가 비쌀수록 자재비가 오른다(자기질 < 포세린 < 대형 포세린)', () => {
    const mat = (tileKind: 'stoneware' | 'porcelain' | 'largePorcelain') =>
      calcTile({ mode: 'precise', space: 'livingFloor', dims: { widthMm: 4000, depthMm: 6000 }, tileKind })
        .cost.breakdown.filter((l) => l.layer === '자재')
        .reduce((s, l) => s + l.amountMax, 0);
    expect(mat('stoneware')).toBeLessThan(mat('porcelain'));
    expect(mat('porcelain')).toBeLessThan(mat('largePorcelain'));
  });

  it('등급 3단 총액 — 보급 < 고급, 고른 등급은 본 금액과 같다', () => {
    const r = calcTile({ mode: 'simple', scope: 'bath1', grade: 'mid' });
    const g = r.cost.gradeTotals;
    expect(g.basic.max).toBeLessThan(g.high.max);
    expect(g.basic.min).toBeLessThanOrEqual(g.mid.min);
    expect(g.mid).toEqual({ min: r.cost.min, max: r.cost.max });
  });

  it('절약 금액 — 철거 욕실은 덧방, 에폭시는 기본 줄눈으로 바꾸면 줄어든다(큰 것부터)', () => {
    const r = calcTile({ mode: 'simple', scope: 'bath1', method: 'demolish', groutType: 'epoxy' });
    const keys = r.cost.savings.map((s) => s.key);
    expect(keys).toContain('overlay');
    expect(keys).toContain('cementGrout');
    expect(keys).toContain('basicGrade');
    for (let i = 1; i < r.cost.savings.length; i += 1) expect(r.cost.savings[i - 1].amount).toBeGreaterThanOrEqual(r.cost.savings[i].amount);
    // 에폭시는 시공 줄이 따로 붙는다
    expect(r.cost.breakdown.some((l) => l.key === 'epoxyLabor')).toBe(true);
  });

  it('시공 조건 — 방수 끄면 줄이 빠지고 경고, 난방 위면 인건이 오른다, 코너비드·실리콘 끄면 0개', () => {
    const off = calcTile({ ...bathWall, waterproof: false });
    expect(off.cost.breakdown.some((l) => l.key === 'waterproof')).toBe(false);
    expect(off.checks).toContain('noWaterproof');
    const floor = { mode: 'precise' as const, space: 'livingFloor' as const, dims: { widthMm: 6000, depthMm: 8000 } };
    const cold = calcTile(floor);
    const warm = calcTile({ ...floor, heated: true });
    expect(warm.quantity.mandays).toBeGreaterThanOrEqual(cold.quantity.mandays);
    expect(warm.cost.max).toBeGreaterThan(cold.cost.max);
    expect(warm.checks).toContain('heatedFloor');
    const bare = calcTile({ ...bathWall, cornerBead: false, silicone: false });
    expect(bare.quantity.cornerBeads).toBe(0);
    expect(bare.quantity.siliconeTubes).toBe(0);
    expect(calcTile(bathWall).quantity.cornerBeads).toBe(4);
  });

  it('간단 주방 벽 — 기본 덧방(철거·방수 없음), 34평 2.4㎡', () => {
    const r = calcTile({ mode: 'simple', scope: 'kitchen' });
    expect(r.resolved.method).toBe('overlay');
    expect(r.quantity.wall?.netSqm).toBe(2.4);
    expect(r.cost.breakdown.some((l) => l.layer === '철거' || l.layer === '방수')).toBe(false);
  });

  it('검증 — 공간만 오고 치수가 없거나 범위 밖이면 400, 주방 벽은 높이 600 허용', () => {
    expect(() => parseInput({ mode: 'precise', space: 'bathWall' })).toThrow(ValidationError);
    expect(() => parseInput({ mode: 'precise', space: 'bathWall', dims: { widthMm: 1600, depthMm: 2100 } })).toThrow(ValidationError);
    expect(() => parseInput({ mode: 'precise', space: 'bathWall', dims: { widthMm: 1600, depthMm: 2100, heightMm: 3000 } })).toThrow(ValidationError);
    expect(() => parseInput({ mode: 'precise', space: 'entrance', dims: { widthMm: 0, depthMm: 1500 } })).toThrow(ValidationError);
    expect(parseInput({ mode: 'precise', space: 'kitchenWall', dims: { widthMm: 2400, heightMm: 600 } }).dims?.heightMm).toBe(600);
    expect(() => parseInput({ mode: 'simple', scope: 'bath1', tileKind: 'marble' })).toThrow(ValidationError);
    expect(parseInput({ mode: 'simple', scope: 'bath1', setting: 'bond' }).setting).toBe('bond');
  });

  it('응답에 단가표 원본이 없다(새 단가 포함)', () => {
    const json = JSON.stringify(calcTile({ ...bathWall, tileKind: 'porcelain', groutType: 'epoxy' }));
    expect(json).not.toContain('310000');
    expect(json).not.toMatch(/unitLabel|basis"/);
  });
});
