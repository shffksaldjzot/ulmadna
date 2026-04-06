'use client';

import { useState } from 'react';
import type { CalculatorInput, CalculatorAction, CalculatorOutput } from '@/types/calculator';
import AreaSelector from './inputs/AreaSelector';
import TypeSelector from './inputs/TypeSelector';
import RegionSelector from './inputs/RegionSelector';
import GradeSelector from './inputs/GradeSelector';
import ProcessToggles from './inputs/ProcessToggles';

interface InputPanelProps {
  input: CalculatorInput;
  output?: CalculatorOutput;
  dispatch: React.Dispatch<CalculatorAction>;
}

export default function InputPanel({ input, output, dispatch }: InputPanelProps) {
  const [showBasic, setShowBasic] = useState(true);

  return (
    <div className="bg-white border-r border-gray-100">
      <div className="p-4 lg:p-8">
        {/* Step 01. 기본 공간 정보 */}
        <div className="mb-8">
          <button
            onClick={() => setShowBasic(!showBasic)}
            className="flex items-center gap-2 mb-4 lg:mb-6"
          >
            <span className="text-[10px] text-gold tracking-widest font-medium">Step 01.</span>
            <span className="text-base font-bold text-brown">기본 공간 정보</span>
            <span className="text-xs text-gray-300 lg:hidden">{showBasic ? '▲' : '▼'}</span>
          </button>

          <div className={`space-y-5 ${showBasic ? '' : 'hidden'} lg:block`}>
            <AreaSelector
              value={input.basic.area}
              onChange={v => dispatch({ type: 'SET_AREA', payload: v })}
            />
            <TypeSelector
              value={input.basic.housingType}
              onChange={v => dispatch({ type: 'SET_HOUSING_TYPE', payload: v })}
            />
            <RegionSelector
              value={input.basic.region}
              onChange={v => dispatch({ type: 'SET_REGION', payload: v })}
            />
            <GradeSelector
              value={input.basic.grade}
              onChange={v => dispatch({ type: 'SET_GRADE', payload: v })}
            />
          </div>
        </div>

        {/* 모바일: 총 금액 미리보기 (항상 보임) */}
        {output && (
          <div className="lg:hidden bg-cream rounded-xl p-4 mb-6 text-center">
            <p className="text-xs text-gray-400">예상 총 비용</p>
            <p className="text-2xl font-bold text-brown">
              {(output.total / 10000).toLocaleString('ko-KR')}만원
            </p>
            <p className="text-xs text-gold">평당 {(output.perPyeong / 10000).toLocaleString('ko-KR')}만원</p>
          </div>
        )}

        {/* Step 02. 공정 세부 선택 */}
        <div>
          <div className="flex items-center gap-2 mb-4 lg:mb-6">
            <span className="text-[10px] text-gold tracking-widest font-medium">Step 02.</span>
            <span className="text-base font-bold text-brown">공정 세부 선택</span>
          </div>

          <ProcessToggles
            processes={input.processes}
            output={output}
            grade={input.basic.grade}
            onToggle={id => dispatch({ type: 'TOGGLE_PROCESS', payload: id })}
            onFieldChange={(processId, fieldId, value) =>
              dispatch({ type: 'SET_FIELD', payload: { processId, fieldId, value } })
            }
          />
        </div>
      </div>
    </div>
  );
}
