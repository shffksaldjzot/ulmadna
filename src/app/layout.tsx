import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/layout/AuthProvider";

// env 값에 줄바꿈/공백이 붙는 경우가 있어 trim (GA ID 깨짐 방지)
const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();
// Vercel Web Analytics — 방문자 경로(유입 채널/페이지/디바이스) 추적용. GA와 별도로 동작
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "얼마드나 — 무료 인테리어 견적 계산기 | 회원가입 없이 바로 사용",
  description: "평형, 자재 등급, 공정만 선택하면 인테리어 예상 견적이 바로 나옵니다. 회원가입·전화번호 입력 없이 완전 무료.",
  keywords: "인테리어 견적, 인테리어 비용, 리모델링 비용, 평당 가격, 인테리어 얼마",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "얼마드나 — 무료 인테리어 견적 계산기",
    description: "회원가입·전화번호 없이 바로 사용. 평형·자재·공정 선택하면 예상 견적이 나와요.",
    url: "https://ulmadna.com",
    siteName: "얼마드나",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    locale: "ko_KR",
    type: "website",
  },
  // 구글 서치콘솔 'HTML 태그' 인증용. 토큰은 어차피 HTML에 공개되는 값이라 직접 명시
  // (env로 덮어쓰기도 가능). 메타태그 <meta name="google-site-verification" ...> 자동 생성.
  verification: {
    google:
      process.env.GOOGLE_SITE_VERIFICATION?.trim() ||
      "WaSjktLgL1zVR7K_nLqxT1-QjgC2V9wZgj9Z29bdkLg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col" style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <AuthProvider>
          {children}
        </AuthProvider>
        {/* GA4 — 순수 script 태그(브라우저 즉시 실행). next/script afterInteractive가
            인라인 실행 안 하는 문제 회피. React 19가 script 호이스팅 지원. */}
        {GA_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`,
              }}
            />
          </>
        )}
        {/* Google AdSense 로더 — 사이트 소유권 확인 + 광고 게재 토대.
            Auto Ads는 AdSense 대시보드에서 ON, 수동 광고단위는 AdsenseUnit 컴포넌트로. */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9736248258361709"
          crossOrigin="anonymous"
        />
        {/* Vercel Web Analytics — 유입 경로 추적용 */}
        <VercelAnalytics />
      </body>
    </html>
  );
}
