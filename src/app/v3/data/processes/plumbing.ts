// ── 3. 설비 ──
// 근거: ulmadna_db.json (EST-028) + ChatGPT 시장가 보정 (2026년 04월 14일)
import type { ProcessData } from '../types';

export const PLUMBING: ProcessData = {
  id: 'plumbing',
  name: '설비',
  order: 3,
  enabled: false,  // 올수리가 아니면 보통 안 함
  unitType: 'custom',
  grades: {
    // 설비는 등급 개념 없이 항목별 단가
    standard: { label: '기본', desc: '분배기+욕실설비', price: 0, unit: '항목별' },
  },
  subItems: [
    {
      id: 'distributor',
      name: '분배기+가지관 교체',
      grades: { standard: { label: '기본', desc: '분배기+가지관', price: 450000, unit: '원/식' } },
      defaultEnabled: true,
    },
    {
      id: 'bath_plumbing',
      name: '욕실 기초설비 (배관+방수+조적)',
      grades: { standard: { label: '기본', desc: '배관+방수+조적', price: 650000, unit: '원/실' } },
      quantityKey: 'bath_count',  // 욕실 2개소 기준
      defaultEnabled: true,
    },
    {
      id: 'jendai',
      name: '조적 (젠다이)',
      grades: { standard: { label: '기본', desc: '젠다이 신설', price: 300000, unit: '원/개소' } },
      defaultEnabled: false,
    },
  ],
  note: '올수리가 아니면 설비공사 안 하는 경우 많음. 분배기 기존 430만→45만 보정(2026.04.14)',
};
