// ── 8. 바닥 ──
// 근거: ChatGPT 시장가 조사 (장판나라/다나와/공개 단가표) + 대표님 방향 결정
// 구조: A+B 병행 — 프리셋(1뎁스) + 브랜드별 개별 선택(3~4뎁스)
// 고급 프리셋: 거실+주방+복도 = 타일, 방 = 강마루
import type { ProcessData } from '../types';

export const FLOORING: ProcessData = {
  id: 'flooring',
  name: '바닥',
  order: 8,
  enabled: true,
  unitType: 'pyeong',  // 마루 면적 평수 기준
  grades: {
    // 프리셋 단가 (평균값)
    economy:  { label: '가성비 (장판)', desc: 'LX 지아자연애/KCC 숲옥 2.2T 평균', price: 50000,  unit: '원/평' },
    standard: { label: '중급 (강마루)', desc: '동화/구정/LX/KCC 강마루 평균',      price: 115000, unit: '원/평' },
    premium:  { label: '고급 (타일+강마루)', desc: '방: 강마루14.5만 / 거실·주방: 타일15만~', price: 145000, unit: '원/평' },
  },
  extras: [
    { id: 'floor_demolition', label: '기존 마루 철거비', price: 35000, unit: '원/평', defaultOn: true },
  ],
  note: '고급 프리셋: 거실+주방+복도+현관은 타일(별도 단가), 방은 강마루 145,000원/평',
};

// ── 장판 개별 선택 (3~4뎁스) ──
export const JANGPAN_OPTIONS = [
  { id: 'kcc_ok_22',      label: 'KCC 숲옥 2.2T',          brand: 'KCC',  price: 45000,  unit: '원/평', source: 'official' as const },
  { id: 'lx_jayeonae_22', label: 'LX 지아자연애 2.2T',      brand: 'LX',   price: 55000,  unit: '원/평', source: 'official' as const },
  { id: 'kcc_dodam_27',   label: 'KCC 숲도담 2.7T',         brand: 'KCC',  price: 60000,  unit: '원/평', source: 'official' as const },
  { id: 'kcc_dodam_32',   label: 'KCC 숲도담 3.2T',         brand: 'KCC',  price: 70000,  unit: '원/평', source: 'official' as const },
  { id: 'lx_sorijam_45',  label: 'LX 지아소리잠 4.5T',      brand: 'LX',   price: 94000,  unit: '원/평', source: 'official' as const },
  { id: 'kcc_hugaon_50',  label: 'KCC 숲휴가온 5.0T',       brand: 'KCC',  price: 100000, unit: '원/평', source: 'official' as const },
  { id: 'lx_xcomfort_50', label: 'LX 엑스컴포트 5.0T',      brand: 'LX',   price: 106000, unit: '원/평', source: 'official' as const },
];

// ── 강마루 개별 선택 (3~4뎁스) ──
export const KANGMARU_OPTIONS = [
  { id: 'dongwha_natus_s',  label: '동화 나투스진 소폭',       brand: '동화', price: 95000,  unit: '원/평', source: 'market' as const },
  { id: 'dongwha_natus_t',  label: '동화 나투스진 텍스쳐',     brand: '동화', price: 112000, unit: '원/평', source: 'market' as const },
  { id: 'kcc_texture',      label: 'KCC 숲 강마루 텍스쳐',     brand: 'KCC',  price: 112000, unit: '원/평', source: 'market' as const },
  { id: 'gujeong_basic',    label: '구정 강마루',              brand: '구정', price: 115000, unit: '원/평', source: 'official' as const },
  { id: 'lx_promax',        label: 'LX 강그린 프로맥스',       brand: 'LX',   price: 130000, unit: '원/평', source: 'official' as const },
  { id: 'gujeong_grand165', label: '구정 그랜드165',           brand: '구정', price: 145000, unit: '원/평', source: 'official' as const },
];

// ── 천연마루 개별 선택 ──
export const NATURAL_MARU_OPTIONS = [
  { id: 'eagon_foresta',   label: '이건 포레스타',     brand: '이건', price: 128000, unit: '원/평', source: 'official' as const },
  { id: 'eagon_foresta_g', label: '이건 포레스타 G',   brand: '이건', price: 146000, unit: '원/평', source: 'official' as const },
];

// ── 바닥 타일 (고급 프리셋: 거실+주방+복도용) ──
export const FLOOR_TILE_OPTIONS = [
  { id: 'china_600',   label: '중국산 포세린 600×600',      brand: '중국산',       price: 150000, unit: '원/평', source: 'market' as const },
  { id: 'korea_600',   label: '국산 포세린 600×600',        brand: '국산',         price: 155000, unit: '원/평', source: 'market' as const },
  { id: 'spain_600',   label: '스페인산 포세린 600×600',     brand: '스페인산',     price: 220000, unit: '원/평', source: 'official' as const },
  { id: 'italy_600',   label: '이탈리아산 포세린 600×600',   brand: '이탈리아산',   price: 250000, unit: '원/평', source: 'official' as const },
];
