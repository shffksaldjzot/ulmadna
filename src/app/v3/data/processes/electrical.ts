// ── 2. 전기 ──
// 근거: ulmadna_db.json (EST-027~035) + ChatGPT 시장가 검증 적정
import type { ProcessData } from '../types';

export const ELECTRICAL: ProcessData = {
  id: 'electrical',
  name: '전기',
  order: 2,
  enabled: true,
  unitType: 'set',  // 세대 전체 1식 기준
  grades: {
    economy:  { label: '가성비', desc: '콘센트+스위치 교체만 (진흥/나노)',         price: 600000,  unit: '원/식' },
    standard: { label: '중급',   desc: '콘센트+스위치+조명+배선 일부 (베코보노)',   price: 2350000, unit: '원/식' },
    premium:  { label: '고급',   desc: '전체 배선+분전함+조명+인덕션+도어락 (르그랑)', price: 3500000, unit: '원/식' },
  },
  extras: [
    { id: 'induction_wiring', label: '인덕션 단독배선', price: 300000, unit: '원/식', defaultOn: false },
  ],
  products: [
    // 4뎁스 세부 품목 (ChatGPT 조사)
    { id: 'downlight',    label: '다운라이트 2인치',  price: 40000,  unit: '원/EA',  desc: '가성비3만/중급4만/고급5.5만', source: 'estimated' },
    { id: 'indirect_t5',  label: '간접조명 T5',      price: 35000,  unit: '원/m',   desc: '가성비2.5만/중급3.5만/고급5.5만', source: 'estimated' },
    { id: 'panel_box',    label: '분전함 교체',       price: 450000, unit: '원/식',  desc: '가성비35만/중급45만/고급60만', source: 'market' },
    { id: 'doorlock',     label: '도어락 교체',       price: 220000, unit: '원/식',  desc: '보조키12만/푸시풀22만/프리미엄45만', source: 'market' },
    { id: 'intercom',     label: '인터폰 교체',       price: 220000, unit: '원/식',  desc: '음성10만/7인치22만/10인치38만', source: 'market' },
  ],
  note: '범위에 따라 편차 극히 큼 (60만~350만)',
};
