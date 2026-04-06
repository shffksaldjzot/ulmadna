/**
 * v2 계산 엔진 — 옵션별 price 합산 × 수량 × 계수
 * Design Ref: v2 §4 — 코드와 데이터 완전 분리
 *
 * 공정별 금액 = Σ(선택 옵션 price) × 수량 × 지역계수 × 유형계수
 * 총 소계 = Σ(ON 공정)
 * 예비비 = 소계 × 예비비율(5~15%)
 * 총 예산 = 소계 + 예비비
 */

import type {
  CalculatorInput,
  CalculatorOutput,
  ProcessResult,
  ProcessState,
  ProcessData,
  ProcessField,
  FieldValue,
  HiddenCost,
  Grade,
  BasicCondition,
} from '@/types/calculator';
import { evaluateRationality } from './rationality';
import coefficientsRaw from '@/data/coefficients.json';
import categoriesRaw from '@/data/categories.json';
import gradesRaw from '@/data/grades.json';

// 24개 공정 JSON 동적 로드
import demolition from '@/data/items/demolition.json';
import plumbing from '@/data/items/plumbing.json';
import waterproof from '@/data/items/waterproof.json';
import windowData from '@/data/items/window.json';
import woodwork from '@/data/items/woodwork.json';
import electrical from '@/data/items/electrical.json';
import intercom from '@/data/items/intercom.json';
import lighting from '@/data/items/lighting.json';
import wallpaper from '@/data/items/wallpaper.json';
import flooring from '@/data/items/flooring.json';
import tile from '@/data/items/tile.json';
import bathroom from '@/data/items/bathroom.json';
import kitchen from '@/data/items/kitchen.json';
import furniture from '@/data/items/furniture.json';
import film from '@/data/items/film.json';
import paint from '@/data/items/paint.json';
import aircon from '@/data/items/aircon.json';
import middoor from '@/data/items/middoor.json';
import frontdoor from '@/data/items/frontdoor.json';
import boiler from '@/data/items/boiler.json';
import expansion from '@/data/items/expansion.json';
import overhead from '@/data/items/overhead.json';
import curtain from '@/data/items/curtain.json';
import cleaning from '@/data/items/cleaning.json';

const ALL_PROCESSES: ProcessData[] = [
  demolition, plumbing, waterproof, windowData, woodwork, electrical,
  intercom, lighting, wallpaper, flooring, tile, bathroom,
  kitchen, furniture, film, paint, aircon, middoor,
  frontdoor, boiler, expansion, overhead, curtain, cleaning,
] as ProcessData[];

const processMap = new Map<string, ProcessData>();
ALL_PROCESSES.forEach(p => processMap.set(p.id, p));

const coefficients = coefficientsRaw as {
  region: Record<string, number>;
  housingType: Record<string, number>;
  ceilingHeight: Record<string, number>;
};

const grades = gradesRaw as Record<string, { contingencyRate: number }>;

// ─── 필드 금액 계산 ───
function calculateFieldAmount(
  field: ProcessField,
  fieldValue: FieldValue | undefined,
  area: number
): number {
  if (!fieldValue) return 0;
  const val = fieldValue.value;

  switch (field.input) {
    case 'radio': {
      if (!field.options) return 0;
      const selected = field.options.find(o => o.id === val);
      if (!selected) return 0;
      const price = selected.price;
      if (field.multiplier) return price * area;
      return price;
    }
    case 'toggle': {
      if (val !== true) return 0;
      const price = field.price || 0;
      if (field.multiplier) return price * area;
      return price;
    }
    case 'stepper': {
      const count = typeof val === 'number' ? val : 0;
      const price = field.price || 0;
      return price * count;
    }
    case 'checkbox': {
      if (val !== true) return 0;
      const price = field.price || 0;
      if (field.multiplier) return price * area;
      return price;
    }
    default:
      return 0;
  }
}

