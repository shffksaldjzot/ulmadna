'use client';

import { useState } from 'react';
import type { CalculatorInput, CalculatorOutput } from '@/types/calculator';
import { fetchServedAd, useAdMapMode } from '@/lib/ads/useServedAd';

interface PdfDownloadProps {
  input: CalculatorInput;
  output: CalculatorOutput;
}

export default function PdfDownload({ input, output }: PdfDownloadProps) {
  const [loading, setLoading] = useState(false);
  // 관리자 자리 표시 모드(?ad_preview=all)면 견적서 하단 추천 줄 자리를 표시판 글자로 채워 보여 준다
  const mapMode = useAdMapMode();

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { generatePdf } = await import('@/lib/pdf-generator');
      // 견적서 하단 추천 줄: 토탈 인테리어 스폰서(AD-T, 방문자 지역) 상호·전화 (2026-10-29)
      //  - 광고 스위치가 꺼져 있으면 서버에 묻지 않고 null → 견적서는 예전 그대로
      const ad = mapMode ? null : await fetchServedAd('AD-T').catch(() => null);
      const sponsor = mapMode
        ? { name: '[AD-T 표시판] 업체 상호', phone: '전화 번호' }
        : ad
          ? { name: ad.name, phone: ad.phone ?? null }
          : null;
      await generatePdf(input, output, sponsor);
    } catch {
      alert('PDF 만드는 중에 문제가 생겼어요. 다시 한번 눌러주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      // 주 액션 버튼 채움은 강조색(accent) 통일 — 갈색은 글자 전용
      className="flex-1 min-w-[140px] px-4 py-3 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-press transition-colors disabled:opacity-50"
    >
      {loading ? '생성 중...' : 'PDF로 저장하기'}
    </button>
  );
}
