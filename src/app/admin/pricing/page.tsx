'use client';

import { useState } from 'react';
import pricingData from '@/data/pricing.json';
import coefficients from '@/data/coefficients.json';
import { formatRawWon } from '@/lib/format';

export default function PricingAdmin() {
  const [data] = useState(pricingData);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">단가 관리</h2>
        <p className="text-xs text-gray-400">변경 시 Excel DB 수정 후 재빌드 필요</p>
      </div>

      {/* 계수 테이블 */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 mb-6">
        <h3 className="font-semibold text-gray-800 mb-4">계수 설정</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">지역 계수</p>
            {Object.entries(coefficients.region).map(([key, val]) => (
              <div key={key} className="flex justify-between py-1 text-sm">
                <span className="text-gray-600">{key}</span>
                <span className="font-mono text-brown">{val}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">주거유형 계수</p>
            {Object.entries(coefficients.housingType).map(([key, val]) => (
              <div key={key} className="flex justify-between py-1 text-sm">
                <span className="text-gray-600">{key}</span>
                <span className="font-mono text-brown">{val}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">천장높이 계수</p>
            {Object.entries(coefficients.ceilingHeight).map(([key, val]) => (
              <div key={key} className="flex justify-between py-1 text-sm">
                <span className="text-gray-600">{key}</span>
                <span className="font-mono text-brown">{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 공정별 단가 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50">
          <h3 className="font-semibold text-gray-800">공정별 단가 (30평 기준)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">공정</th>
                <th className="text-right px-4 py-3">기본</th>
                <th className="text-right px-4 py-3">중급</th>
                <th className="text-right px-4 py-3">고급</th>
                <th className="text-center px-4 py-3">기본 ON</th>
                <th className="text-center px-4 py-3">순서</th>
              </tr>
            </thead>
            <tbody>
              {data.map(p => (
                <tr key={p.id} className="border-t border-gray-50 hover:bg-cream/30">
                  <td className="px-4 py-3 font-medium text-gray-700">{p.name}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{formatRawWon(p.basic)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{formatRawWon(p.mid)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{formatRawWon(p.premium)}</td>
                  <td className="px-4 py-3 text-center">{p.defaultOn ? '✅' : '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{p.order}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
