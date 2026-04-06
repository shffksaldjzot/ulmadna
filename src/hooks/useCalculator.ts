/**
 * v4 계산기 상태 관리 훅
 * - 아이템별 개별 선택 지원
 * - 등급/평수/유형 변경 → 자동 재계산
 * - localStorage 자동 저장/복원
 */

'use client';

import { useReducer, useEffect, useRef } from 'react';
import type { CalculatorInput, CalculatorOutput, CalculatorAction } from '@/types/calculator';
import {
  calculate,
  createDefaultInput,
  applyGradeChange,
  applyAreaChange,
  applyHousingTypeChange,
  enableDefaultProcesses,
} from '@/lib/calculator';

const STORAGE_KEY = 'ulmadna-v4-input';
const HISTORY_KEY = 'ulmadna-history';

interface CalculatorState {
  input: CalculatorInput;
  output: CalculatorOutput;
}

function loadSavedInput(): CalculatorInput | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as CalculatorInput;
    // Validate v4 structure: check first process has itemSelections
    if (parsed.processes?.[0] && !('itemSelections' in parsed.processes[0])) {
      return null; // old v3 format, discard
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveInput(input: CalculatorInput) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
  } catch {
    // ignore
  }
}

export interface HistorySnapshot {
  timestamp: number;
  area: number;
  grade: string;
  housingType: string;
  total: number;
  perPyeong: number;
  processes: { id: string; name: string; amount: number }[];
}

function saveHistory(output: CalculatorOutput, input: CalculatorInput) {
  if (typeof window === 'undefined') return;
  if (output.total <= 0) return;
  try {
    const existing: HistorySnapshot[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const snapshot: HistorySnapshot = {
      timestamp: Date.now(),
      area: input.basic.area,
      grade: input.basic.grade,
      housingType: input.basic.housingType,
      total: output.total,
      perPyeong: output.perPyeong,
      processes: output.processes.map(p => ({ id: p.id, name: p.name, amount: p.amount })),
    };
    // Keep only last 3, avoid duplicates within 5 seconds
    const filtered = existing.filter(h => Math.abs(h.timestamp - snapshot.timestamp) > 5000);
    const updated = [snapshot, ...filtered].slice(0, 3);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

const defaultInput = createDefaultInput('mid');
const defaultOutput = calculate(defaultInput);

const initialState: CalculatorState = {
  input: defaultInput,
  output: defaultOutput,
};

function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  let newInput: CalculatorInput;

  switch (action.type) {
    case 'SET_AREA': {
      newInput = applyAreaChange(state.input, action.payload);
      if (state.input.basic.area === 0 && action.payload > 0) {
        newInput = enableDefaultProcesses(newInput);
      }
      break;
    }

    case 'SET_HOUSING_TYPE':
      newInput = applyHousingTypeChange(state.input, action.payload);
      break;

    case 'SET_GRADE':
      newInput = applyGradeChange(state.input, action.payload);
      break;

    case 'SET_CONTINGENCY_RATE':
      newInput = {
        ...state.input,
        basic: { ...state.input.basic, contingencyRate: action.payload },
      };
      break;

    case 'SET_MARGIN_RATE':
      newInput = {
        ...state.input,
        basic: { ...state.input.basic, marginRate: action.payload },
      };
      break;

    case 'TOGGLE_PROCESS':
      newInput = {
        ...state.input,
        processes: state.input.processes.map(p =>
          p.id === action.payload ? { ...p, enabled: !p.enabled } : p
        ),
      };
      break;

    case 'SET_PROCESS_COUNT': {
      const { processId, count } = action.payload;
      newInput = {
        ...state.input,
        processes: state.input.processes.map(p =>
          p.id === processId ? { ...p, count } : p
        ),
      };
      break;
    }

    case 'SET_ITEM_SELECTION': {
      const { processId, itemId, grade } = action.payload;
      newInput = {
        ...state.input,
        processes: state.input.processes.map(p =>
          p.id === processId
            ? { ...p, itemSelections: { ...p.itemSelections, [itemId]: grade } }
            : p
        ),
      };
      break;
    }

    case 'SET_ITEM_TOGGLE': {
      const { processId, itemId, enabled } = action.payload;
      newInput = {
        ...state.input,
        processes: state.input.processes.map(p =>
          p.id === processId
            ? { ...p, itemToggles: { ...p.itemToggles, [itemId]: enabled } }
            : p
        ),
      };
      break;
    }

    case 'SET_ITEM_COUNT': {
      const { processId, itemId, count } = action.payload;
      newInput = {
        ...state.input,
        processes: state.input.processes.map(p =>
          p.id === processId
            ? { ...p, itemCounts: { ...p.itemCounts, [itemId]: count } }
            : p
        ),
      };
      break;
    }

    case 'SET_DIMENSION': {
      const { processId, key, value } = action.payload;
      newInput = {
        ...state.input,
        processes: state.input.processes.map(p =>
          p.id === processId
            ? { ...p, dimensions: { ...p.dimensions, [key]: value } }
            : p
        ),
      };
      break;
    }

    case 'SET_CEILING_INCLUDED': {
      const { processId, included } = action.payload;
      newInput = {
        ...state.input,
        processes: state.input.processes.map(p =>
          p.id === processId ? { ...p, ceilingIncluded: included } : p
        ),
      };
      break;
    }

    case 'SET_DEMOLITION_INCLUDED': {
      const { processId, included } = action.payload;
      newInput = {
        ...state.input,
        processes: state.input.processes.map(p =>
          p.id === processId ? { ...p, demolitionIncluded: included } : p
        ),
      };
      break;
    }

    case 'SET_EXTRA_TOGGLE': {
      const { processId, extraName, enabled } = action.payload;
      newInput = {
        ...state.input,
        processes: state.input.processes.map(p =>
          p.id === processId
            ? { ...p, extraToggles: { ...p.extraToggles, [extraName]: enabled } }
            : p
        ),
      };
      break;
    }

    case 'LOAD_INPUT':
      newInput = action.payload;
      break;

    case 'RESET':
      newInput = createDefaultInput('mid');
      break;

    default:
      return state;
  }

  const newOutput = calculate(newInput);
  return { input: newInput, output: newOutput };
}

export function useCalculator() {
  const [state, dispatch] = useReducer(calculatorReducer, initialState);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const saved = loadSavedInput();
    if (saved) {
      dispatch({ type: 'LOAD_INPUT', payload: saved });
    }
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    saveInput(state.input);
    saveHistory(state.output, state.input);
  }, [state.input, state.output]);

  return { state, dispatch };
}
