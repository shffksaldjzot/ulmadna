// ── 1. 철거 ──
// 근거: ulmadna_db.json (EST-028~034) + ChatGPT 시장가 검증 적정
import type { ProcessData } from '../types';

export const DEMOLITION: ProcessData = {
  id: 'demolition',
  name: '철거',
  order: 1,
  enabled: true,
  unitType: 'pyeong',  // 전용면적 평수 기준
  grades: {
    economy:  { label: '부분 철거', desc: '욕실+싱크대+가구 위주', price: 30000, unit: '원/평' },
    standard: { label: '일반 철거', desc: '마루+몰딩+가구+욕실',  price: 50000, unit: '원/평' },
    premium:  { label: '올철거',    desc: '전체 마루+천장+욕실+가구', price: 65000, unit: '원/평' },
  },
  extras: [
    { id: 'waste_basic', label: '폐기물 (부분수리)', price: 500000,  unit: '원/식', defaultOn: false },
    { id: 'waste_mid',   label: '폐기물 (일반수리)', price: 1000000, unit: '원/식', defaultOn: true },
    { id: 'waste_full',  label: '폐기물 (올수리)',   price: 1600000, unit: '원/식', defaultOn: false },
  ],
  note: '전용면적 ÷ 3.3 = 평수. EST-028(10만/평)~EST-034(6만/평) 편차 큼.',
};
