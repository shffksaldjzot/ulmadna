// ──────────────────────────────────────────────
// 미장(레미탈·셀프레벨링) 계산기 서버 모듈 테스트
//
// 확인하는 것:
//   1) 레미탈 10㎡×30mm 물량이 06_미장.md 계수로 손 검산한 값과 맞는가
//   2) 현장 배합(시멘트+모래) 대안이 표준품셈 배합표와 맞는가(로스 미포함 체적 사용, 이중 할증 없음)
//   3) 셀프레벨링 20㎡×5mm 물량 + 프라이머가 손 검산과 맞는가, 인건은 아예 계산하지 않는가
//   4) 공법이 "체적 문턱"이 아니라 용도(usage)로 정해지는가 — 199㎡·200㎡ 경계에서 연속적인가
//   5) 정밀 모드 공법 오버라이드(method)가 usage 기본값보다 우선하는가
//   6) 와이어메시 옵션이 물량·인건에 반영되는가
//   7) 제품을 직접 넣으면 금액·물량이 바뀌는가
//   8) 응답에 단가 출처·문서명이 새지 않는가
//   9) API 라우트가 잘못된 입력을 막는가
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 14일(검사관 1라운드 — 공법 문턱 폐기)
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { calcMortar } from '../mortar';
import { calcMortarLabor } from '../labor-mortar';
import { POST, GET } from '@/app/api/calc/mortar/route';