// ─── 공정별 금액 계산 ───
function calculateProcess(
  processState: ProcessState,
  processData: ProcessData,
  basic: BasicCondition
): ProcessResult {
  const regionCoeff = coefficients.region[basic.region] || 1;
  const housingCoeff = coefficients.housingType[basic.housingType] || 1;
  const globalMultiplier = regionCoeff * housingCoeff;

  const fieldBreakdown: { label: string; amount: number }[] = [];
  let processTotal = 0;

  for (const field of processData.fields) {
    if (field.auto) continue; // 자동 필드는 별도 처리 없음 (가격에 이미 포함)
    const fv = processState.fields[field.id];
    const rawAmount = calculateFieldAmount(field, fv, basic.area);
    const amount = Math.round(rawAmount * globalMultiplier);

    if (amount > 0) {
      fieldBreakdown.push({ label: field.label, amount });
      processTotal += amount;
    }
  }

  return {
    id: processData.id,
    name: processData.name,
    amount: processTotal,
    percentage: 0,
    fieldBreakdown,
  };
}

// ─── 숨은 비용 계산 ───
function calculateHiddenCosts(processes: ProcessState[]): HiddenCost[] {
  const costs: HiddenCost[] = [];

  // 에어컨 (시스템에어컨 선택 시)
  const airconState = processes.find(p => p.id === 'aircon');
  if (airconState?.enabled) {
    const type = airconState.fields['type']?.value;
    if (type === 'system') {
      costs.push({
        category: '에어컨',
        items: [
          { label: '보양비', amount: 600000 },
          { label: '전기공사', amount: 300000 },
          { label: '앵글 설치', amount: 200000 },
          { label: '스킬도배(단내림 부분)', amount: 300000 },
          { label: '난간 설치(필요 시)', amount: 100000 },
        ],
        total: 1500000,
      });
    }
  }

  // 창호/샷시 (전체교체 선택 시)
  const windowState = processes.find(p => p.id === 'window');
  if (windowState?.enabled) {
    const scope = windowState.fields['scope']?.value;
    if (scope === 'full') {
      costs.push({
        category: '창호(샷시)',
        items: [
          { label: '실측비', amount: 330000 },
          { label: '양중비', amount: 330000 },
          { label: '철거비', amount: 330000 },
          { label: '통바', amount: 330000 },
        ],
        total: 1320000,
      });
    }
  }

  // 타일 (욕실/주방 타일 선택 시)
  const tileState = processes.find(p => p.id === 'tile');
  if (tileState?.enabled) {
    costs.push({
      category: '타일',
      items: [
        { label: '타일 양중비', amount: 265000 },
        { label: '부자재(모래/시멘트/본드)', amount: 250000 },
      ],
      total: 515000,
    });
  }

  // 부대비용 (대부분 자동 발생)
  const overheadState = processes.find(p => p.id === 'overhead');
  if (overheadState?.enabled) {
    costs.push({
      category: '부대비용',
      items: [
        { label: '엘리베이터 사용료(관리실 규정)', amount: 200000 },
        { label: '사다리차(필요 시)', amount: 250000 },
        { label: '자재 양중비', amount: 650000 },
      ],
      total: 1100000,
    });
  }

  // 목공 (자동 발생 비용)
  const woodworkState = processes.find(p => p.id === 'woodwork');
  if (woodworkState?.enabled) {
    costs.push({
      category: '목공',
      items: [
        { label: '장비대/공구손료', amount: 180000 },
        { label: '운송비', amount: 30000 },
      ],
      total: 210000,
    });
  }

  // 확장공사 (선택 시)
  const expansionState = processes.find(p => p.id === 'expansion');
  if (expansionState?.enabled) {
    const count = expansionState.fields['count']?.value;
    if (typeof count === 'number' && count > 0) {
      costs.push({
        category: '확장공사',
        items: [
          { label: '확장 허가비용(관할 구청)', amount: 0 },
          { label: '스프링클러 이동(필요 시)', amount: 300000 },
        ],
        total: 300000,
      });
    }
  }

  return costs.filter(c => c.total > 0);
}

// ─── 경고 수집 ───
function collectWarnings(processes: ProcessState[]): string[] {
  const warnings: string[] = [];

  const waterproofState = processes.find(p => p.id === 'waterproof');
  if (waterproofState?.enabled) {
    const count = waterproofState.fields['bathroom_waterproof']?.value;
    if (count === 0) {
      warnings.push('욕실 방수를 빼면 1~2년 후 누수 하자 위험이 높습니다');
    }
  }

  return warnings;
}

