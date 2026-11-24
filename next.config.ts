import type { NextConfig } from "next";

// 그리기와 무관한 경로에서 뺄 것: 배너 글꼴 + next/og(그리기 도구). pay.ts 는 그리기 코드를 결제 확정 때만 동적으로 불러온다
const NO_DRAW = ["./assets/banner-fonts/**/*", "./node_modules/next/dist/compiled/@vercel/og/**/*"];

const nextConfig: NextConfig = {
  /* config options here */

  // ──────────────────────────────────────────────
  // 배너 자동 제작 글꼴 싣기 (2026년 11월 24일)
  //   서버가 배너를 그릴 때 assets/banner-fonts/ 의 글꼴 파일을 fs 로 읽는다(src/server/banner/bannerFonts.ts).
  //   코드에서 import 하지 않는 파일이라 Vercel 함수에 자동으로 안 실리므로, 그리는 경로에만 실어 준다.
  //   결제 확정(confirm·webhook·0원 신청 prepare) · 미리 보기 · 관리자 [자동 제작 다시]
  // ──────────────────────────────────────────────
  outputFileTracingIncludes: {
    "/api/partner/pay/confirm": ["./assets/banner-fonts/**/*"],
    "/api/partner/pay/webhook": ["./assets/banner-fonts/**/*"],
    "/api/partner/pay/prepare": ["./assets/banner-fonts/**/*"],
    "/api/partner/banner-preview": ["./assets/banner-fonts/**/*"],
    "/api/admin/ads": ["./assets/banner-fonts/**/*"],
    // 게재 전 문구 고치기 → 다시 그리기(2026년 11월 24일)
    "/api/partner/orders/[id]/brief": ["./assets/banner-fonts/**/*"],
  },
  // 그리기와 무관한데 결제 코드(pay.ts)를 함께 불러 글꼴이 따라 실리던 경로에서 글꼴을 뺀다(2026년 11월 24일 검사 L11).
  //   이 경로들은 환불·결제 실패 기록·관리자 화면이라 배너를 그리지 않는다(그리기 코드는 pay.ts 가 필요할 때만 불러옴).
  outputFileTracingExcludes: {
    "/api/partner/pay/fail": NO_DRAW,
    "/api/partner/pay/refund": NO_DRAW,
    "/api/admin/advertisers": NO_DRAW,
    "/api/admin/advertisers/[id]": NO_DRAW,
    "/admin": NO_DRAW,
    "/admin/advertisers": NO_DRAW,
  },

  // ──────────────────────────────────────────────
  // 옛 계산기 주소(/v1, /v1/calc/*) → 새 주소(/calc, /calc/*) 영구 이전 (2026-09-11)
  //
  // /v1 밑에 있던 계산기 허브가 본서비스로 승격되면서 주소가 /calc 로 바뀌었다.
  // 예전 링크(블로그 옛 글, 카카오톡 공유, 즐겨찾기 등)가 죽지 않도록
  // 308(영구 이동, 301과 동등 — Next.js가 permanent: true 일 때 실제로 보내는 상태코드는 308이다)로
  // 자동으로 새 주소로 보내준다.
  //
  // 쿼리스트링(예: 공유 링크 ?d=eyJt...)은 destination에 :path* 같은 와일드카드만 있고
  // 쿼리를 따로 안 적어도, Next.js가 목적지에서 안 쓴 쿼리값을 자동으로 그대로 붙여준다
  // (Next.js redirects 공식 동작 — destination이 소비하지 않은 쿼리는 자동 유지).
  // 그래서 /v1/calc/wallpaper?d=abc → /calc/wallpaper?d=abc 로 쿼리까지 그대로 넘어간다.
  async redirects() {
    return [
      // 블로그 중복 글 합치기(2026-10-28): 없앤 글의 옛 주소 → 남긴 글 (영구 이동)
      { source: "/blog/same-size-price-gap-reason", destination: "/blog/interior-cost-difference", permanent: true },
      { source: "/blog/exposed-vs-embedded-wiring-cost", destination: "/blog/outlet-add-embedded-vs-exposed-cost", permanent: true },
      { source: "/blog/system-aircon-vs-wall-aircon-cost", destination: "/blog/system-aircon-vs-wall-stand-comparison", permanent: true },
      { source: "/blog/electrical-panel-breaker-capacity-upgrade-cost", destination: "/blog/electrical-panel-breaker-upgrade-cost", permanent: true },
      {
        // 옛 허브 홈 (정확히 /v1 인 경우만)
        source: "/v1",
        destination: "/calc",
        permanent: true,
      },
      {
        // 옛 계산기·결과 페이지 전부 (/v1/calc/wallpaper, /v1/calc/flooring/result 등)
        //
        // ⚠️ 순서 중요: 아래에 있는 일반 규칙("/v1/:path*")보다 반드시 먼저 와야 한다.
        // Next.js는 배열을 위에서부터 읽어 먼저 맞는 규칙 하나만 적용한다. 만약 이 규칙이
        // 일반 규칙보다 뒤에 있으면 /v1/calc/wallpaper 가 일반 규칙에 먼저 걸려서
        // /calc/calc/wallpaper (calc가 두 번 겹친 잘못된 주소)로 가버린다.
        source: "/v1/calc/:path*",
        destination: "/calc/:path*",
        permanent: true,
      },
      {
        // 위 계산기 전용 규칙에 안 걸린 나머지 /v1/* 전부 (예: /v1/login, /v1/price, /v1/q)
        // → 똑같이 /calc 밑으로 옮긴다. 반드시 위 계산기 규칙 다음에 와야 한다(이유는 위 주석 참고).
        source: "/v1/:path*",
        destination: "/calc/:path*",
        permanent: true,
      },
      {
        // 로그인·가입 화면은 /calc 밑에 따로 두지 않고 루트(/login) 화면을 그대로 쓰기로 했다
        // (2026-09-11 검사관 지적 — /calc/login, /calc/signup 폴더 삭제).
        //
        // 이 규칙은 위의 "/v1/:path*" 규칙과 무관하게 따로 동작한다(source가 겹치지 않는다).
        // 그래서 /v1/login 처럼 옛 주소로 들어와도: /v1/login → (위 규칙) /calc/login →
        // (이 규칙) /login 순서로 리다이렉트가 두 번 연달아 일어나 결국 /login 에 도착한다
        // (브라우저가 리다이렉트를 자동으로 따라가므로 사용자 눈에는 문제없다).
        source: "/calc/login",
        destination: "/login",
        permanent: true,
      },
      {
        // 루트에는 별도 회원가입 화면이 없다(카카오 로그인이 가입을 겸한다) → 로그인 화면으로 보낸다
        source: "/calc/signup",
        destination: "/login",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
