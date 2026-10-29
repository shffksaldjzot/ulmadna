"use client";
// ──────────────────────────────────────────────
// 글 상단 대표 이미지
//
// 1) width/height(원본 픽셀)를 박아서 그림이 오기 전에도 자리가 미리 잡힌다
//    → 그림이 뜰 때 제목 아래 본문이 밀려 내려가는 흔들림(CLS)이 없어진다.
// 2) 일부러 "클라이언트 컴포넌트"로 뺐다.
//    서버 컴포넌트에 <img>를 두면, 다른 화면이 이 글로 가는 링크를 미리 읽을(prefetch) 때
//    그 응답에 "이 그림 미리 받아라" 힌트가 같이 실려 와서, 목록 한 번 열면 수백 장의
//    대표 이미지를 몰래 받아오고 있었다(측정: 목록 데스크톱 약 35MB).
//    클라이언트 컴포넌트 안의 그림은 미리 읽기 응답에 실리지 않는다.
//    (이 글을 직접 열 때는 서버가 만든 HTML 에 그대로 있어서 빨리 뜨는 건 같다)
//
// 작성일: 2026년 10월 29일 (폴리싱 묶음 C)
// ──────────────────────────────────────────────

export function BlogCover({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}) {
  return (
    <div className="blog-post-cover">
      {/* 첫 화면에 보이는 큰 그림이라 lazy 를 안 붙이고 먼저 받게(fetchPriority high) 한다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={width} height={height} fetchPriority="high" decoding="async" />
    </div>
  );
}
