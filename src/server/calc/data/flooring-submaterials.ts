// ──────────────────────────────────────────────
// 바닥재 부자재 카탈로그 (본드·접착제·씰란트·걸레받이 …)
//
// ⚠️ 자동 생성 파일 — 직접 수정 금지.
//    값이 틀렸으면 아래 엑셀을 먼저 고친 뒤 `node scripts/gen-flooring-data.mjs` 를 다시 돌린다.
//
//   원본 엑셀 : C:/dotori/02_ulmadna/docs/도메인지식/대한민국_바닥재_부자재_DB_2026-09-09.xlsx
//   원본 시트 : 부자재_DB
//   생성일   : 2026년 09월 10일
//   행 수     : 18건 (가격이 확인된 것 12건)
//
// 이 파일이 하는 일:
//   부자재 한 건의 규격·판매단위·가격·커버리지(한 통이 몇 평을 감당하는지)를 담는다.
//   실제 단가 밴드는 src/server/pricing/flooring.ts 가 이 값을 근거로 따로 정한다.
// ──────────────────────────────────────────────

/** 바닥재 부자재 한 건 */
export interface FlooringSubmaterial {
  /** 코드에서 쓰는 영문 키 */
  key: string;
  /** 어느 바닥재에 딸린 것인지 (마루 · 데코타일 · 장판 · 카펫타일 · 롤카펫 · 공통) */
  category: string;
  /** 품목 이름 (한글) */
  name: string;
  /** 브랜드·모델 */
  brand: string;
  /** 규격 (10kg · 4kg · 25ml …) */
  spec: string;
  /** 판매 단위 (1통 · 1개 · 1병 …) */
  saleUnit: string;
  /** 판매가 (원, 부가세 포함 환산). 모르면 null */
  price: number | null;
  /** 한 단위가 감당하는 양 (2 = 2평/통, 1.4 = 1.4kg/평). 모르면 null */
  coverage: number | null;
  /** 커버리지 단위 (평/통 · kg/평) */
  coverageUnit: string;
  /** 어떤 상황에 쓰는 것인지 */
  useCase: string;
  /** 엑셀에 적힌 권장 산식 원문 */
  rule: string;
  /** 필수도 (필수 · 조건부 · 선택 · 공구) */
  required: string;
  /** 조사일 */
  surveyDate: string;
  /** 출처 주소 */
  url: string;
  /** 비고 (한글) */
  note: string;
}

