'use client';

import { useState } from 'react';

interface Banner {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  position: 'main' | 'result';
  active: boolean;
}

const SAMPLE_BANNERS: Banner[] = [
  { id: '1', name: '도토리스튜디오', imageUrl: '', linkUrl: '', position: 'main', active: true },
  { id: '2', name: '파트너 배너 슬롯 2', imageUrl: '', linkUrl: '', position: 'main', active: false },
  { id: '3', name: '파트너 배너 슬롯 3', imageUrl: '', linkUrl: '', position: 'main', active: false },
];

export default function BannersAdmin() {
  const [banners, setBanners] = useState(SAMPLE_BANNERS);

  const toggleBanner = (id: string) => {
    setBanners(prev => prev.map(b => b.id === id ? { ...b, active: !b.active } : b));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">배너 광고 관리</h2>
        <button className="bg-brown text-white text-sm px-4 py-2 rounded-lg hover:bg-brown/90 transition-colors">
          + 배너 추가
        </button>
      </div>

      <div className="space-y-4">
        {banners.map(banner => (
          <div key={banner.id} className="bg-white rounded-xl p-5 border border-gray-100 flex items-center gap-4">
            {/* 미리보기 */}
            <div className="w-40 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-300 shrink-0">
              {banner.imageUrl ? (
                <img src={banner.imageUrl} alt={banner.name} className="w-full h-full object-cover rounded-lg" />
              ) : (
                '320×100'
              )}
            </div>

            {/* 정보 */}
            <div className="flex-1">
              <p className="font-medium text-gray-800">{banner.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                위치: {banner.position === 'main' ? '메인 하단' : '결과 패널'} ·
                상태: {banner.active ? '노출 중' : '비활성'}
              </p>
              {banner.linkUrl && (
                <p className="text-xs text-gold mt-1 truncate">{banner.linkUrl}</p>
              )}
            </div>

            {/* 액션 */}
            <div className="flex items-center gap-2">
              <button className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 border border-gray-200 rounded-lg">
                수정
              </button>
              <button
                onClick={() => toggleBanner(banner.id)}
                className={`w-10 h-5 rounded-full transition-colors ${banner.active ? 'bg-safe' : 'bg-gray-300'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mt-0.5 ${banner.active ? 'translate-x-5 ml-0.5' : 'ml-0.5'}`} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-cream rounded-xl p-5 text-sm text-gray-500">
        <p className="font-medium text-brown mb-2">배너 가이드</p>
        <ul className="space-y-1 text-xs text-gray-400">
          <li>• 데스크톱 권장 사이즈: 728×90px</li>
          <li>• 모바일 권장 사이즈: 320×100px</li>
          <li>• 최대 3개 슬롯 (콘텐츠 영역 밖에만 배치)</li>
          <li>• 모든 배너에 &quot;파트너&quot; 라벨 자동 표시</li>
        </ul>
      </div>
    </div>
  );
}
