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
  under10: '10년 미만', ten20: '10~20년', over20: '20년 이상',
};

export default function ResultPanel({ input, output, dispatch }: ResultPanelProps) {
  const rColor = output.rationality.level === 'good' ? 'text-safe' : output.rationality.level === 'normal' ? 'text-amber' : 'text-danger';
  const rBg = output.rationality.level === 'good' ? 'bg-safe/10' : output.rationality.level === 'normal' ? 'bg-amber/10' : 'bg-danger/10';

  const isEmpty = output.total === 0;

  return (
    <div className="bg-background p-4 lg:p-6 space-y-4">
      {/* 빈 상태 안내 */}
      {isEmpty && (
        <div className="bg-white rounded-2xl p-10 border border-border text-center">
          <div className="w-14 h-14 rounded-2xl bg-cream mx-auto mb-5 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gold">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-base font-bold text-brown-deep mb-2">견적을 시작해보세요</h3>
          <p className="text-sm text-secondary leading-relaxed">
            평형과 등급을 선택하고,<br />
            필요한 공정을 켜면<br />
            예상 견적이 바로 나와요.
          </p>
        </div>
      )}

      {/* 견적 카드 */}
      {!isEmpty && <div className="bg-white rounded-2xl p-6 border border-border shadow-[0_4px_20px_-4px_rgba(92,58,33,0.06)]">
        {/* 합리성 배지 — 상단 */}
        <div className={`inline-flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-full ${rBg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${rColor.replace('text-', 'bg-')}`} />
          <span className={`text-[11px] font-medium ${rColor}`}>{output.rationality.comment}</span>
        </div>

        <p className="text-[11px] text-secondary mb-1">
          {input.basic.area}평 · {HOUSING_LABELS[input.basic.housingType]} · {GRADE_LABELS[input.basic.grade]}
        </p>

        <p className="text-3xl lg:text-4xl font-bold text-brown-deep tracking-tight tabular-nums">
          {Math.round(output.total / 10000).toLocaleString()}만원
        </p>
        <p className="text-sm text-secondary mt-1 tabular-nums">
          평당 {formatPerPyeong(output.perPyeong)}
        </p>

        {/* 비용 내역 */}
        <div className="mt-4 pt-4 border-t border-border space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-secondary">공사비</span>
            <span className="text-foreground tabular-nums">{formatWonExact(output.subtotal)}</span>
          </div>
          {output.margin > 0 && (
            <div className="flex justify-between text-[11px]">
              <span className="text-secondary">이윤 ({Math.round(output.marginRate * 100)}%)</span>
              <span className="text-foreground tabular-nums">{formatWonExact(output.margin)}</span>
            </div>
          )}
          <div className="flex justify-between text-[11px]">
            <span className="text-secondary">예비비 ({Math.round(output.contingencyRate * 100)}%)</span>
            <span className="text-foreground tabular-nums">{formatWonExact(output.contingency)}</span>
          </div>
        </div>
      </div>}

      {/* 공정별 비용 비중 */}
      {!isEmpty && (
        <div className="bg-white rounded-2xl p-5 border border-border">
          <h3 className="text-[11px] font-medium text-secondary tracking-wide uppercase mb-3">공정별 비용 비중</h3>
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

      {/* 숨은 비용: 상세보기로 통합됨 */}

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
