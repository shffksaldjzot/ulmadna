'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SavedEstimate {
  id: string;
  title: string;
  input: {
    basic: {
      area: number;
      grade: string;
      housingType: string;
    };
    processes: unknown[];
  };
  output: {
    total: number;
    perPyeong: number;
  };
  created_at: string;
}

const GRADE_LABELS: Record<string, string> = {
  basic: '기본', mid: '중급', premium: '고급',
};
const HOUSING_LABELS: Record<string, string> = {
  under10: '10년 미만', ten20: '10~20년', over20: '20년 이상',
};

export default function MyEstimatesPage() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<SavedEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchEstimates();
  }, []);

  async function fetchEstimates() {
    try {
      const res = await fetch('/api/estimates');
      if (res.status === 401) {
        setNeedsLogin(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setEstimates(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 견적을 삭제하시겠습니까?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/estimates?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEstimates(prev => prev.filter(e => e.id !== id));
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  function handleLoad(estimate: SavedEstimate) {
    localStorage.setItem('ulmadna-v4-input', JSON.stringify(estimate.input));
    router.push('/');
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  return (
    <div className="min-h-screen bg-cream/30">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.push('/')} className="text-brown hover:text-gold transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="text-lg font-bold text-brown">저장된 견적</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 로딩 */}
        {loading && (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">불러오는 중...</p>
          </div>
        )}

        {/* 로그인 필요 */}
        {needsLogin && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-16 h-16 rounded-2xl bg-cream mx-auto mb-4 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gold">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-brown mb-2">로그인이 필요해요</h3>
            <p className="text-sm text-gray-400 mb-4">견적을 저장하고 관리하려면 로그인해주세요.</p>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-2.5 bg-brown text-white text-sm font-medium rounded-full hover:bg-brown/90 transition-colors"
            >
              로그인하기
            </button>
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && !needsLogin && estimates.length === 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-16 h-16 rounded-2xl bg-cream mx-auto mb-4 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gold">
                <path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-brown mb-2">아직 저장된 견적이 없어요</h3>
            <p className="text-sm text-gray-400 mb-4">견적을 만들고 저장해보세요.</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2.5 bg-brown text-white text-sm font-medium rounded-full hover:bg-brown/90 transition-colors"
            >
              견적 만들기
            </button>
          </div>
        )}

        {/* 견적 카드 목록 */}
        {!loading && !needsLogin && estimates.map(est => (
          <div key={est.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-brown">{est.title}</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {est.input.basic.area}평 · {HOUSING_LABELS[est.input.basic.housingType] || ''} · {GRADE_LABELS[est.input.basic.grade] || ''}
                </p>
              </div>
              <span className="text-[10px] text-gray-300">{formatDate(est.created_at)}</span>
            </div>

            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-2xl font-bold text-brown">
                {Math.round(est.output.total / 10000).toLocaleString()}만원
              </span>
              <span className="text-xs text-gray-400">
                평당 {Math.round(est.output.perPyeong / 10000).toLocaleString()}만원
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleLoad(est)}
                className="flex-1 py-2 text-xs font-medium text-white bg-brown rounded-xl hover:bg-brown/90 transition-colors"
              >
                불러오기
              </button>
              <button
                onClick={() => handleDelete(est.id)}
                disabled={deletingId === est.id}
                className="px-4 py-2 text-xs font-medium text-gray-400 bg-gray-50 rounded-xl hover:bg-gray-100 hover:text-danger transition-colors disabled:opacity-50"
              >
                {deletingId === est.id ? '...' : '삭제'}
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
