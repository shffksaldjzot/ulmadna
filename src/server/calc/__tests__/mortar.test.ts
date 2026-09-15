// ──────────────────────────────────────────────
// 미장(레미탈·셀프레벨링) 계산기 서버 모듈 테스트
//
// 2026-09-15 운영자 현장 기준 지시로 5층 비용 구조(자재/부자재/운송·하차/양중/인건)를 도입하면서
// 인건 계산 방식 자체가 바뀌어(품 누적 → "오늘 몇 명") 전면 다시 썼다. 확인하는 것:
//   1) 레미탈 10㎡×30mm 물량이 06_미장.md 계수로 손 검산한 값과 맞는가
//   2) 현장 배합(시멘트+모래) 대안이 표준품셈 배합표와 맞는가(로스 미포함 체적 사용, 이중 할증 없음)
//   3) 셀프레벨링 20㎡×5mm 물량 + 프라이머가 손 검산과 맞는가, 인건은 아예 계산하지 않는가
//   4) 공법 기본값이 항상 손미장인가(방통 포함, 2026-09-15 운영자 현장 기준 지시로 "방통만 장비 타설" 폐기)
//   5) 정밀 모드 공법 오버라이드(method)가 usage 기본값보다 우선하는가
//   6) 손미장 인원 산정 — 20평×100mm=기공2·조공2·1일, 물량 비례 배수(상한 없음)
//   7) 장비 타설 인원 산정 — 9-1-3 품만 인원수로 환산(9-1-4 이중 계상 제거) + 장비대·피니싱 별도 계상
//   8) 5층 비용 구조 — 자재·부자재(시멘트·자나무·와이어메시·프라이머)·운송하차·양중·인건 그룹핑
//   9) 운송비·지게차 하차비·양중비 직접 입력이 breakdown에 반영되는가, 기본값 0이면 빠지는가
//   10) 양중 참고값(liftingReferenceWon)·현장 확인 필요 목록(siteConfirmItems)
//   11) 제품을 직접 넣으면 금액·물량이 바뀌는가
//   12) 응답에 단가 출처·문서명이 새지 않는가
//   13) API 라우트가 잘못된 입력을 막는가(음수·문자열 400, 상한 클램프)
//   14) 서버 계산이 화면 즉답(useMortarQuickCalc)과 같은 공유 함수(mortarQuantity.ts)를 쓰는가
//   15) 공유 링크(trimFormForShare) 왕복 후에도 간단 모드에서 고른 공법이 유지되는가
//       (검사관 지적 — delete trimmed.method가 간단 모드 공법 선택을 지워서, 장비 타설을
//       고르고 공유한 링크를 열면 손미장 기본값으로 되돌아가 총액이 달라지는 사고가 있었다)
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 15일(운영자 현장 기준 지시 — 5층 비용 구조 전면 개편)
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { calcMortar } from '../mortar';
import { calcMortarLabor } from '../labor-mortar';
import { calcMortarBags, calcMortarVolume, calcAltMix, REMICON_KG_PER_MM_SQM, REMICON_BAG_KG } from '@/lib/v1/mortarQuantity';
import { POST, GET } from '@/app/api/calc/mortar/route';
import { encodeMortarForm, decodeMortarForm, type MortarFormState } from '@/lib/v1/mortarQuery';
import { toEngineInput, trimFormForShare, sanitizeMortarFormState } from '@/lib/v1/mortarEngineInput';

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

  it('용도를 안 골랐으면 기본 공법은 손미장이다(레미탈은 항상 손미장 기본)', () => {
    expect(r.quantity.method).toBe('손미장');
    expect(r.labor?.method).toBe('손미장');
    expect(r.labor?.crewMechanic).toBe(0);
  });

  it('손미장 인원 — 체적 0.3㎥는 기준(6.6116㎥)보다 훨씬 작아 최소 1명씩', () => {
    expect(r.labor?.crewPlasterer).toBe(1);
    expect(r.labor?.crewHelper).toBe(1);
    expect(r.labor?.days).toBe(1);
  });

  it('현장 배합 대안(1:3)이 로스 미포함 체적 × 표준품셈 배합표와 맞는다(이중 할증 없음)', () => {
    expect(r.quantity.altMix).toBeDefined();
    const alt = r.quantity.altMix!;
    expect(alt.mixRatio).toBe('1:3');
    expect(alt.cementKg).toBe(153);
    expect(alt.cementBags).toBe(4);
    expect(alt.sandM3).toBeCloseTo(0.33, 5);
  });

  it('비용이 최저 ≤ 중간 ≤ 최고 순서로 나오고 0보다 크다', () => {
    expect(r.cost.min).toBeGreaterThan(0);
    expect(r.cost.min).toBeLessThanOrEqual(r.cost.mid);
    expect(r.cost.mid).toBeLessThanOrEqual(r.cost.max);
  });

  it('구성 보기에 자재·부자재(시멘트·자나무)·시공·경비 줄이 있고 옵션(와이어메시·프라이머)은 없다', () => {
    const keys = r.cost.breakdown.map((b) => b.key);
    expect(keys).toContain('material');
    expect(keys).toContain('cement');
    expect(keys).toContain('plywood');
    expect(keys).toContain('labor');
    expect(keys).toContain('overhead');
    expect(keys).not.toContain('wiremesh');
    expect(keys).not.toContain('primer');
  });

  it('시멘트는 레미탈 13포 ÷ 100 올림 = 1포다', () => {
    const cement = r.cost.breakdown.find((b) => b.key === 'cement');
    expect(cement?.qty).toBe(1);
  });

  it('모든 줄에 5층 layer 태그가 붙어 있다', () => {
    const material = r.cost.breakdown.find((b) => b.key === 'material');
    const cement = r.cost.breakdown.find((b) => b.key === 'cement');
    const labor = r.cost.breakdown.find((b) => b.key === 'labor');
    const overhead = r.cost.breakdown.find((b) => b.key === 'overhead');
    expect(material?.layer).toBe('자재');
    expect(cement?.layer).toBe('부자재');
    expect(labor?.layer).toBe('인건');
    expect(overhead?.layer).toBe('경비');
  });

  it('운송·양중을 안 넣으면 breakdown에 안 잡히고 siteConfirmItems에 안내가 남는다', () => {
    const keys = r.cost.breakdown.map((b) => b.key);
    expect(keys).not.toContain('delivery');
    expect(keys).not.toContain('lifting');
    expect(keys).not.toContain('forklift');
    expect(r.siteConfirmItems).toContain('운송비');
    expect(r.siteConfirmItems).toContain('양중비');
    // 손미장이라 장비대는 안내 목록에 없다
    expect(r.siteConfirmItems).not.toContain('장비대');
  });

  it('양중 참고값(liftingReferenceWon)이 항상 채워져 있다', () => {
    expect(r.liftingReferenceWon).toBeGreaterThan(0);
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
    expect(high.quantity.bags).toBeGreaterThan(low.quantity.bags);
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

  it('레미탈 전용 항목(현장 배합·와이어메시·공법·시멘트·자나무)은 없다', () => {
    expect(r.quantity.altMix).toBeUndefined();
    expect(r.quantity.method).toBeUndefined();
    const keys = r.cost.breakdown.map((b) => b.key);
    expect(keys).not.toContain('wiremesh');
    expect(keys).not.toContain('cement');
    expect(keys).not.toContain('plywood');
  });

  it('프라이머를 끄면 부자재·비용 구성에서 빠진다', () => {
    const off = calcMortar({ mode: '셀프레벨링', areaSqm: 20, thicknessMm: 5, primer: false });
    expect(off.quantity.primerLiters).toBeUndefined();
    expect(off.cost.breakdown.map((b) => b.key)).not.toContain('primer');
  });

  it('셀프레벨링도 양중 참고값·siteConfirmItems가 채워진다(모드 공통)', () => {
    expect(r.liftingReferenceWon).toBeGreaterThan(0);
    expect(r.siteConfirmItems).toContain('운송비');
    expect(r.siteConfirmItems).toContain('양중비');
  });
});

