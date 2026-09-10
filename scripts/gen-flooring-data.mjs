// ──────────────────────────────────────────────
// 엑셀 → 바닥재 엔진 데이터 자동 생성기
//
// 이 파일이 하는 일:
//   형아(사용자)가 손으로 정리한 바닥재 엑셀을 읽어서
//   계산기 엔진이 쓰는 타입스크립트 데이터 파일 두 개를 자동으로 만들어 준다.
//
//   읽는 것 : C:/dotori/02_ulmadna/docs/도메인지식/대한민국_바닥재_부자재_DB_2026-09-09.xlsx
//              - 시트 '바닥재_DB'   (제품 72행)
//              - 시트 '부자재_DB'   (부자재 18행)
//   쓰는 것 : src/server/calc/data/flooring-products.ts     (제품 목록 + 종류별 평균가 밴드)
//              src/server/calc/data/flooring-submaterials.ts (부자재 목록)
//
// 왜 자동 생성인가:
//   숫자를 손으로 옮기면 반드시 오타가 난다. 엑셀이 바뀌면 이 스크립트만 다시 돌린다.
//
// 사용법 (워크트리 루트에서):
//   node scripts/gen-flooring-data.mjs
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

import xlsx from 'xlsx';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// ── 경로 (전부 절대경로. 워크트리 밖은 건드리지 않는다) ──
const ROOT = 'C:/dotori/02_ulmadna/ulmadna_v1/.claude/worktrees/wallpaper-labor-coeff';
const XLSX_PATH = 'C:/dotori/02_ulmadna/docs/도메인지식/대한민국_바닥재_부자재_DB_2026-09-09.xlsx';
const OUT_PRODUCTS = `${ROOT}/src/server/calc/data/flooring-products.ts`;
const OUT_SUBS = `${ROOT}/src/server/calc/data/flooring-submaterials.ts`;

// 엑셀 안에서 실제 표가 시작하는 줄 번호 (0부터 셈. 그 위는 제목·주의 문구다)
const PRODUCT_HEADER_ROW = 3; // '바닥재_DB' 시트: 4번째 줄이 컬럼 이름
const SUB_HEADER_ROW = 3; // '부자재_DB' 시트: 4번째 줄이 컬럼 이름

// ── 작은 도우미들 ────────────────────────────────

/** 값이 비었는지(null·빈 문자열·공백만) 본다 */
const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';

