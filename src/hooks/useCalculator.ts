/**
 * v2 계산기 상태 관리 훅
 * Design Ref: v2 §3 — 3단 Progressive Disclosure
 * - 등급 변경 → 비커스텀 필드 일괄 업데이트
 * - 개별 필드 변경 → customized = true
 */

'use client';

import { useReducer } from 'react';
import type { CalculatorInput, CalculatorOutput, CalculatorAction } from '@/types/calculator';
import { calculate, createDefaultInput, applyGradeChange } from '@/lib/calculator';

interface CalculatorState {
  input: CalculatorInput;
  output: CalculatorOutput;
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
      // 등급 변경 → 비커스텀 필드 일괄 변경
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
  return { state, dispatch };
}
