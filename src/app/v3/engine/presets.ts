// ──────────────────────────────────────────────
// v3 견적 엔진 — 프리셋 (등급별 자동 세팅)
// 가성비/중급/고급 선택 시 16개 공정의 ON/OFF와 등급을 자동 결정
// ──────────────────────────────────────────────

import type { GradeKey, PresetConfig } from '../data/types';

/** 가성비 프리셋 */
const ECONOMY_PRESET: PresetConfig = {
  grade: 'economy',
  processes: {
    demolition:  { enabled: true,  gradeKey: 'economy' },   // 부분 철거
    electrical:  { enabled: true,  gradeKey: 'economy' },   // 콘센트+스위치만
    plumbing:    { enabled: false, gradeKey: 'standard' },   // 설비 안함
    expansion:   { enabled: false, gradeKey: 'standard' },   // 확장 안함
    window:      { enabled: true,  gradeKey: 'economy' },   // PVC 이중창
    woodwork:    { enabled: true,  gradeKey: 'economy', subItems: {
      molding:   { enabled: true,  gradeKey: 'economy' },   // 3전 몰딩
      doors:     { enabled: true,  gradeKey: 'economy' },   // 보급 방문
      tv_wall:   { enabled: false, gradeKey: 'economy' },   // TV매립 안함
      ceiling:   { enabled: false, gradeKey: 'economy' },   // 천장 안함
      ac_box:    { enabled: false, gradeKey: 'standard' },  // 에어컨 단내림 안함
    }},
    bathroom:    { enabled: true,  gradeKey: 'economy' },   // 보급형 욕실
    flooring:    { enabled: true,  gradeKey: 'economy' },   // 장판 5만/평
    wallpaper:   { enabled: true,  gradeKey: 'economy' },   // 합지 3만/평
    painting:    { enabled: false, gradeKey: 'standard' },   // 도장 안함
    film:        { enabled: true,  gradeKey: 'economy' },   // 방문틀+신발장+욕실문틀
    middledoor:  { enabled: false, gradeKey: 'economy' },   // 중문 안함
    aircon:      { enabled: false, gradeKey: 'economy' },   // 에어컨 안함
    furniture:   { enabled: true,  gradeKey: 'economy', subItems: {
      sink:            { enabled: true,  gradeKey: 'economy' },
      island:          { enabled: false, gradeKey: 'economy' },
      shoe_cabinet:    { enabled: true,  gradeKey: 'economy' },
      closet:          { enabled: true,  gradeKey: 'economy' },
      fridge_cabinet:  { enabled: true,  gradeKey: 'economy' },
      cafe_cabinet:    { enabled: false, gradeKey: 'standard' },
      dressroom:       { enabled: false, gradeKey: 'standard' },
      veranda_storage: { enabled: false, gradeKey: 'standard' },
    }},
    appliance:   { enabled: false, gradeKey: 'economy' },   // 가전 안함 (직접 구매)
    curtain:     { enabled: false, gradeKey: 'economy' },   // 커튼 안함 (직접 구매)
    finishing:   { enabled: true,  gradeKey: 'standard', subItems: {
      cleaning:        { enabled: true,  gradeKey: 'standard' },
      nano_coating:    { enabled: false, gradeKey: 'standard' },
      grout_kerafoxy:  { enabled: false, gradeKey: 'standard' },
      grout_polyurea:  { enabled: false, gradeKey: 'standard' },
      consent_agent:   { enabled: true,  gradeKey: 'standard' },
      elevator_protect: { enabled: true, gradeKey: 'standard' },
      elevator_fee:    { enabled: true,  gradeKey: 'standard' },
      material_lift:   { enabled: true,  gradeKey: 'standard' },
      handy:           { enabled: true,  gradeKey: 'standard' },
    }},
  },
};

/** 중급 프리셋 */
const STANDARD_PRESET: PresetConfig = {
  grade: 'standard',
  processes: {
    demolition:  { enabled: true,  gradeKey: 'standard' },  // 일반 철거
    electrical:  { enabled: true,  gradeKey: 'standard' },  // 콘센트+조명+배선
    plumbing:    { enabled: false, gradeKey: 'standard' },  // 설비 안함 (올수리 아니면)
    expansion:   { enabled: false, gradeKey: 'standard' },  // 확장 안함
    window:      { enabled: true,  gradeKey: 'standard' },  // PVC 이중창 + Low-E
    woodwork:    { enabled: true,  gradeKey: 'standard', subItems: {
      molding:   { enabled: true,  gradeKey: 'standard' },  // 마이너스몰딩
      doors:     { enabled: true,  gradeKey: 'standard' },  // 예림 방문
      tv_wall:   { enabled: true,  gradeKey: 'standard' },  // TV반매립
      ceiling:   { enabled: false, gradeKey: 'standard' },  // 천장 기본 안함
      ac_box:    { enabled: false, gradeKey: 'standard' },
    }},
    bathroom:    { enabled: true,  gradeKey: 'standard' },  // 대림/이누스
    flooring:    { enabled: true,  gradeKey: 'standard' },  // 강마루 11.5만/평
    wallpaper:   { enabled: true,  gradeKey: 'standard' },  // 실크 8.9만/평
    painting:    { enabled: false, gradeKey: 'standard' },  // 도장 안함
    film:        { enabled: true,  gradeKey: 'standard' },  // 중급 필름
    middledoor:  { enabled: true,  gradeKey: 'standard' },  // 원슬라이딩
    aircon:      { enabled: false, gradeKey: 'economy' },   // 에어컨 별도
    furniture:   { enabled: true,  gradeKey: 'standard', subItems: {
      sink:            { enabled: true,  gradeKey: 'standard' },
      island:          { enabled: true,  gradeKey: 'standard' },
      shoe_cabinet:    { enabled: true,  gradeKey: 'standard' },
      closet:          { enabled: true,  gradeKey: 'standard' },
      fridge_cabinet:  { enabled: true,  gradeKey: 'standard' },
      cafe_cabinet:    { enabled: false, gradeKey: 'standard' },
      dressroom:       { enabled: false, gradeKey: 'standard' },
      veranda_storage: { enabled: false, gradeKey: 'standard' },
    }},
    appliance:   { enabled: false, gradeKey: 'standard' },
    curtain:     { enabled: false, gradeKey: 'standard' },
    finishing:   { enabled: true,  gradeKey: 'standard', subItems: {
      cleaning:        { enabled: true,  gradeKey: 'standard' },
      nano_coating:    { enabled: false, gradeKey: 'standard' },
      grout_kerafoxy:  { enabled: false, gradeKey: 'standard' },
      grout_polyurea:  { enabled: false, gradeKey: 'standard' },
      consent_agent:   { enabled: true,  gradeKey: 'standard' },
      elevator_protect: { enabled: true, gradeKey: 'standard' },
      elevator_fee:    { enabled: true,  gradeKey: 'standard' },
      material_lift:   { enabled: true,  gradeKey: 'standard' },
      handy:           { enabled: true,  gradeKey: 'standard' },
    }},
  },
};

