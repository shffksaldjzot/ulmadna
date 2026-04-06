/**
 * 얼마드나 v3 계산 엔진 — ulmadna_db.json 기반 하이브리드 적산
 *
 * A타입 (개수 적산): 아이템별 단가 합산 × 개소수
 * B타입 (면적 품셈): 평당 단가 × 평수
 *
 * 총액 = Σ(각 공정) × 거주환경계수 + 이윤 + 예비비
 */

import type {
  CalculatorInput,
  CalculatorOutput,
  ProcessResult,
  ProcessUserState,
  BasicCondition,
  Grade,
  HiddenCost,
  SavingTip,
  DBProcess,
  DBOption,
  UlmadnaDB,
  HousingType,
  GRADE_MAP,
} from '@/types/calculator';
import { evaluateRationality } from './rationality';
import dbRaw from '@/data/ulmadna_db.json';

const db = dbRaw as unknown as UlmadnaDB;

// ─── 등급 매핑: UI 3등급 → DB 세분화 등급 ───
const GRADE_MAPPING: Record<Grade, string[]> = {
  basic: ['basic', 'partial'],
  mid: ['mid', 'mid_low', 'mid_high', 'full'],
  premium: ['high', 'high_low', 'premium'],
};

// DB 등급에서 가장 가까운 옵션 찾기
function findBestOption(options: DBOption[], uiGrade: Grade): DBOption | null {
  if (!options || options.length === 0) return null;

  const targetGrades = GRADE_MAPPING[uiGrade];

  // 1순위: 정확히 매칭되는 등급
  for (const g of targetGrades) {
    const found = options.find(o => o.grade === g);
    if (found) return found;
  }

  // 2순위: 가장 가까운 등급 (mid면 mid_low → mid_high 순)
  // fallback: 첫 번째 옵션
  if (uiGrade === 'basic') return options[0];
  if (uiGrade === 'premium') return options[options.length - 1];
  return options[Math.floor(options.length / 2)];
}

// ─── B타입 공정 금액 계산 (면적 품셈) ───
function calculateBArea(process: DBProcess, grade: Grade, area: number): { amount: number; optionName: string; breakdown: { label: string; amount: number }[] } {
  const breakdown: { label: string; amount: number }[] = [];
  let total = 0;
  let optionName = '';

  if (process.options && process.options.length > 0) {
    const option = findBestOption(process.options, grade);
    if (option) {
      optionName = option.name;
      if (option.price_per_pyeong) {
        const amount = option.price_per_pyeong * area;
        total += amount;
        breakdown.push({ label: `${option.name} (${option.price_per_pyeong.toLocaleString()}원/평 × ${area}평)`, amount });
      } else if (option.price) {
        total += option.price;
        breakdown.push({ label: option.name, amount: option.price });
      }
    }
  }

  // 폐기물 처리 (철거 공정)
  if (process.waste_disposal) {
    const wasteOption = findBestOption(process.waste_disposal.options, grade);
    if (wasteOption && wasteOption.price) {
      total += wasteOption.price;
      breakdown.push({ label: `폐기물 처리 (${wasteOption.name})`, amount: wasteOption.price });
    }
  }

  return { amount: Math.round(total), optionName, breakdown };
}

// ─── A타입 공정 금액 계산 (개수 적산) ───
function calculateAItem(process: DBProcess, grade: Grade, count: number, area: number): { amount: number; optionName: string; breakdown: { label: string; amount: number }[] } {
  const breakdown: { label: string; amount: number }[] = [];
  let total = 0;
  let optionName = '';

  // 프리셋이 있으면 프리셋 사용 (Level 1/2)
  if (process.presets) {
    const targetGrades = GRADE_MAPPING[grade];
    let preset = null;
    for (const g of targetGrades) {
      if (process.presets[g]) {
        preset = process.presets[g];
        break;
      }
    }

    if (preset) {
      optionName = preset.name;
      const unitPrice = preset.total_per_unit || preset.total || 0;
      const amount = unitPrice * (preset.total_per_unit ? count : 1);
      total = amount;
      breakdown.push({
        label: `${preset.name}${preset.total_per_unit ? ` × ${count}개소` : ''}`,
        amount
      });
      return { amount: Math.round(total), optionName, breakdown };
    }
  }

  // 옵션이 있으면 옵션 사용
  if (process.options && process.options.length > 0) {
    const option = findBestOption(process.options, grade);
    if (option) {
      optionName = option.name;
      const price = option.price || 0;
      const amount = price * count;
      total = amount;
      breakdown.push({
        label: `${option.name} × ${count}${process.unit || '개'}`,
        amount
      });
    }
  }

  // sub_items (주방 부속품 등) — Level 3용이므로 기본 계산에서는 제외

  return { amount: Math.round(total), optionName, breakdown };
}

