// ──────────────────────────────────────────────
// v1 허브 — 홈 검색창 (클라이언트)
// 지금은 계산기가 도배 하나뿐이라, 검색을 누르면 바로 도배 계산기로 보낸다.
// (전체 검색 인덱스는 계산기가 더 늘어난 뒤 붙인다)
// ──────────────────────────────────────────────

'use client';

import { useRouter } from 'next/navigation';
import TextField from '@/components/v1/TextField';

export default function HomeSearch() {
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push('/v1/calc/wallpaper');
      }}
    >
      <TextField withSearchIcon name="q" placeholder="도배 34평 얼마" readOnly onClick={() => router.push('/v1/calc/wallpaper')} />
    </form>
  );
}
