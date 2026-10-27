'use client';

import type { CalculatorInput } from '@/types/calculator';
import { pickRealRange, FULL_REMODEL_PROCESS_IDS } from '@/lib/real-estimate-range';

interface RealRangeBarProps {
  input: CalculatorInput;
  /** 계산 결과 총액(원) */
  total: number;
}

/**
 * 실제 견적 범위 속 내 위치 — 한 줄 막대.
 * 20평대·30평대 올수리(주요 5공정 모두 켜짐)일 때만 보인다.
 * 띠 = 실제 견적서 하위25~상위25 범위, 점 = 내 결과. 범위 밖이면 점이 끝에 붙는다.
 */
export default function RealRangeBar({ input, total }: RealRangeBarProps) {
  const range = pickRealRange(input.basic.area);
  if (!range) return null;

  // 올수리 판정: 핵심 공정이 하나라도 꺼져 있으면 부분 공사라 비교하지 않음
  const allOn = FULL_REMODEL_PROCESS_IDS.every(id => input.processes.find(p => p.id === id)?.enabled);
  if (!allOn) return null;

  const myMan = Math.round(total / 10000);
  // 막대 눈금: 띠 폭의 절반만큼 양옆 여백을 둔다
  const pad = (range.high - range.low) * 0.5;
  const min = range.low - pad;
  const max = range.high + pad;
  const toPct = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-gray-100">
        {/* 실제 견적 가운데 절반 범위 띠 */}
        <div
          className="absolute top-0 h-2 rounded-full bg-gold/30"
          style={{ left: `${toPct(range.low)}%`, width: `${toPct(range.high) - toPct(range.low)}%` }}
        />
        {/* 내 결과 점 */}
        <div
          className="absolute top-1/2 w-3.5 h-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-accent border-2 border-white shadow"
          style={{ left: `${toPct(myMan)}%` }}
          aria-label={`내 결과 ${myMan.toLocaleString()}만원`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1.5">
        <span>{range.low.toLocaleString()}만</span>
        <span>실제 견적서 기준 범위</span>
        <span>{range.high.toLocaleString()}만</span>
      </div>
    </div>
  );
}
