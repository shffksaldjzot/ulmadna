'use client';

import { useState } from 'react';
import type { CalculatorInput, CalculatorAction, CalculatorOutput } from '@/types/calculator';
import AreaSelector from './inputs/AreaSelector';
import TypeSelector from './inputs/TypeSelector';
import GradeSelector from './inputs/GradeSelector';
import ProcessToggles from './inputs/ProcessToggles';

interface InputPanelProps {
  input: CalculatorInput;
  output?: CalculatorOutput;
  dispatch: React.Dispatch<CalculatorAction>;
}

export default function InputPanel({ input, output, dispatch }: InputPanelProps) {
  const [showBasic, setShowBasic] = useState(true);

  const handleReset = () => {
    if (confirm('입력한 내용을 모두 초기화할까요?')) {
      localStorage.removeItem('ulmadna-v3-input');
      dispatch({ type: 'RESET' });
    }
  };

  return (
    <div className="bg-white border-r border-gray-100">
      <div className="p-4 lg:p-8">
        {/* 상단: 초기화 버튼 */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-danger border border-gray-200 hover:border-danger/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            초기화
          </button>
        </div>

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
            <GradeSelector
              value={input.basic.grade}
              onChange={v => dispatch({ type: 'SET_GRADE', payload: v })}
            />

            {/* 시공환경 선택 */}
            <div>
              <p className="text-xs text-gray-500 mb-2">시공 환경</p>
              <div className="flex gap-2">
                {(['empty', 'occupied'] as const).map(cond => (
                  <button
                    key={cond}
                    onClick={() => dispatch({ type: 'SET_LIVING_CONDITION', payload: cond })}
                    className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                      input.basic.livingCondition === cond
                        ? 'bg-brown text-white border-brown'
                        : 'bg-cream text-gray-600 border-gray-200 hover:border-gold'
                    }`}
                  >
                    {cond === 'empty' ? '빈집' : '거주중'}
                  </button>
                ))}
              </div>
            </div>

            {/* 이윤율 선택 */}
            <div>
              <p className="text-xs text-gray-500 mb-2">기업 이윤율</p>
              <div className="flex gap-1.5">
                {[0, 3, 5, 7, 10].map(rate => (
                  <button
                    key={rate}
                    onClick={() => dispatch({ type: 'SET_MARGIN_RATE', payload: rate / 100 })}
                    className={`flex-1 py-2 rounded-lg text-center transition-all text-sm font-medium ${
                      Math.round(input.basic.marginRate * 100) === rate
                        ? 'bg-brown text-white shadow-sm'
                        : 'bg-white text-gray-500 border border-gray-200 hover:border-gold'
                    }`}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-300 mt-1.5">
                {input.basic.marginRate === 0 ? '직영 시공 (이윤 없음)' :
                 input.basic.marginRate <= 0.05 ? '일반적인 수준' :
                 '턴키/올인원 업체 수준'}
              </p>
            </div>
          </div>
        </div>

        {/* 모바일: 총 금액 미리보기 */}
        {output && output.total > 0 && (
          <div className="lg:hidden bg-cream rounded-xl p-4 mb-6 text-center">
            <p className="text-xs text-gray-400">예상 총 비용</p>
            <p className="text-2xl font-bold text-brown">
              {Math.round(output.total / 10000).toLocaleString('ko-KR')}만원
            </p>
            <p className="text-xs text-gold">
              평당 {Math.round(output.perPyeong / 10000).toLocaleString('ko-KR')}만원
            </p>
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
            onGradeChange={(processId, grade) =>
              dispatch({ type: 'SET_PROCESS_GRADE', payload: { processId, grade } })
            }
            onCountChange={(processId, count) =>
              dispatch({ type: 'SET_PROCESS_COUNT', payload: { processId, count } })
            }
          />
        </div>
      </div>
    </div>
  );
}
