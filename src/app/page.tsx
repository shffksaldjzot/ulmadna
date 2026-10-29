// ──────────────────────────────────────────────
// 홈 — 서버 래퍼. 견적서 건수를 서버에서 집계(1시간 캐시)해
// 클라이언트 화면(HomeClient)에 props 로 넘긴다. (클라이언트에서 DB 호출 금지)
// ──────────────────────────────────────────────
import HomeClient from './HomeClient';
import { getEstimateCount } from '@/lib/stats/estimateCount';

export const revalidate = 3600;

export default async function Home() {
  const estimateCount = await getEstimateCount();
  return <HomeClient estimateCount={estimateCount} />;
}
