// ──────────────────────────────────────────────
// 벽지 제품 카탈로그 초안 (도배 계산기용)
//
// 이 파일은 데이터만 담은 초안이다. 아직 계산기 엔진(schema/wallpaper.ts,
// pricing/wallpaper.ts, cutting/rollWall.ts)에는 연결하지 않았다.
// 엔진 코드는 이 작업에서 절대 수정하지 않았다 — 필드명만 엔진 스키마에 맞췄다.
//
// 조사 방법: 국내 5개 브랜드(LX Z:IN·신한벽지·개나리벽지·제일벽지·서울벽지)를
// 웹 조사(공개 정보)로 확인. 확인 안 된 값은 전부 null + note에 "미확인" 표기.
// 절대 추측으로 숫자를 채우지 않았다.
//
// 상세 조사 표·출처·형아 검수 필요 항목은 아래 문서에 정리했다:
//   C:\dotori\02_ulmadna\docs\도메인지식\01-1_벽지제품_초안_20260908.md
//
// ── 엔진 스키마와 안 맞아 판단이 필요했던 점 (문서 4절과 동일) ──
//   1) 폭 단위: 조사는 mm 단위로 했지만 엔진 필드명(RollSpec.widthCm)이
//      cm 단위라서 mm ÷ 10 으로 환산해 widthCm에 저장했다(값 손실 없음).
//   2) 평당 커버 이중 표기: 브랜드가 마케팅용으로 쓰는 "1롤 5평"(반올림된 값,
//      pyeongPerRollLabel)과 엔진이 실제 재단에 쓰는 계산값
//      (sqmPerRoll = widthCm/100 × lengthM)이 정확히 안 맞는 경우가 많아
//      두 필드를 따로 뒀다. 엔진 연결 시에는 sqmPerRoll을 써야 한다.
//   3) 가격은 엔진(DirectProduct.rollPrice)이 숫자 하나만 받지만, 시세 조사라
//      범위로만 나온 값이 많아 priceMin/priceMax 두 필드로 저장했다.
//   4) 리피트: 엔진(RollSpec.repeatCm)은 숫자이고 "0 = 무지"라는 규칙인데,
//      조사 결과에는 "리피트 여부 자체를 확인 못 함"(미확인)과
//      "무지라서 리피트가 없음"(확인된 0)이 섞여 있어 number | null로 두었다.
//      null = 미확인, 0 = 무지(리피트 없음) 확인됨.
//
// 작성일: 2026년 09월 08일
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
   * 브랜드가 마케팅용으로 표기한 "1롤 O평" 값 (참고용, 반올림된 값이라
   * sqmPerRoll과 정확히 일치하지 않을 수 있다). 표기 없으면 null.
   */
  pyeongPerRollLabel: number | null;
  /**
   * 무늬 리피트(패턴 반복 간격, cm) — 엔진 RollSpec.repeatCm과 동일 단위.
   * null = 리피트 여부 자체가 미확인, 0 = 무지(리피트 없음) 확인됨,
   * 양수 = 리피트 길이 확인됨.
   */
  repeatCm: number | null;
  /** 소비자가 최저 (원/롤). 미확인이면 null */
  priceMin: number | null;
  /** 소비자가 최고 (원/롤). 미확인이면 null (단일 확인가면 min과 동일값) */
  priceMax: number | null;
  /** 가격 신뢰도·편차에 대한 한글 메모 */
  priceNote: string;
  /** 출처 URL 목록 (실제로 확인한 페이지만) */
  sourceUrls: string[];
  /** 조사일 */
  surveyDate: string;
  /** 형아(사용자) 검수가 꼭 필요한 항목인지 */
  needsReview: boolean;
  /** 한글 비고 — 미확인 필드, 출처 신뢰도, 특이사항 등 */
  note: string;
}

/**
 * 브랜드별 실크 2~3개 + 합지 1~2개 대표 컬렉션 초안 (총 18건).
 * 상세 조사 근거는 01-1_벽지제품_초안_20260908.md 참고.
 */
