// ── 12. 중문 ──
// 근거: ulmadna_db.json (EST-026~034)
import type { ProcessData } from '../types';

export const MIDDLEDOOR: ProcessData = {
  id: 'middledoor',
  name: '중문',
  order: 12,
  enabled: false,  // 선택 품목
  unitType: 'unit',  // 1개
  grades: {
    economy:  { label: '초슬림 3연동',              desc: '초슬림 3연동 중문',         price: 800000,  unit: '원/개' },
    standard: { label: '원슬라이딩 (아이지/영림)',    desc: '아이지도어/영림',           price: 1150000, unit: '원/개' },
    premium:  { label: '원슬라이딩 (이노핸즈/스틸)',   desc: '이노핸즈/스틸프레임',       price: 1500000, unit: '원/개' },
  },
  products: [
    { id: 'slim3',      label: '초슬림 3연동',                  price: 800000,  unit: '원/개', source: 'official' },
    { id: 'igi',        label: '원슬라이딩 (아이지도어)',         price: 850000,  unit: '원/개', source: 'official' },
    { id: 'younglim',   label: '원슬라이딩 (영림)',              price: 1150000, unit: '원/개', source: 'official' },
    { id: 'innohands',  label: '원슬라이딩 (이노핸즈)',          price: 1210000, unit: '원/개', source: 'official' },
    { id: 'steel',      label: '원슬라이딩 (스틸프레임)',         price: 1500000, unit: '원/개', source: 'official' },
    { id: 'wood_flute', label: '우드프레임+플루트유리',           price: 850000,  unit: '원/개', source: 'market' },
    { id: 'pocket',     label: '포켓도어',                      price: 1800000, unit: '원/개', source: 'estimated' },
  ],
};
