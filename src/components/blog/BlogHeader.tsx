// 블로그 헤더 — 로고(홈) + 견적 계산기 / 블로그
import Link from "next/link";

export function BlogHeader() {
  return (
    <header className="hdr">
      <div className="wrap hdr-in">
        <a href="/" className="logo-link" aria-label="얼마드나 홈">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ulmadna_logo.png" alt="얼마드나" className="logo-img" />
        </a>
        <div className="hdr-right">
          <Link href="/" className="hdr-nav">견적 계산기</Link>
          <Link href="/blog" className="hdr-nav">블로그</Link>
        </div>
      </div>
    </header>
  );
}
