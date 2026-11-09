// /ig 라우트 ─ 인스타그램 유입 트래픽 추적용 별도 경로.
// 메인 페이지 컴포넌트를 그대로 재노출 (Vercel Analytics / GA에서 /ig로 별도 페이지뷰 집계)
export { default } from '../page';

// [검색 색인 — 2026년 11월 09일] 이 경로는 홈과 내용이 똑같아 서치 콘솔이 "표준 없는 중복 페이지"로 잡았다.
// 정본(canonical)을 홈으로 지정해 색인은 홈에만 모이게 한다. 유입 추적(GA 경로별 집계)은 그대로 된다.
export const metadata = { alternates: { canonical: 'https://ulmadna.com/' } };
