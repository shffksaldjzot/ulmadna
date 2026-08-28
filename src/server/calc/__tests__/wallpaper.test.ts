// ──────────────────────────────────────────────
// 도배 계산기 서버 모듈 테스트
//
// 확인하는 것:
//   1) 34평 3베이 전체 실크 천장 포함 롤 수가 도메인 문서 관행 범위에 들어오는가
//   2) 입력 방식에 따라 로스 모드가 추정 / 실제 / 면적으로 갈리는가
//   3) 아주 작은 공사도 최소 1품이 나오는가
//   4) 제품 규격을 직접 넣으면 롤 수가 실제로 바뀌는가
//   5) 응답에 업자가·산식 내부값이 새지 않는가
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { calcWallpaper } from '../wallpaper';
import { calcLabor, laborSanityFloor } from '../labor';
import { resolveDimensions } from '../dimensions';

/** 테스트에서 자주 쓰는 34평 3베이 전체 실크 조건 */
const BASE_34 = {
  mode: '평형' as const,
  pyeong: 34,
  bay: 3 as const,
  scope: '전체' as const,
  ceiling: true,
  paperType: '실크' as const,
  region: '서울',
};

/** 코디네이터가 지정한 실측 예시 (거실 5×4 … 복도 4×1.2, 높이 2.3) */
const MEASURED_ROOMS = [
  { name: '거실', widthM: 5, depthM: 4, doors: 1 },
  { name: '안방', widthM: 4, depthM: 3.5, doors: 1, windows: [{ widthCm: 200, heightCm: 130 }] },
  { name: '방2', widthM: 3, depthM: 3, doors: 1, windows: [{ widthCm: 150, heightCm: 130 }] },
  { name: '방3', widthM: 3, depthM: 3, doors: 1, windows: [{ widthCm: 150, heightCm: 130 }] },
  { name: '주방', widthM: 3, depthM: 3 },
  { name: '복도', widthM: 4, depthM: 1.2 },
];

describe('34평 3베이 전체 실크 (천장 포함)', () => {
  const result = calcWallpaper(BASE_34);

  it('롤 수가 도메인 문서의 34평 관행 범위(11~22롤) 안에 든다', () => {
    // 01_도배.md 1-7: 출처별로 11롤~20롤 안팎. 전용 2.5배 공식 역산은 16~17롤.
    expect(result.quantity.rolls).toBeGreaterThanOrEqual(11);
    expect(result.quantity.rolls).toBeLessThanOrEqual(22);
  });

  it('벽·천장 면적이 62건 비율표 범위로 나온다', () => {
    // 84타입 3베이 기준 벽 약 177㎡ · 천장 약 75㎡ (욕실 제외분만큼 조금 줄어든다)
    expect(result.quantity.wallSqm).toBeGreaterThan(120);
    expect(result.quantity.wallSqm).toBeLessThan(200);
    expect(result.quantity.ceilingSqm).toBeGreaterThan(50);
    expect(result.quantity.ceilingSqm).toBeLessThan(90);
  });

  it('평형 모드라 로스는 추정 20%다', () => {
    expect(result.quantity.lossMode).toBe('추정');
    expect(result.quantity.lossPct).toBe(20);
    expect(result.quantity.inputMode).toBe('평형');
  });

  it('실별 보기 롤 수 합계가 총 롤 수와 같다', () => {
    const sum = result.quantity.byRoom.reduce((s, r) => s + r.rolls, 0);
    expect(sum).toBe(result.quantity.rolls);
    expect(result.quantity.byRoom.length).toBeGreaterThan(1);
  });

  it('실크면 부직포·본드가 붙고 각초배지는 안 붙는다', () => {
    const keys = result.submaterials.map((s) => s.key);
    expect(keys).toContain('paste');
    expect(keys).toContain('nonwoven');
    expect(keys).toContain('bond');
    expect(keys).not.toContain('lining_paper');
  });

  it('신축(기본)이면 퍼티·바인더·네바리는 안 붙는다', () => {
    const keys = result.submaterials.map((s) => s.key);
    expect(keys).not.toContain('putty');
    expect(keys).not.toContain('binder');
    expect(keys).not.toContain('nebari');
  });

  it('비용은 최저 < 중간 < 최고 순서로 나온다', () => {
    expect(result.cost.min).toBeGreaterThan(0);
    expect(result.cost.mid).toBeGreaterThan(result.cost.min);
    expect(result.cost.max).toBeGreaterThan(result.cost.mid);
    expect(result.cost.mode).toBe('산식');
    expect(result.cost.basisLine).toContain('서울');
  });

  it('구성 보기에 벽지·시공·일반경비 줄이 다 있다', () => {
    const keys = result.cost.breakdown.map((b) => b.key);
    expect(keys).toContain('wallpaper');
    expect(keys).toContain('labor');
    expect(keys).toContain('overhead');
  });
});

