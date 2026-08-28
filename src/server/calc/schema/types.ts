// ──────────────────────────────────────────────
// 공정 스키마 — 타입 정의 (단일 진실 소스)
//
// 이 파일이 하는 일:
//   "공정 하나는 어떤 항목들로 이루어지고, 각 항목의 단위와 물량 산출 규칙은 무엇인가"를
//   한 곳에 정의한다. 계산기 / 소비자 질문 폼 / 업체 견적 폼 / 시세 통계가 전부 이 표를 공유한다.
//
// 왜 공유하는가 (설계 정본 0-B절):
//   - 공정한 비교: 업체 3곳 견적이 같은 항목·같은 물량 위에 단가만 다르게 놓인다.
//   - 업체 부담 최소: 업체는 물량을 뽑을 필요 없이 단가 칸만 채우면 견적이 완성된다.
//   - 시세 자동 축적: 항목별 단가가 표준 단위(롤당·㎡당·품당)로 쌓인다.
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

/** 항목의 계산·표기 단위. 업체 견적 폼의 단가 단위와 그대로 짝을 이룬다. */
export type Unit =
  | '롤'   // 벽지·부직포·초배지·네바리처럼 롤로 파는 것
  | '㎡'   // 면적으로 세는 것 (기존 벽지 제거 등)
  | 'm'    // 길이로 세는 것 (몰딩·걸레받이·레일)
  | '개'   // 낱개 (실리콘 카트리지 등)
  | '포'   // 포대 (도배풀 14kg 포, 압착시멘트 20kg 포)
  | '통'   // 캔·통 (본드, 바인더)
  | '품'   // 인건 단위. 1품 = 1인 1일
  | '식'   // 한 번에 묶어 계상하는 것 (보양, 폐기물)
  | '평'   // 평 단위로 파는 관행이 있는 것
  | '%';   // 비율로 붙는 것 (일반경비)

/** 항목의 성격. 결과 화면에서 묶음(자재 / 부자재 / 시공 …)을 나눌 때 쓴다. */
export type ItemKind =
  | '자재'    // 주자재 (벽지·마루·타일 본체)
  | '부자재'  // 주자재를 붙이기 위해 딸려 오는 것 (풀·초배지·본드)
  | '시공'    // 사람 손이 들어가는 인건
  | '철거'    // 기존 것을 뜯어내는 작업
  | '경비';   // 일반경비·운반비 등 비율성 비용

/** 이 항목의 단가를 누가 매기는가. 시세 집계 대상 판별에도 쓴다. */
export type PriceSource =
  | '제품'  // 제품 마스터의 판매가 (벽지 롤당 가격 등)
  | '업체'  // 업체가 견적 폼에서 직접 입력하는 단가 (인건·철거)
  | '시세'; // 우리가 모은 표본 통계 단가

/** 근거 등급. C는 화면에 "추정" 표기를 붙여야 하는 값이다. */
export type EvidenceGrade =
  | 'A'  // 확보 — 표준품셈·제조사 스펙·실측 등 근거 문서가 있음
  | 'B'  // 산출 가능 — 계수는 없지만 엔진이 가진 치수(둘레 등)로 정확히 뽑을 수 있음
  | 'C'; // 추정 — 제조사 TDS나 시공팀 확인 대기. 임시 추정치 사용 중

/**
 * 물량 산출 함수에 넘기는 재료.
 * 공정마다 필요한 숫자가 다르므로 이름표를 붙인 자유 사전 형태로 둔다.
 * (예: numbers.wallSqm = 벽 면적, numbers.perimeterM = 둘레, flags.isOld = 구축 여부)
 */
export interface SchemaCalcContext {
  /** 계산에 쓰는 숫자들 (면적·둘레·롤 수·평수 등) */
  numbers: Record<string, number>;
  /** 조건 스위치들 (천장 포함 여부, 구축 여부 등) */
  flags: Record<string, boolean>;
  /** 문자열 조건들 (벽지 종류, 지역 등) */
  texts: Record<string, string>;
}

