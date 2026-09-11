import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // ──────────────────────────────────────────────
  // 옛 계산기 주소(/v1, /v1/calc/*) → 새 주소(/calc, /calc/*) 영구 이전 (2026-09-11)
  //
  // /v1 밑에 있던 계산기 허브가 본서비스로 승격되면서 주소가 /calc 로 바뀌었다.
  // 예전 링크(블로그 옛 글, 카카오톡 공유, 즐겨찾기 등)가 죽지 않도록 301(영구 이동)로
  // 자동으로 새 주소로 보내준다.
  //
  // 쿼리스트링(예: 공유 링크 ?d=eyJt...)은 destination에 :path* 같은 와일드카드만 있고
  // 쿼리를 따로 안 적어도, Next.js가 목적지에서 안 쓴 쿼리값을 자동으로 그대로 붙여준다
  // (Next.js redirects 공식 동작 — destination이 소비하지 않은 쿼리는 자동 유지).
  // 그래서 /v1/calc/wallpaper?d=abc → /calc/wallpaper?d=abc 로 쿼리까지 그대로 넘어간다.
  async redirects() {
    return [
      {
        // 옛 허브 홈 (정확히 /v1 인 경우만)
        source: "/v1",
        destination: "/calc",
        permanent: true,
      },
      {
        // 옛 계산기·결과 페이지 전부 (/v1/calc/wallpaper, /v1/calc/flooring/result 등)
        source: "/v1/calc/:path*",
        destination: "/calc/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
