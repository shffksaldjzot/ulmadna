// ──────────────────────────────────────────────
// 바닥재 계산기 서버 모듈 테스트
//
// 확인하는 것:
//   1) 34평 3베이 기본 물량이 손으로 검산한 값과 맞는가 (박스 수 · 비용 순서)
//   2) 장판 재단이 형아 엑셀 예시(3.6×4.2m 방 → 8.6m)와 똑같이 나오는가
//   3) 실측 깔아보기 로스가 추정 로스와 다른 값으로 나오는가
//   4) 철거·걸레받이 토글이 총액과 구성 줄에 제대로 반영되는가
//   5) 종류별로 붙는 부자재가 갈리는가 (마루 본드 / LVT 접착제 / 장판 용착제)
//   6) 제품을 직접 넣으면 금액이 바뀌는가
//   7) 응답에 단가 출처·문서명이 새지 않는가
//   8) API 라우트가 잘못된 입력을 막는가
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { calcFlooring } from '../flooring';
import { FLOORING_PROCESS } from '../schema/flooring';
import { findFlooringSubmaterial } from '../data/flooring-submaterials';
import { getFlooringSubmaterialBand } from '@/server/pricing/flooring';
import { ceilSafe, ceilSafe1 } from '../cutting/round';
import { calcFlooringLabor, laborSpecManDays } from '../labor-flooring';
import { calcSheet } from '../cutting/sheet';
import { calcRollFloor } from '../cutting/rollFloor';
import { POST, GET } from '@/app/api/calc/flooring/route';

/** 테스트에서 자주 쓰는 34평 3베이 전체 조건 */
const BASE_34 = { mode: '평형' as const, pyeong: 34, bay: 3 as const, scope: '전체' as const };

