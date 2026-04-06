import type { Metadata } from "next";
import "./globals.css";
import Analytics from "@/components/layout/Analytics";

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
    images: [{ url: "/og-icon.png", width: 512, height: 512 }],
    locale: "ko_KR",
    type: "website",
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
        {children}
        <Analytics />
      </body>
    </html>
  );
}