// ── 3. 공법 — 기본은 항상 손미장(방통 포함), 문턱도 용도 강제도 없다 ──

describe('공법 — 2026-09-15 운영자 현장 기준 지시: 기본은 항상 손미장(방통 포함)', () => {
  it('방통 전체도 기본 공법은 손미장이다(예전엔 장비 타설이 기본이었으나 폐기됨)', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 20, thicknessMm: 45, usage: '방통전체' });
    expect(r.quantity.method).toBe('손미장');
  });

  it('확장부 바닥도 기본 손미장이다', () => {
    const big = calcMortar({ mode: '레미탈', areaSqm: 300, thicknessMm: 45, usage: '확장부바닥' });
    expect(big.quantity.method).toBe('손미장');
  });

  it('method="장비타설"을 명시하면 용도와 무관하게 장비 타설로 계산된다', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 20, thicknessMm: 45, usage: '방통전체', method: '장비타설' });
    expect(r.quantity.method).toBe('장비타설');
    expect(r.labor?.method).toBe('장비타설');
    // 장비 타설을 고르면 장비대·피니싱이 breakdown에 잡히고 siteConfirmItems에도 "장비대"가 남는다
    const keys = r.cost.breakdown.map((b) => b.key);
    expect(keys).toContain('equipment');
    expect(keys).toContain('finish');
    expect(r.siteConfirmItems).toContain('장비대');
  });

  it('199㎡ → 200㎡로 1㎡ 늘 때 총액이 매끄럽게 이어진다(문턱에 의한 급격한 변화 없음)', () => {
    const a = calcMortar({ mode: '레미탈', areaSqm: 199, thicknessMm: 45, usage: '방통전체' });
    const b = calcMortar({ mode: '레미탈', areaSqm: 200, thicknessMm: 45, usage: '방통전체' });
    expect(a.quantity.method).toBe('손미장');
    expect(b.quantity.method).toBe('손미장');
    const diffRatio = Math.abs(b.cost.mid - a.cost.mid) / a.cost.mid;
    expect(diffRatio).toBeLessThan(0.05);
    expect(b.cost.mid).toBeGreaterThanOrEqual(a.cost.mid);
  });

  it('84㎡ 방통(45mm) 소~중규모에서는 손미장 총액이 장비 타설(장비대·피니싱 포함) 총액보다 싸다', () => {
    // 장비 타설은 물량과 무관하게 장비대(50만~70만원/일)가 고정으로 붙어서, 소~중규모
    // 현장에서는 오히려 손미장보다 비싸질 수 있다는 도메인 해석(06_미장.md §11-9)과 정합한다.
    const hand = calcMortar({ mode: '레미탈', areaSqm: 84, thicknessMm: 45, method: '손미장' });
    const equipment = calcMortar({ mode: '레미탈', areaSqm: 84, thicknessMm: 45, method: '장비타설' });
    expect(hand.cost.mid).toBeLessThan(equipment.cost.mid);
  });
});

