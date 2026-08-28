'use client';

import { useState, useMemo } from 'react';
// v3 엔진 import
import { calculateEstimate, formatPrice } from './engine';
import type { GradeKey, ApartmentType, EstimateResult } from './data/types';
import { TYPE_AVERAGES } from './data/quantity';

// ──────────────────────────────────────────────
// 메인 페이지 — 엔진 연결 검증용
// ──────────────────────────────────────────────
export default function V3Page() {
  // ── 0뎁스: 평형 선택 ──
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customArea, setCustomArea] = useState<string>('');

  // ── 1뎁스: 등급 선택 ──
  const [grade, setGrade] = useState<GradeKey>('standard');

  // 현재 전용면적
  const currentArea = selectedType === 'custom'
    ? parseFloat(customArea) || 0
    : selectedType ? TYPE_AVERAGES[selectedType as ApartmentType]?.area || 0 : 0;

  // 엔진 계산 결과
  const result: EstimateResult | null = useMemo(() => {
    if (currentArea <= 0) return null;
    return calculateEstimate(currentArea, grade);
  }, [currentArea, grade]);

  // 등급 정보
  const gradeInfo: Record<GradeKey, { label: string; desc: string; color: string }> = {
    economy:  { label: '가성비', desc: '필수 공정만 · 장판 · 합지 · 보급형',       color: 'bg-green-500' },
    standard: { label: '중급',   desc: '인기 조합 · 강마루 · 실크 · 대림/이누스',   color: 'bg-blue-500' },
    premium:  { label: '고급',   desc: '풀옵션 · 타일+마루 · 디아망 · 시스템창',    color: 'bg-purple-500' },
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      {/* ───── 제목 ───── */}
      <h1 className="text-2xl font-bold text-center mt-6 mb-2" style={{ color: '#5C3A1E' }}>
        얼마드나 v3
      </h1>
      <p className="text-center text-gray-500 text-sm mb-8">
        62건 평면도 분석 기반 · 16개 공정 견적 엔진
      </p>

      {/* ───── 0뎁스: 평형 선택 ───── */}
      <div className="bg-white rounded-xl p-5 shadow-sm mb-4">
        <h2 className="font-semibold mb-4 text-lg">몇 평형이세요?</h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {(['59', '74', '84'] as const).map((type) => (
            <button
              key={type}
              onClick={() => { setSelectedType(type); setCustomArea(''); }}
              className={`py-4 rounded-xl border-2 text-center transition-all ${
                selectedType === type
                  ? 'border-[#5C3A1E] bg-[#5C3A1E] text-white'
                  : 'border-gray-200 bg-white hover:border-[#5C3A1E]'
              }`}
            >
              <div className="text-lg font-bold">{type}㎡</div>
              <div className="text-xs mt-1 opacity-70">
                {type === '59' ? '25평형' : type === '74' ? '30평형' : '34평형'}
              </div>
            </button>
          ))}
        </div>
        {/* 직접 입력 */}
        <div className={`border-2 rounded-xl p-4 transition-all ${
          selectedType === 'custom' ? 'border-[#5C3A1E]' : 'border-gray-200'
        }`}>
          <label className="text-sm text-gray-500 mb-2 block">직접 입력</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={customArea}
              onChange={(e) => { setCustomArea(e.target.value); setSelectedType('custom'); }}
              placeholder="전용면적 (㎡)"
              className="flex-1 border rounded-lg px-3 py-2 text-center"
            />
            <span className="text-gray-500">㎡</span>
          </div>
        </div>
      </div>

      {/* ───── 1뎁스: 등급 선택 ───── */}
      {currentArea > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm mb-4">
          <h2 className="font-semibold mb-4 text-lg">어떤 수준으로 하세요?</h2>
          <div className="space-y-3">
            {(Object.entries(gradeInfo) as [GradeKey, typeof gradeInfo[GradeKey]][]).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setGrade(key)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  grade === key
                    ? 'border-[#5C3A1E] bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${info.color}`} />
                  <span className="font-bold">{info.label}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-6">{info.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ───── 결과 ───── */}
      {result && (
        <>
          {/* 총액 카드 */}
          <div className="bg-[#5C3A1E] text-white rounded-xl p-6 mb-4 shadow-lg">
            <p className="text-sm opacity-80 mb-1">
              {result.exclusiveArea}㎡ ({result.apartmentType}타입) · {gradeInfo[grade].label}
            </p>
            <p className="text-3xl font-bold mb-2">{formatPrice(result.grandTotal)}</p>
            <div className="flex justify-between text-sm opacity-70">
              <span>공사비</span>
              <span>{formatPrice(result.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm opacity-70">
              <span>예비비 (10%)</span>
              <span>{formatPrice(result.contingency)}</span>
            </div>
          </div>

          {/* 공정별 내역 */}
          <div className="bg-white rounded-xl p-5 shadow-sm mb-4">
            <h2 className="font-semibold mb-4 text-lg">공정별 내역</h2>
            <div className="space-y-2">
              {result.processes
                .filter(p => p.enabled)
                .sort((a, b) => b.total - a.total)
                .map((p) => (
                  <div key={p.processId} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <span className="font-medium text-sm">{p.processName}</span>
                      {p.items && p.items.length > 0 && (
                        <p className="text-xs text-gray-400">
                          {p.items.map(i => i.name).join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="font-semibold text-sm" style={{ color: '#5C3A1E' }}>
                      {formatPrice(p.total)}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* OFF 공정 */}
          {result.processes.filter(p => !p.enabled).length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm mb-4">
              <h2 className="font-semibold mb-3 text-sm text-gray-400">미포함 공정</h2>
              <div className="flex flex-wrap gap-2">
                {result.processes
                  .filter(p => !p.enabled)
                  .map(p => (
                    <span key={p.processId} className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
                      {p.processName}
                    </span>
                  ))
                }
              </div>
            </div>
          )}

          {/* 근거 안내 */}
          <div className="bg-amber-50 rounded-xl p-4 mb-8 text-sm text-amber-800">
            <p className="font-semibold mb-1">이 견적의 근거</p>
            <p>물량: 62건 아파트 평면도 분석 ({result.apartmentType}㎡ 타입 매칭)</p>
            <p>단가: 35건 실제 견적서 + ChatGPT 시장가 교차검증 (2026년 04월 14일)</p>
            <p>창호: 논문 92개 창호 조사 + 시공플러스(KCC) 공개가</p>
            <p className="mt-2 text-amber-600">실측과 ±10% 오차 가능 | 정확한 검증은 도토리스튜디오</p>
          </div>
        </>
      )}
    </div>
  );
}
