'use client';

import { SessionProvider } from 'next-auth/react';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider refetchOnWindowFocus={false} /* 2026-10-28: 탭 복귀마다 로그인 재확인 끔(요청 절약) */>{children}</SessionProvider>;
}
