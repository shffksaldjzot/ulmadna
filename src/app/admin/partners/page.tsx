'use client';

import { useState } from 'react';

interface Partner {
  id: string;
  name: string;
  category: string;
  region: string;
  contact: string;
  active: boolean;
}

const SAMPLE_PARTNERS: Partner[] = [
  { id: '1', name: '도토리스튜디오', category: '인테리어 시공', region: '서울', contact: 'contact@dotori.studio', active: true },
];

export default function PartnersAdmin() {
  const [partners] = useState(SAMPLE_PARTNERS);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">파트너 관리</h2>
        <button className="bg-brown text-white text-sm px-4 py-2 rounded-lg hover:bg-brown/90 transition-colors">
          + 파트너 추가
        </button>
      </div>

      <p className="text-sm text-gray-400 mb-4">등록된 파트너는 엑셀 다운로드 시 &quot;추천 업체&quot; 시트에 자동 포함됩니다.</p>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">업체명</th>
              <th className="text-left px-4 py-3">업종</th>
              <th className="text-left px-4 py-3">지역</th>
              <th className="text-left px-4 py-3">연락처</th>
              <th className="text-center px-4 py-3">상태</th>
              <th className="text-center px-4 py-3">관리</th>
            </tr>
          </thead>
          <tbody>
            {partners.map(p => (
              <tr key={p.id} className="border-t border-gray-50">
                <td className="px-4 py-3 font-medium text-gray-700">{p.name}</td>
                <td className="px-4 py-3 text-gray-500">{p.category}</td>
                <td className="px-4 py-3 text-gray-500">{p.region}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{p.contact}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.active ? 'bg-safe/10 text-safe' : 'bg-gray-100 text-gray-400'}`}>
                    {p.active ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button className="text-xs text-gray-400 hover:text-gray-600">수정</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
