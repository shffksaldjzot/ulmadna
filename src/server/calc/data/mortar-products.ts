// ──────────────────────────────────────────────
// 미장(레미탈·셀프레벨링) 제품 마스터
//
// ⚠️ 도배·바닥재 제품 마스터(wallpaper-products.ts·flooring-products.ts)와 달리
//    이 파일은 엑셀 자동 생성이 아니다 — 미장 부자재 엑셀 조사가 아직 없어서
//    docs/도메인지식/06_미장.md 에 정리된 제조사 공식 스펙을 손으로 옮겨 적었다.
//    값을 고치려면 먼저 06_미장.md 를 고친 뒤 여기를 맞춘다.
//
//   원본 문서: C:/dotori/02_ulmadna/docs/도메인지식/06_미장.md §4·§5
//   작성일   : 2026년 09월 14일
//
// 이 파일이 하는 일:
//   1) 제품 하나하나의 포장 단위·자재 계수(kg/mm·㎡)·시공 두께 범위·판매가를 담는다
//   2) 가격이 조사되지 않은 제품이 대부분이라(레미탈은 브랜드별 개별가 자체가 없음),
//      가격이 없으면 src/server/pricing/mortar.ts 가 종류 평균 밴드로 대신 계산한다
//      (규격·계수는 제품 값을 그대로 쓰고, 가격만 종류 평균으로 폴백한다)
// ──────────────────────────────────────────────

import type { EvidenceGrade } from '../schema/types';
import type { MortarMode } from '../schema/mortar-coefficients';

/** 미장 제품 한 건 */
export interface MortarProduct {
  /** 코드에서 쓰는 고유 이름 */
  id: string;
  /** 브랜드 (한글) */
  brand: string;
  /** 제품군 이름 (한글) */
  line: string;
  /** 어느 모드(레미탈/셀프레벨링) 제품인지 */
  mode: MortarMode;
  /** 포장 단위 (kg) */
  bagKg: number;
  /** 자재 계수 — kg / (mm · ㎡) */
  kgPerMmSqm: number;
  /** 시공 권장 두께 하한 (mm) */
  minThicknessMm: number;
  /** 시공 권장 두께 상한 (mm) */
  maxThicknessMm: number;
  /** 포당 판매가 (원). 미확보면 null — 이때는 종류 평균 밴드로 계산한다 */
  pricePerBag: number | null;
  /** 계수·규격 근거 등급 */
  specGrade: EvidenceGrade;
  /** 가격 근거 등급 (가격이 null이면 의미 없음) */
  priceGrade: EvidenceGrade;
  /** 조사일 */
  surveyDate: string;
  /** 비고 (한글) */
  note: string;
  /** 가격 등 확인이 더 필요한 항목인지 — 화면에서 별도 표기하지 않지만 코드 경고용 */
  needsReview: boolean;
}