// ─── 메인 계산 함수 ───
export function calculate(input: CalculatorInput): CalculatorOutput {
  const results: ProcessResult[] = [];

  for (const ps of input.processes) {
    if (!ps.enabled) continue;
    const pd = processMap.get(ps.id);
    if (!pd) continue;
    const result = calculateProcess(ps, pd, input.basic);
    if (result.amount > 0) {
      results.push(result);
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

  const contingencyRate = input.basic.contingencyRate;
  const contingency = Math.round(subtotal * contingencyRate);
  const total = subtotal + contingency;
  const perPyeong = input.basic.area > 0 ? Math.round(total / input.basic.area) : 0;

  const hiddenCosts = calculateHiddenCosts(input.processes);
  const warnings = collectWarnings(input.processes);
  const rationality = evaluateRationality(perPyeong, input.basic.grade);

  return {
    subtotal,
    contingency,
    contingencyRate,
    total,
    perPyeong,
    processes: results,
    hiddenCosts,
    rationality,
    savingTips: [], // Phase 3에서 개선
    warnings,
  };
}

// ─── 등급 기반 초기 상태 생성 ───
export function createDefaultInput(grade: Grade = 'mid'): CalculatorInput {
  const gradeData = grades[grade];

  const processes: ProcessState[] = ALL_PROCESSES.map(pd => {
    const fields: Record<string, FieldValue> = {};

    for (const field of pd.fields) {
      let defaultValue: string | number | boolean;

      switch (field.input) {
        case 'radio':
          // 등급에 맞는 기본값 찾기
          defaultValue = field.options?.find(o => o.defaultGrade[grade])?.id
            || field.options?.[0]?.id || '';
          break;
        case 'stepper':
          defaultValue = field.default ?? field.min ?? 0;
          break;
        case 'toggle':
          defaultValue = true;
          break;
        case 'checkbox':
          defaultValue = false;
          break;
        default:
          defaultValue = '';
      }

      fields[field.id] = { value: defaultValue, customized: false };
    }

    return {
      id: pd.id,
      enabled: false, // 첫 접속 시 전부 OFF → 겁먹지 않게
      fields,
    };
  });

  return {
    basic: {
      area: 0, // 첫 접속 시 미선택 상태
      housingType: 'old10',
      region: 'seoul',
      grade,
      contingencyRate: gradeData?.contingencyRate || 0.10,
    },
    processes,
  };
}

// ─── 등급 변경 시 비커스텀 필드 일괄 업데이트 ───
export function applyGradeChange(input: CalculatorInput, newGrade: Grade): CalculatorInput {
  const gradeData = grades[newGrade];

  const newProcesses = input.processes.map(ps => {
    const pd = processMap.get(ps.id);
    if (!pd) return ps;

    const newFields: Record<string, FieldValue> = {};
    for (const field of pd.fields) {
      const existing = ps.fields[field.id];

      // 사용자가 커스텀한 필드는 유지
      if (existing?.customized) {
        newFields[field.id] = existing;
        continue;
      }

      // 등급 기본값으로 재설정
      let defaultValue: string | number | boolean;
      switch (field.input) {
        case 'radio':
          defaultValue = field.options?.find(o => o.defaultGrade[newGrade])?.id
            || field.options?.[0]?.id || '';
          break;
        case 'stepper':
          defaultValue = field.default ?? field.min ?? 0;
          break;
        case 'toggle':
          defaultValue = true;
          break;
        case 'checkbox':
          defaultValue = false;
          break;
        default:
          defaultValue = '';
      }

      newFields[field.id] = { value: defaultValue, customized: false };
    }

    return { ...ps, fields: newFields };
  });

  return {
    basic: {
      ...input.basic,
      grade: newGrade,
      contingencyRate: gradeData?.contingencyRate || 0.10,
    },
    processes: newProcesses,
  };
}

export { ALL_PROCESSES, processMap, categoriesRaw as categories };