/** 숫자 칸 하나를 숫자로 바꾼다. 못 바꾸면 null (0은 살린다) */
function num(v) {
  if (isBlank(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 글자 칸 하나를 다듬는다. 비었으면 빈 문자열 */
function text(v) {
  return isBlank(v) ? '' : String(v).trim();
}

/** 소수점 자리를 잘라 반올림한다 (엑셀 수식이 남긴 3.1920000000000006 같은 꼬리 정리용) */
function round(n, digits) {
  if (n === null) return null;
  const p = Math.pow(10, digits);
  return Math.round(n * p) / p;
}

// ── 한글 → 영문 슬러그 (제품 id 만들 때 쓴다) ────────
// 제품 id는 코드에서 부르는 이름이라 영문·숫자여야 한다.
// 한글 이름을 소리 나는 대로 적어 두면(강그린 → ganggeurin) 나중에 사람이 봐도 알아본다.

/** 한글 첫소리 19개의 로마자 */
const HANGUL_INITIAL = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
/** 한글 가운뎃소리 21개의 로마자 */
const HANGUL_VOWEL = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
/** 한글 끝소리 28개의 로마자 (첫 칸은 받침 없음) */
const HANGUL_FINAL = ['','k','k','k','n','n','n','t','l','k','m','p','l','l','l','l','l','m','p','t','t','ng','t','t','k','t','p','t'];

/**
 * 아무 문자열이나 영문·숫자·밑줄로만 된 슬러그로 바꾼다.
 * 한글은 소리대로 풀어 쓰고, 그 밖의 기호는 밑줄 하나로 합친다.
 */
function slug(src) {
  let out = '';
  for (const ch of String(src)) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code >= 0 && code < 11172) {
      // 한글 한 글자를 첫소리·가운뎃소리·끝소리로 쪼개 로마자로 잇는다
      out += HANGUL_INITIAL[Math.floor(code / 588)];
      out += HANGUL_VOWEL[Math.floor((code % 588) / 28)];
      out += HANGUL_FINAL[code % 28];
    } else if (/[A-Za-z0-9]/.test(ch)) {
      out += ch.toLowerCase();
    } else {
      out += '_';
    }
  }
  // 밑줄이 여러 개 붙거나 앞뒤에 남은 것을 정리한다
  return out.replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/** 슬러그를 최대 길이만큼만 남긴다 (id가 너무 길어지지 않게) */
function shortSlug(src, max) {
  const s = slug(src);
  return s.length <= max ? s : s.slice(0, max).replace(/_$/, '');
}

// ── 종류(kind) 판정 ──────────────────────────────
// 엔진이 다루는 바닥재 종류는 세 가지뿐이다.
// 카펫타일·롤카펫은 계산 규칙이 아예 달라 이번 계산기에서 뺀다(kind = null → 화면 목록에서 제외).
const KIND_BY_CATEGORY = {
  마루: '마루',
  장판: '장판',
  데코타일: '데코타일',
  카펫타일: null,
  롤카펫: null,
};

/** 대분류 원문으로 엔진 종류를 정한다. 모르는 대분류는 null(화면 제외) */
function kindOf(category) {
  return Object.prototype.hasOwnProperty.call(KIND_BY_CATEGORY, category)
    ? KIND_BY_CATEGORY[category]
    : null;
}

/** 판매단위 원문('1BOX' · '1m' · '판매단위(3.6m×0.9m)')을 엔진 값으로 바꾼다 */
function saleUnitOf(raw) {
  const t = text(raw).toUpperCase();
  if (t.includes('BOX')) return 'BOX';
  if (t === '1M') return 'm';
  return '기타';
}

// ── 1) 제품 시트 읽기 ────────────────────────────

/**
 * '바닥재_DB' 시트를 읽어 제품 배열을 만든다.
 * 엑셀 컬럼 순서에 맞춰 자리번호로 꺼낸다(컬럼 이름이 병합 셀이라 이름으로는 못 꺼낸다).
 */
function readProducts(wb) {
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['바닥재_DB'], { header: 1, defval: null });
  const body = rows.slice(PRODUCT_HEADER_ROW + 1).filter((r) => r && r.some((c) => !isBlank(c)));

  const usedIds = new Set();
  const products = body.map((r) => {
    const category = text(r[0]); // 대분류
    const subCategory = text(r[1]); // 세부분류
    const brand = text(r[2]);
    const line = text(r[3]); // 제품군
    const sku = text(r[4]); // 대표SKU/패턴
    const thicknessMm = num(r[5]);
    const widthMm = num(r[6]);
    const lengthMm = num(r[7]);
    const rollLengthM = num(r[8]);
    const pcsPerBox = num(r[9]);
    const sqmPerBox = round(num(r[10]), 4); // 엑셀 수식 꼬리(3.1920000000000006) 정리
    const saleUnit = saleUnitOf(r[11]);
    const price = round(num(r[14]), 0); // VAT포함환산가
    const priceBasis = text(r[15]); // 가격기준 (원/BOX · 원/m …)
    const excelPricePerSqm = round(num(r[16]), 0); // 엑셀이 계산해 둔 환산 원/㎡
    const lossRate = num(r[18]) ?? 0; // 계산기 초기 로스율
    const priceStatus = text(r[19]);
    const surveyDate = text(r[20]);
    const specUrl = text(r[21]);
    const priceUrl = text(r[22]);
    const note = text(r[23]);

    const kind = kindOf(category);

    // ㎡당 가격: 엑셀 수식값이 있으면 그대로, 없으면 우리가 다시 계산한다
    //   박스형 → 박스 가격 ÷ 박스당 ㎡
    //   롤형(장판) → m당 가격 ÷ 롤 폭(m)
    let pricePerSqm = excelPricePerSqm;
    if (pricePerSqm === null && price !== null) {
      if (saleUnit === 'BOX' && sqmPerBox) pricePerSqm = Math.round(price / sqmPerBox);
      else if (saleUnit === 'm' && widthMm) pricePerSqm = Math.round(price / (widthMm / 1000));
    }

    // 화면에서 쓸 수 있는 제품인가:
    //   1) 엔진이 다루는 종류여야 하고
    //   2) 가격이 있어야 하고
    //   3) 박스형이면 박스당 ㎡가, 롤형이면 롤 폭이 있어야 한다
    const usable =
      kind !== null &&
      price !== null &&
      (saleUnit === 'BOX' ? !!sqmPerBox : saleUnit === 'm' ? !!widthMm : false);

    // id = 브랜드_제품군_대표SKU 슬러그. 같은 id가 생기면 뒤에 번호를 붙인다.
    const parts = [shortSlug(brand, 12), shortSlug(line, 22)];
    if (sku) parts.push(shortSlug(sku, 16));
    let id = parts.filter(Boolean).join('_');
    if (usedIds.has(id)) {
      let n = 2;
      while (usedIds.has(`${id}_${n}`)) n += 1;
      id = `${id}_${n}`;
    }
    usedIds.add(id);

    return {
      id, brand, line, sku, category, subCategory, kind,
      thicknessMm, widthMm, lengthMm, rollLengthM, pcsPerBox, sqmPerBox,
      saleUnit, price, priceBasis, pricePerSqm, lossRate,
      priceStatus, surveyDate, specUrl, priceUrl, note, usable,
    };
  });

  return products;
}

// ── 2) 종류별 평균가 밴드 ────────────────────────

/**
 * 제품을 안 고른 사람에게 보여 줄 "종류 평균가"를 만든다.
 * 쓸 수 있는(usable) 제품의 ㎡당 가격만 모아 최저~최고를 잡는다.
 * 중앙값의 2배를 넘는 값은 이상치로 보고 뺀다 — 한 제품 때문에 밴드가 통째로 벌어지는 걸 막는다.
 */
function buildKindBands(products) {
  const bands = {};
  for (const kind of ['마루', '장판', '데코타일']) {
    const all = products
      .filter((p) => p.kind === kind && p.usable && p.pricePerSqm)
      .map((p) => ({ id: p.id, v: p.pricePerSqm }))
      .sort((a, b) => a.v - b.v);

    if (all.length === 0) {
      bands[kind] = { minPerSqm: 0, maxPerSqm: 0, samples: 0, excluded: [] };
      continue;
    }

    // 중앙값 (표본이 짝수면 가운데 두 값의 평균)
    const mid = all.length % 2 === 1
      ? all[(all.length - 1) / 2].v
      : (all[all.length / 2 - 1].v + all[all.length / 2].v) / 2;

    const kept = all.filter((x) => x.v <= mid * 2);
    const excluded = all.filter((x) => x.v > mid * 2).map((x) => `${x.id}(${x.v})`);

    bands[kind] = {
      minPerSqm: kept[0].v,
      maxPerSqm: kept[kept.length - 1].v,
      samples: kept.length,
      medianPerSqm: Math.round(mid),
      excluded,
    };
  }
  return bands;
}

// ── 3) 부자재 시트 읽기 ──────────────────────────

/**
 * 부자재 품목 이름 → 코드에서 쓰는 영문 키.
 * 엑셀 품목 이름이 바뀌면 여기도 같이 고쳐야 한다(못 찾으면 소리 나는 대로 슬러그를 쓴다).
 */
const SUB_KEY_MAP = {
  '마루용 본드': 'maru_bond',
  '황토 마루본드': 'maru_bond_hwangto',
  '에폭시 마루본드': 'maru_bond_epoxy',
  '마루용 톱니헤라': 'maru_trowel',
  'LVT 유성접착제': 'lvt_adhesive_oil',
  'LVT 수성접착제': 'lvt_adhesive_water',
  '데코타일 본드': 'decotile_bond',
  '카펫타일 점착제': 'carpettile_adhesive',
  '라텍스 접착제': 'rollcarpet_latex',
  '용착제/이음매 접착제': 'jangpan_seam',
  '수성 아크릴 씰란트': 'sealant',
  '접착식 굽도리/걸레받이': 'baseboard',
  '마감프로파일/재료분리대': 'edge_profile',
  '바닥 프라이머': 'primer',
  '셀프레벨링/수평몰탈': 'self_leveling',
};

/** '부자재_DB' 시트를 읽어 부자재 배열을 만든다 */
function readSubmaterials(wb) {
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['부자재_DB'], { header: 1, defval: null });
  const body = rows.slice(SUB_HEADER_ROW + 1).filter((r) => r && r.some((c) => !isBlank(c)));

  const usedKeys = new Set();
  return body.map((r) => {
    const category = text(r[0]); // 대분류 (마루 · 데코타일 · 장판 · 공통 …)
    const name = text(r[1]); // 품목
    const brand = text(r[2]); // 브랜드/모델
    const spec = text(r[3]); // 규격
    const saleUnit = text(r[4]); // 판매단위
    const price = round(num(r[7]), 0); // VAT포함환산가 (없으면 null)
    const coverage = num(r[8]); // 커버리지 값
    const coverageUnit = text(r[9]); // 커버리지 단위 (평/통 · kg/평 …)
    const useCase = text(r[10]); // 사용기준
    const rule = text(r[11]); // 웹서비스 권장산식
    const required = text(r[12]); // 필수도 (필수/조건부/선택/공구)
    const surveyDate = text(r[13]);
    const url = text(r[14]);
    const note = text(r[15]);

    // 키 만들기: 표에 있으면 그 값, 없으면 소리 나는 대로. 같은 품목이 규격만 다르면 규격을 덧붙인다.
    let key = SUB_KEY_MAP[name] ?? shortSlug(name, 24);
    if (usedKeys.has(key)) key = `${key}_${shortSlug(spec, 8)}`;
    if (usedKeys.has(key)) {
      let n = 2;
      while (usedKeys.has(`${key}_${n}`)) n += 1;
      key = `${key}_${n}`;
    }
    usedKeys.add(key);

    return {
      key, category, name, brand, spec, saleUnit, price,
      coverage, coverageUnit, useCase, rule, required, surveyDate, url, note,
    };
  });
}