/** 06_미장.md §4·§5 표에서 옮긴 제품 목록 */
export const MORTAR_PRODUCTS: MortarProduct[] = [
  // ── 레미탈(일반 미장용 40kg) — §4 ──────────────
  {
    id: 'sampyo_sp_moltar_ilban',
    brand: '삼표',
    line: 'SP몰탈 일반미장용',
    mode: '레미탈',
    bagKg: 40,
    kgPerMmSqm: 1.65,
    // 2026-09-15 검사관 지적: 06_미장.md §4-3 두께별 환산표가 10~50mm 다섯 구간(10/20/30/40/50)을
    // 전부 다루는데 여기 상한이 30이라 방통(40~50mm)에서 제품을 못 고르던 문제 — 문서 표대로 50까지 늘렸다.
    minThicknessMm: 10,
    maxThicknessMm: 50,
    pricePerBag: null,
    specGrade: 'B',
    priceGrade: 'C',
    surveyDate: '2026-09-14',
    note: '공식 스펙(40kg = 1.3~1.4㎡/포, 두께 18mm 기준)을 두께 무관 계수로 역산. 개별 판매가는 조사 못함 — 종류 평균 밴드로 계산',
    needsReview: true,
  },
  {
    id: 'hanil_remitar_mijangyong',
    brand: '한일시멘트',
    line: '레미탈 미장용',
    mode: '레미탈',
    bagKg: 40,
    kgPerMmSqm: 1.65,
    // 삼표와 같은 이유로 06_미장.md §4-3 표(10~50mm)에 맞춰 상한을 50으로 늘렸다
    minThicknessMm: 10,
    maxThicknessMm: 50,
    pricePerBag: null,
    specGrade: 'C',
    priceGrade: 'C',
    surveyDate: '2026-09-14',
    note: '이번 조사에서 브랜드 전용 계수를 확보하지 못해 삼표 역산 계수(1.65)를 그대로 씀 — 확인 대기',
    needsReview: true,
  },

  // ── 셀프레벨링(수평몰탈 25kg) — §5-1 ────────────
  {
    id: 'hanil_rfsl05',
    brand: '한일시멘트',
    line: 'RFSL05',
    mode: '셀프레벨링',
    bagKg: 25,
    kgPerMmSqm: 1.6,
    minThicknessMm: 0.5,
    maxThicknessMm: 10,
    pricePerBag: null,
    specGrade: 'A',
    priceGrade: 'C',
    surveyDate: '2026-09-14',
    note: '박층형. 물배합 22~24%, 전용 SL프라이머 필요. 가사시간·보행시간·가격 미확보',
    needsReview: true,
  },
  {
    id: 'hanil_rfsl05s',
    brand: '한일시멘트',
    line: 'RFSL05s',
    mode: '셀프레벨링',
    bagKg: 25,
    kgPerMmSqm: 1.5,
    minThicknessMm: 1,
    maxThicknessMm: 10,
    pricePerBag: null,
    specGrade: 'A',
    priceGrade: 'C',
    surveyDate: '2026-09-14',
    note: '박층형(RFSL05 대비 표면강도 강화 계열). 가격 미확보',
    needsReview: true,
  },
  {
    id: 'hanil_rfsl15',
    brand: '한일시멘트',
    line: 'RFSL15',
    mode: '셀프레벨링',
    bagKg: 25,
    kgPerMmSqm: 1.5,
    minThicknessMm: 5,
    maxThicknessMm: 20,
    pricePerBag: null,
    specGrade: 'A',
    priceGrade: 'C',
    surveyDate: '2026-09-14',
    note: '박층~중층형. 타일 시공 전 평탄화에 주로 쓴다. 가격 미확보',
    needsReview: true,
  },
  {
    id: 'hanil_rfsl30',
    brand: '한일시멘트',
    line: 'RFSL30',
    mode: '셀프레벨링',
    bagKg: 25,
    kgPerMmSqm: 1.7,
    minThicknessMm: 10,
    maxThicknessMm: 40,
    pricePerBag: 25000,
    specGrade: 'A',
    priceGrade: 'C',
    surveyDate: '2026-09-14',
    note: '고두께용. 유통 시세 확인(단일 표본) — 대표값 확정 전 추가 스냅샷 조사 필요',
    needsReview: true,
  },
  {
    id: 'mapei_ultraplan',
    brand: '마페이',
    line: '울트라플랜',
    mode: '셀프레벨링',
    bagKg: 25,
    kgPerMmSqm: 1.6,
    // 2026-09-15 검사관 지적: 06_미장.md §5-1은 "시공권장 최대 약 10mm"만 적혀 있고 하한은
    // 문서에 없다 — 근거 없이 1mm를 쓰지 않고, 같은 박층형 제품군(한일 RFSL05s 1mm)과 비슷한
    // 통상값 3mm로 두고 등급을 C(확인 필요)로 낮춘다.
    minThicknessMm: 3,
    maxThicknessMm: 10,
    pricePerBag: null,
    specGrade: 'C',
    priceGrade: 'C',
    surveyDate: '2026-09-14',
    note: '가사시간 20~30분·경보행 약 3시간·후속공정 약 12시간(제조사 스펙, 이 부분은 등급 A). 최소 시공두께 3mm는 문서에 없는 추정값(등급 C) — 전용 프라이머(AC2000K 등) 필요, 가격 미확보',
    needsReview: true,
  },
];