describe('구축(재도배) 조건', () => {
  const result = calcWallpaper({ ...BASE_34, isOld: true });

  it('구축이면 퍼티·바인더·네바리가 붙는다', () => {
    const keys = result.submaterials.map((s) => s.key);
    expect(keys).toContain('putty');
    expect(keys).toContain('binder');
    expect(keys).toContain('nebari');
  });

  it('기존 벽지 제거 줄이 비용에 들어간다', () => {
    const removal = result.cost.breakdown.find((b) => b.key === 'removal');
    expect(removal).toBeDefined();
    expect(removal!.qty).toBeGreaterThan(0);
  });

  it('구축이 신축보다 비싸다', () => {
    const fresh = calcWallpaper(BASE_34);
    expect(result.cost.mid).toBeGreaterThan(fresh.cost.mid);
  });
});

describe('로스 모드 전환', () => {
  it('실측 모드면 실제 재단 로스가 나온다', () => {
    const result = calcWallpaper({
      mode: '실측',
      rooms: MEASURED_ROOMS,
      heightM: 2.3,
      paperType: '실크',
      ceiling: true,
      region: '서울',
    });
    expect(result.quantity.inputMode).toBe('실측');
    expect(result.quantity.lossMode).toBe('실제');
    // 실제 재단이면 로스가 표준품셈 추정 20%보다 낮게 나오는 것이 정상이다
    expect(result.quantity.lossPct).toBeLessThan(20);
    expect(result.quantity.lossPct).toBeGreaterThanOrEqual(0);
    // 실별 보기는 넣은 방 수만큼
    expect(result.quantity.byRoom.length).toBe(MEASURED_ROOMS.length);
    expect(result.quantity.rolls).toBeGreaterThan(0);
  });

  it('실측 모드는 개구부(문·창)를 벽 면적에서 뺀다', () => {
    const withOpenings = resolveDimensions({ mode: '실측', rooms: MEASURED_ROOMS, heightM: 2.3 });
    const noOpenings = resolveDimensions({
      mode: '실측',
      heightM: 2.3,
      rooms: MEASURED_ROOMS.map((r) => ({ name: r.name, widthM: r.widthM, depthM: r.depthM })),
    });
    expect(withOpenings.totals.wallSqm).toBeLessThan(noOpenings.totals.wallSqm);
    expect(withOpenings.totals.openingSqm).toBeGreaterThan(0);
  });

  it('면적 모드면 로스 꼬리표가 면적이고 실별 보기가 1행이다', () => {
    const result = calcWallpaper({
      mode: '면적',
      areas: { wallSqm: 92, ceilingSqm: 38 }, // 둘레는 비웠다
      paperType: '실크',
      ceiling: true,
    });
    expect(result.quantity.inputMode).toBe('면적');
    expect(result.quantity.lossMode).toBe('면적');
    expect(result.quantity.byRoom.length).toBe(1);
    expect(result.quantity.byRoom[0].name).toBe('전체');
    expect(result.quantity.wallSqm).toBe(92);
    expect(result.quantity.ceilingSqm).toBe(38);
    // 둘레를 안 넣었으니 벽 면적 ÷ 2.3 으로 추정하고 근거에 "추정"이 붙는다
    expect(result.quantity.perimeterM).toBeGreaterThan(0);
    const silicone = result.submaterials.find((s) => s.key === 'silicone');
    expect(silicone).toBeDefined();
    expect(silicone!.basis).toContain('추정');
  });

  it('면적 모드에 둘레를 직접 넣으면 근거가 실측으로 바뀐다', () => {
    const result = calcWallpaper({
      mode: '면적',
      areas: { wallSqm: 92, ceilingSqm: 38, perimeterM: 40 },
      paperType: '실크',
    });
    expect(result.quantity.perimeterM).toBe(40);
    const silicone = result.submaterials.find((s) => s.key === 'silicone');
    expect(silicone!.basis).toContain('실측');
  });
});