/** 테스트용 POST 요청 하나를 만든다 */
function post(body: unknown) {
  return new Request('http://localhost/api/calc/flooring', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── 1. 34평 3베이 기본 검산 ──────────────────────

describe('34평 3베이 전체 · 강마루 기본', () => {
  const r = calcFlooring({ ...BASE_34, kind: '마루' });

  it('바닥 면적이 코어 엔진 84타입 바닥(마루+타일, 현관 제외) 범위로 나온다', () => {
    // 84타입 마루 57.5㎡ + 타일 바닥 10.7㎡ = 68.2㎡
    expect(r.quantity.floorSqm).toBeGreaterThan(60);
    expect(r.quantity.floorSqm).toBeLessThan(75);
  });

  it('박스 수가 손 검산(바닥 ㎡ × 1.05 ÷ 박스당 3.19㎡)과 맞는다', () => {
    const expected = Math.ceil((r.quantity.floorSqm * 1.05) / 3.19);
    expect(r.quantity.units).toBe(expected);
    expect(r.quantity.unit).toBe('박스');
    // 박스당 42장이므로 총 장 수도 같이 나온다
    expect(r.quantity.pieces).toBe(expected * 42);
  });

  it('평형 모드라 로스는 마루 기본 5% 추정이다', () => {
    expect(r.quantity.lossMode).toBe('추정');
    expect(r.quantity.lossPct).toBe(5);
    expect(r.quantity.inputMode).toBe('평형');
  });

  it('비용이 최저 < 중간 < 최고 순서로 나온다', () => {
    expect(r.cost.min).toBeGreaterThan(0);
    expect(r.cost.min).toBeLessThan(r.cost.mid);
    expect(r.cost.mid).toBeLessThan(r.cost.max);
  });

  it('구성 보기에 자재·시공·경비 줄이 전부 있다', () => {
    const keys = r.cost.breakdown.map((b) => b.key);
    expect(keys).toContain('material');
    expect(keys).toContain('labor');
    expect(keys).toContain('overhead');
    // 기본값은 구축 기준이라 철거·폐기물·걸레받이도 들어 있다
    expect(keys).toContain('removal');
    expect(keys).toContain('waste');
    expect(keys).toContain('baseboard');
  });

  it('실별 보기의 박스 수 합계가 총 박스 수와 같다', () => {
    const sum = r.quantity.byRoom.reduce((s, x) => s + x.units, 0);
    expect(sum).toBe(r.quantity.units);
  });

  it('욕실·현관은 실별 보기에 없다', () => {
    const keys = r.quantity.byRoom.map((x) => x.key);
    expect(keys).not.toContain('bath1');
    expect(keys).not.toContain('bath2');
    expect(keys).not.toContain('entrance');
  });
});

// ── 2. 장판 재단 — 형아 엑셀 예시 검산 ─────────────

describe('장판 재단 (형아 엑셀 계산식_로스율 예시)', () => {
  it('3.6m × 4.2m 방 · 롤 폭 1.83m 는 8.6m 가 나온다', () => {
    const cut = calcRollFloor({
      floorSqm: 3.6 * 4.2,
      rooms: [{ name: '안방', widthM: 3.6, lengthM: 4.2 }],
      spec: { widthM: 1.83 },
      cutMarginM: 0.1,
    });
    // 방향 A = 올림(3.6÷1.83)=2 × (4.2+0.1) = 8.6m  ← 채택
    // 방향 B = 올림(4.2÷1.83)=3 × (3.6+0.1) = 11.1m
    expect(cut.units).toBe(8.6);
    expect(cut.unitName).toBe('m');
    expect(cut.lossMode).toBe('실제');
  });

  it('계산기 전체를 돌려도 같은 8.6m 가 나온다', () => {
    const r = calcFlooring({
      mode: '실측',
      kind: '장판',
      rooms: [{ name: '안방', widthM: 3.6, depthM: 4.2 }],
    });
    expect(r.quantity.unit).toBe('m');
    expect(r.quantity.units).toBe(8.6);
    expect(r.quantity.lossMode).toBe('실제');
  });

  it('평형 모드 장판은 추정 꼬리표가 붙는다', () => {
    const r = calcFlooring({ ...BASE_34, kind: '장판' });
    expect(r.quantity.lossMode).toBe('추정');
    expect(r.quantity.units).toBeGreaterThan(r.quantity.floorSqm / 1.83);
  });
});

// ── 3. 마루 깔아보기 — 실측이 추정과 달라야 한다 ────

describe('마루 실측 깔아보기', () => {
  const rooms = [
    { name: '안방', widthM: 3.6, depthM: 4.2 },
    { name: '거실', widthM: 5, depthM: 4 },
  ];
  const measured = calcFlooring({ mode: '실측', kind: '마루', rooms });

  it('로스 모드가 실제로 바뀌고, 값도 추정 5%와 다르다', () => {
    expect(measured.quantity.lossMode).toBe('실제');
    expect(measured.quantity.lossPct).not.toBe(5);
  });

  it('자투리 재사용 기준(300mm)을 없애면 장이 더 든다', () => {
    const spec = { widthMm: 95, lengthMm: 800, piecesPerBox: 42, sqmPerBox: 3.19 };
    const withReuse = calcSheet({
      floorSqm: 35.1,
      rooms: rooms.map((r) => ({ name: r.name, widthM: r.widthM, lengthM: r.depthM })),
      spec,
      reuseMinMm: 300,
    });
    const noReuse = calcSheet({
      floorSqm: 35.1,
      rooms: rooms.map((r) => ({ name: r.name, widthM: r.widthM, lengthM: r.depthM })),
      spec,
      // 자투리를 아예 못 쓰게 하면(2.4m = 장 길이보다 김) 재사용이 한 번도 안 일어난다
      reuseMinMm: 2400,
    });
    expect(noReuse.lossPct).toBeGreaterThan(withReuse.lossPct);
  });
});

// ── 4. 토글 (철거 · 걸레받이) ─────────────────────

describe('토글', () => {
  const on = calcFlooring({ ...BASE_34, kind: '마루' });

  it('기존 바닥재 철거를 끄면 철거·폐기물 줄이 빠지고 총액이 준다', () => {
    const off = calcFlooring({ ...BASE_34, kind: '마루', removeOld: false });
    const keys = off.cost.breakdown.map((b) => b.key);
    expect(keys).not.toContain('removal');
    expect(keys).not.toContain('waste');
    expect(off.cost.max).toBeLessThan(on.cost.max);
  });

  it('걸레받이를 끄면 걸레받이·씰란트 줄이 빠지고 총액이 준다', () => {
    const off = calcFlooring({ ...BASE_34, kind: '마루', baseboard: false });
    const keys = off.cost.breakdown.map((b) => b.key);
    expect(keys).not.toContain('baseboard');
    expect(keys).not.toContain('sealant');
    expect(off.cost.max).toBeLessThan(on.cost.max);
  });
});

// ── 5. 시공 범위 ─────────────────────────────────

describe('시공 범위', () => {
  const all = calcFlooring({ ...BASE_34, kind: '마루', scope: '전체' });
  const roomOnly = calcFlooring({ ...BASE_34, kind: '마루', scope: '방만' });
  const living = calcFlooring({ ...BASE_34, kind: '마루', scope: '거실주방' });

  it('방만 범위는 전체보다 면적도 금액도 작다', () => {
    expect(roomOnly.quantity.floorSqm).toBeLessThan(all.quantity.floorSqm);
    expect(roomOnly.cost.max).toBeLessThan(all.cost.max);
  });

  it('방만 + 거실·주방을 더하면 전체 면적이 된다', () => {
    const sum = roomOnly.quantity.floorSqm + living.quantity.floorSqm;
    expect(Math.abs(sum - all.quantity.floorSqm)).toBeLessThan(0.5);
  });
});

// ── 6. 종류별 부자재 분기 ─────────────────────────

describe('종류별 부자재', () => {
  it('마루는 마루 본드만 붙고 LVT 접착제는 안 붙는다', () => {
    const r = calcFlooring({ ...BASE_34, kind: '마루' });
    const keys = r.submaterials.map((s) => s.key);
    expect(keys).toContain('bond');
    expect(keys).not.toContain('adhesive');
    expect(keys).not.toContain('seam');
  });

  it('데코타일은 LVT 접착제만 붙고 마루 본드는 안 붙는다', () => {
    const r = calcFlooring({ ...BASE_34, kind: '데코타일' });
    const keys = r.submaterials.map((s) => s.key);
    expect(keys).toContain('adhesive');
    expect(keys).not.toContain('bond');
  });

  it('장판은 용착제가 붙는다', () => {
    const r = calcFlooring({ ...BASE_34, kind: '장판' });
    const keys = r.submaterials.map((s) => s.key);
    expect(keys).toContain('seam');
    expect(keys).not.toContain('bond');
    expect(keys).not.toContain('adhesive');
  });
});

// ── 7. 제품 직접 입력 ─────────────────────────────

describe('제품 직접 입력', () => {
  it('박스 가격을 올리면 자재 금액이 그만큼 오른다', () => {
    const r = calcFlooring({
      ...BASE_34,
      kind: '마루',
      product: { pricePerBox: 120000, sqmPerBox: 3.19, pcsPerBox: 42, widthMm: 95, lengthMm: 800, sourceLabel: '구정마루 마뷸러스' },
    });
    const material = r.cost.breakdown.find((b) => b.key === 'material');
    expect(material).toBeDefined();
    // 직접 입력값은 최저 = 최고 고정값이다
    expect(material?.unitPriceMin).toBe(120000);
    expect(material?.unitPriceMax).toBe(120000);
    expect(material?.amountMin).toBe(r.quantity.units * 120000);
    expect(material?.note).toBe('구정마루 마뷸러스');
  });

  it('제품 초기 로스율이 헤링본(12%)이면 박스가 더 든다', () => {
    const normal = calcFlooring({ ...BASE_34, kind: '마루' });
    const herringbone = calcFlooring({ ...BASE_34, kind: '마루', product: { lossRate: 0.12 } });
    expect(herringbone.quantity.lossPct).toBe(12);
    expect(herringbone.quantity.units).toBeGreaterThan(normal.quantity.units);
  });

  it('장판 m 가격을 넣으면 그 값으로 계산된다', () => {
    const r = calcFlooring({ ...BASE_34, kind: '장판', product: { pricePerM: 22000, rollWidthM: 1.83, thicknessMm: 2.2 } });
    const material = r.cost.breakdown.find((b) => b.key === 'material');
    expect(material?.unitPriceMin).toBe(22000);
    expect(material?.note).toBe('직접 입력');
  });
});

// ── 8. 인건 ─────────────────────────────────────

describe('인건', () => {
  it('아주 작은 공사도 최소 1품이 나온다', () => {
    const labor = calcFlooringLabor({ floorSqm: 3, kind: '장판' });
    expect(labor.manDays).toBe(1);
  });

  it('헤링본이면 인건비가 더 든다', () => {
    const plain = calcFlooringLabor({ floorSqm: 100, kind: '마루' });
    const herring = calcFlooringLabor({ floorSqm: 100, kind: '마루', isHerringbone: true });
    expect(herring.baseAmount).toBeGreaterThan(plain.baseAmount);
  });

  it('표준품셈 대조 함수가 인·일을 돌려준다 (화면에는 안 쓴다)', () => {
    const spec = laborSpecManDays({ floorSqm: 68.2, kind: '마루' });
    expect(spec.interior).toBeGreaterThan(0);
    expect(spec.total).toBeGreaterThan(spec.interior);
  });
});

// ── 9. 단가·산식이 응답으로 새지 않는가 ─────────────

describe('단가·산식 보호', () => {
  it('구성 보기 note 에 출처 문서명·엑셀·견적서 번호가 들어가지 않는다', () => {
    const r = calcFlooring({ ...BASE_34, kind: '마루' });
    const joined = r.cost.breakdown.map((b) => b.note).join(' ') +
      r.submaterials.map((s) => s.basis).join(' ') + r.cost.basisLine;
    for (const banned of ['엑셀', 'EST-', 'ulmadna_db', '설계서', '표준품셈', '원/평', '원/㎡']) {
      expect(joined).not.toContain(banned);
    }
  });
});

// ── 10. API 라우트 ───────────────────────────────

describe('POST /api/calc/flooring', () => {
  it('평형 모드 기본 요청이 계산 결과를 돌려준다', async () => {
    const res = await POST(post({ mode: '평형', pyeong: 34, bay: 3, kind: '마루' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quantity.units).toBeGreaterThan(0);
    expect(json.cost.min).toBeGreaterThan(0);
    expect(json.submaterials.length).toBeGreaterThan(0);
  });

  it('종류(kind)를 안 넣으면 400', async () => {
    const res = await POST(post({ mode: '평형', pyeong: 34 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('kind');
  });

  it('평형 모드인데 평형이 없으면 400', async () => {
    const res = await POST(post({ mode: '평형', kind: '마루' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('pyeong');
  });

  it('실측 모드인데 방 목록이 없으면 400', async () => {
    const res = await POST(post({ mode: '실측', kind: '마루' }));
    expect(res.status).toBe(400);
  });

  it('베이가 5면 400', async () => {
    const res = await POST(post({ pyeong: 34, bay: 5, kind: '마루' }));
    expect(res.status).toBe(400);
  });

  it('범위 값이 이상하면 400', async () => {
    const res = await POST(post({ pyeong: 34, kind: '마루', scope: '욕실만' }));
    expect(res.status).toBe(400);
  });

  it('JSON 이 아니면 400', async () => {
    const req = new Request('http://localhost/api/calc/flooring', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('실측 모드 요청이 실제 로스로 계산된다', async () => {
    const res = await POST(post({
      mode: '실측',
      kind: '마루',
      rooms: [{ name: '거실', widthM: 5, depthM: 4 }, { name: '안방', widthM: 3.6, depthM: 4.2 }],
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quantity.lossMode).toBe('실제');
  });
});

describe('GET /api/calc/flooring', () => {
  it('GET 은 405 로 막는다', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
  });
});


// ──────────────────────────────────────────────
// 2026-09-10 검사관 1라운드 지적 반영 확인
// ──────────────────────────────────────────────

describe('검사관 1 — 실측 모드는 시공 범위를 무시한다', () => {
  // 사용자가 방 이름을 "방1 · 방2"처럼 적으면 엔진이 방 키를 못 알아본다.
  // 그때 범위를 적용하면 방이 통째로 빠지는 사고가 나서, 실측은 적어 준 방을 전부 계산한다.
  const rooms = [
    { name: '방1', widthM: 3.6, depthM: 4.2 },
    { name: '방2', widthM: 3, depthM: 3 },
    { name: '방3', widthM: 3.2, depthM: 3.4 },
  ];

  it('실측 방 3개 + 범위 "방만" 이 전체와 똑같이 나온다', () => {
    const all = calcFlooring({ mode: '실측', kind: '마루', rooms, scope: '전체' });
    const roomOnly = calcFlooring({ mode: '실측', kind: '마루', rooms, scope: '방만' });
    expect(roomOnly.quantity.floorSqm).toBe(all.quantity.floorSqm);
    expect(roomOnly.quantity.units).toBe(all.quantity.units);
    expect(roomOnly.quantity.byRoom.length).toBe(3);
    expect(roomOnly.cost.max).toBe(all.cost.max);
  });

  it('실측 방 3개 + 범위 "거실주방" 도 전체와 똑같이 나온다', () => {
    const all = calcFlooring({ mode: '실측', kind: '마루', rooms, scope: '전체' });
    const living = calcFlooring({ mode: '실측', kind: '마루', rooms, scope: '거실주방' });
    expect(living.quantity.floorSqm).toBe(all.quantity.floorSqm);
    expect(living.quantity.byRoom.length).toBe(3);
  });
});

describe('검사관 2 — 깔아보기 올림이 소수점 오차에 안 걸린다', () => {
  it('143mm 장 · 2.145m 방은 15열이다 (16열이 아니다)', () => {
    // 2.145 ÷ 0.143 은 딱 15인데 컴퓨터가 15.000000000000002 로 계산한다
    expect(2.145 / 0.143).toBeGreaterThan(15);
    expect(ceilSafe(2.145 / 0.143)).toBe(15);

    const cut = calcSheet({
      floorSqm: 2.145 * 0.8,
      rooms: [{ name: '방', widthM: 2.145, lengthM: 0.8 }],
      spec: { widthMm: 143, lengthMm: 800, piecesPerBox: 1, sqmPerBox: 0.1144 },
    });
    // 열 15개 × 열마다 1장 = 15장 (예전 올림이면 16장이 나왔다)
    expect(cut.detail?.neededPieces).toBe(15);
  });
});

describe('검사관 3 — 장판 길이 올림도 소수점 오차에 안 걸린다', () => {
  it('폭 1줄 · 세로 1.1m 방은 1.2m 다 (1.3m 가 아니다)', () => {
    expect(1.1 + 0.1).toBeGreaterThan(1.2);
    expect(ceilSafe1(1.1 + 0.1)).toBe(1.2);

    const cut = calcRollFloor({
      floorSqm: 1.5 * 1.1,
      rooms: [{ name: '방', widthM: 1.5, lengthM: 1.1 }],
      spec: { widthM: 1.83 },
      cutMarginM: 0.1,
    });
    expect(cut.units).toBe(1.2);
  });
});

describe('검사관 4·14 — 부자재 단가를 엑셀 데이터에서 읽어 온다', () => {
  it('마루 본드 단가가 데이터 파일의 값과 똑같다', () => {
    const row = findFlooringSubmaterial('maru_bond');
    const band = getFlooringSubmaterialBand('bond');
    expect(row?.price).toBeTruthy();
    expect(band?.min).toBe(row?.price);
    expect(band?.max).toBe(row?.price);
  });

  it('LVT 접착제는 엑셀 데코타일 본드 단일가(20,500원)를 쓰고 등급이 C 다', () => {
    const row = findFlooringSubmaterial('decotile_bond');
    const band = getFlooringSubmaterialBand('adhesive');
    expect(row?.price).toBe(20500);
    expect(band?.min).toBe(20500);
    expect(band?.max).toBe(20500);
    expect(band?.등급).toBe('C');
  });

  it('용착제·씰란트도 데이터 파일 값과 똑같다', () => {
    expect(getFlooringSubmaterialBand('seam')?.min).toBe(findFlooringSubmaterial('jangpan_seam')?.price);
    expect(getFlooringSubmaterialBand('sealant')?.min).toBe(findFlooringSubmaterial('sealant')?.price);
  });
});

describe('검사관 5 — 걸레받이 m 단가를 공급 평 기준으로 환산한다', () => {
  it('8,700 ~ 14,300원/m 이고 등급은 C 다', () => {
    const band = getFlooringSubmaterialBand('baseboard');
    // 공급 34평 · 걸레받이 78.3m → 2.30m/평. 평당 2만~3.3만을 이 값으로 나눈다.
    expect(band?.min).toBe(8700);
    expect(band?.max).toBe(14300);
    expect(band?.등급).toBe('C');
  });
});

describe('검사관 7 — 평형 모드에서 둘레도 같이 정규화된다', () => {
  it('둘레가 걸레받이 물량과 어긋나지 않는다', () => {
    const r = calcFlooring({ ...BASE_34, kind: '마루' });
    const baseboard = r.submaterials.find((x) => x.key === 'baseboard');
    // 걸레받이 = 둘레 × 1.05 (소수 1자리)
    expect(baseboard?.qty).toBe(Math.round(r.quantity.perimeterM * 1.05 * 10) / 10);
    // 정규화 배율(면적 68.2 ÷ 비율표 70.6)의 제곱근이 걸린 값이라 원값 68.1보다 조금 작다
    expect(r.quantity.perimeterM).toBeGreaterThan(64);
    expect(r.quantity.perimeterM).toBeLessThan(68);
  });
});

describe('검사관 8 — 계수가 추정인 항목은 등급도 C 다', () => {
  it('씰란트·걸레받이 등급이 C 다', () => {
    const r = calcFlooring({ ...BASE_34, kind: '마루' });
    expect(r.submaterials.find((x) => x.key === 'sealant')?.grade).toBe('C');
    expect(r.submaterials.find((x) => x.key === 'baseboard')?.grade).toBe('C');
  });
});

describe('검사관 10 — 스키마 설명글에 단가 숫자가 없다', () => {
  it('시공 항목 설명에 평당 단가·일당 숫자가 안 들어 있다', () => {
    const labor = FLOORING_PROCESS.items.find((x) => x.key === 'labor');
    expect(labor?.quantityRule.desc).toBeTruthy();
    for (const banned of ['16,000', '10,000', '13,000', '30만', '1.25']) {
      expect(labor?.quantityRule.desc).not.toContain(banned);
    }
  });
});

describe('검사관 12 — 안 쓰는 export 가 데이터 파일에 없다', () => {
  it('usableFlooringProducts 가 생성 결과에 없다', () => {
    const src = readFileSync('src/server/calc/data/flooring-products.ts', 'utf8');
    expect(src).not.toContain('usableFlooringProducts');
  });
});

describe('검사관 13 — 거실·주방 범위에 복도·기타가 들어간다', () => {
  it('평형 모드 거실주방 범위에 living 과 etc 가 같이 들어간다', () => {
    const r = calcFlooring({ ...BASE_34, kind: '마루', scope: '거실주방' });
    const keys = r.quantity.byRoom.map((x) => x.key);
    expect(keys).toContain('living');
    expect(keys).toContain('etc');
    expect(keys).not.toContain('master');
  });
});