/** 물량 산출 함수의 결과 한 줄 */
export interface SchemaQuantityOutput {
  /** 산출된 물량 (구매 단위로 이미 올림한 값) */
  qty: number;
  /** 결과 화면 "구성 보기"에 그대로 붙일 근거 문장 (예: "벽 138㎡ × 1.08 ÷ 99㎡/롤") */
  basis: string;
}

/**
 * 항목별 물량 산출 함수.
 * 이 항목이 이번 조건에 해당하지 않으면(예: 신축인데 퍼티 항목) null을 돌려준다.
 */
export type SchemaQuantityFn = (ctx: SchemaCalcContext) => SchemaQuantityOutput | null;

/** 물량 산출 규칙 = 사람이 읽는 설명 + 기계가 쓰는 계산 함수 */
export interface QuantityRule {
  /** 사람이 읽는 산출 규칙 설명. 업체 견적 폼의 물량 칸 툴팁으로도 쓴다. */
  desc: string;
  /** 실제 계산 함수. 없으면 아직 자동 산출을 붙이지 않은 항목(업체 직접 입력). */
  calc?: SchemaQuantityFn;
}

/** 공정을 이루는 항목 하나 */
export interface Item {
  /** 코드에서 쓰는 고유 키 (시세 집계 키로도 그대로 사용) */
  key: string;
  /** 화면에 보이는 이름 */
  name: string;
  /** 단위 */
  unit: Unit;
  /** 성격 (자재 / 부자재 / 시공 / 철거 / 경비) */
  kind: ItemKind;
  /** 물량 산출 규칙 */
  quantityRule: QuantityRule;
  /** 단가 주체 */
  priceSource: PriceSource;
  /** 근거 등급 */
  evidenceGrade: EvidenceGrade;
  /** 사용자가 끄고 켤 수 있는 선택 항목인지 */
  optional?: boolean;
  /** 어떤 조건에서만 붙는 항목인지 사람이 읽는 설명 (예: "구축 재도배만") */
  appliesWhen?: string;
  /** 비고 */
  note?: string;
}

/** 공정 하나 (도배·바닥재·커튼 …) */
export interface Process {
  /** 고유 키 (API 경로와 맞춘다: wallpaper → /api/calc/wallpaper) */
  key: string;
  /** 공정 이름 */
  name: string;
  /** 항목 목록 */
  items: Item[];
}

// ── 스키마를 다루는 작은 도우미들 ──────────────────

/** 공정 안에서 키로 항목 하나를 찾는다. 없으면 undefined. */
export function findItem(process: Process, key: string): Item | undefined {
  return process.items.find((it) => it.key === key);
}

/** 공정 안에서 성격(자재/부자재/…)별로 항목을 골라낸다. */
export function itemsByKind(process: Process, kind: ItemKind): Item[] {
  return process.items.filter((it) => it.kind === kind);
}

/**
 * 업체 견적 폼용 뼈대를 만든다.
 * 항목·단위는 스키마에서 오고, 물량은 계산기가 채우며, 업체는 단가 칸만 입력한다.
 */
export interface VendorFormRow {
  key: string;
  name: string;
  unit: Unit;
  /** 계산기가 채운 물량 (업체가 고치면 edited 표시) */
  qty: number;
  /** 물량 근거 문장 */
  basis: string;
  /** 업체가 물량을 고쳤는지 여부 */
  edited: boolean;
}

/** 스키마 + 산출된 물량 사전으로 업체 견적 폼 행을 만든다. */
export function toVendorForm(
  process: Process,
  quantities: Record<string, SchemaQuantityOutput>,
): VendorFormRow[] {
  const rows: VendorFormRow[] = [];
  for (const item of process.items) {
    const q = quantities[item.key];
    // 이번 조건에서 산출되지 않은 항목(해당 없음)은 폼에서도 뺀다
    if (!q) continue;
    rows.push({ key: item.key, name: item.name, unit: item.unit, qty: q.qty, basis: q.basis, edited: false });
  }
  return rows;
}
