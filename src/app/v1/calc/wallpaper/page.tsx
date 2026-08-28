// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 입력 페이지
// 실제 폼 로직은 WallpaperInputForm(클라이언트)에 있다.
// useSearchParams를 쓰는 클라이언트 컴포넌트라 Suspense로 감싸야 빌드가 안전하다.
// ──────────────────────────────────────────────

import { Suspense } from 'react';
import WallpaperInputForm from './WallpaperInputForm';

export const metadata = {
  title: '도배 계산기 — 얼마드나',
  description: '평형·실측·면적 중 하나로 도배 물량과 비용을 계산합니다.',
};

export default function WallpaperCalcPage() {
  return (
    <Suspense fallback={null}>
      <WallpaperInputForm />
    </Suspense>
  );
}
