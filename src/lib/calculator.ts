/**
 * 얼마드나 v4 계산 엔진 — 아이템별 적산
 *
 * 각 공정 내 아이템별로 자재/옵션을 개별 선택하고
 * 선택된 옵션 가격을 합산하여 총액을 산출합니다.
 *
 * 총액 = Σ(각 공정 아이템 합산) × 연식계수 + 이윤 + 예비비
 */

import type {
  CalculatorInput,
  CalculatorOutput,
  ProcessResult,
  ProcessUserState,
  Grade,
  HiddenCost,
  SavingTip,
  DBProcess,
  DBOption,
  DBItem,
  UlmadnaDB,
  HousingType,
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

// UI 등급에서 DB 옵션 중 가장 적합한 grade key 찾기
function findDefaultGradeKey(options: DBOption[], uiGrade: Grade): string {
  const targetGrades = GRADE_MAPPING[uiGrade];
  for (const g of targetGrades) {
    const found = options.find(o => o.grade === g);
    if (found) return found.grade;
  }
  // fallback
  if (uiGrade === 'basic') return options[0]?.grade || 'basic';
  if (uiGrade === 'premium') return options[options.length - 1]?.grade || 'high';
  return options[Math.floor(options.length / 2)]?.grade || 'mid';
}

// 옵션 배열에서 grade key로 찾기
function findOptionByGrade(options: DBOption[], gradeKey: string): DBOption | null {
  return options.find(o => o.grade === gradeKey) || options[0] || null;
}

// ─── 연식별 계수 ───
const HOUSING_COEFFICIENTS: Record<string, number> = {
  under10: 0.8,
  ten20: 0.9,
  over20: 1.0,
};

// ─── 공정별 기본 개소수 ───
function getDefaultCount(processId: string, area: number, _housingType: string): number {
  const counts: Record<string, number> = {
    bathroom: 2,
    door: area >= 39 ? 6 : area >= 30 ? 5 : 4,
    entrance_door: 1,
    aircon: area >= 39 ? 5 : area >= 30 ? 4 : 3,
    lighting: 1,
    electrical: 1,
    painting: 1,
    furniture: 1,
    art_wall: 1,
    ceiling_work: 1,
    expansion: 0,
    plumbing: 1,
    misc: 1,
  };
  return counts[processId] || 1;
}

// ─── 공정 기본 ON/OFF ───
function getDefaultEnabled(processId: string, housingType: string): boolean {
  const under10Off = ['demolition', 'window', 'expansion', 'plumbing', 'ceiling_work'];
  if (housingType === 'under10' && under10Off.includes(processId)) return false;

  const ten20Off = ['expansion', 'ceiling_work'];
  if (housingType === 'ten20' && ten20Off.includes(processId)) return false;

  const defaultOff = ['expansion', 'art_wall', 'ceiling_work'];
  if (defaultOff.includes(processId)) return false;

  return true;
}

// ─── 아이템별 기본 선택 생성 ───
function createItemDefaults(process: DBProcess, uiGrade: Grade): {
  itemSelections: Record<string, string>;
  itemToggles: Record<string, boolean>;
  itemCounts: Record<string, number>;
  dimensions: Record<string, number>;
  extraToggles: Record<string, boolean>;
} {
  const itemSelections: Record<string, string> = {};
  const itemToggles: Record<string, boolean> = {};
  const itemCounts: Record<string, number> = {};
  const dimensions: Record<string, number> = {};
  const extraToggles: Record<string, boolean> = {};

  // Process-level options (B_area or A_item with options)
  if (process.options && process.options.length > 0) {
    itemSelections['__process__'] = findDefaultGradeKey(process.options, uiGrade);
  }

  // Waste disposal
  if (process.waste_disposal?.options) {
    itemSelections['__waste__'] = findDefaultGradeKey(process.waste_disposal.options, uiGrade);
  }

  // Items
  if (process.items) {
    for (const item of process.items) {
      if (item.options && item.options.length > 0) {
        // Item with options -> dropdown
        itemSelections[item.id] = findDefaultGradeKey(item.options, uiGrade);
      } else if (item.price !== undefined && !item.unit) {
        // Single price item with no unit -> toggle ON by default
        itemToggles[item.id] = true;
      } else if (item.price !== undefined && item.unit) {
        // Item with unit -> toggle ON, count based on unit
        itemToggles[item.id] = true;
        if (item.unit === 'EA' || item.unit === 'M') {
          itemCounts[item.id] = item.unit === 'EA' ? 10 : 20; // sensible defaults
        }
      }
    }
  }

  // Sub items (kitchen extras) -> OFF by default
  if (process.sub_items) {
    for (const item of process.sub_items) {
      itemToggles[item.id] = false;
      if (item.options && item.options.length > 0) {
        itemSelections[item.id] = findDefaultGradeKey(item.options, uiGrade);
      }
    }
  }

  // Kitchen sink length default
  if (process.id === 'kitchen') {
    dimensions['sink_length'] = 3.5;
  }

  // Furniture builtin closet default size (자 units)
  if (process.id === 'furniture') {
    dimensions['builtin_closet_ja'] = 12; // 12자 default
  }

  // Extras -> OFF by default
  if (process.extras) {
    for (const extra of process.extras) {
      extraToggles[extra.name] = false;
    }
  }

  return { itemSelections, itemToggles, itemCounts, dimensions, extraToggles };
}

// ─── 공정별 금액 계산 (v4: 아이템별 적산) ───
function calculateProcess(
  process: DBProcess,
  ps: ProcessUserState,
  area: number,
): { amount: number; optionName: string; breakdown: { label: string; amount: number }[] } {
  const breakdown: { label: string; amount: number }[] = [];
  let total = 0;
  const optionNames: string[] = [];

  if (process.type === 'B_area') {
    // ── B_area: process-level options with price_per_pyeong ──
    if (process.options && process.options.length > 0) {
      const gradeKey = ps.itemSelections['__process__'] || process.options[0].grade;
      const option = findOptionByGrade(process.options, gradeKey);
      if (option) {
        optionNames.push(option.name);
        if (option.price_per_pyeong) {
          const amt = option.price_per_pyeong * area;
          total += amt;
          breakdown.push({
            label: `${option.name} (${option.price_per_pyeong.toLocaleString()}원/평 × ${area}평)`,
            amount: amt,
          });
        } else if (option.price) {
          total += option.price;
          breakdown.push({ label: option.name, amount: option.price });
        }
      }
    }

    // Wallpaper: ceiling included
    if (process.id === 'wallpaper' && ps.ceilingIncluded) {
      const gradeKey = ps.itemSelections['__process__'] || '';
      const option = process.options ? findOptionByGrade(process.options, gradeKey) : null;
      if (option?.price_per_pyeong) {
        // Ceiling area is approximately same as floor area
        const ceilingArea = Math.round(area * 0.3); // roughly 30% of total pyeong for ceiling
        const amt = option.price_per_pyeong * ceilingArea;
        total += amt;
        breakdown.push({
          label: `천정 도배 (${option.price_per_pyeong.toLocaleString()}원/평 × ${ceilingArea}평)`,
          amount: amt,
        });
      }
    }

    // Flooring: demolition included
    if (process.id === 'flooring' && ps.demolitionIncluded) {
      const demolitionPrice = 35000;
      const amt = demolitionPrice * area;
      total += amt;
      breakdown.push({
        label: `기존 마루 철거 (35,000원/평 × ${area}평)`,
        amount: amt,
      });
    }

    // Waste disposal (demolition)
    if (process.waste_disposal) {
      const wasteGradeKey = ps.itemSelections['__waste__'] || process.waste_disposal.options[0]?.grade;
      const wasteOption = findOptionByGrade(process.waste_disposal.options, wasteGradeKey);
      if (wasteOption?.price) {
        total += wasteOption.price;
        breakdown.push({ label: `폐기물 처리 (${wasteOption.name})`, amount: wasteOption.price });
      }
    }
  } else {
    // ── A_item: item-level calculation ──

    // Process-level options (painting, door, entrance_door, aircon, expansion, art_wall, ceiling_work)
    if (process.options && process.options.length > 0 && !process.items?.length) {
      const gradeKey = ps.itemSelections['__process__'] || process.options[0].grade;
      const option = findOptionByGrade(process.options, gradeKey);
      if (option) {
        optionNames.push(option.name);
        const price = option.price || 0;
        const count = ps.count;
        const amt = price * count;
        total += amt;
        const unitLabel = process.unit || '개';
        breakdown.push({
          label: `${option.name}${count > 1 ? ` × ${count}${unitLabel}` : ''}`,
          amount: amt,
        });
      }
    }

    // Items array
    if (process.items && process.items.length > 0) {
      // If process has both options AND items (e.g. electrical, lighting),
      // use item-level calculation instead of process-level options
      const hasProcessOptionsAndItems = process.options && process.options.length > 0 && process.items.length > 0;

      for (const item of process.items) {
        if (item.options && item.options.length > 0) {
          // Item with options -> use selected grade from dropdown
          const gradeKey = ps.itemSelections[item.id] || item.options[0].grade;
          const option = findOptionByGrade(item.options, gradeKey);
          if (option) {
            let amt = 0;
            if (option.price_per_m !== undefined) {
              // price_per_m -> multiply by dimension
              const dimKey = item.id === 'sink_cabinet' || item.id === 'countertop' ? 'sink_length' : `${item.id}_length`;
              const dimValue = ps.dimensions[dimKey] || 3.5;
              amt = option.price_per_m * dimValue;
              breakdown.push({
                label: `${item.name} · ${option.name} (${(option.price_per_m / 10000).toFixed(0)}만/m × ${dimValue}m)`,
                amount: amt,
              });
            } else if (option.price_per_ja !== undefined) {
              // price_per_ja -> multiply by ja dimension
              const dimKey = `${item.id}_ja`;
              const dimValue = ps.dimensions[dimKey] || 12;
              amt = option.price_per_ja * dimValue;
              breakdown.push({
                label: `${item.name} · ${option.name} (${(option.price_per_ja / 10000).toFixed(1)}만/자 × ${dimValue}자)`,
                amount: amt,
              });
            } else if (option.price !== undefined) {
              // For bathroom items, multiply by process count
              if (process.id === 'bathroom') {
                amt = option.price * ps.count;
                breakdown.push({
                  label: `${item.name} · ${option.name}${ps.count > 1 ? ` × ${ps.count}` : ''}`,
                  amount: amt,
                });
              } else {
                amt = option.price;
                breakdown.push({
                  label: `${item.name} · ${option.name}`,
                  amount: amt,
                });
              }
            }
            total += amt;
          }
        } else if (item.price !== undefined) {
          // Fixed price item
          const isToggled = ps.itemToggles[item.id] !== false; // default on unless explicitly off
          if (!isToggled) continue;

          let amt = 0;
          if (item.unit === 'EA' || item.unit === 'M') {
            // Stepper item
            const count = ps.itemCounts[item.id] || 0;
            amt = item.price * count;
            if (amt > 0) {
              breakdown.push({
                label: `${item.name} × ${count}${item.unit}`,
                amount: amt,
              });
            }
          } else if (item.unit === '실' || item.unit === '개소') {
            // Per-unit items (bathroom: tile_labor, fixture_install, grout, etc.)
            const count = process.id === 'bathroom' ? ps.count : 1;
            if (item.days_per_bathroom) {
              amt = item.price * item.days_per_bathroom * count;
              breakdown.push({
                label: `${item.name} (${item.days_per_bathroom}일 × ${count}개소)`,
                amount: amt,
              });
            } else {
              amt = item.price * count;
              breakdown.push({
                label: `${item.name}${count > 1 ? ` × ${count}${item.unit}` : ''}`,
                amount: amt,
              });
            }
          } else if (item.price_per_pyeong) {
            // price_per_pyeong (e.g. misc cleaning)
            amt = item.price_per_pyeong * area;
            breakdown.push({
              label: `${item.name} (${(item.price_per_pyeong / 10000).toFixed(1)}만/평 × ${area}평)`,
              amount: amt,
            });
          } else if (item.unit === '일') {
            // Daily rate items
            const count = process.id === 'bathroom' ? ps.count : 1;
            const days = item.days_per_bathroom || 1;
            amt = item.price * days * count;
            breakdown.push({
              label: `${item.name} (${days}일 × ${count}개소)`,
              amount: amt,
            });
          } else {
            // Simple fixed price
            amt = item.price;
            breakdown.push({ label: item.name, amount: amt });
          }
          total += amt;
        }
      }

      // If we had process options AND items, skip process-level (already handled in items loop)
      if (hasProcessOptionsAndItems) {
        // Already computed via items, remove process-level entry if any
      }
    }

    // Sub items (kitchen extras)
    if (process.sub_items) {
      for (const item of process.sub_items) {
        const isToggled = ps.itemToggles[item.id] === true;
        if (!isToggled) continue;

        if (item.options && item.options.length > 0) {
          const gradeKey = ps.itemSelections[item.id] || item.options[0].grade;
          const option = findOptionByGrade(item.options, gradeKey);
          if (option) {
            let amt = 0;
            if (option.price_per_ja !== undefined) {
              const dimKey = `${item.id}_ja`;
              const dimValue = ps.dimensions[dimKey] || 6;
              amt = option.price_per_ja * dimValue;
              breakdown.push({
                label: `${item.name} · ${option.name} (${dimValue}자)`,
                amount: amt,
              });
            } else if (option.price !== undefined) {
              amt = option.price;
              breakdown.push({ label: `${item.name} · ${option.name}`, amount: amt });
            }
            total += amt;
          }
        }
      }
    }
  }

  // Extras
  if (process.extras) {
    for (const extra of process.extras) {
      const isToggled = ps.extraToggles?.[extra.name] === true;
      if (!isToggled) continue;

      const price = extra.price || 0;
      const pricePerUnit = extra.price_per_unit || 0;
      let amt = 0;

      if (pricePerUnit > 0) {
        amt = pricePerUnit * ps.count;
        breakdown.push({ label: `${extra.name} × ${ps.count}`, amount: amt });
      } else {
        amt = price;
        breakdown.push({ label: extra.name, amount: amt });
      }
      total += amt;
    }
  }

  // Handle misc items with price_per_pyeong (cleaning)
  if (process.id === 'misc' && process.items) {
    // Check for cleaning which has price_per_pyeong in DB
    for (const item of process.items) {
      if (item.id === 'cleaning' && (item as unknown as { price_per_pyeong?: number }).price_per_pyeong) {
        // Already handled above via the item.price path;
        // but cleaning has price_per_pyeong in DB, handle specially
        // This is handled below in the override
      }
    }
  }

  return {
    amount: Math.round(total),
    optionName: optionNames.join(', ') || (breakdown.length > 0 ? breakdown[0].label.split(' ·')[0] : ''),
    breakdown,
  };
}

// ─── 숨은 비용 계산 ───
function calculateHiddenCosts(_enabledProcessIds: string[]): HiddenCost[] {
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
function calculateSavingTips(_enabledProcessIds: string[]): SavingTip[] {
  return db.tips.map(tip => ({ text: tip, saving: 0 }));
}

// ─── 메인 계산 함수 ───
export function calculate(input: CalculatorInput): CalculatorOutput {
  const { basic } = input;
  const results: ProcessResult[] = [];
  const housingCoeff = HOUSING_COEFFICIENTS[basic.housingType] || 1;

  for (const ps of input.processes) {
    if (!ps.enabled) continue;

    const process = db.processes.find(p => p.id === ps.id);
    if (!process) continue;

    const calcResult = calculateProcess(process, ps, basic.area);

    if (calcResult.amount > 0) {
      const adjustedAmount = Math.round(calcResult.amount * housingCoeff);

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

  results.sort((a, b) => b.amount - a.amount);

  const subtotal = results.reduce((sum, r) => sum + r.amount, 0);

  if (subtotal > 0) {
    results.forEach(r => {
      r.percentage = Math.round((r.amount / subtotal) * 1000) / 10;
    });
  }

  const marginRate = basic.marginRate;
  const margin = Math.round(subtotal * marginRate);
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
  const processes: ProcessUserState[] = db.processes.map(p => {
    const defaults = createItemDefaults(p, grade);
    return {
      id: p.id,
      enabled: false,
      count: getDefaultCount(p.id, 33, 'over20'),
      ...defaults,
    };
  });

  return {
    basic: {
      area: 0,
      housingType: 'over20',
      grade,
      contingencyRate: db.config.contingency_rate,
      marginRate: db.config.margin_rate_range.min,
    },
    processes,
  };
}

// ─── 등급 변경: 모든 아이템 선택을 새 등급 기본값으로 리셋 ───
export function applyGradeChange(input: CalculatorInput, newGrade: Grade): CalculatorInput {
  return {
    basic: { ...input.basic, grade: newGrade },
    processes: input.processes.map(ps => {
      const process = db.processes.find(p => p.id === ps.id);
      if (!process) return ps;
      const defaults = createItemDefaults(process, newGrade);
      return {
        ...ps,
        itemSelections: defaults.itemSelections,
        // Keep toggles, counts, dimensions, extras as-is (user customization)
      };
    }),
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
