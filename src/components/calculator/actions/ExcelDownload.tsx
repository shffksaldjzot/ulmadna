'use client';

import { useState } from 'react';
import type { CalculatorInput, CalculatorOutput } from '@/types/calculator';

interface ExcelDownloadProps {
  input: CalculatorInput;
  output: CalculatorOutput;
}

export default function ExcelDownload({ input, output }: ExcelDownloadProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { generateExcel } = await import('@/lib/excel-generator');
      await generateExcel(input, output);
    } catch {
      alert('엑셀 파일 생성 중 문제가 생겼어요. 다시 한번 눌러주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex-1 min-w-[140px] px-4 py-3 bg-gold text-white rounded-lg text-sm font-medium hover:bg-gold/90 transition-colors disabled:opacity-50"
    >
      {loading ? '생성 중...' : '엑셀로 저장하기'}
    </button>
  );
}