/** 테스트용 POST 요청 하나를 만든다 */
function post(body: unknown) {
  return new Request('http://localhost/api/calc/mortar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── 1. 레미탈 10㎡ × 30mm 기본 검산 (용도 미지정 → 기본 손미장) ──

describe('레미탈 10㎡ × 30mm (기본 로스 5%, 계수 1.65, 40kg 포, 용도 없음 → 손미장)', () => {
  const r = calcMortar({ mode: '레미탈', areaSqm: 10, thicknessMm: 30 });

  it('체적이 손 검산과 맞는다 (순수 0.3㎥ · 로스 포함 0.315㎥)', () => {
    expect(r.quantity.volumeM3).toBeCloseTo(0.3, 5);
    expect(r.quantity.volumeWithLossM3).toBeCloseTo(0.315, 5);
    expect(r.quantity.lossPct).toBe(5);
  });

  it('포수가 손 검산(10×30×1.65×1.05÷40, 올림)과 맞는다', () => {
    const expected = Math.ceil((10 * 30 * 1.65 * 1.05) / 40);
    expect(expected).toBe(13);
    expect(r.quantity.bags).toBe(13);
    expect(r.quantity.unit).toBe('포');
    expect(r.quantity.bagKg).toBe(40);
  });

  it('용도를 안 골랐으면 기본 공법은 손미장이다', () => {
    expect(r.quantity.method).toBe('손미장');
    expect(r.labor?.method).toBe('손미장');
    expect(r.labor?.manDaysMechanic).toBe(0);
  });

  it('현장 배합 대안(1:3)이 로스 미포함 체적 × 표준품셈 배합표와 맞는다(이중 할증 없음)', () => {
    expect(r.quantity.altMix).toBeDefined();
    const alt = r.quantity.altMix!;
    expect(alt.mixRatio).toBe('1:3');
    // ⚠️ 로스 미포함 순수 체적(0.3㎥) × 510kg/㎥ = 153kg → 4포(올림). 로스 포함(0.315㎥)을 쓰면
    // 159.75kg → 4포로 결과가 같아 보이지만, 다른 조건에서는 달라진다 — 아래 "이중 할증 없음"
    // 테스트가 두 값이 실제로 다르다는 것 자체를 확인한다.
    expect(alt.cementKg).toBe(153);
    expect(alt.cementBags).toBe(4);
    // 0.3 × 1.10 = 0.33 → 소수 2자리
    expect(alt.sandM3).toBeCloseTo(0.33, 5);
  });

  it('비용이 최저 ≤ 중간 ≤ 최고 순서로 나오고 0보다 크다', () => {
    expect(r.cost.min).toBeGreaterThan(0);
    expect(r.cost.min).toBeLessThanOrEqual(r.cost.mid);
    expect(r.cost.mid).toBeLessThanOrEqual(r.cost.max);
  });

  it('구성 보기에 자재·시공·경비 줄이 있고 옵션(와이어메시·프라이머)은 없다', () => {
    const keys = r.cost.breakdown.map((b) => b.key);
    expect(keys).toContain('material');
    expect(keys).toContain('labor');
    expect(keys).toContain('overhead');
    expect(keys).not.toContain('wiremesh');
    expect(keys).not.toContain('primer');
  });

  it('실별 보기(전체 시공 한 줄) 합계가 총 포수와 같다', () => {
    expect(r.quantity.byRoom.length).toBe(1);
    expect(r.quantity.byRoom[0].bags).toBe(r.quantity.bags);
  });
});

// ── 1-B. 이중 할증이 실제로 빠졌는지 별도 확인 ──

describe('현장 배합 대안 — 이중 할증 제거 확인', () => {
  it('로스율을 20%로 올려도 현장 배합 시멘트량은 그대로다(체적 자체가 로스 미포함이라 로스율 영향 안 받음)', () => {
    const low = calcMortar({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, lossRate: 0 });
    const high = calcMortar({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, lossRate: 0.2 });
    // 레미탈 포수는 로스율에 따라 달라지지만
    expect(high.quantity.bags).toBeGreaterThan(low.quantity.bags);
    // 현장 배합 대안(순수 체적 기준)은 로스율과 무관하게 항상 같다
    expect(high.quantity.altMix?.cementKg).toBe(low.quantity.altMix?.cementKg);
    expect(high.quantity.altMix?.sandM3).toBe(low.quantity.altMix?.sandM3);
  });
});

// ── 2. 셀프레벨링 20㎡ × 5mm 검산 — 인건 자체를 계산하지 않는다 ──

describe('셀프레벨링 20㎡ × 5mm (기본 로스 5%, 계수 1.6, 25kg 포)', () => {
  const r = calcMortar({ mode: '셀프레벨링', areaSqm: 20, thicknessMm: 5 });

  it('포수가 손 검산(20×5×1.6×1.05÷25, 올림)과 맞는다', () => {
    const expected = Math.ceil((20 * 5 * 1.6 * 1.05) / 25);
    expect(expected).toBe(7);
    expect(r.quantity.bags).toBe(7);
    expect(r.quantity.bagKg).toBe(25);
  });

  it('프라이머가 기본 켬(제조사 필수)이고 원액 소요량이 20×0.2=4L', () => {
    expect(r.quantity.primerLiters).toBeCloseTo(4, 5);
    const primerLine = r.submaterials.find((s) => s.key === 'primer');
    expect(primerLine).toBeDefined();
    expect(primerLine?.qty).toBe(1);
  });

  it('인건은 아예 계산하지 않는다(labor=null) — 화면엔 "시공비는 현장 견적 별도"만 보여준다', () => {
    expect(r.labor).toBeNull();
    expect(r.laborAdvisoryNote).toBe('시공비는 현장 견적 별도');
    expect(r.cost.breakdown.map((b) => b.key)).not.toContain('labor');
  });

  it('레미탈 전용 항목(현장 배합·와이어메시·공법)은 없다', () => {
    expect(r.quantity.altMix).toBeUndefined();
    expect(r.quantity.method).toBeUndefined();
    expect(r.cost.breakdown.map((b) => b.key)).not.toContain('wiremesh');
  });

  it('프라이머를 끄면 부자재·비용 구성에서 빠진다', () => {
    const off = calcMortar({ mode: '셀프레벨링', areaSqm: 20, thicknessMm: 5, primer: false });
    expect(off.quantity.primerLiters).toBeUndefined();
    expect(off.cost.breakdown.map((b) => b.key)).not.toContain('primer');
  });
});

// ── 3. 공법 — 용도가 정하고, 문턱이 없어 연속적이다 ────

describe('공법 — "방통 전체"만 장비 타설, 체적 문턱 없음', () => {
  it('방통 전체는 면적과 무관하게 장비 타설이다(체적이 작아도)', () => {
    const small = calcMortar({ mode: '레미탈', areaSqm: 5, thicknessMm: 45, usage: '방통전체' });
    expect(small.quantity.method).toBe('장비타설');
  });

  it('확장부 바닥은 면적이 커도 손미장이다(용도가 정하지, 체적이 정하지 않는다)', () => {
    const big = calcMortar({ mode: '레미탈', areaSqm: 300, thicknessMm: 45, usage: '확장부바닥' });
    expect(big.quantity.method).toBe('손미장');
  });

  // 검사관 요청 검증: 199㎡ vs 200㎡(구 문턱 10㎥ 경계 부근) 총액이 매끄럽게 이어지는가.
  // 199㎡×45mm=8.955㎥, 200㎡×45mm=9.0㎥ — 둘 다 옛 문턱(10㎥) 아래라 예전엔 둘 다 "소면적"
  // 이었지만, 지금은 usage='방통전체'라 체적과 무관하게 둘 다 장비 타설로 계산된다.
  it('199㎡ → 200㎡로 1㎡ 늘 때 총액이 매끄럽게 이어진다(문턱에 의한 급격한 변화 없음)', () => {
    const a = calcMortar({ mode: '레미탈', areaSqm: 199, thicknessMm: 45, usage: '방통전체' });
    const b = calcMortar({ mode: '레미탈', areaSqm: 200, thicknessMm: 45, usage: '방통전체' });
    expect(a.quantity.method).toBe('장비타설');
    expect(b.quantity.method).toBe('장비타설');
    // 1㎡ 증가로 총액이 널뛰지 않고 5% 이내로만 움직인다(연속성 확인)
    const diffRatio = Math.abs(b.cost.mid - a.cost.mid) / a.cost.mid;
    expect(diffRatio).toBeLessThan(0.05);
    expect(b.cost.mid).toBeGreaterThanOrEqual(a.cost.mid);
  });

  // 84㎡×45mm(방통 전체 기준 34평 아파트 바닥 근사치)을 손미장/장비타설 둘 다로 계산해
  // "상식선" 비교(손 계산표는 최종 보고에 남긴다) — 넓은 면적은 손미장이 훨씬 비싸야 한다.
  it('84㎡ 방통을 손미장으로 하면 장비 타설보다 인건비가 훨씬 크다(장비를 쓰는 이유가 설명된다)', () => {
    const equipment = calcMortarLabor({ areaSqm: 84, thicknessMm: 45, mode: '레미탈', method: '장비타설' });
    const hand = calcMortarLabor({ areaSqm: 84, thicknessMm: 45, mode: '레미탈', method: '손미장' });
    expect(equipment).not.toBeNull();
    expect(hand).not.toBeNull();
    expect(hand!.amount).toBeGreaterThan(equipment!.amount * 5);
  });
});

// ── 4. 정밀 모드 공법 오버라이드 ────────────────

describe('공법 오버라이드', () => {
  it('용도가 방통 전체(기본 장비 타설)여도 method="손미장"을 주면 손미장으로 계산된다', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 10, thicknessMm: 45, usage: '방통전체', method: '손미장' });
    expect(r.quantity.method).toBe('손미장');
    expect(r.labor?.method).toBe('손미장');
  });
});

