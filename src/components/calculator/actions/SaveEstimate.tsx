'use client';

import { useState } from 'react';
import type { CalculatorInput, CalculatorOutput } from '@/types/calculator';

interface SaveEstimateProps {
  input: CalculatorInput;
  output: CalculatorOutput;
  title?: string;
}

export default function SaveEstimate({ input, output, title = '' }: SaveEstimateProps) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('견적서 제목을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, output, title: title.trim() }),
      });

      if (res.status === 401) {
        if (confirm('카카오로 간편 로그인하면 저장할 수 있어요. 3초면 끝나요.\n\n로그인하시겠어요?')) {
          window.location.href = '/login';
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
      {saved ? '저장 완료!' : '내 견적 저장하기'}
    </button>
  );
}
