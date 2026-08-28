// ── 7. 욕실·타일 ──
// 근거: ulmadna_db.json (EST-027~035) + ChatGPT 도기/시공비 시장가 조사
// 구조: 1뎁스 세트 단가 + 3~4뎁스 도기 개별 선택 병행
import type { ProcessData } from '../types';

export const BATHROOM: ProcessData = {
  id: 'bathroom',
  name: '욕실·타일',
  order: 7,
  enabled: true,
  unitType: 'room',  // 욕실 개소 기준 (기본 2개소)
  grades: {
    // 1뎁스 세트 단가 (도기+타일+시공 전부 포함)
    economy:  { label: '보급형',              desc: '도기+기본타일+시공',                          price: 1300000, unit: '원/실' },
    standard: { label: '중급 (대림/이누스)',    desc: '도기+타일+시공+악세사리+천장',                  price: 3000000, unit: '원/실' },
    premium:  { label: '고급 (아메리칸스탠다드)', desc: '도기+포세린타일+시공+악세사리+천장+줄눈',        price: 4000000, unit: '원/실' },
  },
  subItems: [
    // ── 타일 (욕실 외) ──
    {
      id: 'entrance_tile',
      name: '현관타일',
      grades: {
        economy:  { label: '600×600 덧방',     desc: '기본 타일',       price: 160000, unit: '원/식' },
        standard: { label: '포세린 덧방',       desc: '포세린 타일',     price: 250000, unit: '원/식' },
        premium:  { label: '1200×600 포세린',   desc: '대형 포세린',     price: 500000, unit: '원/식' },
      },
      defaultEnabled: true,
    },
    {
      id: 'kitchen_tile',
      name: '주방 벽타일',
      grades: {
        economy:  { label: '300×600',         desc: '기본 벽타일',     price: 272000, unit: '원/식' },
        standard: { label: '300×600 중급',     desc: '중급 벽타일',     price: 400000, unit: '원/식' },
        premium:  { label: '800×800',         desc: '대형 벽타일',     price: 500000, unit: '원/식' },
      },
      defaultEnabled: true,
    },
    {
      id: 'veranda_tile',
      name: '베란다 타일',
      grades: {
        economy:  { label: '300×300 1개소',    desc: '기본 1개소',      price: 562000, unit: '원/식' },
        standard: { label: '앞뒤 베란다',      desc: '앞뒤 2개소',      price: 1800000, unit: '원/식' },
      },
      defaultEnabled: false,
    },
  ],
  note: '욕실 2개소 기준 (안방+거실). 3~4뎁스에서 도기 브랜드별 개별 선택 가능.',
};

// ── 도기 시공비 (순수 공임, 제품비 별도) ──
export const SANITARY_INSTALL_COSTS = {
  toilet:     { label: '양변기 (철거+설치)',  price: 100000, unit: '원/개' },
  basin:      { label: '세면대 (철거+설치)',  price: 80000,  unit: '원/개' },
  basin_tap:  { label: '세면수전 교체',      price: 60000,  unit: '원/개' },
  shower_tap: { label: '샤워수전 교체',      price: 70000,  unit: '원/개' },
  bathtub:    { label: '욕조 (철거+설치)',    price: 300000, unit: '원/개' },
  partition:  { label: '샤워파티션 설치',     price: 60000,  unit: '원/개' },
  accessory:  { label: '악세사리 세트 설치',  price: 40000,  unit: '원/세트' },
} as const;

// ── 도기 제품 옵션 (4뎁스 브랜드별 선택) ──
export const TOILET_OPTIONS = [
  { id: 'hanssem',  label: '한샘 치마형 투피스',           brand: '한샘',            price: 139000,  source: 'official' as const },
  { id: 'inus_2p',  label: '이누스 투피스',               brand: '이누스',           price: 178000,  source: 'official' as const },
  { id: 'inus_1p',  label: '이누스 원피스',               brand: '이누스',           price: 237000,  source: 'official' as const },
  { id: 'as_2p',    label: '아메리칸스탠다드 투피스',       brand: '아메리칸스탠다드',   price: 337000,  source: 'official' as const },
  { id: 'daelim_2p', label: '대림바스 투피스 PC-9030',     brand: '대림바스',         price: 317000,  source: 'official' as const },
  { id: 'daelim_1p', label: '대림바스 원피스 PC-7040',     brand: '대림바스',         price: 360000,  source: 'official' as const },
  { id: 'as_1p',    label: '아메리칸스탠다드 원피스',       brand: '아메리칸스탠다드',   price: 535000,  source: 'official' as const },
  { id: 'toto_wash', label: 'TOTO 워시렛 일체형',         brand: 'TOTO',            price: 3000000, source: 'official' as const },
];

export const BASIN_OPTIONS = [
  { id: 'hanssem',   label: '한샘 사각 TY-002',           brand: '한샘',            price: 170000, source: 'official' as const },
  { id: 'as_activa', label: '아메리칸스탠다드 액티바',      brand: '아메리칸스탠다드',  price: 183000, source: 'official' as const },
  { id: 'daelim',    label: '대림바스 반다리 PL-1042',     brand: '대림바스',         price: 184000, source: 'official' as const },
  { id: 'toto_l',    label: 'TOTO L700CET 탑볼',         brand: 'TOTO',            price: 320000, source: 'official' as const },
];

export const TAP_OPTIONS = [
  { id: 'hanssem',    label: '한샘 기본 무광',       brand: '한샘',       price: 47000,   source: 'official' as const },
  { id: 'daelim',     label: '대림바스 니켈',        brand: '대림바스',    price: 54000,   source: 'official' as const },
  { id: 'grohe_euro', label: '그로에 유로스타일',     brand: '그로에',     price: 182000,  source: 'official' as const },
  { id: 'grohe_ess',  label: '그로에 에센스',        brand: '그로에',     price: 308000,  source: 'official' as const },
  { id: 'hans_talis', label: '한스그로에 타리스',     brand: '한스그로에',  price: 594000,  source: 'official' as const },
  { id: 'hans_metro', label: '한스그로에 메트로폴',   brand: '한스그로에',  price: 1000000, source: 'official' as const },
];

export const ACCESSORY_OPTIONS = [
  { id: 'nickel',    label: '니켈/무광 SUS 4품세트',       price: 53000,  source: 'official' as const },
  { id: 'import',    label: '한스그로에 Logis 5in1 세트',  price: 857000, source: 'official' as const },
];
