// ──────────────────────────────────────────────
// 벽지 제품 카탈로그 (도배 계산기용)
//
// 출처: 형아(사용자)가 직접 정리한 엑셀
//   C:\dotori\02_ulmadna\docs\도메인지식\대한민국_벽지_부자재_DB_2026-09-09.xlsx
//   시트 '벽지_컬렉션_DB' (조사 기준일 2026-09-09, 전체 51행)
// 이 파일은 그 엑셀을 그대로 옮긴 데이터다. 숫자를 손으로 고치지 말고,
// 값이 바뀌면 엑셀을 먼저 고친 뒤 다시 옮겨라.
//
// ── 엑셀 컬럼 → 이 파일 필드 매핑 규칙 ──────────────
//   폭(mm) ÷ 10                       → widthCm      (엔진 RollSpec이 cm 단위라서)
//   롤길이(m)                          → lengthM
//   widthCm/100 × lengthM (계산)       → sqmPerRoll   (엔진 재단이 실제로 쓰는 값)
//   명목평수(엑셀은 계산 평수)를 반올림   → pyeongPerRollLabel
//                                       (엑셀 '명목평수' 칸에는 6.625㎡ → 2.004 같은
//                                        계산값이 들어 있어서, 유통에서 부르는 표기
//                                        평수(소폭 2평 / 장폭·실크 5평)로 반올림했다.
//                                        '표준규격_계산식' 시트의 '유통 명목평수'와 일치)
//   시장최저(원/롤) → priceMin, 시장최고(원/롤) → priceMax
//                                       (둘 다 없으면 대표가 → 환산롤가격 순으로
//                                        단일값을 넣고 min = max 로 둔다)
//   분류                                → paperType
//                                       소폭합지·장폭합지 → '합지'
//                                       실크(일반/중급/고급)·방염실크 → '실크'
//                                       (엑셀의 세부 분류 원문은 note에 그대로 남겼다)
//   규격확인수준                        → needsReview (아래 규칙)
//   규격출처URL·가격출처URL             → sourceUrls (두 개)
//   조사일                              → surveyDate ('2026-09-09' 고정)
//   무늬 리피트                         → repeatCm 는 전부 null.
//                                       이 엑셀에는 리피트 칸 자체가 없다(미확인).
//
// ── needsReview 판정 규칙 (엑셀 '규격확인수준' 값 기준) ──
//   1) 값에 '미확인'이 들어가면            → true  (검수 필요)
//   2) 그 외에 '확인'이 들어가면           → false (그대로 써도 됨)
//   3) 둘 다 아니면                        → true  (검수 필요)
//   이관된 38건에 실제로 나온 값과 판정:
//     false — 공식/유통 규격 확인(3) · 대표제품 규격 확인(3) · 대표제품/공식 규격 확인(1)
//             · 동일 유형/제품 규격 확인(1) · 동일 컬렉션 규격 확인(6)
//             · 유형 표준 + 유통확인(2) · 유형 표준 + 카테고리 확인(8) · 제품/유통 규격 확인(3)
//     true  — 유형 표준(9) · 유형 분류 기반(1) · 유형 표준 + 고급실크 카테고리(1)
//   ※ 'KSW 그랑디'만 규칙 3에 걸려 검수 필요로 잡힌다.
//      뜻은 '유형 표준 + 카테고리 확인'과 사실상 같은데 엑셀 표기에 '확인' 글자가 없어서다.
//      엑셀 표기를 '유형 표준 + 고급실크 카테고리 확인'으로 고치면 자동으로 풀린다.
//
// ── 엑셀 51행 중 13건은 옮기지 않았다 (이유별) ──
//   가격 표본이 없어서 (4건)
//     GNI 개나리 방염벽지 · 서울벽지 카라 · 신한벽지 에상스 · 코스모스벽지 모던
//   폭·롤길이가 없어서 (4건, 제품마다 규격이 달라 엑셀에도 안 적혀 있음)
//     여명벽지 질석/스톤 · 지사 · 초경 · 콜크 (천연/특수 벽지)
//   폭·롤길이·가격이 전부 없어서 (4건, 주요 유통처 노출 0)
//     그린벽지 · 에덴바이오벽지 · 나무&케어벽지 · 신성벽지
//   합지도 실크도 아니라서 (1건)
//     LX Z:IN 뮤럴 M-series (1m × 2.4m 패널 — 롤 계산 구조에 안 맞음)
//
// 이전 초안(2026-09-08 웹 조사 18건)은 이 파일에서 전부 걷어냈다.
// 초안 내용은 아래 문서에 그대로 남아 있다:
//   C:\dotori\02_ulmadna\docs\도메인지식\01-1_벽지제품_초안_20260908.md
//
// 작성일: 2026년 09월 09일
// ──────────────────────────────────────────────

import type { PaperType } from '../schema/wallpaper-coefficients';

/**
 * 벽지 제품(컬렉션) 한 건.
 * 개별 패턴 번호가 아니라 브랜드의 대표 라인업(컬렉션) 단위로 정리했다.
 */