// ── 4) 타입스크립트 파일로 쓰기 ──────────────────

/** 값 하나를 타입스크립트 리터럴 글자로 바꾼다 (문자열은 따옴표, null은 null) */
function lit(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  return JSON.stringify(String(v));
}

/** 오늘 날짜를 "2026년 09월 10일" 모양으로 */
function today() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}년 ${mm}월 ${dd}일`;
}

/** 파일을 쓴다 (폴더가 없으면 만든다) */
function write(path, body) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, 'utf8');
  console.log(`  → ${path} (${body.split('\n').length}줄)`);
}

/** 제품 파일 본문을 만든다 */
function renderProducts(products, bands) {
  const usableCount = products.filter((p) => p.usable).length;
  const byKind = (k) => products.filter((p) => p.kind === k).length;
  const usableByKind = (k) => products.filter((p) => p.kind === k && p.usable).length;

  const rows = products.map((p) => `  {
    id: ${lit(p.id)},
    brand: ${lit(p.brand)},
    line: ${lit(p.line)},
    sku: ${lit(p.sku)},
    category: ${lit(p.category)},
    subCategory: ${lit(p.subCategory)},
    kind: ${lit(p.kind)},
    thicknessMm: ${lit(p.thicknessMm)},
    widthMm: ${lit(p.widthMm)},
    lengthMm: ${lit(p.lengthMm)},
    rollLengthM: ${lit(p.rollLengthM)},
    pcsPerBox: ${lit(p.pcsPerBox)},
    sqmPerBox: ${lit(p.sqmPerBox)},
    saleUnit: ${lit(p.saleUnit)},
    price: ${lit(p.price)},
    pricePerSqm: ${lit(p.pricePerSqm)},
    lossRate: ${lit(p.lossRate)},
    priceStatus: ${lit(p.priceStatus)},
    surveyDate: ${lit(p.surveyDate)},
    specUrl: ${lit(p.specUrl)},
    priceUrl: ${lit(p.priceUrl)},
    note: ${lit(p.note)},
    usable: ${lit(p.usable)},
  },`).join('\n');

  const bandRows = ['마루', '장판', '데코타일'].map((k) => {
    const b = bands[k];
    const ex = b.excluded.length ? ` 이상치 제외: ${b.excluded.join(', ')}` : ' 이상치 없음';
    return `  ${k}: {
    minPerSqm: ${b.minPerSqm},
    maxPerSqm: ${b.maxPerSqm},
    medianPerSqm: ${b.medianPerSqm ?? 0},
    samples: ${b.samples},
    // 중앙값 ${b.medianPerSqm ?? 0}원/㎡의 2배를 넘는 값은 밴드에서 뺐다.${ex}
  },`;
  }).join('\n');

  return `// ──────────────────────────────────────────────