// ─── 공정별 기본 개소수 ───
function getDefaultCount(processId: string, area: number, housingType: string): number {
  const counts: Record<string, number> = {
    bathroom: 2,
    door: area >= 39 ? 6 : area >= 30 ? 5 : 4,
    entrance_door: 1,
    aircon: area >= 39 ? 5 : area >= 30 ? 4 : 3,
    lighting: 1,
    electrical: 1,
    painting: 2,
    furniture: 1,
    art_wall: 1,
    ceiling_work: 1,
    expansion: 0,
    plumbing: 1,
    misc: 1,
  };
  return counts[processId] || 1;
}

// ─── 연식별 계수 ───
const HOUSING_COEFFICIENTS: Record<string, number> = {
  under10: 0.8,
  ten20: 0.9,
  over20: 1.0,
};

// ─── 공정 기본 ON/OFF ───
function getDefaultEnabled(processId: string, housingType: string): boolean {
  // 10년 미만: 철거·창호·확장·설비·천장 OFF
  const under10Off = ['demolition', 'window', 'expansion', 'plumbing', 'ceiling_work'];
  if (housingType === 'under10' && under10Off.includes(processId)) return false;

  // 10~20년: 확장·천장 OFF
  const ten20Off = ['expansion', 'ceiling_work'];
  if (housingType === 'ten20' && ten20Off.includes(processId)) return false;

  // 기본 OFF 공정 (모든 연식)
  const defaultOff = ['expansion', 'art_wall', 'ceiling_work'];
  if (defaultOff.includes(processId)) return false;

  return true;
}

// ─── 숨은 비용 계산 ───
function calculateHiddenCosts(enabledProcessIds: string[]): HiddenCost[] {
  const costs: HiddenCost[] = [];

  for (const item of db.hidden_costs.items) {
    if (item.amount) {
      costs.push({
        category: item.name,
        items: [{ label: item.detail, amount: item.amount }],
        total: item.amount,
      });
    }
  }

  return costs;
}

// ─── 절약 팁 ───
function calculateSavingTips(enabledProcessIds: string[]): SavingTip[] {
  return db.tips.map(tip => ({
    text: tip,
    saving: 0,
  }));
}

// ─── 메인 계산 함수 ───
export function calculate(input: CalculatorInput): CalculatorOutput {
  const { basic } = input;
  const results: ProcessResult[] = [];
  const livingCoeff = db.config.living_condition_coefficient[basic.livingCondition] || 1;
  const housingCoeff = HOUSING_COEFFICIENTS[basic.housingType] || 1;

  for (const ps of input.processes) {
    if (!ps.enabled) continue;

    const process = db.processes.find(p => p.id === ps.id);
    if (!process) continue;

    let calcResult;
    if (process.type === 'B_area') {
      calcResult = calculateBArea(process, basic.grade, basic.area);
    } else {
      calcResult = calculateAItem(process, basic.grade, ps.count, basic.area);
    }

    if (calcResult.amount > 0) {
      // 거주환경 + 연식 계수 적용
      const adjustedAmount = Math.round(calcResult.amount * livingCoeff * housingCoeff);

      results.push({
        id: process.id,
        name: process.name,
        amount: adjustedAmount,
        percentage: 0,
        selectedOption: calcResult.optionName,
        fieldBreakdown: calcResult.breakdown,
      });
    }
  }

  // 금액 큰 순 정렬
  results.sort((a, b) => b.amount - a.amount);

  const subtotal = results.reduce((sum, r) => sum + r.amount, 0);

  // 비중 계산
  if (subtotal > 0) {
    results.forEach(r => {
      r.percentage = Math.round((r.amount / subtotal) * 1000) / 10;
    });
  }

  // 이윤
  const marginRate = basic.marginRate;
  const margin = Math.round(subtotal * marginRate);

  // 예비비
  const contingencyRate = basic.contingencyRate;
  const afterMargin = subtotal + margin;
  const contingency = Math.round(afterMargin * contingencyRate);

  const total = afterMargin + contingency;
  const perPyeong = basic.area > 0 ? Math.round(total / basic.area) : 0;

  const enabledIds = input.processes.filter(p => p.enabled).map(p => p.id);
  const hiddenCosts = calculateHiddenCosts(enabledIds);
  const savingTips = calculateSavingTips(enabledIds);
  const rationality = evaluateRationality(perPyeong, basic.grade);
  const warnings = collectWarnings(input);

  return {
    subtotal,
    margin,
    marginRate,
    contingency,
    contingencyRate,
    total,
    perPyeong,
    processes: results,
    hiddenCosts,
    rationality,
    savingTips,
    warnings,
  };
}

