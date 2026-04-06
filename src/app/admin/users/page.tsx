'use client';

import { useState, useEffect } from 'react';

interface UserEstimate {
  title: string;
  total: number;
  createdAt: string;
}

interface UserData {
  userId: string;
  estimateCount: number;
  lastActive: string;
  estimates: UserEstimate[];
}

interface UsersResponse {
  totalUsers: number;
  totalEstimates: number;
  users: UserData[];
}

export default function UsersAdmin() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin-users')
      .then(res => {
        if (!res.ok) throw new Error('권한이 없습니다');
        return res.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-400">로딩 중...</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">사용자 관리</h2>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-xs text-gray-400 mb-1">전체 사용자</p>
          <p className="text-2xl font-bold text-brown">{data.totalUsers}명</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-xs text-gray-400 mb-1">저장된 견적 수</p>
          <p className="text-2xl font-bold text-brown">{data.totalEstimates}건</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-xs text-gray-400 mb-1">인당 평균 견적</p>
          <p className="text-2xl font-bold text-gold">
            {data.totalUsers > 0 ? (data.totalEstimates / data.totalUsers).toFixed(1) : 0}건
          </p>
        </div>
      </div>

      {/* 사용자 목록 */}
      {data.users.length === 0 ? (
        <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
          <p className="text-sm text-gray-400">아직 가입한 사용자가 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {/* 헤더 */}
          <div className="grid grid-cols-4 gap-4 px-5 py-3 bg-gray-50 text-xs text-gray-500 font-medium border-b border-gray-100">
            <span>사용자 ID</span>
            <span>견적 수</span>
            <span>최근 활동</span>
            <span>상세</span>
          </div>

          {/* 행 */}
          {data.users.map(user => (
            <div key={user.userId}>
              <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-gray-50 items-center">
                <span className="text-xs text-gray-700 font-mono truncate" title={user.userId}>
                  {user.userId.slice(0, 12)}...
                </span>
                <span className="text-sm font-medium text-brown">{user.estimateCount}건</span>
                <span className="text-xs text-gray-400">
                  {new Date(user.lastActive).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
                <button
                  onClick={() => setExpandedUser(expandedUser === user.userId ? null : user.userId)}
                  className="text-xs text-gold hover:text-brown transition-colors text-left"
                >
                  {expandedUser === user.userId ? '접기 ▲' : '보기 ▼'}
                </button>
              </div>

              {/* 견적 상세 */}
              {expandedUser === user.userId && (
                <div className="bg-cream/30 px-5 py-3 border-b border-gray-100">
                  <p className="text-[10px] text-gray-400 mb-2">저장된 견적 목록</p>
                  <div className="space-y-1.5">
                    {user.estimates.map((est, i) => (
                      <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-600">{est.title}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-brown">
                            {est.total > 0 ? `${Math.round(est.total / 10000).toLocaleString()}만원` : '-'}
                          </span>
                          <span className="text-[10px] text-gray-300">
                            {new Date(est.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
