// ── 5. 창호 ──
// 근거: 논문 92개 창호 조사 + 시공플러스(KCC) 공개가 + 품셈 교차검증
// 상태: 확정
import type { ProcessData } from '../types';
import type { ApartmentType } from '../types';

// 타입별 위치별 창호 면적 (㎡)
export const WINDOW_AREAS: Record<ApartmentType, { name: string; area: number }[]> = {
  '59': [
    { name: '거실 대창', area: 6.9 },
    { name: '안방 창', area: 3.4 },
    { name: '침실2 창', area: 2.3 },
    { name: '침실3 창', area: 2.3 },
    { name: '다용도실 창', area: 1.1 },
  ],
  '74': [
    { name: '거실 대창', area: 7.6 },
    { name: '안방 창', area: 3.9 },
    { name: '침실2 창', area: 2.3 },
    { name: '침실3 창', area: 2.3 },
    { name: '다용도실 창', area: 1.1 },
  ],
  '84': [
    { name: '거실 대창', area: 7.6 },
    { name: '안방 창', area: 3.9 },
    { name: '침실2 창', area: 2.3 },
    { name: '침실3 창', area: 2.3 },
    { name: '다용도실 창', area: 1.1 },
  ],
};

export const WINDOW: ProcessData = {
  id: 'window',
  name: '창호',
  order: 5,
  enabled: true,
  unitType: 'sqm',  // ㎡ 단가
  grades: {
    economy:  { label: '가성비', desc: 'PVC 이중창 + 일반 복층유리',     price: 500000, unit: '원/㎡' },
    standard: { label: '중급',   desc: 'PVC 이중창 + Low-E',            price: 580000, unit: '원/㎡' },
    premium:  { label: '고급',   desc: '시스템창 + Low-E + 아르곤',      price: 700000, unit: '원/㎡' },
  },
  extras: [
    { id: 'demolition', label: '기존창 철거·폐기', price: 35000,  unit: '원/㎡',  defaultOn: true },
    { id: 'transport',  label: '사다리차/양중',    price: 700000, unit: '원/현장', defaultOn: true },
    { id: 'delivery',   label: '운반비',           price: 150000, unit: '원/현장', defaultOn: true },
  ],
  products: [
    { id: 'double', label: '이중창', price: 0, unit: '', desc: '단열 1.2~1.8 W/m²K (2~3등급) · 복층유리' },
    { id: 'system', label: '시스템창', price: 0, unit: '', desc: '단열 0.6~0.9 W/m²K (1등급) · 3중유리+가스충전' },
    { id: 'none',   label: '교체안함', price: 0, unit: '' },
  ],
  note: '등급별 통합단가는 철거폐기 포함. 부대비용(양중/운반)은 별도.',
};
