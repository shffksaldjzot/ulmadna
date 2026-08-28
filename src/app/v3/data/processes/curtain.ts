// ── 16. 커튼 ──
// 근거: ChatGPT 2차 조사 — 공개 맞춤커튼 판매가 + 숨고 시공 평균
// 구조: A+B 병행 — 프리셋(창당) + 원단별 개별 선택(m당)
import type { ProcessData } from '../types';

export const CURTAIN: ProcessData = {
  id: 'curtain',
  name: '커튼',
  order: 16,
  enabled: false,  // 선택 품목
  unitType: 'window',  // 창 개수 기준
  grades: {
    // 프리셋 (창당 단가)
    economy:  { label: '가성비', desc: '쉬폰 단일 or 세미암막',                  price: 175000,  unit: '원/창' },
    standard: { label: '중급',   desc: '쉬폰+암막 이중 (형상기억)',               price: 375000,  unit: '원/창' },
    premium:  { label: '고급',   desc: '쉬폰+벨벳/고중량 암막 + 전동',            price: 650000,  unit: '원/창' },
  },
  note: '숨고 평균 건당 32만원. 전동은 레일·모터 추가 구조 (원단 가격 불변). 커튼 1개당 모터 1개.',
};

// ── 원단별 자재비 (m당, 봉제 제작비 포함) ──
export const CURTAIN_FABRICS = [
  { id: 'sheer',        label: '쉬폰/쉬어',     economy: 12000, standard: 18000, premium: 23000,  unit: '원/m' },
  { id: 'blackout',     label: '암막',          economy: 23000, standard: 32000, premium: 42000,  unit: '원/m' },
  { id: 'double',       label: '쉬폰+암막 이중', economy: 35000, standard: 48000, premium: 60000,  unit: '원/m' },
  { id: 'linen',        label: '린넨룩',         economy: 24000, standard: 33000, premium: 45000,  unit: '원/m' },
  { id: 'lace',         label: '레이스/자수',     economy: 20000, standard: 30000, premium: 42000,  unit: '원/m' },
  { id: 'velvet',       label: '벨벳/호텔식',     economy: 35000, standard: 50000, premium: 0,      unit: '원/m' },
] as const;

// ── 시공비 ──
export const CURTAIN_INSTALL = {
  single_rail:  { label: '수동 단일 레일 설치', price: 20000, unit: '원/창' },
  double_rail:  { label: '수동 이중 레일 설치', price: 28000, unit: '원/창' },
} as const;

// ── 전동 추가비 ──
export const CURTAIN_MOTORIZED = {
  single:   { label: '암막 1겹만 전동',      price: 275000, unit: '원/창' },
  double:   { label: '쉬폰+암막 양쪽 전동',   price: 600000, unit: '원/창' },
  somfy:    { label: '프리미엄 (솜피)',       price: 570000, unit: '원/레일' },
} as const;

// ── 가공 옵션 ──
export const CURTAIN_OPTIONS = {
  memory_sheer:    { label: '형상기억 (쉬폰)', price: 25000, unit: '원/폭' },
  memory_blackout: { label: '형상기억 (암막)',  price: 38000, unit: '원/폭' },
} as const;

// ── 실별 추천 (UI 팁 표시용) ──
export const CURTAIN_ROOM_TIPS = {
  living:  '거실: 쉬폰+암막 이중 (형상기억) — 가장 넓은 창, 전동 체감 최고',
  master:  '안방: 암막 단일 or 이중 — 수면 품질 핵심',
  bedroom: '침실: 가성비 암막 — 아이방/게스트룸은 기본으로 충분',
  kitchen: '주방/다용도: 롤스크린 — 기름때·습기에 강함',
  veranda: '베란다: 롤스크린 — 자외선+시선 차단',
} as const;