// ── 4. 손미장 인원 산정(§11-5·§11-8) — 20평×100mm=기공2·조공2, 물량 비례 배수 ──

describe('손미장 인원 산정 — 20평×100mm 기준(기공2·조공2), 배수 적용, 상한 없음', () => {
  it('20평(66.116㎡)×100mm → 기공 2인·조공 2인, 1일 완료', () => {
    const labor = calcMortarLabor({ areaSqm: 66.116, thicknessMm: 100, mode: '레미탈', method: '손미장' });
    expect(labor?.crewPlasterer).toBe(2);
    expect(labor?.crewHelper).toBe(2);
    expect(labor?.days).toBe(1);
    expect(labor?.crewMechanic).toBe(0);
  });

  it('40평(132.232㎡)×100mm → 물량이 꼭 2배라 인원도 기공4·조공4로 배수 적용된다(상한 없음)', () => {
    const labor = calcMortarLabor({ areaSqm: 132.232, thicknessMm: 100, mode: '레미탈', method: '손미장' });
    expect(labor?.crewPlasterer).toBe(4);
    expect(labor?.crewHelper).toBe(4);
  });

  it('아주 작은 공사도 최소 1명씩은 나온다(0명 없음)', () => {
    const labor = calcMortarLabor({ areaSqm: 1, thicknessMm: 10, mode: '레미탈', method: '손미장' });
    expect(labor?.crewPlasterer).toBeGreaterThanOrEqual(1);
    expect(labor?.crewHelper).toBeGreaterThanOrEqual(1);
  });

  it('인건비 범위가 (기공×미장공노임 + 조공×보통인부노임)의 시장가~표준품셈 범위와 맞는다', () => {
    const labor = calcMortarLabor({ areaSqm: 66.116, thicknessMm: 100, mode: '레미탈', method: '손미장' });
    // 기공2·조공2 — 하한(시장가 20만·14만) vs 상한(표준품셈 277,276·172,068)
    expect(labor?.amountMin).toBe(2 * 200000 + 2 * 140000);
    expect(labor?.amountMax).toBe(2 * 277276 + 2 * 172068);
  });

  it('와이어메시 옵션을 켜면 인건비가 더 든다(인원수는 그대로)', () => {
    const plain = calcMortarLabor({ areaSqm: 10, thicknessMm: 30, mode: '레미탈', method: '손미장' });
    const withMesh = calcMortarLabor({ areaSqm: 10, thicknessMm: 30, mode: '레미탈', method: '손미장', wireMesh: true });
    expect(withMesh!.amountMax).toBeGreaterThan(plain!.amountMax);
    expect(withMesh!.crewPlasterer).toBe(plain!.crewPlasterer);
  });

  it('셀프레벨링은 null을 돌려준다(인건 자체를 계산하지 않는다)', () => {
    expect(calcMortarLabor({ areaSqm: 20, thicknessMm: 5, mode: '셀프레벨링' })).toBeNull();
  });
});

