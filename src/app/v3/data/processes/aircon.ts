// ── 13. 시스템에어컨 ──
// 근거: ulmadna_db.json (EST-028,029) + ChatGPT SSG 공개가
import type { ProcessData } from '../types';

export const AIRCON: ProcessData = {
  id: 'aircon',
  name: '시스템에어컨',
  order: 13,
  enabled: false,  // 선택 품목
  unitType: 'unit',  // 대수 기준
  grades: {
    economy:  { label: '삼성 기본형', desc: '삼성 시스템에어컨', price: 1375000, unit: '원/대' },
    standard: { label: 'LG 기본형',  desc: 'LG 시스템에어컨',  price: 1600000, unit: '원/대' },
  },
  extras: [
    { id: 'ac_electric', label: '에어컨 전기작업',    price: 500000, unit: '원/식', defaultOn: true },
    { id: 'ac_box',      label: '에어컨 단내림 목공', price: 350000, unit: '원/실', defaultOn: true },
  ],
  products: [
    // 삼성
    { id: 'samsung_1way', label: '삼성 1way 6평형',  brand: '삼성', price: 720000,  unit: '원/대', source: 'official' },
    { id: 'samsung_4way', label: '삼성 4way 25평형', brand: '삼성', price: 2000000, unit: '원/대', source: 'official' },
    // LG
    { id: 'lg_1way',      label: 'LG 1way 6평형',   brand: 'LG',   price: 700000,  unit: '원/대', source: 'official' },
    { id: 'lg_4way',      label: 'LG 4way 25평형',  brand: 'LG',   price: 1900000, unit: '원/대', source: 'official' },
  ],
  note: '별도 발주 시 300~500만 절약 가능하나 책임분리 리스크. 배관 추가 19,000~30,000원/m.',
};
