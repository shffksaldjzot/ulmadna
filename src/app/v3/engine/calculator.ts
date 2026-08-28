// ──────────────────────────────────────────────
// v3 견적 엔진 — 핵심 계산 로직
// 물량 × 단가 + 부대비용 + 옵션
// ──────────────────────────────────────────────

import type { GradeKey, ProcessData, ProcessEstimate, EstimateResult, PresetConfig, QuantityResult, StructureInput } from '../data/types';
import { calculateQuantity, sqmToPyeong, ROOM_RATIOS, FLOOR_ZONE } from '../data/quantity';
import { ALL_PROCESSES } from '../data/processes';
import { getPreset } from './presets';

// ── 예비비 비율 (10%) ──
const CONTINGENCY_RATE = 0.10;

// ── 욕실 기본 개수 ──
const DEFAULT_BATH_COUNT = 2;

// ── 에어컨 기본 대수 (고급 프리셋) ──
const DEFAULT_AC_COUNT = 4;

// ── 커튼 기본 창 개수 (거실+안방+침실2+침실3) ──
const DEFAULT_CURTAIN_WINDOWS = 4;

/** 단일 공정의 견적 계산 */
function calculateProcess(
  process: ProcessData,
  presetProcess: PresetConfig['processes'][string],
  qty: QuantityResult,
  exclusiveArea: number,
): ProcessEstimate {
  // OFF면 0원 반환
  if (!presetProcess.enabled) {
    return {
      processId: process.id,
      processName: process.name,
      enabled: false,
      grade: presetProcess.gradeKey,
      quantity: 0,
      unitPrice: 0,
      subtotal: 0,
      extras: 0,
      total: 0,
    };
  }

  const gradeKey = presetProcess.gradeKey;
  let subtotal = 0;
  let extrasTotal = 0;
  const items: ProcessEstimate['items'] = [];

  // ── 하위 품목이 있는 복합 공정 (목공, 설비, 확장, 가구, 가전, 기타입주시공, 도장) ──
  if (process.subItems && process.subItems.length > 0) {
    for (const sub of process.subItems) {
      // 하위 품목 ON/OFF 확인
      const subPreset = presetProcess.subItems?.[sub.id];
      const subEnabled = subPreset?.enabled ?? sub.defaultEnabled ?? true;
      if (!subEnabled) continue;

      const subGradeKey = subPreset?.gradeKey ?? gradeKey;
      const gradeData = sub.grades[subGradeKey] ?? sub.grades['standard'] ?? Object.values(sub.grades)[0];
      if (!gradeData) continue;

      // 물량 결정
      let subQty = 1;
      if (sub.quantityKey === 'doors') subQty = qty.quantities.doors;
      else if (sub.quantityKey === 'area_pyeong') subQty = qty.quantities.area_pyeong;
      else if (sub.quantityKey === 'baseboard') subQty = qty.quantities.baseboard;
      else if (sub.quantityKey === 'bath_count') subQty = DEFAULT_BATH_COUNT;

      const subTotal = Math.round(gradeData.price * subQty);
      subtotal += subTotal;

      items.push({
        name: sub.name,
        quantity: subQty,
        unitPrice: gradeData.price,
        total: subTotal,
      });
    }
  } else {
    // ── 단일 등급 공정 ──
    const gradeData = process.grades[gradeKey] ?? process.grades['standard'] ?? Object.values(process.grades)[0];
    if (!gradeData) {
      return { processId: process.id, processName: process.name, enabled: true, grade: gradeKey, quantity: 0, unitPrice: 0, subtotal: 0, extras: 0, total: 0 };
    }

    // 물량 결정 (공정 유형별)
    let quantity = 1;
    switch (process.unitType) {
      case 'pyeong':
        if (process.id === 'wallpaper') {
          quantity = qty.quantities.wallpaper_pyeong;
        } else if (process.id === 'flooring') {
          // 고급은 방만 강마루 (36%), 가성비/중급은 전체 마루
          if (gradeKey === 'premium') {
            // 방 영역 면적만 (평 환산)
            const roomRatio = FLOOR_ZONE.maru.reduce((sum, key) => sum + (ROOM_RATIOS[key]?.ratio ?? 0), 0);
            quantity = sqmToPyeong(exclusiveArea * roomRatio);
          } else {
            quantity = qty.quantities.floor_wood_pyeong;
          }
        } else {
          // 철거 등 — 전용면적 평수
          quantity = qty.quantities.area_pyeong;
        }
        break;
      case 'sqm':
        // 창호 — 총 창호 면적 (Bay 보정 적용된 값)
        if (process.id === 'window') {
          quantity = qty.quantities.window_area;
        }
        break;
      case 'room':
        // 욕실 — 기본 2개소
        quantity = DEFAULT_BATH_COUNT;
        break;
      case 'unit':
        // 중문 — 1개, 에어컨 — 대수
        if (process.id === 'aircon') quantity = DEFAULT_AC_COUNT;
        else quantity = 1;
        break;
      case 'window':
        // 커튼 — 창 개수
        quantity = DEFAULT_CURTAIN_WINDOWS;
        break;
      case 'set':
        // 전기, 필름 — 1식
        quantity = 1;
        break;
      default:
        quantity = 1;
    }

    subtotal = Math.round(gradeData.price * quantity);

    items.push({
      name: process.name,
      quantity,
      unitPrice: gradeData.price,
      total: subtotal,
    });
  }

  // ── 부대비용 계산 ──
  if (process.extras) {
    for (const extra of process.extras) {
      // 기본 ON인 것만 자동 적용
      if (!extra.defaultOn) continue;

      let extraAmount = extra.price;

      // ㎡ 단위 부대비용 (창호 철거 등)
      if (extra.unit === '원/㎡' && process.id === 'window') {
        extraAmount = Math.round(extra.price * qty.quantities.window_area);
      }
      // 평당 부대비용 (바닥 철거 등)
      else if (extra.unit === '원/평') {
        extraAmount = Math.round(extra.price * qty.quantities.floor_wood_pyeong);
      }

      extrasTotal += extraAmount;
    }
  }

  return {
    processId: process.id,
    processName: process.name,
    enabled: true,
    grade: gradeKey,
    quantity: items.length === 1 ? items[0].quantity : items.length,
    unitPrice: items.length === 1 ? items[0].unitPrice : 0,
    subtotal,
    extras: extrasTotal,
    total: subtotal + extrasTotal,
    items,
  };
}