// ── 5. 장비 타설 인원 산정 — 9-1-3 품을 인원수로, 장비대·피니싱 별도 ──
//
// 2026-09-15 검사관 지적으로 크루 계산에서 9-1-4(표면마무리)를 뺐다 — "피니싱" 줄(형아
// 기준, 기공1×0.5일)이 이미 마무리 인건을 계상하고 있어서 9-1-4까지 더하면 이중 계상이다.

describe('장비 타설 인원 산정 + 장비대·피니싱', () => {
  it('20평(66.116㎡)×100mm 장비 타설 → 기공1·조공1·기계운전1(9-1-3 품만, 9-1-4는 미포함)', () => {
    // 미장공 품 = 6.6116×0.039 ≈ 0.258 → 1인 (9-1-4 표면마무리는 더하지 않는다 —
    // 마무리 인건은 아래 "피니싱" 줄이 따로 계상한다)
    // 보통인부 품 = 6.6116×0.047 ≈ 0.311 → 1인
    // 기계운전사 품 = 6.6116×0.02 ≈ 0.132 → 1인
    const labor = calcMortarLabor({ areaSqm: 66.116, thicknessMm: 100, mode: '레미탈', method: '장비타설' });
    expect(labor?.crewPlasterer).toBe(1);
    expect(labor?.crewHelper).toBe(1);
    expect(labor?.crewMechanic).toBe(1);
    expect(labor?.days).toBe(1);
    expect(labor?.mechanicWageIsEstimate).toBe(true);
  });

  it('9-1-4를 크루 계산에 더하지 않는다는 걸 큰 면적으로 직접 확인한다(이중 계상 방지)', () => {
    // 200㎡×100mm — 9-1-4를 더했다면 면적×0.003이 커져서 크루가 달라졌을 규모.
    // 9-1-4 없이: 미장공 품 = 20×0.039 = 0.78 → 1인. 9-1-4를 더했다면 200×0.003=0.6이
    // 추가돼 1.38 → 2인이 됐을 것이다 — 지금은 1인이어야 이중 계상이 없다는 뜻이다.
    const labor = calcMortarLabor({ areaSqm: 200, thicknessMm: 100, mode: '레미탈', method: '장비타설' });
    expect(labor?.crewPlasterer).toBe(1);
  });

  it('장비대·피니싱이 breakdown에 "인건" 층으로 잡히고, 단가 칸은 노출하지 않는다(0)', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 66.116, thicknessMm: 100, method: '장비타설' });
    const equipment = r.cost.breakdown.find((b) => b.key === 'equipment');
    const finish = r.cost.breakdown.find((b) => b.key === 'finish');
    expect(equipment).toBeDefined();
    expect(equipment?.layer).toBe('인건');
    expect(equipment?.amountMin).toBe(500000);
    expect(equipment?.amountMax).toBe(700000);
    expect(finish).toBeDefined();
    expect(finish?.layer).toBe('인건');
    expect(finish?.qty).toBeCloseTo(0.5, 5);
    // "미장 시공" 줄과 같은 원칙 — 단가(unitPrice)는 0으로 채우고 금액만 진짜 값
    expect(finish?.unitPriceMin).toBe(0);
    expect(finish?.unitPriceMax).toBe(0);
    expect(finish!.amountMin).toBeGreaterThan(0);
  });

  it('손미장은 장비대·피니싱 줄이 없다', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 66.116, thicknessMm: 100, method: '손미장' });
    const keys = r.cost.breakdown.map((b) => b.key);
    expect(keys).not.toContain('equipment');
    expect(keys).not.toContain('finish');
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