// 바닥재 제품 카탈로그 (바닥재 계산기용)
//
// ⚠️ 자동 생성 파일 — 직접 수정 금지.
//    값이 틀렸으면 아래 엑셀을 먼저 고친 뒤 \`node scripts/gen-flooring-data.mjs\` 를 다시 돌린다.
//
//   원본 엑셀 : C:/dotori/02_ulmadna/docs/도메인지식/대한민국_바닥재_부자재_DB_2026-09-09.xlsx
//   원본 시트 : 바닥재_DB
//   생성일   : ${today()}
//   행 수     : 전체 ${products.length}건 · 계산에 쓸 수 있는 것 ${usableCount}건
//               (마루 ${byKind('마루')}건 중 ${usableByKind('마루')}건 ·
//                장판 ${byKind('장판')}건 중 ${usableByKind('장판')}건 ·
//                데코타일 ${byKind('데코타일')}건 중 ${usableByKind('데코타일')}건 ·
//                카펫타일·롤카펫 ${products.filter((p) => p.kind === null).length}건은 kind=null 이라 화면에서 뺀다)
//
// 이 파일이 하는 일:
//   1) 제품 하나하나의 규격·가격·초기 로스율을 담는다 (FLOORING_PRODUCTS)
//   2) 제품을 안 고른 사람에게 쓸 종류별 평균가 밴드를 담는다 (FLOORING_KIND_PRICE_BAND)
// ──────────────────────────────────────────────

