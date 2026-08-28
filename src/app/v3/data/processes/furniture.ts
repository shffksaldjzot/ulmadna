// ── 14. 가구 ──
// 근거: ulmadna_db.json (EST-027~035) + ChatGPT 시장가 보정
import type { ProcessData } from '../types';

export const FURNITURE: ProcessData = {
  id: 'furniture',
  name: '가구',
  order: 14,
  enabled: true,
  unitType: 'custom',  // 품목별 단위 다름
  grades: {
    economy:  { label: '가성비', desc: '보급형 싱크대+신발장',       price: 0, unit: '항목별' },
    standard: { label: '중급',   desc: 'PET EO급 싱크대+가구',      price: 0, unit: '항목별' },
    premium:  { label: '고급',   desc: '한솔 PET 18T급+풀옵션',     price: 0, unit: '항목별' },
  },
  subItems: [
    // 싱크대 (1식)
    {
      id: 'sink',
      name: '싱크대',
      grades: {
        economy:  { label: '보급 일자',       desc: '무브랜드 일자형',      price: 1900000, unit: '원/식' },
        standard: { label: 'PET EO ㄱ자',    desc: '예림/LX급',          price: 3500000, unit: '원/식' },
        premium:  { label: '한솔 PET 18T',   desc: '한솔 프리미엄',       price: 4500000, unit: '원/식' },
      },
      defaultEnabled: true,
    },
    // 아일랜드장 (1개)
    {
      id: 'island',
      name: '아일랜드장',
      grades: {
        economy:  { label: '소형',  desc: '소형 아일랜드', price: 750000,  unit: '원/개' },
        standard: { label: '중형',  desc: '중형',         price: 1500000, unit: '원/개' },
        premium:  { label: '대형',  desc: '대형',         price: 2100000, unit: '원/개' },
      },
      defaultEnabled: false,
    },
    // 신발장 (1개)
    {
      id: 'shoe_cabinet',
      name: '신발장',
      grades: {
        economy:  { label: '보급',           desc: '보급형',           price: 750000, unit: '원/개' },
        standard: { label: 'PET 하부띄움',   desc: 'PET 하부띄움',    price: 800000, unit: '원/개' },
        premium:  { label: '한솔 PET 18T',  desc: '한솔 프리미엄',    price: 910000, unit: '원/개' },
      },
      defaultEnabled: true,
    },
    // 붙박이장 (자당, 약 0.3m)
    {
      id: 'closet',
      name: '붙박이장',
      grades: {
        economy:  { label: '무광PET 가성비', desc: '무광PET 여닫이', price: 130000, unit: '원/자' },
        standard: { label: '무광PET 중급',  desc: '무광PET',       price: 150000, unit: '원/자' },
        premium:  { label: '한솔 하이그로시', desc: '하이그로시',     price: 180000, unit: '원/자' },
      },
      defaultEnabled: true,
    },
    // 냉장고장
    {
      id: 'fridge_cabinet',
      name: '냉장고장',
      grades: {
        economy:  { label: '보급',          desc: '보급형',           price: 750000,  unit: '원/개' },
        standard: { label: '3도어',         desc: '3도어 냉장고장',   price: 780000,  unit: '원/개' },
        premium:  { label: '냉장고장+키큰장', desc: '냉장고장+키큰장', price: 1680000, unit: '원/개' },
      },
      defaultEnabled: true,
    },
    // 홈카페장
    {
      id: 'cafe_cabinet',
      name: '홈카페장',
      grades: {
        standard: { label: '기본형',               desc: '기본 홈카페장',        price: 1400000, unit: '원/개' },
        premium:  { label: '로봇청소기수납 포함',    desc: '로봇청소기 수납 포함',  price: 1950000, unit: '원/개' },
      },
      defaultEnabled: false,
    },
    // 드레스룸선반
    {
      id: 'dressroom',
      name: '드레스룸선반 (시스템행거)',
      grades: {
        standard: { label: '시스템행거', desc: 'DR.CODY급 시스템행거', price: 1560000, unit: '원/식' },
      },
      defaultEnabled: false,
    },
    // 베란다 창고장
    {
      id: 'veranda_storage',
      name: '베란다 창고장',
      grades: {
        standard: { label: '기본', desc: '베란다 수납장', price: 480000, unit: '원/개소' },
      },
      defaultEnabled: false,
    },
  ],
  note: '아일랜드 대형 290만→210만, 홈카페장 중급 200만→140만, 고급 280만→195만 보정(2026.04.14). 드레스룸 DR.CODY 120만×1.3=156만.',
};
