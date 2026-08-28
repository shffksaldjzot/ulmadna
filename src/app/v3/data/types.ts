// ──────────────────────────────────────────────
// v3 견적 엔진 — 타입 정의
// 모든 공정·등급·품목·단가의 TypeScript 인터페이스
// ──────────────────────────────────────────────

/** 등급 키 — 전체 프리셋용 */
export type GradeKey = 'economy' | 'standard' | 'premium';

/** 아파트 타입 키 */
export type ApartmentType = '59' | '74' | '84';

/** Bay 수 — 창호·도배 물량에 영향 */
export type BayKey = '2' | '3' | '4';

/** 방 구성 — 문 개수·도배 물량에 영향 */
export type RoomsKey = 'pure3' | 'plus' | 'four';   // 순수3룸 / 3+알파(DR 등) / 4룸

/**
 * 구조 입력 — 사용자가 화면에서 고르는 평면 정보.
 * 62건 평면도 분석으로 검증된 물량 보정에 사용 (memory: 얼마드나 V2 적산엔진)
 * 모두 선택값. 미지정 시 가장 흔한 기본값(3Bay·3+알파·확장) 적용.
 */
export interface StructureInput {
  bay?: BayKey;        // 기본 '3' (62건 중 최다)
  rooms?: RoomsKey;    // 기본 'plus' (3+알파)
  expanded?: boolean;  // 기본 true (84 이하 대부분 확장)
}

// ── 물량 관련 ──

/** 타입별 평균 물량 (62건 분석 기반) */
export interface TypeAverage {
  area: number;            // 전용면적 (㎡)
  floor_wood: number;      // 마루 바닥 면적 (㎡)
  floor_tile: number;      // 타일 바닥 면적 (㎡)
  wallpaper_wall: number;  // 도배 벽 면적 (㎡)
  wallpaper_ceiling: number; // 도배 천장 면적 (㎡)
  bath_tile: number;       // 욕실 타일 면적 (㎡)
  baseboard: number;       // 걸레받이 길이 (m)
  doors: number;           // 문 개수 (개)
  windows: number;         // 창호 개수 (개소)
}

/** 실별 면적 비율 */
export interface RoomRatio {
  name: string;   // 실 이름 (안방, 침실2, 거실+주방 등)
  ratio: number;  // 전용면적 대비 비율 (0~1)
}

/** 물량 산출 결과 */
export interface QuantityResult {
  closestType: ApartmentType;  // 매칭된 타입
  areaRatio: number;           // 면적 보정 비율
  bay: BayKey;                 // 적용된 Bay
  rooms_config: RoomsKey;      // 적용된 구성
  expanded: boolean;           // 확장 여부
  rooms: { key: string; name: string; area: number }[];  // 실별 면적
  quantities: {
    floor_wood: number;        // 마루 면적 (㎡)
    floor_tile: number;        // 타일 면적 (㎡)
    wallpaper_wall: number;    // 도배 벽 (㎡)
    wallpaper_ceiling: number; // 도배 천장 (㎡)
    wallpaper_total: number;   // 도배 합계 (㎡)
    wallpaper_pyeong: number;  // 도배 평 환산
    bath_tile: number;         // 욕실 타일 (㎡)
    baseboard: number;         // 걸레받이 (m)
    doors: number;             // 문 (개)
    windows: number;           // 창호 (개소)
    window_area: number;       // 창호 총 면적 (㎡) — 샷시 견적용, Bay 보정 적용
    area_pyeong: number;       // 전용면적 평 환산
    floor_wood_pyeong: number; // 마루 면적 평 환산
  };
}

// ── 공정 관련 ──

/** 공정 하나의 등급별 단가 정보 */
export interface GradePrice {
  label: string;       // 표시명 (가성비, 중급, 고급)
  desc: string;        // 설명 (합지, 실크, 디아망 등)
  price: number;       // 단가 (원)
  unit: string;        // 단위 (원/평, 원/㎡, 원/개, 원/식 등)
}

/** 부대비용 항목 */
export interface ExtraCost {
  id: string;          // 식별 키
  label: string;       // 표시명
  price: number;       // 단가
  unit: string;        // 단위
  defaultOn: boolean;  // 기본 ON 여부
}

/** 개별 품목 (3~4뎁스 선택용) */
export interface ProductOption {
  id: string;          // 식별 키
  label: string;       // 표시명 (LX 지아자연애 2.2T 등)
  brand?: string;      // 브랜드명
  price: number;       // 단가
  unit: string;        // 단위
  desc?: string;       // 설명/스펙
  source?: 'official' | 'market' | 'estimated';  // 근거 수준
}

/** 공정 하나의 전체 데이터 구조 */
export interface ProcessData {
  id: string;                    // 공정 식별 키 (demolition, electrical 등)
  name: string;                  // 공정명 (철거, 전기 등)
  order: number;                 // 시공 순서
  enabled: boolean;              // 기본 ON/OFF
  unitType: 'pyeong' | 'sqm' | 'unit' | 'set' | 'room' | 'window' | 'custom';  // 물량 단위 타입
  grades: Record<string, GradePrice>;  // 등급별 단가
  extras?: ExtraCost[];          // 부대비용
  products?: ProductOption[];    // 개별 선택 품목 (3~4뎁스)
  subItems?: SubItem[];          // 하위 품목 그룹 (목공, 가구 등 복합 공정)
  note?: string;                 // 비고/특이사항
}

/** 하위 품목 그룹 (목공의 몰딩/방문/TV 등) */
export interface SubItem {
  id: string;                    // 식별 키
  name: string;                  // 품목명
  grades: Record<string, GradePrice>;  // 등급별 단가
  products?: ProductOption[];    // 개별 선택 품목
  quantityKey?: string;          // 물량 참조 키 (doors, baseboard 등)
  defaultEnabled?: boolean;      // 기본 ON/OFF
}

// ── 견적 결과 ──

/** 공정 하나의 견적 결과 */
export interface ProcessEstimate {
  processId: string;       // 공정 ID
  processName: string;     // 공정명
  enabled: boolean;        // ON/OFF
  grade: string;           // 선택된 등급
  quantity: number;        // 물량
  unitPrice: number;       // 단가
  subtotal: number;        // 소계 (물량 × 단가)
  extras: number;          // 부대비용 합계
  total: number;           // 총액 (소계 + 부대비용)
  items?: {                // 품목별 상세 (3뎁스)
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
}

/** 전체 견적 결과 */
export interface EstimateResult {
  apartmentType: ApartmentType;   // 타입
  exclusiveArea: number;          // 전용면적
  grade: GradeKey;                // 선택 등급
  processes: ProcessEstimate[];   // 공정별 결과
  subtotal: number;               // 공사비 소계
  contingency: number;            // 예비비 (10%)
  grandTotal: number;             // 총 예상 비용
}

// ── 프리셋 ──

/** 프리셋 — 등급 선택 시 각 공정에 적용할 설정 */
export interface PresetConfig {
  grade: GradeKey;
  processes: {
    [processId: string]: {
      enabled: boolean;      // ON/OFF
      gradeKey: string;      // 해당 공정에서 사용할 등급 키
      subItems?: {           // 하위 품목별 설정
        [subItemId: string]: {
          enabled: boolean;
          gradeKey: string;
        };
      };
    };
  };
}