// ─── 경고 수집 ───
function collectWarnings(input: CalculatorInput): string[] {
  const warnings: string[] = [];

  const bathroom = input.processes.find(p => p.id === 'bathroom');
  if (bathroom?.enabled && bathroom.count >= 2) {
    warnings.push('욕실 2개소 이상 시 설비/방수 공사비가 추가될 수 있습니다');
  }

  if (input.basic.housingType === 'over20') {
    warnings.push('20년 이상 된 집은 공사 중 추가비용 약 10~15% 발생할 수 있어요');
  }

  return warnings;
}

// ─── 초기 상태 생성 ───
export function createDefaultInput(grade: Grade = 'mid'): CalculatorInput {
  const processes: ProcessUserState[] = db.processes.map(p => ({
    id: p.id,
    enabled: false, // 첫 접속 시 전부 OFF
    selectedGrade: grade === 'basic' ? 'basic' : grade === 'premium' ? 'high' : 'mid',
    count: getDefaultCount(p.id, 33, 'old20'),
  }));

  return {
    basic: {
      area: 0,
      housingType: 'over20',
      livingCondition: 'empty',
      grade,
      contingencyRate: db.config.contingency_rate,
      marginRate: db.config.margin_rate_range.min,
    },
    processes,
  };
}

// ─── 등급 변경 ───
export function applyGradeChange(input: CalculatorInput, newGrade: Grade): CalculatorInput {
  const dbGrade = newGrade === 'basic' ? 'basic' : newGrade === 'premium' ? 'high' : 'mid';

  return {
    basic: { ...input.basic, grade: newGrade },
    processes: input.processes.map(ps => ({
      ...ps,
      selectedGrade: dbGrade,
    })),
  };
}

// ─── 평수 변경 시 개소수 자동 조정 ───
export function applyAreaChange(input: CalculatorInput, newArea: number): CalculatorInput {
  return {
    basic: { ...input.basic, area: newArea },
    processes: input.processes.map(ps => ({
      ...ps,
      count: getDefaultCount(ps.id, newArea, input.basic.housingType),
    })),
  };
}

// ─── 유형 변경 시 ON/OFF 자동 조정 ───
export function applyHousingTypeChange(input: CalculatorInput, newType: HousingType): CalculatorInput {
  return {
    basic: { ...input.basic, housingType: newType },
    processes: input.processes.map(ps => ({
      ...ps,
      enabled: input.basic.area > 0 ? getDefaultEnabled(ps.id, newType) : false,
    })),
  };
}

// ─── 전체 공정 ON (평수+유형 선택 후 호출) ───
export function enableDefaultProcesses(input: CalculatorInput): CalculatorInput {
  return {
    ...input,
    processes: input.processes.map(ps => ({
      ...ps,
      enabled: getDefaultEnabled(ps.id, input.basic.housingType),
      count: getDefaultCount(ps.id, input.basic.area, input.basic.housingType),
    })),
  };
}

export { db };
