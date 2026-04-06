// Design Ref: v2 §4 — 코드와 데이터 완전 분리, 3단 Progressive Disclosure

// ─── 기본 조건 (1단계) ───
export type Grade = 'basic' | 'mid' | 'premium';
export type HousingType = 'new' | 'old10' | 'old20';
export type Region = 'seoul' | 'gyeonggi' | 'metro' | 'others';

export interface BasicCondition {
  area: number;
  housingType: HousingType;
  region: Region;
  grade: Grade;
  contingencyRate: number; // 5~15%
}

// ─── JSON 데이터 스키마 ───
export interface FieldOption {
  id: string;
  label: string;
  price: number;
  defaultGrade: Record<Grade, boolean>;
}

export interface ProcessField {
  id: string;
  label: string;
  input: 'radio' | 'checkbox' | 'stepper' | 'toggle';
  level: 2 | 3;
  options?: FieldOption[];
  min?: number;
  max?: number;
  default?: number;
  price?: number;
  multiplier?: boolean;
  auto?: boolean;
  dependsOn?: string;
  warning?: string;
}

export interface ProcessData {
  id: string;
  name: string;
  order: number;
  version: string;
  defaultOn: boolean;
  fields: ProcessField[];
}

export interface CategoryData {
  id: string;
  name: string;
  order: number;
  defaultOn: boolean;
  icon: string;
}

export interface GradeData {
  label: string;
  description: string;
  concept: string;
  contingencyRate: number;
}

// ─── 사용자 입력 상태 ───
export interface FieldValue {
  // radio: 선택된 option id
  // checkbox: true/false
  // stepper: number
  // toggle: true/false
  value: string | number | boolean;
  customized: boolean; // 등급 기본값에서 사용자가 직접 변경했는지
}

export interface ProcessState {
  id: string;
  enabled: boolean;
  fields: Record<string, FieldValue>;
}

export interface CalculatorInput {
  basic: BasicCondition;
  processes: ProcessState[];
}

// ─── 계산 결과 ───
export interface ProcessResult {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  fieldBreakdown: { label: string; amount: number }[]; // 세부 항목별 금액
}

export interface HiddenCost {
  category: string; // "에어컨", "샷시" 등
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
  | { type: 'SET_REGION'; payload: Region }
  | { type: 'SET_GRADE'; payload: Grade }
  | { type: 'SET_CONTINGENCY_RATE'; payload: number }
  | { type: 'TOGGLE_PROCESS'; payload: string }
  | { type: 'SET_FIELD'; payload: { processId: string; fieldId: string; value: string | number | boolean } }
  | { type: 'LOAD_INPUT'; payload: CalculatorInput };
