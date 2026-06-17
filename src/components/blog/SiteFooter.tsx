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
        </nav>
        <p className="site-foot-note">
          얼마드나는 실제 견적 데이터 기반의 참고용 예상 견적이에요. 실제 계약가는 현장·자재에 따라
          달라질 수 있어요.
        </p>
      </div>
    </footer>
  );
}
