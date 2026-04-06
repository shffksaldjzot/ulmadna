/**
 * v3 계산기 상태 관리 훅
 * - ulmadna_db.json 기반 하이브리드 적산
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

const STORAGE_KEY = 'ulmadna-v3-input';

interface CalculatorState {
  input: CalculatorInput;
  output: CalculatorOutput;
}

function loadSavedInput(): CalculatorInput | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved) as CalculatorInput;
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
      // 평수 처음 선택 시 공정 자동 활성화
      if (state.input.basic.area === 0 && action.payload > 0) {
        newInput = enableDefaultProcesses(newInput);
      }
      break;
    }

    case 'SET_HOUSING_TYPE':
      newInput = applyHousingTypeChange(state.input, action.payload);
      break;

    case 'SET_LIVING_CONDITION':
      newInput = {
        ...state.input,
        basic: { ...state.input.basic, livingCondition: action.payload },
      };
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

    case 'SET_PROCESS_GRADE': {
      const { processId, grade } = action.payload;
      newInput = {
        ...state.input,
        processes: state.input.processes.map(p =>
          p.id === processId ? { ...p, selectedGrade: grade } : p
        ),
      };
      break;
    }

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