/** 엔진이 다루는 바닥재 종류 세 가지 */
export type FlooringKind = '마루' | '장판' | '데코타일';

/** 파는 단위 — 박스로 파는 것(마루·데코타일) / m 로 파는 것(장판) / 그 밖(계산 대상 아님) */
export type FlooringSaleUnit = 'BOX' | 'm' | '기타';

/** 바닥재 제품 한 건 */
export interface FlooringProduct {
  /** 코드에서 쓰는 고유 이름 (브랜드_제품군_대표SKU 를 소리 나는 대로 적은 값) */
  id: string;
  /** 브랜드 (한글) */
  brand: string;
  /** 제품군 이름 (한글) */
  line: string;
  /** 대표 SKU·패턴 이름. 없으면 빈 문자열 */
  sku: string;
  /** 엑셀 대분류 원문 (마루 · 장판 · 데코타일 · 카펫타일 · 롤카펫) */
  category: string;
  /** 엑셀 세부분류 원문 (강마루 · 강마루 헤링본 · LVT 600각 …) */
  subCategory: string;
  /** 엔진 종류. 카펫타일·롤카펫은 계산 규칙이 달라 null 이고 화면에서 뺀다 */
  kind: FlooringKind | null;
  /** 두께 (mm). 모르면 null */
  thicknessMm: number | null;
  /** 장 폭 (mm) — 장판은 롤 폭(보통 1830) */
  widthMm: number | null;
  /** 장 길이 (mm). 장판은 없음(null) */
  lengthMm: number | null;
  /** 롤 한 통의 길이 (m) — 장판만 */
  rollLengthM: number | null;
  /** 박스당 장 수 */
  pcsPerBox: number | null;
  /** 박스당 면적 (㎡) */
  sqmPerBox: number | null;
  /** 파는 단위 */
  saleUnit: FlooringSaleUnit;
  /** 판매가 (원, 부가세 포함 환산). 박스형은 원/박스, 롤형은 원/m. 모르면 null */
  price: number | null;
  /** ㎡당 환산 가격 (원). 종류 평균가를 만들 때 쓴다 */
  pricePerSqm: number | null;
  /** 계산기 초기 로스율 (0.05 = 5%). 장판은 0(재단여유 방식이라 퍼센트를 안 쓴다) */
  lossRate: number;
  /** 가격이 어떤 성격인지 (온라인 소매 표본 · 전화문의 · 가격 별도 확인 …) */
  priceStatus: string;
  /** 조사일 */
  surveyDate: string;
  /** 규격 출처 주소 */
  specUrl: string;
  /** 가격 출처 주소 */
  priceUrl: string;
  /** 비고 (한글) */
  note: string;
  /** 화면 목록·계산에 쓸 수 있는 제품인지. 가격이나 규격이 없으면 false */
  usable: boolean;
}