// ── 5. 인건 — 레미탈 손미장/장비 타설 ──────────────

describe('인건(labor-mortar.ts)', () => {
  it('아주 작은 공사도 최소 0.5품이 나온다(최소 1품이 아니다)', () => {
    const labor = calcMortarLabor({ areaSqm: 1, thicknessMm: 10, mode: '레미탈', method: '손미장' });
    expect(labor?.manDaysTotal).toBeGreaterThanOrEqual(0.5);
  });

  it('손미장 공식(면적 × 0.07·0.03)과 맞는다', () => {
    const labor = calcMortarLabor({ areaSqm: 10, thicknessMm: 30, mode: '레미탈', method: '손미장' });
    expect(labor?.manDaysPlasterer).toBeCloseTo(10 * 0.07, 5);
    expect(labor?.manDaysHelper).toBeCloseTo(10 * 0.03, 5);
    expect(labor?.manDaysMechanic).toBe(0);
  });

  it('장비 타설 공식(체적 × 0.039+면적×0.003 · 체적×0.047 · 체적×0.02)과 맞는다', () => {
    // 200㎡ × 50mm = 10㎥
    const labor = calcMortarLabor({ areaSqm: 200, thicknessMm: 50, mode: '레미탈', method: '장비타설' });
    expect(labor?.manDaysPlasterer).toBeCloseTo(1, 5); // 10×0.039+200×0.003=0.99→반올림 1.0
    expect(labor?.manDaysHelper).toBeCloseTo(0.5, 5); // 10×0.047=0.47→반올림 0.5
    expect(labor?.manDaysMechanic).toBeCloseTo(0.2, 5); // 10×0.02=0.2
    expect(labor?.mechanicWageIsEstimate).toBe(true);
    expect(labor?.equipmentNote).toBe('모르타르 타설 장비비 별도(현장 견적)');
  });

  it('와이어메시 옵션을 켜면 인건이 더 든다', () => {
    const plain = calcMortarLabor({ areaSqm: 10, thicknessMm: 30, mode: '레미탈', method: '손미장' });
    const withMesh = calcMortarLabor({ areaSqm: 10, thicknessMm: 30, mode: '레미탈', method: '손미장', wireMesh: true });
    expect(withMesh!.amount).toBeGreaterThan(plain!.amount);
  });

  it('셀프레벨링은 null을 돌려준다(인건 자체를 계산하지 않는다)', () => {
    expect(calcMortarLabor({ areaSqm: 20, thicknessMm: 5, mode: '셀프레벨링' })).toBeNull();
  });
});

