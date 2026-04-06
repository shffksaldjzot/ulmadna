'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AdminLoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      const from = searchParams.get('from') || '/admin';
      router.push(from);
    } else {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <form onSubmit={handleLogin} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 w-full max-w-sm">
        <h1 className="text-xl font-bold text-brown mb-1">얼마드나 관리자</h1>
        <p className="text-xs text-gray-400 mb-6">관리자 비밀번호를 입력하세요</p>

        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(false); }}
          placeholder="비밀번호"
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gold mb-3"
          autoFocus
        />

        {error && (
          <p className="text-xs text-danger mb-3">비밀번호가 틀렸습니다.</p>
        )}

        <button
          type="submit"
          className="w-full bg-brown text-white py-3 rounded-lg text-sm font-medium hover:bg-brown/90 transition-colors"
        >
          로그인
        </button>
      </form>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}
