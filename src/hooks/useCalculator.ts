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
  }, [state.input]);

  return { state, dispatch };
}
