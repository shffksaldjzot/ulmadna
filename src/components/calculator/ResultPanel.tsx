'use client';

import { useState } from 'react';
import type { CalculatorInput, CalculatorOutput, CalculatorAction } from '@/types/calculator';
import { formatPerPyeong, formatWonExact, formatPercent } from '@/lib/format';
import type { HistorySnapshot } from '@/hooks/useCalculator';
import PdfDownload from './actions/PdfDownload';
import ExcelDownload from './actions/ExcelDownload';
import KakaoShare from './actions/KakaoShare';
import SaveEstimate from './actions/SaveEstimate';
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
  const [showAll, setShowAll] = useState(false);
  const [title, setTitle] = useState('');
  const [showCompare, setShowCompare] = useState(false);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const rColor = output.rationality.level === 'good' ? 'text-safe' : output.rationality.level === 'normal' ? 'text-amber' : 'text-danger';
  const rBg = output.rationality.level === 'good' ? 'bg-safe/10' : output.rationality.level === 'normal' ? 'bg-amber/10' : 'bg-danger/10';

  const isEmpty = output.total === 0;

  return (
    <div className="bg-cream/50 p-4 lg:p-6 space-y-4">
      {/* 빈 상태 안내 */}
      {isEmpty && (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 rounded-2xl bg-cream mx-auto mb-4 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gold">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-lg font-bold text-brown mb-2">견적을 시작해보세요</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            평형과 등급을 선택하고,<br />
            필요한 공정을 켜면<br />
            예상 견적이 바로 나와요.
          </p>
        </div>
      )}

      {/* 견적 제목 입력 */}
      {!isEmpty && (
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={`예: ${input.basic.area}평 거실 리모델링 A안`}
          maxLength={30}
          className="w-full px-4 py-3 text-sm rounded-2xl border border-gray-200 bg-white focus:border-gold focus:outline-none placeholder:text-gray-300"
        />
      )}

      {/* 견적 카드 */}
      {!isEmpty && <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <p className="text-[10px] text-gold tracking-widest mb-1">실시간 견적 결과</p>
        <p className="text-xs text-gray-400 mb-4">
          {input.basic.area}평 · {HOUSING_LABELS[input.basic.housingType]} · {GRADE_LABELS[input.basic.grade]}
        </p>

        <p className="text-3xl lg:text-4xl font-bold text-brown tracking-tight">
          {Math.round(output.total / 10000).toLocaleString()}만원
        </p>
        <p className="text-sm text-gray-400 mt-1">
          평당 {formatPerPyeong(output.perPyeong)}
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
            {(showAll ? output.processes : output.processes.slice(0, 8)).map(p => (
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
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full text-center text-xs text-gold hover:text-brown py-1.5 transition-colors"
              >
                {showAll ? '접기 ▲' : `더보기 ▼ (+${output.processes.length - 8}개 공정)`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 다운로드/공유 */}
      {!isEmpty && (
        <div className="grid grid-cols-2 gap-2">
          <PdfDownload input={input} output={output} />
          <ExcelDownload input={input} output={output} />
          <KakaoShare input={input} output={output} />
          <SaveEstimate input={input} output={output} title={title} />
        </div>
      )}

      {/* 비교하기 */}
      {!isEmpty && (
        <button
          onClick={() => {
            try {
              const raw = localStorage.getItem('ulmadna-history');
              const parsed: HistorySnapshot[] = raw ? JSON.parse(raw) : [];
              setHistory(parsed);
            } catch {
              setHistory([]);
            }
            setSelectedIdx(null);
            setShowCompare(true);
          }}
          className="w-full py-3 text-sm font-medium text-brown bg-white border border-brown/20 rounded-2xl hover:bg-cream transition-colors"
        >
          이전 견적과 비교하기
        </button>
      )}

      {/* 비교 모달 */}
      {showCompare && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowCompare(false)}>
          <div className="bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-brown">견적 비교</h3>
              <button onClick={() => setShowCompare(false)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
            </div>

            {history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">비교할 이전 견적이 없어요.<br/>견적을 변경하면 자동으로 기록돼요.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-[11px] text-gray-400">비교 대상 선택</p>
                  {history.map((h, i) => (
                    <button
                      key={h.timestamp}
                      onClick={() => setSelectedIdx(i)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs transition-all ${
                        selectedIdx === i ? 'border-brown bg-brown/5 text-brown' : 'border-gray-100 text-gray-600 hover:border-gold/50'
                      }`}
                    >
                      <span className="font-medium">{h.area}평 · {Math.round(h.total / 10000).toLocaleString()}만원</span>
                      <span className="text-gray-300 ml-2">{new Date(h.timestamp).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </button>
                  ))}
                </div>

                {selectedIdx !== null && (() => {
                  const sel = history[selectedIdx];
                  const diffTotal = output.total - sel.total;
                  const diffPP = output.perPyeong - sel.perPyeong;

                  // Build process comparison
                  const currentMap = new Map(output.processes.map(p => [p.id, { name: p.name, amount: p.amount }]));
                  const selMap = new Map(sel.processes.map(p => [p.id, { name: p.name, amount: p.amount }]));
                  const allIds = new Set([...currentMap.keys(), ...selMap.keys()]);
                  const diffs: { name: string; current: number; prev: number; diff: number }[] = [];
                  allIds.forEach(id => {
                    const cur = currentMap.get(id);
                    const prev = selMap.get(id);
                    const curAmt = cur?.amount || 0;
                    const prevAmt = prev?.amount || 0;
                    if (curAmt !== prevAmt) {
                      diffs.push({ name: cur?.name || prev?.name || id, current: curAmt, prev: prevAmt, diff: curAmt - prevAmt });
                    }
                  });
                  diffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
                  const topDiffs = diffs.slice(0, 5);

                  return (
                    <div className="space-y-3 border-t border-gray-100 pt-3">
                      {/* Total comparison */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-cream/50 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-gray-400 mb-1">현재 견적</p>
                          <p className="text-lg font-bold text-brown">{Math.round(output.total / 10000).toLocaleString()}만원</p>
                          <p className="text-[10px] text-gray-400">평당 {Math.round(output.perPyeong / 10000).toLocaleString()}만</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-gray-400 mb-1">이전 견적</p>
                          <p className="text-lg font-bold text-gray-600">{Math.round(sel.total / 10000).toLocaleString()}만원</p>
                          <p className="text-[10px] text-gray-400">평당 {Math.round(sel.perPyeong / 10000).toLocaleString()}만</p>
                        </div>
                      </div>

                      {/* Difference */}
                      <div className={`text-center py-2 rounded-xl ${diffTotal > 0 ? 'bg-danger/5' : diffTotal < 0 ? 'bg-safe/5' : 'bg-gray-50'}`}>
                        <span className={`text-sm font-bold ${diffTotal > 0 ? 'text-danger' : diffTotal < 0 ? 'text-safe' : 'text-gray-500'}`}>
                          {diffTotal > 0 ? '+' : ''}{Math.round(diffTotal / 10000).toLocaleString()}만원
                        </span>
                        <span className="text-[10px] text-gray-400 ml-2">
                          (평당 {diffPP > 0 ? '+' : ''}{Math.round(diffPP / 10000).toLocaleString()}만)
                        </span>
                      </div>

                      {/* Top differences by process */}
                      {topDiffs.length > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-400 mb-2">공정별 주요 차이</p>
                          <div className="space-y-1.5">
                            {topDiffs.map(d => (
                              <div key={d.name} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600 truncate w-24">{d.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400 w-16 text-right">{Math.round(d.prev / 10000).toLocaleString()}만</span>
                                  <span className="text-gray-300">→</span>
                                  <span className="text-brown w-16 text-right">{Math.round(d.current / 10000).toLocaleString()}만</span>
                                  <span className={`w-14 text-right font-medium ${d.diff > 0 ? 'text-danger' : 'text-safe'}`}>
                                    {d.diff > 0 ? '+' : ''}{Math.round(d.diff / 10000).toLocaleString()}만
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* 면책 + 출처 */}
      <div className="bg-cream rounded-2xl p-4 space-y-1.5">
        <p className="text-xs text-gray-500 text-center">
          본 견적은 시장 평균 기반의 <strong>참고용 예상 금액</strong>입니다.
        </p>
        <p className="text-xs text-gray-400 text-center leading-relaxed">
          실제 비용은 현장 상황 · 자재 수급 · 지역에 따라 달라질 수 있습니다.
          반드시 인테리어 전문 업체와 상의하세요.
        </p>
        <p className="text-[11px] text-gray-300 text-center">
          2025~2026 시장 평균 기반
        </p>
      </div>
    </div>
  );
}
