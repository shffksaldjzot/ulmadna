"use client";
// 블로그 글 외부 공유 버튼 — 카카오톡 + 모바일 기본공유(Web Share) + 링크복사 + X + 페이스북
import { useEffect, useState } from "react";

// 카카오 SDK 최소 타입 (window.Kakao)
type KakaoSDK = {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share?: {
    sendDefault: (settings: Record<string, unknown>) => void;
  };
};
declare global {
  interface Window {
    Kakao?: KakaoSDK;
  }
}

export function ShareButtons({
  url,
  title,
  description,
  image,
}: {
  url: string;
  title: string;
  description?: string;
  image?: string; // 절대 URL (카카오 공유 카드 썸네일용)
}) {
  // 모바일 등 navigator.share 지원 기기에서만 "공유" 버튼 노출
  const [canNativeShare, setCanNativeShare] = useState(false);
  // 카카오 SDK 초기화 완료 시에만 카톡 버튼 노출
  const [kakaoReady, setKakaoReady] = useState(false);
  // 링크복사 눌렀을 때 "복사됨!" 잠깐 표시
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);

    // 카카오 JS SDK 로드 + 초기화 (키는 공개용 NEXT_PUBLIC)
    const KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!KEY) return;
    const init = () => {
      try {
        if (window.Kakao && !window.Kakao.isInitialized()) window.Kakao.init(KEY);
        if (window.Kakao?.isInitialized()) setKakaoReady(true);
      } catch {
        /* 초기화 실패 시 카톡 버튼만 숨김 */
      }
    };
    if (window.Kakao) {
      init();
      return;
    }
    // SDK 스크립트가 아직 없으면 주입
    const existing = document.getElementById("kakao-sdk");
    if (existing) {
      existing.addEventListener("load", init);
      return;
    }
    const s = document.createElement("script");
    s.id = "kakao-sdk";
    s.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    s.crossOrigin = "anonymous";
    s.onload = init;
    document.head.appendChild(s);
  }, []);

  // 카카오톡 공유 (피드 카드: 제목·설명·썸네일·링크)
  const onKakao = () => {
    if (!window.Kakao?.Share) return;
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title,
        description: description || "",
        imageUrl: image || "",
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [
        { title: "글 보러가기", link: { mobileWebUrl: url, webUrl: url } },
      ],
    });
  };

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
        {kakaoReady && (
          <button type="button" className="blog-share-btn kakao" onClick={onKakao} aria-label="카카오톡으로 공유">
            <span aria-hidden>💬</span> 카카오톡
          </button>
        )}
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
