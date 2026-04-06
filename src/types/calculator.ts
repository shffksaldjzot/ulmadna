/**
 * 얼마드나 v3 타입 시스템
 * ulmadna_db.json 기반 하이브리드 적산 (A타입: 개수, B타입: 면적)
 */

// ─── 기본 조건 ───
export type Grade = 'basic' | 'mid' | 'premium';
export type HousingType = 'new' | 'old20';
export type LivingCondition = 'empty' | 'occupied';

export interface BasicCondition {
  area: number;           // 평수
  housingType: HousingType;
  livingCondition: LivingCondition;
  grade: Grade;
  contingencyRate: number; // 0.10 고정
  marginRate: number;      // 0.05 ~ 0.10
}

// ─── 등급 매핑 (DB의 세분화 → UI 3등급) ───
export const GRADE_MAP: Record<Grade, string[]> = {
  basic: ['basic', 'partial'],
  mid: ['mid', 'mid_low', 'mid_high', 'full'],
  premium: ['high', 'high_low', 'premium'],
};

// ─── DB JSON 스키마 ───
export interface DBConfig {
  region_coefficient: number;
  living_condition_coefficient: Record<string, number>;
  ceiling_height_base_mm: number;
  contingency_rate: number;
  margin_rate_range: { min: number; max: number };
  labor_default_workers: number;
  labor_solo_threshold_days: number;
}

export interface PyeongArea {
  floor_m2: number;
  wall_m2: number;
  ceiling_m2: number;
}

export interface DBOption {
  grade: string;
  name: string;
  price?: number;
  price_per_pyeong?: number;
  price_per_m?: number;
  price_per_ja?: number;
  price_per_unit?: number;
  brand?: string;
  description?: string;
  includes?: string;
  source?: string;
}

export interface DBItem {
  id: string;
  name: string;
  options?: DBOption[];
  price?: number;
  unit?: string;
  days_per_bathroom?: number;
  source?: string;
}

export interface DBPreset {
  name: string;
  total?: number;
  total_per_unit?: number;
  source?: string;
}

export interface DBProcess {
  id: string;
  name: string;
  type: 'A_item' | 'B_area';
  unit?: string;
  description?: string;
  options?: DBOption[];
  items?: DBItem[];
  presets?: Record<string, DBPreset>;
  waste_disposal?: { name: string; options: DBOption[] };
  extras?: { name: string; price: number; source?: string }[];
  sub_items?: DBItem[];
  labor_included?: boolean;
  note?: string;
  confirmed_market_price?: boolean;
  material_price_per_m?: number;
  material_brand?: string;
  labor_daily_rate?: number;
}

export interface DBHiddenCost {
  name: string;
  amount?: number;
  detail: string;
}

export interface UlmadnaDB {
  meta: { version: string; updated: string; source: string };
  config: DBConfig;
  pyeong_to_area: { data: Record<string, PyeongArea> };
  labor_rates: { data: Record<string, { name: string; daily_rate?: number; daily_rate_per_pyeong?: number; default_workers: number }> };
  processes: DBProcess[];
  hidden_costs: { items: DBHiddenCost[] };
  tips: string[];
}

// ─── 사용자 입력 상태 ───
export interface ProcessUserState {
  id: string;
  enabled: boolean;
  selectedGrade: string;    // DB의 grade 문자열
  count: number;            // A타입 개소수 (욕실 2개, 방문 5개 등)
  selectedOptionId?: string; // 특정 옵션 선택시
}

export interface CalculatorInput {
  basic: BasicCondition;
  processes: ProcessUserState[];
}

// ─── 계산 결과 ───
export interface ProcessResult {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  selectedOption: string;   // 선택된 옵션명
  fieldBreakdown: { label: string; amount: number }[];
}

export interface HiddenCost {
  category: string;
  items: { label: string; amount: number }[];
  total: number;
}

export type RationalityLevel = 'good' | 'normal' | 'high';

export interface RationalityResult {
  level: RationalityLevel;
  comment: string;
}

export interface SavingTip {
  text: string;
  saving: number;
}

export interface CalculatorOutput {
  subtotal: number;
  margin: number;
  marginRate: number;
  contingency: number;
  contingencyRate: number;
  total: number;
  perPyeong: number;
  processes: ProcessResult[];
  hiddenCosts: HiddenCost[];
  rationality: RationalityResult;
  savingTips: SavingTip[];
  warnings: string[];
}

// ─── 액션 ───
export type CalculatorAction =
  | { type: 'SET_AREA'; payload: number }
  | { type: 'SET_HOUSING_TYPE'; payload: HousingType }
  | { type: 'SET_LIVING_CONDITION'; payload: LivingCondition }
  | { type: 'SET_GRADE'; payload: Grade }
  | { type: 'SET_CONTINGENCY_RATE'; payload: number }
  | { type: 'SET_MARGIN_RATE'; payload: number }
  | { type: 'TOGGLE_PROCESS'; payload: string }
  | { type: 'SET_PROCESS_GRADE'; payload: { processId: string; grade: string } }
  | { type: 'SET_PROCESS_COUNT'; payload: { processId: string; count: number } }
  | { type: 'LOAD_INPUT'; payload: CalculatorInput }
  | { type: 'RESET' };