/** 전체 견적 계산 — 메인 함수
 *  @param exclusiveArea 전용면적(㎡)
 *  @param grade 등급(가성비/중급/고급)
 *  @param structure Bay/구성/확장 (미지정 시 3Bay·3+알파·확장 기본값)
 */
export function calculateEstimate(exclusiveArea: number, grade: GradeKey, structure: StructureInput = {}): EstimateResult {
  // 1. 물량 산출 (구조입력 반영)
  const qty = calculateQuantity(exclusiveArea, structure);

  // 2. 프리셋 가져오기
  const preset = getPreset(grade);

  // 3. 고급 바닥 타일 별도 계산 (거실+주방+복도+현관)
  let floorTileTotal = 0;
  if (grade === 'premium') {
    const tileRatio = FLOOR_ZONE.tile.reduce((sum, key) => sum + (ROOM_RATIOS[key]?.ratio ?? 0), 0);
    const tilePyeong = sqmToPyeong(exclusiveArea * tileRatio);
    // 국산 포세린 600×600 기본값: 155,000원/평
    floorTileTotal = Math.round(tilePyeong * 155000);
  }

  // 4. 공정별 계산
  const processes: ProcessEstimate[] = ALL_PROCESSES.map((process) => {
    const presetProcess = preset.processes[process.id];
    if (!presetProcess) {
      return {
        processId: process.id,
        processName: process.name,
        enabled: false,
        grade: 'standard',
        quantity: 0,
        unitPrice: 0,
        subtotal: 0,
        extras: 0,
        total: 0,
      };
    }
    return calculateProcess(process, presetProcess, qty, exclusiveArea);
  });

  // 5. 고급 바닥 타일을 별도 항목으로 추가
  if (grade === 'premium' && floorTileTotal > 0) {
    const tileRatio = FLOOR_ZONE.tile.reduce((sum, key) => sum + (ROOM_RATIOS[key]?.ratio ?? 0), 0);
    const tilePyeong = sqmToPyeong(exclusiveArea * tileRatio);
    processes.push({
      processId: 'floor_tile',
      processName: '바닥 타일 (거실+주방+복도)',
      enabled: true,
      grade: 'premium',
      quantity: tilePyeong,
      unitPrice: 155000,
      subtotal: floorTileTotal,
      extras: 0,
      total: floorTileTotal,
      items: [{
        name: '국산 포세린 600×600',
        quantity: tilePyeong,
        unitPrice: 155000,
        total: floorTileTotal,
      }],
    });
  }

  // 6. 합산
  const subtotal = processes.reduce((sum, p) => sum + p.total, 0);
  const contingency = Math.round(subtotal * CONTINGENCY_RATE);
  const grandTotal = subtotal + contingency;

  return {
    apartmentType: qty.closestType,
    exclusiveArea,
    grade,
    processes,
    subtotal,
    contingency,
    grandTotal,
  };
}
