'use client';

import { useState } from 'react';
import type { CalculatorInput, CalculatorOutput } from '@/types/calculator';

interface PdfDownloadProps {
  input: CalculatorInput;
  output: CalculatorOutput;
}

export default function PdfDownload({ input, output }: PdfDownloadProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { generatePdf } = await import('@/lib/pdf-generator');
      await generatePdf(input, output);
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
      className="flex-1 min-w-[140px] px-4 py-3 bg-brown text-white rounded-lg text-sm font-medium hover:bg-brown/90 transition-colors disabled:opacity-50"
    >
      {loading ? '생성 중...' : 'PDF로 저장하기'}
    </button>
  );
}
