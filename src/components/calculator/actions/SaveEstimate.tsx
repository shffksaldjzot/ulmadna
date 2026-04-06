'use client';

import { useState } from 'react';
import type { CalculatorInput, CalculatorOutput } from '@/types/calculator';

interface SaveEstimateProps {
  input: CalculatorInput;
  output: CalculatorOutput;
}

export default function SaveEstimate({ input, output }: SaveEstimateProps) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, output }),
      });

      if (res.status === 401) {
        // 비회원 → 로그인 안내
        if (confirm('카카오로 간편 로그인하면 저장할 수 있어요. 3초면 끝나요.\n\n로그인하시겠어요?')) {
          window.location.href = '/api/auth/signin';
        }
        return;
      }

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      alert('저장 중 문제가 생겼어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSave}
      disabled={loading}
      className="flex-1 min-w-[140px] px-4 py-3 bg-white text-brown border border-brown rounded-lg text-sm font-medium hover:bg-cream transition-colors disabled:opacity-50"
    >
      {saved ? '저장 완료!' : loading ? '저장 중...' : '내 견적 저장하기'}
    </button>
  );
}