/** 엑셀 '부자재_DB' 전체 18행 */
export const FLOORING_SUBMATERIALS: FlooringSubmaterial[] = [
  {
    key: "maru_bond",
    category: "마루",
    name: "마루용 본드",
    brand: "일반",
    spec: "10kg",
    saleUnit: "1통",
    price: 28200,
    coverage: 2,
    coverageUnit: "평/통",
    useCase: "강마루 접착시공",
    rule: "CEILING(시공평수/2,1)",
    required: "필수(접착식 마루)",
    surveyDate: "2026-09-09",
    url: "https://jangpannara.kr/category/%EB%A7%88%EB%A3%A8%EC%9A%A9-%EB%B3%B8%EB%93%9C/2601/",
    note: "온라인 판매 표본.",
  },
  {
    key: "maru_bond_hwangto",
    category: "마루",
    name: "황토 마루본드",
    brand: "삼창 계열",
    spec: "10kg",
    saleUnit: "1통",
    price: 40000,
    coverage: 2,
    coverageUnit: "평/통",
    useCase: "강마루 접착시공",
    rule: "CEILING(시공평수/2,1)",
    required: "선택",
    surveyDate: "2026-09-09",
    url: "https://jangpannara.kr/category/%EB%A7%88%EB%A3%A8%EC%9A%A9-%EB%B3%B8%EB%93%9C/2601/",
    note: "",
  },
  {
    key: "maru_bond_hwangto_20kg",
    category: "마루",
    name: "황토 마루본드",
    brand: "삼창 계열",
    spec: "20kg",
    saleUnit: "1통",
    price: 75000,
    coverage: 4,
    coverageUnit: "평/통",
    useCase: "강마루 접착시공",
    rule: "CEILING(시공평수/4,1)",
    required: "선택",
    surveyDate: "2026-09-09",
    url: "https://jangpannara.kr/category/%EB%A7%88%EB%A3%A8%EC%9A%A9-%EB%B3%B8%EB%93%9C/2601/",
    note: "",
  },
  {
    key: "maru_bond_epoxy",
    category: "마루",
    name: "에폭시 마루본드",
    brand: "일반",
    spec: "10kg",
    saleUnit: "1통",
    price: 25000,
    coverage: 2,
    coverageUnit: "평/통",
    useCase: "현장조건별 접착/보강",
    rule: "CEILING(시공평수/2,1)",
    required: "조건부",
    surveyDate: "2026-09-09",
    url: "https://jangpannara.kr/category/%EB%A7%88%EB%A3%A8%EC%9A%A9-%EB%B3%B8%EB%93%9C/2601/",
    note: "",
  },
  {
    key: "maru_bond_epoxy_20kg",
    category: "마루",
    name: "에폭시 마루본드",
    brand: "일반",
    spec: "20kg",
    saleUnit: "1통",
    price: 41000,
    coverage: 4,
    coverageUnit: "평/통",
    useCase: "현장조건별 접착/보강",
    rule: "CEILING(시공평수/4,1)",
    required: "조건부",
    surveyDate: "2026-09-09",
    url: "https://jangpannara.kr/category/%EB%A7%88%EB%A3%A8%EC%9A%A9-%EB%B3%B8%EB%93%9C/2601/",
    note: "",
  },
  {
    key: "maru_trowel",
    category: "마루",
    name: "마루용 톱니헤라",
    brand: "일반",
    spec: "1개",
    saleUnit: "1개",
    price: 4000,
    coverage: null,
    coverageUnit: "",
    useCase: "본드 도포 공구",
    rule: "현장당 1개 기본",
    required: "공구",
    surveyDate: "2026-09-09",
    url: "https://jangpannara.kr/category/%EB%A7%88%EB%A3%A8%EC%9A%A9-%EB%B3%B8%EB%93%9C/2601/",
    note: "재사용 공구.",
  },
  {
    key: "lvt_adhesive_oil",
    category: "데코타일",
    name: "LVT 유성접착제",
    brand: "NOX 기준",
    spec: "4kg",
    saleUnit: "1통",
    price: null,
    coverage: 1.4,
    coverageUnit: "kg/평",
    useCase: "난방/동절기/고습 바닥",
    rule: "필요kg=시공평수×1.3~1.5; 통수=CEILING(필요kg/4,1)",
    required: "조건부",
    surveyDate: "2026-09-09",
    url: "https://www.noxglobal.com/kor/w/page/product/product_LVT_detail_05.php?CATEGORY_TYPE=A&COLLECTION_TYPE=A&P_IDX=143258",
    note: "NOX 공식 표준도포량 1.3~1.5kg/평.",
  },
  {
    key: "lvt_adhesive_oil_20kg",
    category: "데코타일",
    name: "LVT 유성접착제",
    brand: "NOX 기준",
    spec: "20kg",
    saleUnit: "1통",
    price: null,
    coverage: 1.4,
    coverageUnit: "kg/평",
    useCase: "대면적 난방/고습 바닥",
    rule: "필요kg=시공평수×1.3~1.5; 통수=CEILING(필요kg/20,1)",
    required: "조건부",
    surveyDate: "2026-09-09",
    url: "https://www.noxglobal.com/kor/w/page/product/product_LVT_detail_05.php?CATEGORY_TYPE=A&COLLECTION_TYPE=A&P_IDX=143258",
    note: "",
  },
  {
    key: "lvt_adhesive_water",
    category: "데코타일",
    name: "LVT 수성접착제",
    brand: "NOX 기준",
    spec: "10kg",
    saleUnit: "1통",
    price: null,
    coverage: 1.4,
    coverageUnit: "kg/평",
    useCase: "일반 바닥",
    rule: "필요kg=시공평수×1.3~1.5; 통수=CEILING(필요kg/10,1)",
    required: "필수(접착식)",
    surveyDate: "2026-09-09",
    url: "https://www.noxglobal.com/kor/w/page/product/product_LVT_detail_05.php?CATEGORY_TYPE=A&COLLECTION_TYPE=A&P_IDX=143258",
    note: "",
  },
  {
    key: "decotile_bond",
    category: "데코타일",
    name: "데코타일 본드",
    brand: "쌍곰/대흥/영진 등",
    spec: "4kg",
    saleUnit: "1통",
    price: 20500,
    coverage: null,
    coverageUnit: "",
    useCase: "PVC 데코타일 접착",
    rule: "제품별 도포량 적용",
    required: "필수(접착식)",
    surveyDate: "2026-09-09",
    url: "https://search.danawa.com/mobile/dsearch.php?keyword=%EB%8D%B0%EC%BD%94%ED%83%80%EC%9D%BC%EB%B3%B8%EB%93%9C4KG",
    note: "온라인 4kg 제품은 약 1.4만~4.3만원대 표본. 제품별 차이 큼.",
  },
  {
    key: "carpettile_adhesive",
    category: "카펫타일",
    name: "카펫타일 점착제",
    brand: "영진 Y9000 계열",
    spec: "4kg",
    saleUnit: "1통",
    price: 43000,
    coverage: null,
    coverageUnit: "",
    useCase: "카펫타일 점착",
    rule: "제품별 커버리지 적용",
    required: "조건부",
    surveyDate: "2026-09-09",
    url: "https://search.danawa.com/mobile/dsearch.php?keyword=%EB%8D%B0%EC%BD%94%ED%83%80%EC%9D%BC%EB%B3%B8%EB%93%9C4KG",
    note: "",
  },
  {
    key: "rollcarpet_latex",
    category: "롤카펫",
    name: "라텍스 접착제",
    brand: "롤카펫용",
    spec: "1.8L",
    saleUnit: "1통",
    price: 15000,
    coverage: null,
    coverageUnit: "",
    useCase: "롤카펫 접착",
    rule: "현장/제품 도포량에 따라 직접수량",
    required: "조건부",
    surveyDate: "2026-09-09",
    url: "https://hscarpet.co.kr/product/%EC%8A%A4%EC%99%84%EC%B9%B4%ED%8E%98%ED%8A%B8-fo-3305-%EB%A1%A4-%ED%83%80%EC%9E%85-6mm-1%ED%8F%8936m-x-90cm-%EA%B8%B0%EC%A4%80/442/",
    note: "판매페이지 추가구성상품.",
  },
  {
    key: "jangpan_seam",
    category: "장판",
    name: "용착제/이음매 접착제",
    brand: "소리잠 깜쪽이 등",
    spec: "25ml",
    saleUnit: "1병",
    price: 2500,
    coverage: null,
    coverageUnit: "",
    useCase: "장판 이음부 마감",
    rule: "이음길이 기준 또는 현장당 1~2병 옵션",
    required: "조건부",
    surveyDate: "2026-09-09",
    url: "https://marubang.net/",
    note: "",
  },
  {
    key: "sealant",
    category: "공통",
    name: "수성 아크릴 씰란트",
    brand: "HJ4000 등",
    spec: "1개",
    saleUnit: "1개",
    price: 5000,
    coverage: null,
    coverageUnit: "",
    useCase: "걸레받이·틈새 마감",
    rule: "현장당 수량 직접선택",
    required: "선택",
    surveyDate: "2026-09-09",
    url: "https://marubang.net/",
    note: "",
  },
  {
    key: "baseboard",
    category: "공통",
    name: "접착식 굽도리/걸레받이",
    brand: "노본 굽도리 등",
    spec: "상품별",
    saleUnit: "1개",
    price: 20000,
    coverage: null,
    coverageUnit: "",
    useCase: "벽체 하부 마감",
    rule: "벽 둘레÷제품 1롤 길이",
    required: "선택",
    surveyDate: "2026-09-09",
    url: "https://marubang.net/",
    note: "제품별 롤길이 확인 필요.",
  },
  {
    key: "edge_profile",
    category: "공통",
    name: "마감프로파일/재료분리대",
    brand: "알루미늄/PVC 등",
    spec: "제품별",
    saleUnit: "1본",
    price: null,
    coverage: null,
    coverageUnit: "",
    useCase: "문턱·재료 접점 마감",
    rule: "필요길이÷본 길이",
    required: "선택",
    surveyDate: "2026-09-09",
    url: "https://hanaro-material.com/category/%ED%98%84%EB%8C%80lc%EC%9E%A5%ED%8C%90%ED%83%80%EC%9D%BC/223/",
    note: "가격은 규격/재질별 차이 큼.",
  },
  {
    key: "primer",
    category: "공통",
    name: "바닥 프라이머",
    brand: "제품별",
    spec: "제품별",
    saleUnit: "1통",
    price: null,
    coverage: null,
    coverageUnit: "",
    useCase: "분진/흡수성 바탕면 전처리",
    rule: "제품별 도포량",
    required: "조건부",
    surveyDate: "2026-09-09",
    url: "https://search.danawa.com/mobile/dsearch.php?keyword=%EB%8D%B0%EC%BD%94%ED%83%80%EC%9D%BC%EB%B3%B8%EB%93%9C4KG",
    note: "",
  },
  {
    key: "self_leveling",
    category: "공통",
    name: "셀프레벨링/수평몰탈",
    brand: "제품별",
    spec: "20~25kg/포",
    saleUnit: "1포",
    price: null,
    coverage: null,
    coverageUnit: "",
    useCase: "바닥 평활도 불량 시",
    rule: "면적×평균두께×제품 소요량",
    required: "조건부",
    surveyDate: "2026-09-09",
    url: "https://search.danawa.com/mobile/dsearch.php?keyword=%EB%8D%B0%EC%BD%94%ED%83%80%EC%9D%BC%EB%B3%B8%EB%93%9C4KG",
    note: "계산기에서 '바탕면 보수 필요' 옵션으로 분리 권장.",
  },
];

/** 영문 키로 부자재 한 건을 찾는다. 없으면 undefined */
export function findFlooringSubmaterial(key: string): FlooringSubmaterial | undefined {
  return FLOORING_SUBMATERIALS.find((s) => s.key === key);
}
