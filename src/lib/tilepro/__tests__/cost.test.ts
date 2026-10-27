// ──────────────────────────────────────────────
// 전문가용 타일 자재비 계산 시험
//   - 타일 단가 단위 환산(박스/장/㎡), 금액 = 수량 × 단가
//   - 부가세, 수량 직접 수정 반영, 추가 항목, 방수제 켜기
//   - 주소 공유: 단가 포함 여부
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { DEFAULT_TILE_PRO } from '../form';
import { computeTilePro } from '../quantity';
import { DEFAULT_COST, buildCostRows, decodeCost, encodeCost, summarizeCost, tileQty, type CostState } from '../cost';

const form = DEFAULT_TILE_PRO;
const result = computeTilePro(form);
const rowOf = (cost: CostState, id: string) => buildCostRows(form, result, cost).find((r) => r.id === id)!;

describe('타일 단가 단위 환산', () => {
  it('박스·장·㎡ 수량이 물량표와 맞는다', () => {
    expect(tileQty(result, form, 'box')).toBe(result.boxes);
    expect(tileQty(result, form, 'piece')).toBe(result.total);
    // ㎡ = 주문 장 수 × 타일 1장 면적(0.18㎡), 소수 첫째 자리 올림
    expect(tileQty(result, form, 'sqm')).toBeCloseTo(Math.ceil(result.total * 0.18 * 10 - 1e-9) / 10, 5);
  });
  it('단위를 바꾸면 같은 단가라도 금액이 달라진다', () => {
    const box = rowOf({ ...DEFAULT_COST, tileUnit: 'box', prices: { tile_box: 10000 } }, 'tile');
    const piece = rowOf({ ...DEFAULT_COST, tileUnit: 'piece', prices: { tile_piece: 10000 } }, 'tile');
    expect(box.amount).toBe(result.boxes * 10000);
    expect(piece.amount).toBe(result.total * 10000);
    expect(box.unit).toBe('박스');
  });
  it('단가를 안 넣으면 금액 0, 합계도 "단가 없음"', () => {
    const rows = buildCostRows(form, result, DEFAULT_COST);
    expect(rows.every((r) => r.amount === 0)).toBe(true);
    expect(summarizeCost(rows, false).hasPrice).toBe(false);
  });
});

describe('합계·부가세', () => {
  it('부가세 10% 를 더한다', () => {
    const cost = { ...DEFAULT_COST, prices: { tile_box: 10000 } };
    const rows = buildCostRows(form, result, cost);
    const base = summarizeCost(rows, false);
    const vat = summarizeCost(rows, true);
    expect(base.subtotal).toBe(result.boxes * 10000);
    expect(base.total).toBe(base.subtotal);
    expect(vat.vat).toBe(Math.round(base.subtotal * 0.1));
    expect(vat.total).toBe(base.subtotal + vat.vat);
  });
});

describe('수량 수정·추가 항목', () => {
  it('수량을 고치면 금액에 반영되고 자동값은 그대로 남는다', () => {
    const r = rowOf({ ...DEFAULT_COST, qty: { grout: 5 }, prices: { grout: 3000 } }, 'grout');
    expect(r.qty).toBe(5);
    expect(r.amount).toBe(15000);
    expect(r.auto).toBe(result.grout.packs);
  });
  it('추가 항목은 수량 × 단가가 합계에 들어간다', () => {
    const cost: CostState = { ...DEFAULT_COST, extras: [{ name: '운반비', unit: '식', qty: 2, price: 50000 }] };
    const rows = buildCostRows(form, result, cost);
    const x = rows.find((r) => r.id === 'x0')!;
    expect(x.amount).toBe(100000);
    expect(summarizeCost(rows, false).subtotal).toBe(100000);
  });
  it('방수제는 켰을 때만 나온다', () => {
    expect(rowOf(DEFAULT_COST, 'waterproof')).toBeUndefined();
    const w = rowOf({ ...DEFAULT_COST, waterproof: true }, 'waterproof');
    expect(w.auto).toBe(Math.ceil(result.netSqm * 1.5));
  });
  it('마감재 길이는 입력한 m 그대로, 실리콘은 둘레 ÷ 8m 올림', () => {
    expect(rowOf({ ...DEFAULT_COST, edgeM: 3.2 }, 'edge').auto).toBe(3.2);
    // 기본 방 2100×1600 → 둘레 7.4m → 1개
    expect(rowOf(DEFAULT_COST, 'silicone').auto).toBe(1);
  });
  it('수평 클립은 필요 장 수 × 3', () => {
    expect(rowOf(DEFAULT_COST, 'clip').auto).toBe(result.total * 3);
  });
});

describe('주소 공유', () => {
  const cost: CostState = { ...DEFAULT_COST, prices: { grout: 3000 }, extras: [{ name: '양중', unit: '식', qty: 1, price: 70000 }], edgeM: 4, vat: true };
  it('단가 미포함이면 단가가 빠지고 나머지는 남는다', () => {
    const back = decodeCost(encodeCost(cost, false))!;
    expect(back.prices).toEqual({});
    expect(back.extras[0].price).toBe(0);
    expect(back.extras[0].name).toBe('양중');
    expect(back.edgeM).toBe(4);
  });
  it('단가 포함이면 그대로 돌아온다', () => {
    const back = decodeCost(encodeCost(cost, true))!;
    expect(back.prices.grout).toBe(3000);
    expect(back.extras[0].price).toBe(70000);
  });
  it('깨진 글자는 null', () => {
    expect(decodeCost('@@@')).toBeNull();
  });
});