// ── 6. 와이어메시 옵션 (레미탈 전용) ────────────────

describe('와이어메시', () => {
  it('옵션을 켜면 면적×1.1 물량이 붙고 총액이 오른다', () => {
    const off = calcMortar({ mode: '레미탈', areaSqm: 10, thicknessMm: 30 });
    const on = calcMortar({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, wireMesh: true });
    const line = on.submaterials.find((s) => s.key === 'wiremesh');
    expect(line).toBeDefined();
    expect(line?.qty).toBeCloseTo(11, 5);
    expect(on.cost.max).toBeGreaterThan(off.cost.max);
  });

  it('셀프레벨링 모드에서는 옵션을 켜도 와이어메시가 안 붙는다', () => {
    const r = calcMortar({ mode: '셀프레벨링', areaSqm: 20, thicknessMm: 5, wireMesh: true });
    expect(r.submaterials.find((s) => s.key === 'wiremesh')).toBeUndefined();
  });
});

// ── 7. 제품 직접 입력 ──────────────────────────────

describe('제품 직접 입력', () => {
  it('포당 가격을 넣으면 자재 금액이 그만큼 오른다', () => {
    const r = calcMortar({
      mode: '레미탈',
      areaSqm: 10,
      thicknessMm: 30,
      product: { pricePerBag: 9000, sourceLabel: '삼표 SP몰탈' },
    });
    const material = r.cost.breakdown.find((b) => b.key === 'material');
    expect(material?.unitPriceMin).toBe(9000);
    expect(material?.unitPriceMax).toBe(9000);
    expect(material?.amountMin).toBe(r.quantity.bags * 9000);
    expect(material?.note).toBe('삼표 SP몰탈');
  });

  it('제품 계수를 바꾸면 포수가 달라진다', () => {
    const base = calcMortar({ mode: '셀프레벨링', areaSqm: 20, thicknessMm: 10 });
    const higherCoeff = calcMortar({
      mode: '셀프레벨링',
      areaSqm: 20,
      thicknessMm: 10,
      product: { kgPerMmSqm: 1.7 },
    });
    expect(higherCoeff.quantity.bags).toBeGreaterThanOrEqual(base.quantity.bags);
  });

  // 2026-09-15 검사관 지적: 종류 평균가(등급 C)로 계산했을 때 화면 note에 "추정"이 붙는지 확인
  it('제품을 안 고르면 종류 평균가(C등급)라 자재 note에 "추정"이 붙는다', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 10, thicknessMm: 30 });
    const material = r.cost.breakdown.find((b) => b.key === 'material');
    expect(material?.note).toBe('종류 평균가 · 추정');
  });

  it('실제 가격을 직접 입력하면(등급 A) "추정"이 안 붙는다', () => {
    const r = calcMortar({
      mode: '레미탈',
      areaSqm: 10,
      thicknessMm: 30,
      product: { pricePerBag: 9000, sourceLabel: '삼표 SP몰탈' },
    });
    const material = r.cost.breakdown.find((b) => b.key === 'material');
    expect(material?.note).not.toContain('추정');
  });
});