export interface WallpaperProduct {
  /** 고유 식별자 (브랜드_라인업, 영문/숫자) */
  id: string;
  /** 브랜드명 (한글) */
  brand: string;
  /** 컬렉션/라인업 이름 (한글) */
  line: string;
  /** 종류 — 엔진의 PaperType과 동일 ('실크' | '합지') */
  paperType: PaperType;
  /** 롤 폭 (cm) — 엔진 RollSpec.widthCm과 동일 단위. 미확인이면 null */
  widthCm: number | null;
  /** 롤 길이 (m) — 엔진 RollSpec.lengthM과 동일 단위. 미확인이면 null */
  lengthM: number | null;
  /**
   * 롤당 실제 면적(㎡) — widthCm/100 × lengthM 계산값.
   * 엔진 재단 모듈(rollWall.ts)이 실제로 쓰는 값은 이쪽이다.
   * widthCm·lengthM 둘 다 있을 때만 계산해서 채웠고, 없으면 null.
   */
  sqmPerRoll: number | null;
  /**
   * 유통에서 부르는 "1롤 O평" 표기 (참고용, 반올림된 값이라
   * sqmPerRoll과 정확히 일치하지 않는다). 표기 없으면 null.
   */
  pyeongPerRollLabel: number | null;
  /**
   * 무늬 리피트(패턴 반복 간격, cm) — 엔진 RollSpec.repeatCm과 동일 단위.
   * null = 리피트 여부 자체가 미확인, 0 = 무지(리피트 없음) 확인됨,
   * 양수 = 리피트 길이 확인됨.
   * 지금은 전부 null이다 — 형아 엑셀에 리피트 칸이 없다.
   */
  repeatCm: number | null;
  /** 소비자가 최저 (원/롤). 미확인이면 null */
  priceMin: number | null;
  /** 소비자가 최고 (원/롤). 미확인이면 null (단일 확인가면 min과 동일값) */
  priceMax: number | null;
  /** 가격이 어떻게 나온 값인지 한글 메모 */
  priceNote: string;
  /** 출처 URL 목록 (규격 출처 · 가격 출처) */
  sourceUrls: string[];
  /** 조사일 */
  surveyDate: string;
  /** 형아(사용자) 검수가 꼭 필요한 항목인지 — true면 화면 목록에서 빠진다 */
  needsReview: boolean;
  /** 한글 비고 — 엑셀 분류·판매상태·규격확인수준·비고를 합친 값 */
  note: string;
}

/**
 * 형아 엑셀 '벽지_컬렉션_DB' 51행 중 계산에 쓸 수 있는 38건.
 * (합지 17건 · 실크 21건. 이 중 needsReview=false 인 27건만 화면 목록에 뜬다)
 */
