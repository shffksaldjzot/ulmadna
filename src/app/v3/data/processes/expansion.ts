// ── 4. 확장 ──
// 근거: ulmadna_db.json (EST-028) + ChatGPT 시장가 보정 (2026년 04월 14일)
import type { ProcessData } from '../types';

export const EXPANSION: ProcessData = {
  id: 'expansion',
  name: '확장',
  order: 4,
  enabled: false,  // 이미 확장된 아파트가 대부분
  unitType: 'custom',
  grades: {
    standard: { label: '기본', desc: '확장공사', price: 0, unit: '항목별' },
  },
  subItems: [
    {
      id: 'room_expansion',
      name: '방 확장 (난방+미장+단열)',
      grades: { standard: { label: '기본', desc: '난방+미장+단열', price: 1250000, unit: '원/실' } },
      defaultEnabled: false,
    },
    {
      id: 'living_expansion',
      name: '거실 확장 (터닝도어 포함)',
      grades: { standard: { label: '기본', desc: '터닝도어 포함', price: 2000000, unit: '원/식' } },
      defaultEnabled: false,
    },
    {
      id: 'kitchen_expansion',
      name: '주방 확장',
      grades: { standard: { label: '기본', desc: '주방 확장', price: 2500000, unit: '원/식' } },
      defaultEnabled: false,
    },
    {
      id: 'insulation',
      name: '외벽 e보드 단열',
      grades: { standard: { label: '기본', desc: 'e보드 단열', price: 300000, unit: '원/별도' } },
      defaultEnabled: false,
    },
    {
      id: 'permit',
      name: '확장 행위허가+동의서',
      grades: { standard: { label: '기본', desc: '행위허가+동의서 대행', price: 600000, unit: '원/별도' } },
      defaultEnabled: false,
    },
  ],
  note: '이미 확장된 아파트가 대부분이라 해당 없는 경우 많음. 방 확장 100만→125만 보정(2026.04.14)',
};