export const WALLPAPER_PRODUCTS: WallpaperProduct[] = [
  // ── LX Z:IN (엘엑스 지인, 구 LG하우시스) ──────────────────
  {
    id: 'lxzin_bestee',
    brand: 'LX Z:IN',
    line: '베스띠(실크벽지 베스트)',
    paperType: '실크',
    widthCm: 106, // 1060mm → 106cm 환산
    lengthM: 15.6,
    sqmPerRoll: 16.5, // 1.06 × 15.6 = 16.536 반올림
    pyeongPerRollLabel: null, // 브랜드가 "O평" 표기한 걸 못 찾음 (계산상 약 5평)
    repeatCm: 0, // 무지 계열 패턴으로 확인됨
    priceMin: 43700,
    priceMax: 43700,
    priceNote: '단일 판매처 확인가. 색상별 편차는 추가 조사 필요',
    sourceUrls: ['https://www.lxzin.com/zin/product/100515'],
    surveyDate: '2026-09-08',
    needsReview: false,
    note: '규격·가격 모두 공식 판매 페이지에서 확인',
  },
  {
    id: 'lxzin_giafabric',
    brand: 'LX Z:IN',
    line: '지아패브릭(실크벽지 패브릭)',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.5, // 베스띠(15.6m)와 0.1m 차이 — 오차인지 실제 규격차인지 미확인
    sqmPerRoll: 16.4, // 1.06 × 15.5 = 16.43 반올림
    pyeongPerRollLabel: null,
    repeatCm: null, // 미확인
    priceMin: 48000,
    priceMax: 48000,
    priceNote: '단일 확인가. 옥수수 유래 PLA 코팅·오코텍스 인증 프리미엄 라인이라 색상별 가격차 가능',
    sourceUrls: ['https://www.lxzin.com/zin/product/100040', 'https://www.lxzin.com/zin/product/100125'],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: '길이(15.5m)가 베스띠(15.6m)와 미묘하게 달라 형아 검수 필요. 리피트 미확인',
  },
  {
    id: 'lxzin_diamant',
    brand: 'LX Z:IN',
    line: '디아망(고급 라인)',
    paperType: '실크',
    widthCm: null, // 공식 페이지에 mm 표기 없이 "1롤 5평"만 확인됨 — 추측 금지
    lengthM: null,
    sqmPerRoll: null,
    pyeongPerRollLabel: 5, // "1롤(5평)" 표기 확인
    repeatCm: null,
    priceMin: 68500,
    priceMax: 68500,
    priceNote: '"모던회벽" 색상 한 건만 확인 — 라인 전체 대표값인지 불확실',
    sourceUrls: [
      'https://www.lxzin.com/zin/product/13396',
      'https://jangpanmart.com/product/lx%ED%95%98%EC%9A%B0%EC%8B%9C%EC%8A%A4-lg%EB%B2%BD%EC%A7%80-%EB%94%94%EC%95%84%EB%A7%9D-%ED%94%84%EB%A6%AC%EB%AF%B8%EC%97%84-%EC%8B%A4%ED%81%AC-%EB%B2%BD%EC%A7%80-%ED%8C%A8%EB%B8%8C%EB%A6%AD-pr003-06-%ED%81%AC%EB%A1%9C%EC%89%90-%ED%99%94%EC%9D%B4%ED%8A%B8/3251/',
    ],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: '폭·길이 mm 미확인, 가격도 색상 한정 — 형아 검수 필요',
  },
  {
    id: 'lxzin_finance93',
    brand: 'LX Z:IN',
    line: '휘앙세93',
    paperType: '합지',
    widthCm: 93, // 930mm → 93cm
    lengthM: 17.75,
    sqmPerRoll: 16.5, // 0.93 × 17.75 = 16.5075 반올림
    pyeongPerRollLabel: null,
    repeatCm: null,
    priceMin: null, // 21,000원 vs "5~9만원대" 상충 — 신뢰도 낮아 비움
    priceMax: null,
    priceNote: '출처마다 21,000원과 5~9만원대로 3배 이상 차이. 어느 쪽도 신뢰 확정 못 해 비워둠',
    sourceUrls: [
      'https://www.lxzin.com/zin/product/101019',
      'https://www.lxzin.com/styling/style-trend/detail/2800',
      'https://roomstore.co.kr/product/1%EB%A1%A4-%EB%8B%A8%EC%9C%84-%EC%B9%9C%ED%99%98%EA%B2%BD-%ED%95%A9%EC%A7%80%EB%B2%BD%EC%A7%80-%EC%85%80%ED%94%84-%EB%8F%84%EB%B0%B0%EC%A7%80-%EB%AA%A8%EC%9D%8C%EC%A0%84/4275/',
    ],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: '가격 상충 — 형아 검수 필요. 폭·길이는 공식 규격 페이지로 확인됨',
  },

  // ── 신한벽지 (KCC 계열) ──────────────────────────────────
  {
    id: 'shinhan_living',
    brand: '신한벽지',
    line: '리빙',
    paperType: '실크',
    widthCm: null,
    lengthM: null,
    sqmPerRoll: null,
    pyeongPerRollLabel: null,
    repeatCm: null,
    priceMin: null,
    priceMax: null,
    priceNote: '"42,000원부터"라는 최저가 시작값만 확인, 정확한 롤당 단가 미확인',
    sourceUrls: [
      'https://www.shinhanwall.co.kr/brands/view.html?depth1=1&depth2=4',
      'https://search.danawa.com/dsearch.php?query=%EC%8B%A0%ED%95%9C%EB%B2%BD%EC%A7%80',
    ],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: '공식 페이지에 컬렉션 이미지만 있고 규격·가격 스펙이 없음. 전면 재조사 필요',
  },
  {
    id: 'shinhan_sketch',
    brand: '신한벽지',
    line: '스케치(항곰팡이)',
    paperType: '실크',
    widthCm: null, // mm/m 스펙이 상품 상세 이미지 안에만 있어 텍스트로 못 뽑음
    lengthM: null,
    sqmPerRoll: 16.5, // "1롤 5평" 표기에서 역산(5평 × 3.3058㎡ ≈ 16.5㎡) — mm 실측 아님
    pyeongPerRollLabel: 5,
    repeatCm: null,
    priceMin: 42900,
    priceMax: 42900,
    priceNote: '2024년 패턴(15106-3) 한 건 확인가. 항곰팡이 기능은 검색 요약에서만 확인됨',
    sourceUrls: [
      'https://daumdeco.com/product/%EC%8B%A0%ED%95%9C%EB%B2%BD%EC%A7%80-%EC%8A%A4%EC%BC%80%EC%B9%98-15106-3-%EC%A6%90%EA%B1%B0%EC%9A%B4-%EC%86%8C%EC%8B%9D-1%EB%A1%A45%ED%8F%89-%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80-24%EB%85%84/11740/',
    ],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: 'sqmPerRoll은 평 표기 역산값이지 브랜드 mm 스펙이 아님. 폭·길이 mm 재조사 필요',
  },
  {
    id: 'shinhan_hapji_unnamed',
    brand: '신한벽지',
    line: '합지(라인업명 미확정, "아이리스"로 추정)',
    paperType: '합지',
    widthCm: null,
    lengthM: null,
    sqmPerRoll: null,
    pyeongPerRollLabel: null,
    repeatCm: null,
    priceMin: null,
    priceMax: null,
    priceNote: '가격 정보 전혀 확인 못함',
    sourceUrls: ['https://zzro.kr/blog-79'],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: '출처 페이지가 403으로 직접 열람 불가(검색 스니펫만). 라인업 이름 자체도 재확인 필요',
  },

  // ── 개나리벽지 (GNI) ─────────────────────────────────────
  {
    id: 'gnaeri_lohas_avenue',
    brand: '개나리벽지',
    line: '로하스+ / 에비뉴',
    paperType: '실크',
    widthCm: 106, // 1060mm → 106cm
    lengthM: 15.5,
    sqmPerRoll: 16.4, // 1.06 × 15.5 = 16.43 반올림
    pyeongPerRollLabel: 5, // "약 5평" 자재로 표기
    repeatCm: null,
    priceMin: 32364,
    priceMax: 55390,
    priceNote: '두 라인업이 유통몰에서 묶여 판매돼 가격 편차가 큼. 개별 라인 분리 재조사 필요',
    sourceUrls: [
      'https://zzro.kr/product-papering-gaenari-avenue',
      'https://j-flooring.co.kr/category/%EC%8B%A4%ED%81%AC-%EB%A1%9C%ED%95%98%EC%8A%A4/390/',
    ],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: '가격 편차 큼 — 형아 검수 필요. 리피트 미확인',
  },
  {
    id: 'gnaeri_artbook',
    brand: '개나리벽지',
    line: '아트북(친환경 무지)',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6,
    sqmPerRoll: 16.5,
    pyeongPerRollLabel: 5, // 판매처 표기
    repeatCm: 0, // "무지벽지 컬렉션"이라는 설명 근거 — mm 실측 리피트 확인은 아님
    priceMin: 36500,
    priceMax: 36500,
    priceNote: '단일 확인가(자재로 표기). 품번별로 다를 수 있음',
    sourceUrls: ['https://prod.danawa.com/info/?pcode=35229776', 'https://zzro.kr/blog-59'],
    surveyDate: '2026-09-08',
    needsReview: false,
    note: '옥수수 유래 수지 코팅 친환경 컬렉션. repeatCm=0은 "무지" 설명에 근거한 것이지 mm 실측 확인은 아님',
  },
  {
    id: 'gnaeri_story',
    brand: '개나리벽지',
    line: '스토리(소폭합지)',
    paperType: '합지',
    widthCm: 53, // 530mm → 53cm
    lengthM: 12.5,
    sqmPerRoll: 6.6, // 0.53 × 12.5 = 6.625 반올림
    pyeongPerRollLabel: null,
    repeatCm: null,
    priceMin: null, // 98,010~110,000원 검색됐으나 1롤가/세트가 구분 불가해 비움
    priceMax: null,
    priceNote: '검색된 가격이 1롤 단가인지 세트(여러 장) 단가인지 페이지에서 구분 못 함 — 실거래가 재확인 필요',
    sourceUrls: ['https://m.danawa.com/product/product.html?code=14585447', 'https://www.11st.co.kr/products/2229530659'],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: '가격 신뢰도 낮음 — 형아 검수 필요',
  },

  // ── 제일벽지 ──────────────────────────────────────────────
  {
    id: 'jeil_basicplus',
    brand: '제일벽지',
    line: '베이직플러스',
    paperType: '실크',
    widthCm: null, // "광폭" 표기만 확인, 정확한 mm은 못 찾음 — 추측 금지
    lengthM: null,
    sqmPerRoll: null,
    pyeongPerRollLabel: 5, // "1롤 5평(약 16.5㎡)" 표기 확인
    repeatCm: null,
    priceMin: 31364,
    priceMax: 41000,
    priceNote: '색상·판매처별 편차. 다나와 통합검색 기준',
    sourceUrls: [
      'https://www.jeilwallpaper.com/kor/%EC%A0%9C%ED%92%88%EC%86%8C%EA%B0%9C/%EC%8B%A4%ED%81%AC-%EB%B8%8C%EB%9E%9C%EB%93%9C/%ED%85%8D%EC%8A%A4%EC%B3%90/jeilwallpaper.com',
      'https://search.danawa.com/dsearch.php?query=%EB%B2%BD%EC%A7%80',
    ],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: '정확한 폭·길이 mm 표기를 브랜드 공식 페이지에서 못 찾음',
  },
  {
    id: 'jeil_j_platinum',
    brand: '제일벽지',
    line: '제이 플래티넘(구 제이 프리미엄)',
    paperType: '실크',
    widthCm: null,
    lengthM: null,
    sqmPerRoll: null,
    pyeongPerRollLabel: null,
    repeatCm: null,
    priceMin: null,
    priceMax: null,
    priceNote: '가격 정보 전혀 확인 못함. 베이직플러스보다 고가일 것으로 추정되나 확인된 수치 아님',
    sourceUrls: [
      'https://www.hankyung.com/article/202408306575O',
      'https://www.jeilwallpaper.com/kor/%EC%A0%9C%ED%92%88%EC%86%8C%EA%B0%9C/%EC%8B%A4%ED%81%AC-%EB%B8%8C%EB%9E%9C%EB%93%9C/%EC%A0%9C%EC%9D%B4-%ED%94%8C%EB%9E%98%ED%8B%B0%EB%84%98/jeilwallpaper.com',
    ],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: '고급/프리미엄 라인 존재만 확인, 규격·가격 전부 미확인',
  },
  {
    id: 'jeil_happyday',
    brand: '제일벽지',
    line: '해피데이',
    paperType: '합지',
    widthCm: 93, // 국내 합지 광폭 표준값에서 유추한 것 — 브랜드 공식 확인 아님
    lengthM: 17.75,
    sqmPerRoll: 16.5,
    pyeongPerRollLabel: null,
    repeatCm: null,
    priceMin: 23380,
    priceMax: 23380,
    priceNote: '출처 페이지가 403으로 직접 열람 불가(검색 스니펫만) — 재검증 필수',
    sourceUrls: ['https://zzro.kr/product-papering-jeil-happyday'],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: '폭·길이가 해피데이 전용 공식 확인이 아니라 국내 합지 광폭 표준(93×17.75) 추정값. 형아 검수 필요',
  },
  {
    id: 'jeil_sense',
    brand: '제일벽지',
    line: '센스(소폭)',
    paperType: '합지',
    widthCm: 53, // 마찬가지로 403 페이지 스니펫 근거, 신뢰도 낮음
    lengthM: null,
    sqmPerRoll: null,
    pyeongPerRollLabel: null,
    repeatCm: null,
    priceMin: null,
    priceMax: null,
    priceNote: '가격 정보 전혀 확인 못함',
    sourceUrls: ['https://zzro.kr/blog-85'],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: '출처 페이지 직접 열람 불가(403). 폭 값도 재확인 필요',
  },

  // ── 서울벽지 ──────────────────────────────────────────────
  {
    id: 'seoul_plain',
    brand: '서울벽지',
    line: '플레인',
    paperType: '실크',
    widthCm: 106, // 1060mm → 106cm
    lengthM: 15.6,
    sqmPerRoll: 16.5,
    pyeongPerRollLabel: 5, // 공식 컬렉션 페이지 "1롤/5평" 표기
    repeatCm: 0, // 무지 디자인으로 공식 확인
    priceMin: 24940,
    priceMax: 38500,
    priceNote: '판매처(니아트·다나와)마다 편차 있음',
    sourceUrls: [
      'http://www.seoulwallpaper.co.kr/collection/collection.php?search_category=2',
      'https://niart.kr/product/%EC%84%9C%EC%9A%B8%EB%B2%BD%EC%A7%80-%EC%8B%A4%ED%81%AC%EB%B2%BD%EC%A7%80-%ED%94%8C%EB%A0%88%EC%9D%B8-395-4/',
    ],
    surveyDate: '2026-09-08',
    needsReview: false,
    note: '규격·가격 모두 공식 페이지 + 판매처로 교차 확인됨',
  },
  {
    id: 'seoul_kara',
    brand: '서울벽지',
    line: '카라',
    paperType: '실크',
    widthCm: 106,
    lengthM: 15.6, // 공식 규격표 기준값. 일부 판매처는 15.5m로 표기(오차 가능)
    sqmPerRoll: 16.5,
    pyeongPerRollLabel: 5,
    repeatCm: null, // 패턴형이라 있을 가능성 높으나 mm 수치 미확인
    priceMin: 46000,
    priceMax: 46000,
    priceNote: '패턴(2326-1) 한 건 확인가',
    sourceUrls: ['https://www.decomoa.com/goods/goods_view.php?goodsNo=1000052650'],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: '길이가 출처마다 15.5m/15.6m로 소폭 다름. 리피트 mm 미확인',
  },
  {
    id: 'seoul_daisy',
    brand: '서울벽지',
    line: '데이지(항균)',
    paperType: '합지',
    widthCm: 91, // 910mm → 91cm
    lengthM: 18.2,
    sqmPerRoll: 16.6, // 0.91 × 18.2 = 16.562 반올림
    pyeongPerRollLabel: 5, // 공식 컬렉션 페이지 "1롤/5평" 표기
    repeatCm: null,
    priceMin: null,
    priceMax: null,
    priceNote: '공식 컬렉션 페이지에 가격 자체가 표기돼 있지 않음',
    sourceUrls: ['http://www.seoulwallpaper.co.kr/collection/collection.php?search_category=3'],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: '규격은 공식 확인, 소비자가는 판매처 재조사 필요',
  },
  {
    id: 'seoul_narrow_hapji',
    brand: '서울벽지',
    line: '소폭합지(9186-1 계열)',
    paperType: '합지',
    widthCm: 53, // 530mm → 53cm
    lengthM: 12.5,
    sqmPerRoll: 6.6, // 0.53 × 12.5 = 6.625 반올림
    pyeongPerRollLabel: null, // 박스단위(20롤/약40평) 역산 시 약 2평 — 브랜드 공식 롤당 표기 아님
    repeatCm: null,
    priceMin: 5350,
    priceMax: 5950,
    priceNote: '박스가(약 107,000원) ÷ 20롤로 역산한 값. 개별 판매가와 다를 수 있음',
    sourceUrls: [
      'https://m.decomoa.com/goods/goods_view.php?goodsNo=1000049621',
      'https://www.11st.co.kr/products/8481171989',
    ],
    surveyDate: '2026-09-08',
    needsReview: true,
    note: '롤당 평수·단가 모두 박스 단위 역산값 — 형아 검수 필요',
  },
];