export const WALLPAPER_PRODUCTS: WallpaperProduct[] = [
  // ── LX Z:IN ────────────────────────────────────
  {
    id: 'lxzin_fiance53',
    brand: 'LX Z:IN',
    line: '휘앙세53',
    paperType: '합지',
    widthCm: 53,
    lengthM: 12.5,
    sqmPerRoll: 6.625,
    pyeongPerRollLabel: 2,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 4310,
    priceMax: 4550,
    priceNote: '시장 최저~최고 표본 · 20롤/박스 91,000원 → 롤당 4,550원 환산 · 대표가 4,550원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/%EC%84%9C%EC%9A%B8%EB%B2%BD%EC%A7%80-%EC%BD%94%EC%A7%80-9187-3-1%EB%B0%95%EC%8A%A420%EB%A1%A4-%EC%86%8C%ED%8F%AD%ED%95%A9%EC%A7%80%EB%B2%BD%EC%A7%80/11904/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 소폭합지 · 판매상태 판매중 · 규격확인수준 유형 표준 + 유통확인 · 활성 SKU 15건 · 박스가 환산 롤당 약 4,550원',
  },
  {
    id: 'lxzin_fiance93',
    brand: 'LX Z:IN',
    line: '휘앙세93',
    paperType: '합지',
    widthCm: 93,
    lengthM: 17.75,
    sqmPerRoll: 16.5075,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 25400,
    priceMax: 25400,
    priceNote: '시장 최저~최고 표본 · 대표가 25,400원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/gni%EA%B0%9C%EB%82%98%EB%A6%AC-%EC%8A%A4%ED%83%80%EC%9D%BC-28365-1-%EC%86%8C%ED%94%84%ED%8A%B8%ED%9A%8C%EB%B2%BD-%EB%A6%AC%EC%96%BC-%ED%99%94%EC%9D%B4%ED%8A%B8-1%EB%A1%A45%ED%8F%89-%EC%9E%A5%ED%8F%AD%ED%95%A9%EC%A7%80-%EB%B2%BD%EC%A7%80-24-25%EB%85%84/12508/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 장폭합지 · 판매상태 판매중 · 규격확인수준 공식/유통 규격 확인 · 활성 SKU 208건',
  },
  {
    id: 'lxzin_base_therapy',
    brand: 'LX Z:IN',
    line: '베이스/테라피',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 42300,
    priceMax: 43000,
    priceNote: '시장 최저~최고 표본 · 대표가 43,000원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(일반) · 판매상태 판매중 · 규격확인수준 대표제품 규격 확인 · 활성 SKU 142건 · 구 테라피/현 베이스 표기 혼용',
  },
  {
    id: 'lxzin_best',
    brand: 'LX Z:IN',
    line: '베스트',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 49300,
    priceMax: 49300,
    priceNote: '시장 최저~최고 표본 · 대표가 49,300원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80-%EC%A4%91%EA%B8%89/348/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(중급) · 판매상태 판매중 · 규격확인수준 유형 표준 + 카테고리 확인 · 활성 SKU 208건 · 일부 T계열 8평 상품 존재',
  },
  {
    id: 'lxzin_giafabric',
    brand: 'LX Z:IN',
    line: '지아패브릭',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 49300,
    priceMax: 49300,
    priceNote: '시장 최저~최고 표본 · 대표가 49,300원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/%EC%A7%80%EC%95%84%ED%8C%A8%EB%B8%8C%EB%A6%AD-%5B%EC%A4%91%EA%B8%89%EC%8B%A4%ED%81%AC%5D/460/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(중급) · 판매상태 판매중 · 규격확인수준 유형 표준 + 카테고리 확인 · 활성 SKU 97건',
  },
  {
    id: 'lxzin_diamant',
    brand: 'LX Z:IN',
    line: '디아망',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 68500,
    priceMax: 68500,
    priceNote: '시장 최저~최고 표본 · 대표가 68,500원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/LX-%EB%94%94%EC%95%84%EB%A7%9D/405/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(고급) · 판매상태 판매중 · 규격확인수준 공식/유통 규격 확인 · 활성 SKU 84건 · 대표상품 배송비 별도',
  },
  {
    id: 'lxzin_diamant_fortis',
    brand: 'LX Z:IN',
    line: '디아망포티스',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 70700,
    priceMax: 70700,
    priceNote: '시장 최저~최고 표본 · 대표가 70,700원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/lx-%EB%94%94%EC%95%84%EB%A7%9D%ED%8F%AC%ED%8B%B0%EC%8A%A4/473/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(고급) · 판매상태 판매중 · 규격확인수준 공식/유통 규격 확인 · 활성 SKU 64건',
  },
  {
    id: 'lxzin_bangyeom',
    brand: 'LX Z:IN',
    line: '방염벽지',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 78200,
    priceMax: 78200,
    priceNote: '시장 최저~최고 표본 · 대표가 78,200원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 방염실크 · 판매상태 판매중 · 규격확인수준 유형 표준 + 유통확인 · 활성 SKU 61건 · 10평 천장용 별도 상품 존재',
  },
  // ── GNI 개나리 ────────────────────────────────────
  {
    id: 'gnaeri_story',
    brand: 'GNI 개나리',
    line: '스토리',
    paperType: '합지',
    widthCm: 53,
    lengthM: 12.5,
    sqmPerRoll: 6.625,
    pyeongPerRollLabel: 2,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 4310,
    priceMax: 4715,
    priceNote: '시장 최저~최고 표본 · 20롤/박스 94,300원 → 롤당 4,715원 환산 · 대표가 4,715원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/gni%EA%B0%9C%EB%82%98%EB%A6%AC%EB%B2%BD%EC%A7%80-%EC%8A%A4%ED%86%A0%EB%A6%AC-25120-2-%EC%98%A4%EB%A6%AC%EC%A7%84-%EC%95%84%EC%9D%B4%EB%B3%B4%EB%A6%AC-1%EB%B0%95%EC%8A%A420%EB%A1%A4-%EC%86%8C%ED%8F%AD%ED%95%A9%EC%A7%80%EB%B2%BD%EC%A7%80/11200/category/417/display/1/',
      'https://daumdeco.co.kr/product/gni%EA%B0%9C%EB%82%98%EB%A6%AC%EB%B2%BD%EC%A7%80-%EC%8A%A4%ED%86%A0%EB%A6%AC-25120-2-%EC%98%A4%EB%A6%AC%EC%A7%84-%EC%95%84%EC%9D%B4%EB%B3%B4%EB%A6%AC-1%EB%B0%95%EC%8A%A420%EB%A1%A4-%EC%86%8C%ED%8F%AD%ED%95%A9%EC%A7%80%EB%B2%BD%EC%A7%80/11200/category/417/display/1/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 소폭합지 · 판매상태 판매중 · 규격확인수준 동일 컬렉션 규격 확인 · 활성 SKU 21건 · 시점별 박스가 86,200~94,300원',
  },
  {
    id: 'gnaeri_style',
    brand: 'GNI 개나리',
    line: '스타일',
    paperType: '합지',
    widthCm: 93,
    lengthM: 17.75,
    sqmPerRoll: 16.5075,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 25000,
    priceMax: 26100,
    priceNote: '시장 최저~최고 표본 · 대표가 26,100원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/gni%EA%B0%9C%EB%82%98%EB%A6%AC-%EC%8A%A4%ED%83%80%EC%9D%BC-28365-1-%EC%86%8C%ED%94%84%ED%8A%B8%ED%9A%8C%EB%B2%BD-%EB%A6%AC%EC%96%BC-%ED%99%94%EC%9D%B4%ED%8A%B8-1%EB%A1%A45%ED%8F%89-%EC%9E%A5%ED%8F%AD%ED%95%A9%EC%A7%80-%EB%B2%BD%EC%A7%80-24-25%EB%85%84/12508/',
      'https://daumdeco.co.kr/product/gni%EA%B0%9C%EB%82%98%EB%A6%AC-%EC%8A%A4%ED%83%80%EC%9D%BC-28365-1-%EC%86%8C%ED%94%84%ED%8A%B8%ED%9A%8C%EB%B2%BD-%EB%A6%AC%EC%96%BC-%ED%99%94%EC%9D%B4%ED%8A%B8-1%EB%A1%A45%ED%8F%89-%EC%9E%A5%ED%8F%AD%ED%95%A9%EC%A7%80-%EB%B2%BD%EC%A7%80-24-25%EB%85%84/12508/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 장폭합지 · 판매상태 판매중 · 규격확인수준 동일 컬렉션 규격 확인 · 활성 SKU 167건 · 일부 SKU 25,000원',
  },
  {
    id: 'gnaeri_trendy',
    brand: 'GNI 개나리',
    line: '트랜디',
    paperType: '합지',
    widthCm: 93,
    lengthM: 17.75,
    sqmPerRoll: 16.5075,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 25000,
    priceMax: 26100,
    priceNote: '시장 최저~최고 표본 · 대표가 26,100원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/gni%EA%B0%9C%EB%82%98%EB%A6%AC-%EC%8A%A4%ED%83%80%EC%9D%BC-28365-1-%EC%86%8C%ED%94%84%ED%8A%B8%ED%9A%8C%EB%B2%BD-%EB%A6%AC%EC%96%BC-%ED%99%94%EC%9D%B4%ED%8A%B8-1%EB%A1%A45%ED%8F%89-%EC%9E%A5%ED%8F%AD%ED%95%A9%EC%A7%80-%EB%B2%BD%EC%A7%80-24-25%EB%85%84/12508/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 장폭합지 · 판매상태 판매중 · 규격확인수준 동일 유형/제품 규격 확인 · 활성 SKU 123건',
  },
  {
    id: 'gnaeri_artbook',
    brand: 'GNI 개나리',
    line: '아트북',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 40700,
    priceMax: 40700,
    priceNote: '시장 최저~최고 표본 · 대표가 40,700원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/GNI-%EC%95%84%ED%8A%B8%EB%B6%81/433/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(일반) · 판매상태 판매중 · 규격확인수준 제품/유통 규격 확인 · 활성 SKU 140건 · 천장용 일부 SKU는 별도 가격',
  },
  {
    id: 'gnaeri_lohas',
    brand: 'GNI 개나리',
    line: '로하스',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 42400,
    priceMax: 47700,
    priceNote: '시장 최저~최고 표본 · 대표가 46,700원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/%EB%A1%9C%ED%95%98%EC%8A%A4-%EC%A4%91%EA%B8%89%EC%8B%A4%ED%81%AC/463/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(중급) · 판매상태 판매중 · 규격확인수준 제품/유통 규격 확인 · 활성 SKU 124건 · 판매처/SKU별 가격 편차',
  },
  {
    id: 'gnaeri_primo',
    brand: 'GNI 개나리',
    line: '프리모',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 59700,
    priceMax: 59700,
    priceNote: '시장 최저~최고 표본 · 대표가 59,700원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/GNI-%ED%94%84%EB%A6%AC%EB%AA%A8/408/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(고급) · 판매상태 판매중 · 규격확인수준 제품/유통 규격 확인 · 활성 SKU 135건',
  },
  // ── did ────────────────────────────────────────────
  {
    id: 'did_theone_sopok',
    brand: 'did',
    line: '더원 소폭',
    paperType: '합지',
    widthCm: 53,
    lengthM: 12.5,
    sqmPerRoll: 6.625,
    pyeongPerRollLabel: 2,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 4660,
    priceMax: 4660,
    priceNote: '시장 최저~최고 표본 · 20롤/박스 93,200원 → 롤당 4,660원 환산 · 대표가 4,660원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/%EC%84%9C%EC%9A%B8%EB%B2%BD%EC%A7%80-%EC%BD%94%EC%A7%80-9187-3-1%EB%B0%95%EC%8A%A420%EB%A1%A4-%EC%86%8C%ED%8F%AD%ED%95%A9%EC%A7%80%EB%B2%BD%EC%A7%80/11904/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: true,
    note: '엑셀 분류 소폭합지 · 판매상태 판매중 · 규격확인수준 유형 표준 · 활성 SKU 16건',
  },
  {
    id: 'did_theone_jangpok',
    brand: 'did',
    line: '더원 장폭',
    paperType: '합지',
    widthCm: 93,
    lengthM: 17.75,
    sqmPerRoll: 16.5075,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 23900,
    priceMax: 23900,
    priceNote: '시장 최저~최고 표본 · 대표가 23,900원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/gni%EA%B0%9C%EB%82%98%EB%A6%AC-%EC%8A%A4%ED%83%80%EC%9D%BC-28365-1-%EC%86%8C%ED%94%84%ED%8A%B8%ED%9A%8C%EB%B2%BD-%EB%A6%AC%EC%96%BC-%ED%99%94%EC%9D%B4%ED%8A%B8-1%EB%A1%A45%ED%8F%89-%EC%9E%A5%ED%8F%AD%ED%95%A9%EC%A7%80-%EB%B2%BD%EC%A7%80-24-25%EB%85%84/12508/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: true,
    note: '엑셀 분류 장폭합지 · 판매상태 판매중 · 규격확인수준 유형 표준 · 활성 SKU 131건',
  },
  {
    id: 'did_five5',
    brand: 'did',
    line: '파이브5',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 34800,
    priceMax: 38000,
    priceNote: '시장 최저~최고 표본 · 대표가 34,800원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/did-%ED%8C%8C%EC%9D%B4%EB%B8%8C5/453/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(일반) · 판매상태 판매중 · 규격확인수준 유형 표준 + 카테고리 확인 · 활성 SKU 71건 · 34,800~38,000원 표본',
  },
  {
    id: 'did_seven7',
    brand: 'did',
    line: '세븐7',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 40200,
    priceMax: 43500,
    priceNote: '시장 최저~최고 표본 · 대표가 43,500원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/%EC%84%B8%EB%B8%907-%5B%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80%5D/457/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(중급) · 판매상태 판매중 · 규격확인수준 유형 표준 + 카테고리 확인 · 활성 SKU 96건 · 40,200~43,500원 표본',
  },
  {
    id: 'did_nine9',
    brand: 'did',
    line: '나인9',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 59800,
    priceMax: 59800,
    priceNote: '시장 최저~최고 표본 · 대표가 59,800원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(고급) · 판매상태 판매중 · 규격확인수준 동일 컬렉션 규격 확인 · 활성 SKU 90건 · 106cm×15.6m 직접 확인',
  },
  // ── KS벽지 ──────────────────────────────────────────
  {
    id: 'ks_thehome',
    brand: 'KS벽지',
    line: '더홈',
    paperType: '합지',
    widthCm: 53,
    lengthM: 12.5,
    sqmPerRoll: 6.625,
    pyeongPerRollLabel: 2,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 4550,
    priceMax: 4550,
    priceNote: '시장 최저~최고 표본 · 20롤/박스 91,000원 → 롤당 4,550원 환산 · 대표가 4,550원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/%EC%84%9C%EC%9A%B8%EB%B2%BD%EC%A7%80-%EC%BD%94%EC%A7%80-9187-3-1%EB%B0%95%EC%8A%A420%EB%A1%A4-%EC%86%8C%ED%8F%AD%ED%95%A9%EC%A7%80%EB%B2%BD%EC%A7%80/11904/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: true,
    note: '엑셀 분류 소폭합지 · 판매상태 판매중 · 규격확인수준 유형 표준 · 활성 SKU 20건',
  },
  {
    id: 'ks_belluce',
    brand: 'KS벽지',
    line: '벨루체',
    paperType: '합지',
    widthCm: 93,
    lengthM: 17.75,
    sqmPerRoll: 16.5075,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 22800,
    priceMax: 22800,
    priceNote: '시장 최저~최고 표본 · 대표가 22,800원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/gni%EA%B0%9C%EB%82%98%EB%A6%AC-%EC%8A%A4%ED%83%80%EC%9D%BC-28365-1-%EC%86%8C%ED%94%84%ED%8A%B8%ED%9A%8C%EB%B2%BD-%EB%A6%AC%EC%96%BC-%ED%99%94%EC%9D%B4%ED%8A%B8-1%EB%A1%A45%ED%8F%89-%EC%9E%A5%ED%8F%AD%ED%95%A9%EC%A7%80-%EB%B2%BD%EC%A7%80-24-25%EB%85%84/12508/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: true,
    note: '엑셀 분류 장폭합지 · 판매상태 판매중 · 규격확인수준 유형 표준 · 활성 SKU 205건',
  },
  {
    id: 'ks_theview',
    brand: 'KS벽지',
    line: '더뷰',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 37500,
    priceMax: 37500,
    priceNote: '시장 최저~최고 표본 · 대표가 37,500원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/ks-%EB%8D%94%EB%B7%B0/436/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(일반) · 판매상태 판매중 · 규격확인수준 유형 표준 + 카테고리 확인 · 활성 SKU 130건',
  },
  {
    id: 'ks_irum',
    brand: 'KS벽지',
    line: '이룸',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 37500,
    priceMax: 37500,
    priceNote: '시장 최저~최고 표본 · 대표가 37,500원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(일반) · 판매상태 판매중 · 규격확인수준 대표제품 규격 확인 · 활성 SKU 113건',
  },
  // ── 서울벽지 ──────────────────────────────────────────
  {
    id: 'seoul_cozy',
    brand: '서울벽지',
    line: '코지',
    paperType: '합지',
    widthCm: 53,
    lengthM: 12.5,
    sqmPerRoll: 6.625,
    pyeongPerRollLabel: 2,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 4310,
    priceMax: 4310,
    priceNote: '시장 최저~최고 표본 · 20롤/박스 86,200원 → 롤당 4,310원 환산 · 대표가 4,310원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/%EC%84%9C%EC%9A%B8%EB%B2%BD%EC%A7%80-%EC%BD%94%EC%A7%80-9187-3-1%EB%B0%95%EC%8A%A420%EB%A1%A4-%EC%86%8C%ED%8F%AD%ED%95%A9%EC%A7%80%EB%B2%BD%EC%A7%80/11904/',
      'https://daumdeco.co.kr/product/%EC%84%9C%EC%9A%B8%EB%B2%BD%EC%A7%80-%EC%BD%94%EC%A7%80-9187-3-1%EB%B0%95%EC%8A%A420%EB%A1%A4-%EC%86%8C%ED%8F%AD%ED%95%A9%EC%A7%80%EB%B2%BD%EC%A7%80/11904/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 소폭합지 · 판매상태 판매중 · 규격확인수준 동일 컬렉션 규격 확인 · 활성 SKU 62건 · 1롤 2평, 53cm×12.5m',
  },
  {
    id: 'seoul_reno',
    brand: '서울벽지',
    line: '레노',
    paperType: '합지',
    widthCm: 93,
    lengthM: 17.75,
    sqmPerRoll: 16.5075,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 21800,
    priceMax: 21800,
    priceNote: '시장 최저~최고 표본 · 대표가 21,800원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/gni%EA%B0%9C%EB%82%98%EB%A6%AC-%EC%8A%A4%ED%83%80%EC%9D%BC-28365-1-%EC%86%8C%ED%94%84%ED%8A%B8%ED%9A%8C%EB%B2%BD-%EB%A6%AC%EC%96%BC-%ED%99%94%EC%9D%B4%ED%8A%B8-1%EB%A1%A45%ED%8F%89-%EC%9E%A5%ED%8F%AD%ED%95%A9%EC%A7%80-%EB%B2%BD%EC%A7%80-24-25%EB%85%84/12508/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: true,
    note: '엑셀 분류 장폭합지 · 판매상태 판매중 · 규격확인수준 유형 표준 · 활성 SKU 199건',
  },
  {
    id: 'seoul_plain',
    brand: '서울벽지',
    line: '플레인',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 36000,
    priceMax: 36000,
    priceNote: '시장 최저~최고 표본 · 대표가 36,000원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/%EC%84%9C%EC%9A%B8-%ED%94%8C%EB%A0%88%EC%9D%B8/437/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(일반) · 판매상태 판매중 · 규격확인수준 대표제품/공식 규격 확인 · 활성 SKU 118건',
  },
  // ── 신한벽지 ──────────────────────────────────────────
  {
    id: 'shinhan_fineheim',
    brand: '신한벽지',
    line: '파인하임',
    paperType: '합지',
    widthCm: 53,
    lengthM: 12.5,
    sqmPerRoll: 6.625,
    pyeongPerRollLabel: 2,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 4310,
    priceMax: 4550,
    priceNote: '시장 최저~최고 표본 · 20롤/박스 91,000원 → 롤당 4,550원 환산 · 대표가 4,550원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/%EC%8B%A0%ED%95%9C%EB%B2%BD%EC%A7%80-%ED%8C%8C%EC%9D%B8%ED%95%98%EC%9E%84-4305-4-%EC%84%A4%EB%A6%AC%EB%B0%98-%EB%8B%A4%ED%81%AC%EA%B7%B8%EB%A0%88%EC%9D%B4-1%EB%B0%95%EC%8A%A420%EB%A1%A4-%EC%86%8C%ED%8F%AD%ED%95%A9%EC%A7%80%EB%B2%BD%EC%A7%80/11272/',
      'https://daumdeco.co.kr/product/%EC%8B%A0%ED%95%9C%EB%B2%BD%EC%A7%80-%ED%8C%8C%EC%9D%B8%ED%95%98%EC%9E%84-4305-4-%EC%84%A4%EB%A6%AC%EB%B0%98-%EB%8B%A4%ED%81%AC%EA%B7%B8%EB%A0%88%EC%9D%B4-1%EB%B0%95%EC%8A%A420%EB%A1%A4-%EC%86%8C%ED%8F%AD%ED%95%A9%EC%A7%80%EB%B2%BD%EC%A7%80/11272/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 소폭합지 · 판매상태 판매중 · 규격확인수준 동일 컬렉션 규격 확인 · 활성 SKU 66건 · SKU별 박스가 편차',
  },
  {
    id: 'shinhan_iris',
    brand: '신한벽지',
    line: '아이리스',
    paperType: '합지',
    widthCm: 93,
    lengthM: 17.75,
    sqmPerRoll: 16.5075,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 26100,
    priceMax: 26100,
    priceNote: '시장 최저~최고 표본 · 대표가 26,100원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/gni%EA%B0%9C%EB%82%98%EB%A6%AC-%EC%8A%A4%ED%83%80%EC%9D%BC-28365-1-%EC%86%8C%ED%94%84%ED%8A%B8%ED%9A%8C%EB%B2%BD-%EB%A6%AC%EC%96%BC-%ED%99%94%EC%9D%B4%ED%8A%B8-1%EB%A1%A45%ED%8F%89-%EC%9E%A5%ED%8F%AD%ED%95%A9%EC%A7%80-%EB%B2%BD%EC%A7%80-24-25%EB%85%84/12508/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: true,
    note: '엑셀 분류 장폭합지 · 판매상태 판매중 · 규격확인수준 유형 표준 · 활성 SKU 145건',
  },
  {
    id: 'shinhan_sketch',
    brand: '신한벽지',
    line: '스케치',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 42900,
    priceMax: 57800,
    priceNote: '시장 최저~최고 표본 · 대표가 42,900원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/%EC%8B%A0%ED%95%9C-%EC%8A%A4%EC%BC%80%EC%B9%98/431/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(일반) · 판매상태 판매중 · 규격확인수준 유형 표준 + 카테고리 확인 · 활성 SKU 128건 · 일부 2026 SKU 고가 표본 존재',
  },
  {
    id: 'shinhan_living',
    brand: '신한벽지',
    line: '리빙',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 41300,
    priceMax: 48900,
    priceNote: '시장 최저~최고 표본 · 대표가 43,500원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/%EB%A6%AC%EB%B9%99-%5B%EC%8B%A4%ED%81%AC%5D/430/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(중급) · 판매상태 판매중 · 규격확인수준 대표제품 규격 확인 · 활성 SKU 135건 · 41,300~48,900원 표본',
  },
  {
    id: 'shinhan_facade',
    brand: '신한벽지',
    line: '파사드',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 59700,
    priceMax: 59700,
    priceNote: '시장 최저~최고 표본 · 대표가 59,700원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/%25EC%258B%25A0%25ED%2595%259C-%25ED%258C%258C%25EC%2582%25AC%25EB%2593%259C/486/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(고급) · 판매상태 판매중 · 규격확인수준 유형 표준 + 카테고리 확인 · 활성 SKU 90건',
  },
  {
    id: 'shinhan_bangyeom',
    brand: '신한벽지',
    line: '방염',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 66200,
    priceMax: 66200,
    priceNote: '시장 최저~최고 표본 · 대표가 66,200원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: true,
    note: '엑셀 분류 방염실크 · 판매상태 판매중 · 규격확인수준 유형 표준 · 활성 SKU 72건',
  },
  // ── 코스모스벽지 ──────────────────────────────────────
  {
    id: 'cosmos_artron',
    brand: '코스모스벽지',
    line: '아트론',
    paperType: '합지',
    widthCm: 53,
    lengthM: 12.5,
    sqmPerRoll: 6.625,
    pyeongPerRollLabel: 2,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 4550,
    priceMax: 4550,
    priceNote: '시장 최저~최고 표본 · 20롤/박스 91,000원 → 롤당 4,550원 환산 · 대표가 4,550원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/%EC%84%9C%EC%9A%B8%EB%B2%BD%EC%A7%80-%EC%BD%94%EC%A7%80-9187-3-1%EB%B0%95%EC%8A%A420%EB%A1%A4-%EC%86%8C%ED%8F%AD%ED%95%A9%EC%A7%80%EB%B2%BD%EC%A7%80/11904/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: true,
    note: '엑셀 분류 소폭합지 · 판매상태 판매중 · 규격확인수준 유형 표준 · 활성 SKU 49건',
  },
  {
    id: 'cosmos_alice',
    brand: '코스모스벽지',
    line: '앨리스',
    paperType: '합지',
    widthCm: 93,
    lengthM: 17.75,
    sqmPerRoll: 16.5075,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 22800,
    priceMax: 22800,
    priceNote: '시장 최저~최고 표본 · 대표가 22,800원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/gni%EA%B0%9C%EB%82%98%EB%A6%AC-%EC%8A%A4%ED%83%80%EC%9D%BC-28365-1-%EC%86%8C%ED%94%84%ED%8A%B8%ED%9A%8C%EB%B2%BD-%EB%A6%AC%EC%96%BC-%ED%99%94%EC%9D%B4%ED%8A%B8-1%EB%A1%A45%ED%8F%89-%EC%9E%A5%ED%8F%AD%ED%95%A9%EC%A7%80-%EB%B2%BD%EC%A7%80-24-25%EB%85%84/12508/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: true,
    note: '엑셀 분류 장폭합지 · 판매상태 판매중 · 규격확인수준 유형 표준 · 활성 SKU 225건 · 타일벽지 등 특수상품 별도',
  },
  {
    id: 'cosmos_soho',
    brand: '코스모스벽지',
    line: '소호',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 36600,
    priceMax: 38000,
    priceNote: '시장 최저~최고 표본 · 대표가 38,000원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/%EC%86%8C%ED%98%B8%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/441/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 실크(중급) · 판매상태 판매중 · 규격확인수준 유형 표준 + 카테고리 확인 · 활성 SKU 103건',
  },
  // ── 제일벽지 ──────────────────────────────────────────
  {
    id: 'jeil_happyday',
    brand: '제일벽지',
    line: '해피데이',
    paperType: '합지',
    widthCm: 93,
    lengthM: 17.75,
    sqmPerRoll: 16.5075,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 49500,
    priceMax: 49500,
    priceNote: '시장 최저~최고 표본 · 대표가 49,500원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/gni%EA%B0%9C%EB%82%98%EB%A6%AC-%EC%8A%A4%ED%83%80%EC%9D%BC-28365-1-%EC%86%8C%ED%94%84%ED%8A%B8%ED%9A%8C%EB%B2%BD-%EB%A6%AC%EC%96%BC-%ED%99%94%EC%9D%B4%ED%8A%B8-1%EB%A1%A45%ED%8F%89-%EC%9E%A5%ED%8F%AD%ED%95%A9%EC%A7%80-%EB%B2%BD%EC%A7%80-24-25%EB%85%84/12508/',
      'https://daumdeco.co.kr/category/%EB%B2%BD%EC%A7%80-%5B%EC%A2%85%EB%A5%98%EB%B3%84%5D/329/',
    ],
    surveyDate: '2026-09-09',
    needsReview: true,
    note: '엑셀 분류 장폭합지 · 판매상태 판매중(재고변동 큼) · 규격확인수준 유형 분류 기반 · 활성 SKU 209건 · 브랜드 페이지와 유형 카테고리 노출 수 불일치',
  },
  // ── 현대L&C ────────────────────────────────────────
  {
    id: 'hyundai_cutie',
    brand: '현대L&C',
    line: '큐티에',
    paperType: '합지',
    widthCm: 93,
    lengthM: 17.75,
    sqmPerRoll: 16.5075,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 22800,
    priceMax: 22800,
    priceNote: '시장 최저~최고 표본 · 대표가 22,800원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/%ED%98%84%EB%8C%80-%ED%81%90%ED%8B%B0%EC%97%90-1091-3-%EC%8A%A4%ED%83%80%EC%BD%94%ED%8E%98%EC%9D%B8%ED%8A%B8-%EC%BD%98%ED%81%AC%EB%A6%AC%ED%8A%B8-1%EB%A1%A45%ED%8F%89-%EC%9E%A5%ED%8F%AD%ED%95%A9%EC%A7%80%EB%B2%BD%EC%A7%80-23-25%EB%85%84/13471/category/480/display/1/',
      'https://daumdeco.co.kr/product/%ED%98%84%EB%8C%80-%ED%81%90%ED%8B%B0%EC%97%90-1091-3-%EC%8A%A4%ED%83%80%EC%BD%94%ED%8E%98%EC%9D%B8%ED%8A%B8-%EC%BD%98%ED%81%AC%EB%A6%AC%ED%8A%B8-1%EB%A1%A45%ED%8F%89-%EC%9E%A5%ED%8F%AD%ED%95%A9%EC%A7%80%EB%B2%BD%EC%A7%80-23-25%EB%85%84/13471/category/480/display/1/',
    ],
    surveyDate: '2026-09-09',
    needsReview: false,
    note: '엑셀 분류 장폭합지 · 판매상태 판매중 · 규격확인수준 동일 컬렉션 규격 확인 · 활성 SKU 109건 · 93cm×17.75m 직접 확인',
  },
  // ── KSW ────────────────────────────────────────────
  {
    id: 'ksw_grandi',
    brand: 'KSW',
    line: '그랑디',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.536,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 엑셀에 리피트 칸 없음(미확인)
    priceMin: 54300,
    priceMax: 54300,
    priceNote: '시장 최저~최고 표본 · 대표가 54,300원',
    sourceUrls: [
      'https://daumdeco.co.kr/product/did%EB%B2%BD%EC%A7%80-no9-%EB%82%98%EC%9D%B8-95017-3-%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%88%EC%8A%A4%ED%83%80%EC%BD%94-%EB%B2%A0%EC%9D%B4%EC%A7%80-%EC%B5%9C%EA%B3%A0%EA%B8%89%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80/15760/',
      'https://daumdeco.co.kr/category/%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80-%EA%B3%A0%EA%B8%89/349/',
    ],
    surveyDate: '2026-09-09',
    needsReview: true,
    note: '엑셀 분류 실크(고급) · 판매상태 판매중 · 규격확인수준 유형 표준 + 고급실크 카테고리 · 활성 SKU 76건',
  },
];