// ── 7. 운송·하차·양중 — 직접 입력(06_미장.md §11-2·§11-3) ──

describe('운송·하차·양중 직접 입력', () => {
  it('배송비를 넣으면 breakdown에 "운송·하차" 층으로 그대로 잡힌다', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, deliveryFeeWon: 30000 });
    const line = r.cost.breakdown.find((b) => b.key === 'delivery');
    expect(line).toBeDefined();
    expect(line?.amountMin).toBe(30000);
    expect(line?.amountMax).toBe(30000);
    expect(line?.layer).toBe('운송·하차');
    expect(r.siteConfirmItems).not.toContain('운송비');
  });

  it('지게차 하차비 — 2026-09-15 운영자 현장 기준 확정: 기본 10만원, 직접 수정한 금액이 그대로 반영된다', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, forkliftFeeWon: 100000 });
    const line = r.cost.breakdown.find((b) => b.key === 'forklift');
    expect(line).toBeDefined();
    expect(line?.amountMin).toBe(100000);
    expect(line?.amountMax).toBe(100000);
    expect(line?.layer).toBe('운송·하차');

    const edited = calcMortar({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, forkliftFeeWon: 150000 });
    const editedLine = edited.cost.breakdown.find((b) => b.key === 'forklift');
    expect(editedLine?.amountMin).toBe(150000);
  });

  it('양중비를 넣으면 breakdown에 "양중" 층으로 잡히고 siteConfirmItems에서 빠진다', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, liftingFeeWon: 300000 });
    const line = r.cost.breakdown.find((b) => b.key === 'lifting');
    expect(line).toBeDefined();
    expect(line?.amountMin).toBe(300000);
    expect(line?.layer).toBe('양중');
    expect(r.siteConfirmItems).not.toContain('양중비');
  });

  it('상한(1천만원)을 넘겨도 계산 자체는 클램프해서 처리한다(에러 아님)', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, deliveryFeeWon: 999_999_999 });
    const line = r.cost.breakdown.find((b) => b.key === 'delivery');
    expect(line?.amountMin).toBe(10_000_000);
  });

  it('값을 안 넣으면(기본 0) breakdown에서 빠진다', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 10, thicknessMm: 30 });
    const keys = r.cost.breakdown.map((b) => b.key);
    expect(keys).not.toContain('delivery');
    expect(keys).not.toContain('forklift');
    expect(keys).not.toContain('lifting');
  });
});

// ── 8. 제품 직접 입력 ──────────────────────────────

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

// ── 8-B. 서버·즉답 공유 함수가 값을 일치시키는가 ─────

describe('서버 계산이 화면 즉답과 같은 공유 함수(mortarQuantity.ts)를 쓴다', () => {
  it('calcMortar의 포수가 calcMortarBags를 직접 부른 값과 정확히 같다(레미탈)', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 17.3, thicknessMm: 37 });
    const direct = calcMortarBags({
      areaSqm: 17.3,
      thicknessMm: 37,
      kgPerMmSqm: REMICON_KG_PER_MM_SQM,
      bagKg: REMICON_BAG_KG,
      lossRate: 0.05,
    });
    expect(r.quantity.bags).toBe(direct);
  });

  it('calcMortar의 체적이 calcMortarVolume을 직접 부른 값과 정확히 같다', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 17.3, thicknessMm: 37 });
    const direct = calcMortarVolume({ areaSqm: 17.3, thicknessMm: 37, lossRate: 0.05 });
    expect(r.quantity.volumeM3).toBe(direct.volumeM3);
    expect(r.quantity.volumeWithLossM3).toBe(direct.volumeWithLossM3);
  });

  it('calcMortar의 현장 배합이 calcAltMix를 직접 부른 값과 정확히 같다', () => {
    const r = calcMortar({ mode: '레미탈', areaSqm: 17.3, thicknessMm: 37, mixRatio: '1:2' });
    const { volumeM3 } = calcMortarVolume({ areaSqm: 17.3, thicknessMm: 37, lossRate: 0.05 });
    const direct = calcAltMix({ volumeM3, mixRatio: '1:2' });
    expect(r.quantity.altMix).toEqual(direct);
  });
});

