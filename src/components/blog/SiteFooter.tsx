// 블로그 푸터 — 동시 접속자 + 링크/면책
import Link from "next/link";
import { LiveVisitors } from "./LiveVisitors";

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="wrap site-foot-in">
        <div className="site-foot-live">
          <LiveVisitors />
        </div>
        <nav className="site-foot-nav">
          <Link href="/">견적 계산기</Link>
          <Link href="/blog">블로그</Link>
          <Link href="/about">소개</Link>
          <Link href="/contact">문의</Link>
          <Link href="/privacy">개인정보처리방침</Link>
          {/* RSS 구독 — 새 글 알림을 받아보는 표준 주소 */}
          <a href="/feed.xml" className="site-foot-rss" aria-label="RSS 구독">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="19" r="2.6" />
              <path d="M3 10.6v3.1a7.3 7.3 0 0 1 7.3 7.3h3.1A10.4 10.4 0 0 0 3 10.6z" />
              <path d="M3 3v3.1c8.2 0 14.9 6.7 14.9 14.9H21C21 11.1 12.9 3 3 3z" />
            </svg>
            RSS
          </a>
        </nav>
        <p className="site-foot-note">
          얼마드나는 실제 견적 데이터 기반의 참고용 예상 견적이에요. 실제 계약가는 현장·자재에 따라
          달라질 수 있어요.
        </p>
      </div>
    </footer>
  );
}