/** 종류별 평균가 밴드 한 줄 — 제품을 안 골랐을 때 쓰는 값 */
export interface FlooringKindPriceBand {
  /** ㎡당 최저 (원) */
  minPerSqm: number;
  /** ㎡당 최고 (원) */
  maxPerSqm: number;
  /** ㎡당 중앙값 (원) — 이상치 판정 기준으로 쓴 값 */
  medianPerSqm: number;
  /** 밴드를 만들 때 쓴 제품 수 */
  samples: number;
}

/** 엑셀 '바닥재_DB' 전체 ${products.length}행 */
export const FLOORING_PRODUCTS: FlooringProduct[] = [
${rows}
];

/**
 * 종류별 ㎡당 평균가 밴드.
 * 제품을 고르지 않은 사람의 견적은 이 밴드로 계산한다.
 * (장판은 m당 가격을 롤 폭 1.83m 로 나눠 ㎡ 로 맞춘 값이다)
 */
export const FLOORING_KIND_PRICE_BAND: Record<FlooringKind, FlooringKindPriceBand> = {
${bandRows}
};

// 화면 목록을 거르는 일은 화면 쪽 변환 함수(src/lib/v1/flooringProductOptions.ts)가 한다.
// 같은 일을 하는 함수를 여기에도 두면 두 곳이 어긋나므로 내보내지 않는다 (2026-09-10 검사관 지적).
`;
}

/** 부자재 파일 본문을 만든다 */
function renderSubmaterials(subs) {
  const rows = subs.map((s) => `  {
    key: ${lit(s.key)},
    category: ${lit(s.category)},
    name: ${lit(s.name)},
    brand: ${lit(s.brand)},
    spec: ${lit(s.spec)},
    saleUnit: ${lit(s.saleUnit)},
    price: ${lit(s.price)},
    coverage: ${lit(s.coverage)},
    coverageUnit: ${lit(s.coverageUnit)},
    useCase: ${lit(s.useCase)},
    rule: ${lit(s.rule)},
    required: ${lit(s.required)},
    surveyDate: ${lit(s.surveyDate)},
    url: ${lit(s.url)},
    note: ${lit(s.note)},
  },`).join('\n');

  return `// ──────────────────────────────────────────────
// 바닥재 부자재 카탈로그 (본드·접착제·씰란트·걸레받이 …)
//
// ⚠️ 자동 생성 파일 — 직접 수정 금지.
//    값이 틀렸으면 아래 엑셀을 먼저 고친 뒤 \`node scripts/gen-flooring-data.mjs\` 를 다시 돌린다.
//
//   원본 엑셀 : C:/dotori/02_ulmadna/docs/도메인지식/대한민국_바닥재_부자재_DB_2026-09-09.xlsx
//   원본 시트 : 부자재_DB
//   생성일   : ${today()}
//   행 수     : ${subs.length}건 (가격이 확인된 것 ${subs.filter((s) => s.price !== null).length}건)
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

/** 엑셀 '부자재_DB' 전체 ${subs.length}행 */
export const FLOORING_SUBMATERIALS: FlooringSubmaterial[] = [
${rows}
];

/** 영문 키로 부자재 한 건을 찾는다. 없으면 undefined */
export function findFlooringSubmaterial(key: string): FlooringSubmaterial | undefined {
  return FLOORING_SUBMATERIALS.find((s) => s.key === key);
}
`;
}

// ── 본체 ────────────────────────────────────────

console.log('바닥재 엑셀을 읽는다:', XLSX_PATH);
const wb = xlsx.readFile(XLSX_PATH);

const products = readProducts(wb);
const bands = buildKindBands(products);
const subs = readSubmaterials(wb);

console.log(`제품 ${products.length}건 · 계산 가능 ${products.filter((p) => p.usable).length}건`);
for (const k of ['마루', '장판', '데코타일']) {
  const b = bands[k];
  console.log(
    `  ${k}: ${b.minPerSqm.toLocaleString()}~${b.maxPerSqm.toLocaleString()}원/㎡ ` +
      `(중앙 ${(b.medianPerSqm ?? 0).toLocaleString()} · 표본 ${b.samples}건` +
      `${b.excluded.length ? ` · 이상치 제외 ${b.excluded.join(', ')}` : ''})`,
  );
}
console.log(`부자재 ${subs.length}건`);

write(OUT_PRODUCTS, renderProducts(products, bands));
write(OUT_SUBS, renderSubmaterials(subs));
console.log('끝났다.');