/** 고급 프리셋 */
const PREMIUM_PRESET: PresetConfig = {
  grade: 'premium',
  processes: {
    demolition:  { enabled: true,  gradeKey: 'premium' },   // 올철거
    electrical:  { enabled: true,  gradeKey: 'premium' },   // 전체 배선+분전함
    plumbing:    { enabled: true,  gradeKey: 'standard', subItems: {
      distributor:   { enabled: true,  gradeKey: 'standard' },
      bath_plumbing: { enabled: true,  gradeKey: 'standard' },
      jendai:        { enabled: true,  gradeKey: 'standard' },
    }},
    expansion:   { enabled: false, gradeKey: 'standard' },  // 확장은 케이스별
    window:      { enabled: true,  gradeKey: 'premium' },   // 시스템창
    woodwork:    { enabled: true,  gradeKey: 'premium', subItems: {
      molding:   { enabled: true,  gradeKey: 'premium' },   // 슬림형
      doors:     { enabled: true,  gradeKey: 'premium' },   // ABS+도무스
      tv_wall:   { enabled: true,  gradeKey: 'premium' },   // 아트월
      ceiling:   { enabled: true,  gradeKey: 'premium' },   // 우물천장
      ac_box:    { enabled: true,  gradeKey: 'standard' },  // 에어컨 단내림
    }},
    bathroom:    { enabled: true,  gradeKey: 'premium' },   // 아메리칸스탠다드
    flooring:    { enabled: true,  gradeKey: 'premium' },   // 방=강마루+거실=타일
    wallpaper:   { enabled: true,  gradeKey: 'premium' },   // 디아망
    painting:    { enabled: true,  gradeKey: 'standard' },  // 도장 ON (고급 단일사양)
    film:        { enabled: true,  gradeKey: 'premium' },   // 전체 필름
    middledoor:  { enabled: true,  gradeKey: 'premium' },   // 이노핸즈/스틸
    aircon:      { enabled: true,  gradeKey: 'standard' },  // 시스템에어컨 ON
    furniture:   { enabled: true,  gradeKey: 'premium', subItems: {
      sink:            { enabled: true,  gradeKey: 'premium' },
      island:          { enabled: true,  gradeKey: 'premium' },
      shoe_cabinet:    { enabled: true,  gradeKey: 'premium' },
      closet:          { enabled: true,  gradeKey: 'premium' },
      fridge_cabinet:  { enabled: true,  gradeKey: 'premium' },
      cafe_cabinet:    { enabled: true,  gradeKey: 'premium' },
      dressroom:       { enabled: true,  gradeKey: 'standard' },
      veranda_storage: { enabled: true,  gradeKey: 'standard' },
    }},
    appliance:   { enabled: true,  gradeKey: 'standard' },  // 가전 참고용 ON
    curtain:     { enabled: true,  gradeKey: 'premium' },   // 고급 커튼
    finishing:   { enabled: true,  gradeKey: 'standard', subItems: {
      cleaning:        { enabled: true,  gradeKey: 'standard' },
      nano_coating:    { enabled: true,  gradeKey: 'standard' },
      grout_kerafoxy:  { enabled: true,  gradeKey: 'standard' },
      grout_polyurea:  { enabled: false, gradeKey: 'standard' },
      consent_agent:   { enabled: true,  gradeKey: 'standard' },
      elevator_protect: { enabled: true, gradeKey: 'standard' },
      elevator_fee:    { enabled: true,  gradeKey: 'standard' },
      material_lift:   { enabled: true,  gradeKey: 'standard' },
      handy:           { enabled: true,  gradeKey: 'standard' },
    }},
  },
};

/** 등급별 프리셋 맵 */
export const PRESETS: Record<GradeKey, PresetConfig> = {
  economy: ECONOMY_PRESET,
  standard: STANDARD_PRESET,
  premium: PREMIUM_PRESET,
};

/** 등급 키로 프리셋 가져오기 */
export function getPreset(grade: GradeKey): PresetConfig {
  return PRESETS[grade];
}