// ── 8. 단가·산식이 응답으로 새지 않는가 ─────────────

describe('단가·산식 보호', () => {
  it('구성 보기 note·근거줄에 출처 문서명이 들어가지 않는다', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, wireMesh: true, usage: '방통전체' });
    const r2 = calcMortar({ mode: '셀프레벨링', areaSqm: 20, thicknessMm: 5 });
    const joined =
      r.cost.breakdown.map((b) => b.note).join(' ') +
      r.submaterials.map((s) => s.basis).join(' ') +
      r.cost.basisLine +
      r2.cost.breakdown.map((b) => b.note).join(' ') +
      r2.submaterials.map((s) => s.basis).join(' ');
    for (const banned of ['06_미장', 'EST-', 'ulmadna_db', '표준품셈', '원/㎡', '원/평', '한일시멘트', '삼표', '마페이']) {
      expect(joined).not.toContain(banned);
    }
  });
});

// ── 9. API 라우트 ─────────────────────────────────

describe('POST /api/calc/mortar', () => {
  it('레미탈 기본 요청이 계산 결과를 돌려준다', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 30 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quantity.bags).toBeGreaterThan(0);
    expect(json.cost.min).toBeGreaterThan(0);
  });

  it('usage·method를 같이 보내면 반영된다', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 45, usage: '방통전체' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quantity.method).toBe('장비타설');
  });

  it('셀프레벨링 기본 요청이 계산 결과를 돌려준다', async () => {
    const res = await POST(post({ mode: '셀프레벨링', areaSqm: 20, thicknessMm: 5 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quantity.bags).toBeGreaterThan(0);
    expect(json.submaterials.length).toBeGreaterThan(0);
    expect(json.labor).toBeNull();
  });

  it('mode 를 안 넣으면 400', async () => {
    const res = await POST(post({ areaSqm: 10, thicknessMm: 30 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('mode');
  });

  it('areaSqm 이 없으면 400', async () => {
    const res = await POST(post({ mode: '레미탈', thicknessMm: 30 }));
    expect(res.status).toBe(400);
  });

  it('thicknessMm 이 범위를 벗어나면 400', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 500 }));
    expect(res.status).toBe(400);
  });

  it('mode 값이 이상하면 400', async () => {
    const res = await POST(post({ mode: '몰탈', areaSqm: 10, thicknessMm: 30 }));
    expect(res.status).toBe(400);
  });

  it('usage 값이 이상하면 400', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, usage: '거실전체' }));
    expect(res.status).toBe(400);
  });

  it('method 값이 이상하면 400', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, method: '기계타설' }));
    expect(res.status).toBe(400);
  });

  it('JSON 이 아니면 400', async () => {
    const req = new Request('http://localhost/api/calc/mortar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/calc/mortar', () => {
  it('GET 은 405 로 막는다', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
  });
});
