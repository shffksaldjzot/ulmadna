/**
 * v2 계산기 상태 관리 훅
 * - 등급 변경 → 비커스텀 필드 일괄 업데이트
 * - 개별 필드 변경 → customized = true
 * - localStorage 자동 저장/복원 → 재방문 시 이전 입력값 유지
 */

'use client';

import { useReducer, useEffect, useRef } from 'react';
import type { CalculatorInput, CalculatorOutput, CalculatorAction } from '@/types/calculator';
import { calculate, createDefaultInput, applyGradeChange } from '@/lib/calculator';

const STORAGE_KEY = 'ulmadna-calculator-input';

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
    // localStorage 용량 초과 등 무시
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
    case 'SET_AREA':
      newInput = {
        ...state.input,
        basic: { ...state.input.basic, area: action.payload },
      };
      break;

    case 'SET_HOUSING_TYPE':
      newInput = {
        ...state.input,
        basic: { ...state.input.basic, housingType: action.payload },
      };
      break;

    case 'SET_REGION':
      newInput = {
        ...state.input,
        basic: { ...state.input.basic, region: action.payload },
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

    case 'TOGGLE_PROCESS':
      newInput = {
        ...state.input,
        processes: state.input.processes.map(p =>
          p.id === action.payload ? { ...p, enabled: !p.enabled } : p
        ),
      };
      break;

    case 'SET_FIELD': {
      const { processId, fieldId, value } = action.payload;
      newInput = {
        ...state.input,
        processes: state.input.processes.map(p =>
          p.id === processId
            ? {
                ...p,
                fields: {
                  ...p.fields,
                  [fieldId]: { value, customized: true },
                },
              }
            : p
        ),
      };
      break;
    }

    case 'LOAD_INPUT':
      newInput = action.payload;
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

  // 최초 마운트 시 localStorage에서 복원
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const saved = loadSavedInput();
    if (saved) {
      dispatch({ type: 'LOAD_INPUT', payload: saved });
    }
  }, []);

  // 입력값 변경 시 자동 저장
  useEffect(() => {
    if (!initialized.current) return;
    saveInput(state.input);
  }, [state.input]);

  return { state, dispatch };
}
