// ──────────────────────────────────────────────
// vitest 설정 — 서버 계산 모듈 테스트용
//
// 두 가지만 손봐 준다.
//   1) '@/...' 경로 별칭을 tsconfig 와 똑같이 맞춘다
//   2) 'server-only' 를 빈 모듈로 바꿔치기한다
//      (Next.js 밖에서 그냥 불러오면 일부러 에러를 던지는 표식 패키지라서)
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const root = process.cwd();

export default defineConfig({
  resolve: {
    alias: {
      'server-only': path.resolve(root, 'src/server/test-stubs/server-only.ts'),
      '@': path.resolve(root, 'src'),
    },
  },
  test: {
    // 서버 계산 모듈 테스트만 돌린다 (Next 페이지·컴포넌트는 대상 아님)
    include: ['src/server/**/*.test.ts'],
    environment: 'node',
  },
});