describe('인건 — 최소 1품', () => {
  it('아주 작은 공사도 1품 아래로 내려가지 않는다', () => {
    const tiny = calcLabor({ supplyPyeong: 1, paperType: '합지', ceiling: false, isOld: false });
    expect(tiny.manDays).toBe(1);

    const zero = calcLabor({ supplyPyeong: 0, paperType: '실크', ceiling: true, isOld: false });
    expect(zero.manDays).toBeGreaterThanOrEqual(1);
  });

  it('작은 면적 계산에도 시공 줄이 1품 이상으로 들어간다', () => {
    const result = calcWallpaper({ mode: '면적', areas: { wallSqm: 2, ceilingSqm: 0 }, ceiling: false });
    const labor = result.cost.breakdown.find((b) => b.key === 'labor');
    expect(labor).toBeDefined();
    expect(labor!.qty).toBeGreaterThanOrEqual(1);
  });

  it('실크가 합지보다 품이 많이 든다', () => {
    const silk = calcLabor({ supplyPyeong: 34, paperType: '실크', ceiling: true, isOld: false });
    const hapji = calcLabor({ supplyPyeong: 34, paperType: '합지', ceiling: true, isOld: false });
    expect(silk.manDays).toBeGreaterThan(hapji.manDays);
  });

  it('표준품셈 하한 검산이 34평 실크 인건비 아래에서 말이 되는 값을 낸다', () => {
    const floor = laborSanityFloor({ wallSqm: 177, ceilingSqm: 76 });
    // 관급 기준이라 민간 견적과 같진 않지만 100만~300만 사이면 계산 자체는 정상이다
    expect(floor.amount).toBeGreaterThan(1000000);
    expect(floor.amount).toBeLessThan(3000000);
    expect(floor.note).toContain('표준품셈');
  });
});

describe('제품 직접 입력', () => {
  it('롤 규격이 작아지면 롤 수가 늘어난다', () => {
    const base = calcWallpaper(BASE_34);
    // 합지 소폭 53cm × 12.5m = 약 6.6㎡/롤 → 기본 실크(16.5㎡)보다 훨씬 많이 필요하다
    const narrow = calcWallpaper({
      ...BASE_34,
      product: { rollPrice: 20000, widthCm: 53, lengthM: 12.5 },
    });
    expect(narrow.quantity.rolls).toBeGreaterThan(base.quantity.rolls);
  });

  it('직접 입력한 롤 가격이 그대로 단가로 쓰인다', () => {
    const result = calcWallpaper({
      ...BASE_34,
      product: { rollPrice: 41234, widthCm: 106, lengthM: 15.6 },
    });
    const line = result.cost.breakdown.find((b) => b.key === 'wallpaper');
    expect(line!.unitPriceMin).toBe(41234);
    expect(line!.unitPriceMax).toBe(41234);
    expect(line!.note).toContain('직접 입력');
  });

  it('리피트가 큰 제품이면 추정 로스가 더 커진다', () => {
    const plain = calcWallpaper({
      ...BASE_34,
      product: { rollPrice: 40000, widthCm: 106, lengthM: 15.6, repeatCm: 0 },
    });
    const patterned = calcWallpaper({
      ...BASE_34,
      product: { rollPrice: 40000, widthCm: 106, lengthM: 15.6, repeatCm: 64 },
    });
    expect(patterned.quantity.lossPct).toBeGreaterThan(plain.quantity.lossPct);
  });
});

describe('시공 범위', () => {
  it('거실·주방만 고르면 전체보다 물량과 비용이 적다', () => {
    const all = calcWallpaper(BASE_34);
    const living = calcWallpaper({ ...BASE_34, scope: '거실주방' });
    expect(living.quantity.wallSqm).toBeLessThan(all.quantity.wallSqm);
    expect(living.quantity.rolls).toBeLessThan(all.quantity.rolls);
    expect(living.cost.mid).toBeLessThan(all.cost.mid);
  });

  it('천장을 끄면 천장 면적이 0이 된다', () => {
    const noCeiling = calcWallpaper({ ...BASE_34, ceiling: false });
    expect(noCeiling.quantity.ceilingSqm).toBe(0);
    expect(noCeiling.quantity.rolls).toBeLessThan(calcWallpaper(BASE_34).quantity.rolls);
  });
});

describe('응답에 새면 안 되는 값', () => {
  const result = calcWallpaper({ ...BASE_34, isOld: true });
  const json = JSON.stringify(result);

  it('업자가·도매가 관련 표현이 응답에 없다', () => {
    for (const word of ['업자', '도매', 'wholesale', 'dealer', 'costPrice', '원가']) {
      expect(json).not.toContain(word);
    }
  });

  it('재단 산식 내부값이 응답에 없다', () => {
    for (const word of ['stripsPerRoll', 'stripsNeeded', 'cutLenM', 'leftoverM', 'rawManDays', 'applied']) {
      expect(json).not.toContain(word);
    }
  });

  it('결과 최상위 키는 물량·부자재·비용 셋뿐이다', () => {
    expect(Object.keys(result).sort()).toEqual(['cost', 'quantity', 'submaterials']);
  });
});
