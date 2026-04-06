'use client';

import type { CalculatorInput, CalculatorOutput, CalculatorAction } from '@/types/calculator';
import { formatPerPyeong, formatWonExact, formatPercent } from '@/lib/format';
import PdfDownload from './actions/PdfDownload';
import ExcelDownload from './actions/ExcelDownload';
import KakaoShare from './actions/KakaoShare';
import SaveEstimate from './actions/SaveEstimate';
import HiddenCosts from './results/HiddenCosts';
import ContingencySelector from './results/ContingencySelector';

interface ResultPanelProps {
  input: CalculatorInput;
  output: CalculatorOutput;
  dispatch: React.Dispatch<CalculatorAction>;
}

const GRADE_LABELS: Record<string, string> = {
  basic: '기본(가성비)', mid: '중급(대중적)', premium: '고급(프리미엄)',
};
const HOUSING_LABELS: Record<string, string> = {
  new: '신축 입주', old10: '구축 10년 미만', old20: '구축 20년 이상',
};

export default function ResultPanel({ input, output, dispatch }: ResultPanelProps) {
  const rColor = output.rationality.level === 'good' ? 'text-safe' : output.rationality.level === 'normal' ? 'text-amber' : 'text-danger';
  const rBg = output.rationality.level === 'good' ? 'bg-safe/10' : output.rationality.level === 'normal' ? 'bg-amber/10' : 'bg-danger/10';

  const isEmpty = output.total === 0;

  return (
    <div className="bg-cream/50 p-4 lg:p-6 space-y-4">
      {/* 빈 상태 안내 */}
      {isEmpty && (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 rounded-full bg-cream mx-auto mb-4 flex items-center justify-center text-2xl">
            🏠
          </div>
          <h3 className="text-lg font-bold text-brown mb-2">견적을 시작해보세요</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            평형과 등급을 선택하고,<br />
            필요한 공정을 켜면<br />
            예상 견적이 바로 나와요.
          </p>
        </div>
      )}

      {/* 견적 카드 — 결과가 있을 때만 */}
      {!isEmpty && <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-gold tracking-widest">실시간 견적 결과</p>
          <div className="w-12 h-12 rounded-full bg-brown text-white flex items-center justify-center text-[10px] font-bold leading-tight text-center">
            견적<br/>서
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          {input.basic.area}평 · {HOUSING_LABELS[input.basic.housingType]} · {GRADE_LABELS[input.basic.grade]}
        </p>

        <p className="text-3xl lg:text-4xl font-bold text-brown tracking-tight">
          ₩{output.total.toLocaleString('ko-KR')}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          예비비 {Math.round(output.contingencyRate * 100)}% 포함 · 평당 {formatPerPyeong(output.perPyeong)}
        </p>

        {/* 예비비 조정 */}
        <div className="mt-3">
          <ContingencySelector
            value={output.contingencyRate}
            onChange={rate => dispatch({ type: 'SET_CONTINGENCY_RATE', payload: rate })}
          />
        </div>

        {/* 합리성 배지 */}
        <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full ${rBg}`}>
          <span className={`w-2 h-2 rounded-full ${rColor.replace('text-', 'bg-')}`} />
          <span className={`text-xs font-medium ${rColor}`}>{output.rationality.comment}</span>
        </div>
      </div>}

      {/* 공정별 비용 비중 */}
      {!isEmpty && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-xs font-bold text-brown mb-3">공정별 비용 비중</h3>
          <div className="space-y-2.5">
            {output.processes.slice(0, 8).map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 shrink-0 truncate">{p.name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-gold rounded-full h-2 transition-all duration-300"
                    style={{ width: `${p.percentage}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-brown w-14 text-right">{formatWonExact(p.amount)}</span>
                <span className="text-[10px] text-gray-300 w-10 text-right">{formatPercent(p.percentage)}</span>
              </div>
            ))}
            {output.processes.length > 8 && (
              <p className="text-[10px] text-gray-300 text-center">외 {output.processes.length - 8}개 공정</p>
            )}
          </div>
        </div>
      )}

      {/* 숨은 비용 알림 */}
      {!isEmpty && <HiddenCosts costs={output.hiddenCosts} warnings={output.warnings} />}

      {/* 다운로드/공유 */}
      {!isEmpty && (
        <div className="grid grid-cols-2 gap-2">
          <PdfDownload input={input} output={output} />
          <ExcelDownload input={input} output={output} />
          <KakaoShare input={input} output={output} />
          <SaveEstimate input={input} output={output} />
        </div>
      )}

      {/* 면책 + 출처 */}
      <div className="bg-cream rounded-lg p-3 space-y-1">
        <p className="text-[10px] text-gray-400 text-center">
          ⚠ 본 견적은 시장 평균 기반의 <strong>참고용 예상 금액</strong>입니다.
        </p>
        <p className="text-[10px] text-gray-300 text-center">
          실제 비용은 현장 상황 · 자재 수급 · 지역에 따라 달라질 수 있습니다.
          반드시 인테리어 전문 업체와 상의하세요.
        </p>
        <p className="text-[10px] text-gray-300 text-center">
          2025~2026 시장 평균 기반
        </p>
      </div>
    </div>
  );
}
