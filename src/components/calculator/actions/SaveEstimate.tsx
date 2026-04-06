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
  const [showNameModal, setShowNameModal] = useState(false);
  const [name, setName] = useState('');

  const handleSave = async () => {
    setLoading(true);
    try {
      const title = name.trim() || `${input.basic.area}평 견적`;
      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, output, title }),
      });

      if (res.status === 401) {
        if (confirm('카카오로 간편 로그인하면 저장할 수 있어요. 3초면 끝나요.\n\n로그인하시겠어요?')) {
          window.location.href = '/login';
        }
        setShowNameModal(false);
        return;
      }

      if (res.ok) {
        setSaved(true);
        setShowNameModal(false);
        setName('');
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      alert('저장 중 문제가 생겼어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowNameModal(true)}
        disabled={loading}
        className="flex-1 min-w-[140px] px-4 py-3 bg-white text-brown border border-brown rounded-lg text-sm font-medium hover:bg-cream transition-colors disabled:opacity-50"
      >
        {saved ? '저장 완료!' : '내 견적 저장하기'}
      </button>

      {/* 이름 입력 모달 */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-brown mb-1">견적 이름 지정</h3>
            <p className="text-xs text-gray-400 mb-4">나중에 구분하기 쉽게 이름을 적어주세요</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`예: ${input.basic.area}평 거실 리모델링 A안`}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gold mb-4"
              autoFocus
              maxLength={30}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowNameModal(false); setName(''); }}
                className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 py-2.5 text-sm text-white bg-brown rounded-lg hover:bg-brown/90 disabled:opacity-50"
              >
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
