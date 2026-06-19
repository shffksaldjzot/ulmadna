"use client";
// 블로그 글 외부 공유 버튼 — 모바일 기본공유(Web Share) + 링크복사 + X + 페이스북
// 카카오톡 전용 공유는 추후(카카오 JS SDK 셋업 필요). 모바일 기본공유에 카톡이 떠서 당장은 충분.
import { useEffect, useState } from "react";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  // 모바일 등 navigator.share 지원 기기에서만 "공유" 버튼 노출
  const [canNativeShare, setCanNativeShare] = useState(false);
  // 링크복사 눌렀을 때 "복사됨!" 잠깐 표시
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  // 모바일 기본 공유창(카톡·쓰레드·인스타 등 폰에 깔린 앱으로 공유)
  const onNativeShare = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      /* 사용자가 취소하면 무시 */
    }
  };

  // 링크 복사
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 클립보드 차단 환경이면 무시 */
    }
  };

  // X(트위터)·페이스북 공유 URL
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  return (
    <div className="blog-share">
      <span className="blog-share-label">이 글 공유하기</span>
      <div className="blog-share-btns">
        {canNativeShare && (
          <button type="button" className="blog-share-btn" onClick={onNativeShare} aria-label="공유">
            <span aria-hidden>📤</span> 공유
          </button>
        )}
        <button type="button" className="blog-share-btn" onClick={onCopy} aria-label="링크 복사">
          <span aria-hidden>🔗</span> {copied ? "복사됨!" : "링크 복사"}
        </button>
        <a
          className="blog-share-btn"
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="X에 공유"
        >
          <span aria-hidden>𝕏</span> X
        </a>
        <a
          className="blog-share-btn"
          href={fbUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="페이스북에 공유"
        >
          <span aria-hidden>f</span> 페이스북
        </a>
      </div>
    </div>
  );
}