// ── 9. 단가·산식이 응답으로 새지 않는가 ─────────────

describe('단가·산식 보호', () => {
  it('구성 보기 note·근거줄에 출처 문서명이 들어가지 않는다', () => {
    const r = calcMortar({
      mode: '레미탈',
      areaSqm: 10,
      thicknessMm: 30,
      wireMesh: true,
      usage: '방통전체',
      method: '장비타설',
      deliveryFeeWon: 30000,
      forkliftFeeWon: 100000,
      liftingFeeWon: 300000,
    });
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

// ── 10. API 라우트 ─────────────────────────────────

describe('POST /api/calc/mortar', () => {
  it('레미탈 기본 요청이 계산 결과를 돌려준다', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 30 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quantity.bags).toBeGreaterThan(0);
    expect(json.cost.min).toBeGreaterThan(0);
  });

  it('usage를 보내도 이제 손미장이 기본이다(방통 포함)', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 45, usage: '방통전체' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quantity.method).toBe('손미장');
  });

  it('method="장비타설"을 명시하면 그대로 반영된다', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 45, usage: '방통전체', method: '장비타설' }));
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

  it('레미탈은 140mm까지 받아 준다(150 이하)', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 140 }));
    expect(res.status).toBe(200);
  });

  it('레미탈은 151mm면 400(상한 150)', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 151 }));
    expect(res.status).toBe(400);
  });

  it('셀프레벨링은 45mm까지 받아 준다(50 이하)', async () => {
    const res = await POST(post({ mode: '셀프레벨링', areaSqm: 10, thicknessMm: 45 }));
    expect(res.status).toBe(200);
  });

  it('셀프레벨링은 51mm면 400(상한 50 — 레미탈과 다른 상한)', async () => {
    const res = await POST(post({ mode: '셀프레벨링', areaSqm: 10, thicknessMm: 51 }));
    expect(res.status).toBe(400);
  });

  it('레미탈 50mm 초과면 표준 범위 밖 안내가 붙는다(계산은 그대로 된다)', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 80 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quantity.standardRangeNote).toBe('표준 범위 밖(두꺼운 방통은 2회 타설 등 현장 확인)');
    expect(json.quantity.bags).toBeGreaterThan(0);
  });

  it('50mm 이하면 표준 범위 밖 안내가 없다', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 45 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quantity.standardRangeNote).toBeUndefined();
  });

  it('제품을 안 고르면 productLabel이 "모드 + 포장kg 포대" 기본값이다', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 30 }));
    const json = await res.json();
    expect(json.quantity.productLabel).toBe('레미탈 40kg 포대');
  });

  it('제품을 고르면 productLabel이 그 제품명이다', async () => {
    const res = await POST(
      post({
        mode: '레미탈',
        areaSqm: 10,
        thicknessMm: 30,
        product: { pricePerBag: 9000, sourceLabel: '삼표 SP몰탈 일반미장용' },
      }),
    );
    const json = await res.json();
    expect(json.quantity.productLabel).toBe('삼표 SP몰탈 일반미장용');
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

  // ── 운송·양중 — 음수/문자열은 400, 상한 초과는 클램프(에러 아님) ──
  it('deliveryFeeWon 음수면 400', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, deliveryFeeWon: -1000 }));
    expect(res.status).toBe(400);
  });

  it('liftingFeeWon 이 문자열(숫자로 못 바꾸는 값)이면 400', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, liftingFeeWon: '많이요' }));
    expect(res.status).toBe(400);
  });

  it('forkliftFeeWon 음수면 400', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, forkliftFeeWon: -1 }));
    expect(res.status).toBe(400);
  });

  it('deliveryFeeWon 이 1천만원을 넘어도 400이 아니라 클램프해서 200으로 계산된다', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, deliveryFeeWon: 999_999_999 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    const line = json.cost.breakdown.find((b: { key: string }) => b.key === 'delivery');
    expect(line.amountMin).toBe(10_000_000);
  });

  it('양중비를 넣으면 breakdown·siteConfirmItems에 반영된다', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 30, liftingFeeWon: 300000 }));
    const json = await res.json();
    expect(json.cost.breakdown.some((b: { key: string }) => b.key === 'lifting')).toBe(true);
    expect(json.siteConfirmItems).not.toContain('양중비');
  });

  it('liftingReferenceWon 이 응답에 항상 있다', async () => {
    const res = await POST(post({ mode: '레미탈', areaSqm: 10, thicknessMm: 30 }));
    const json = await res.json();
    expect(json.liftingReferenceWon).toBeGreaterThan(0);
  });
});

