// ── 9. 도배 ──
// 근거: ulmadna_db.json (EST-028~035)
// 상태: 확정 (2026년 04월 14일, 대표님 판단 — 견적서 단가 유지)
import type { ProcessData } from '../types';

export const WALLPAPER: ProcessData = {
  id: 'wallpaper',
  name: '도배',
  order: 9,
  enabled: true,
  unitType: 'pyeong',  // 도배 합산면적 평 환산
  grades: {
    economy:  { label: '가성비', desc: '합지',                    price: 30000,  unit: '원/평' },
    standard: { label: '중급',   desc: '실크 (개나리 로하스)',      price: 89000,  unit: '원/평' },
    premium:  { label: '고급',   desc: '디아망 (LX/L하우시스)',     price: 130000, unit: '원/평' },
  },
  // 3~4뎁스: 방별 원단 선택
  products: [
    { id: 'hapji',   label: '합지',   price: 30000,  unit: '원/평' },
    { id: 'silk',    label: '실크',   price: 89000,  unit: '원/평' },
    { id: 'diamond', label: '디아망', price: 130000, unit: '원/평' },
    { id: 'none',    label: '안함',   price: 0,      unit: '원/평' },
  ],
  note: '초배+퍼티 포함 여부로 가격 차이 큼. 거실 실크+방 합지 혼합 시 평당 약 7~7.5만.',
};

// 방별 도배 구역 (3뎁스 세부 조정용)
export const WALLPAPER_ZONES = [
  { id: 'living',   name: '거실' },
  { id: 'master',   name: '안방' },
  { id: 'bed2',     name: '침실2' },
  { id: 'bed3',     name: '침실3' },
  { id: 'kitchen',  name: '주방' },
  { id: 'entrance', name: '현관/복도' },
  { id: 'ceiling',  name: '천장' },
];
