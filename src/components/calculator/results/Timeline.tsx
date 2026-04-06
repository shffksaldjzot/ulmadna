'use client';

import type { ProcessResult } from '@/types/calculator';
import pricingData from '@/data/pricing.json';

interface TimelineProps {
  processes: ProcessResult[];
}

export default function Timeline({ processes }: TimelineProps) {
  // 공정 순서대로 정렬 (order 기준)
  const sorted = processes
    .map(p => {
      const data = pricingData.find(d => d.id === p.id);
      return { ...p, order: data?.order || 99, duration: data?.duration || 1 };
    })
    .sort((a, b) => a.order - b.order);

  const totalDays = sorted.reduce((sum, p) => sum + p.duration, 0);
  const totalWeeks = Math.ceil(totalDays / 5); // 주 5일 기준

  return (
    <div>
      <h3 className="text-sm font-semibold text-brown mb-1">공사는 이 순서대로 진행돼요</h3>
      <p className="text-xs text-gray-400 mb-3">
        예상 공사 기간: 약 {totalWeeks}주 ({totalDays}일)
      </p>
      <div className="space-y-1">
        {sorted.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3">
            {/* 순서 번호 + 라인 */}
            <div className="flex flex-col items-center w-6">
              <div className="w-5 h-5 rounded-full bg-brown text-white text-[10px] flex items-center justify-center font-bold">
                {i + 1}
              </div>
              {i < sorted.length - 1 && <div className="w-0.5 h-4 bg-gray-200" />}
            </div>
            {/* 공정 정보 */}
            <div className="flex-1 flex items-center justify-between py-1">
              <span className="text-sm text-gray-700">{p.name}</span>
              <span className="text-xs text-gray-400">{p.duration}일</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