describe('GET /api/calc/mortar', () => {
  it('GET 은 405 로 막는다', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
  });
});

// ── 15. 공유 링크 왕복 — 간단 모드 공법이 유지되는가 ──────────
//
// 검사관 지적: trimFormForShare()가 간단 모드에서 method를 지워 버려서, 장비 타설을
// 고르고 "결과 공유"로 만든 링크를 다시 열면 손미장 기본값으로 계산돼 총액이 달라지는
// 사고가 있었다. encodeMortarForm → decodeMortarForm → sanitizeMortarFormState로
// 실제 공유 흐름을 그대로 재현해 총액이 정확히 같은지 확인한다.

describe('공유 링크 왕복(trimFormForShare) — 간단 모드 공법 유지', () => {
  it('장비 타설을 고른 뒤 공유 링크를 왕복해도 총액이 똑같다', () => {
    const state: MortarFormState = {
      view: 'simple',
      mode: '레미탈',
      areaInputMode: 'area',
      areaUnit: '평',
      area: 20,
      usage: '방통전체',
      thicknessMm: 45,
      method: '장비타설', // 사용자가 간단 모드 공법 칩에서 직접 고른 값
    };

    const before = toEngineInput(state, []);
    expect(before).not.toBeNull();
    expect(before!.method).toBe('장비타설');
    const resultBefore = calcMortar(before!);
    expect(resultBefore.quantity.method).toBe('장비타설');

    // 실제 "결과 공유" 흐름 그대로: 공유용으로 다듬고(trim) → URL 인코딩 → 디코딩 → 표시용 정리(sanitize)
    const shareUrlParam = encodeMortarForm(trimFormForShare(state));
    const decoded = decodeMortarForm(shareUrlParam);
    expect(decoded).not.toBeNull();
    const restored = sanitizeMortarFormState(decoded!);

    // 핵심 검증 — method가 살아있어야 한다(예전엔 delete trimmed.method로 사라졌었다)
    expect(restored.method).toBe('장비타설');

    const after = toEngineInput(restored, []);
    expect(after).not.toBeNull();
    expect(after!.method).toBe('장비타설');
    const resultAfter = calcMortar(after!);

    // 공법이 유지돼 손미장으로 되돌아가지 않으므로 총액이 정확히 같다
    expect(resultAfter.quantity.method).toBe('장비타설');
    expect(resultAfter.cost.min).toBe(resultBefore.cost.min);
    expect(resultAfter.cost.max).toBe(resultBefore.cost.max);
    expect(resultAfter.cost.mid).toBe(resultBefore.cost.mid);
  });

  it('간단 모드에서 손미장(기본값)을 고른 경우도 왕복 후 그대로 손미장이다', () => {
    const state: MortarFormState = {
      view: 'simple',
      mode: '레미탈',
      areaInputMode: 'area',
      areaUnit: '평',
      area: 20,
      usage: '방통전체',
      thicknessMm: 45,
      // method 없음 — 기본값(손미장)
    };
    const shareUrlParam = encodeMortarForm(trimFormForShare(state));
    const restored = sanitizeMortarFormState(decodeMortarForm(shareUrlParam)!);
    const after = toEngineInput(restored, []);
    expect(calcMortar(after!).quantity.method).toBe('손미장');
  });
});
