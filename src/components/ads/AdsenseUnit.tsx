"use client";
// 애드센스 디스플레이 광고 단위 (반응형). slot 없으면 렌더 안 함(안전).
import { useEffect } from "react";
import { ADSENSE_CLIENT } from "@/lib/ads/adsense";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// format: "auto"(가로 디스플레이) | "autorelaxed"(멀티플렉스 그리드) | "fluid"(인아티클 네이티브)
// layout: fluid 인아티클이면 "in-article" 전달
export function AdsenseUnit({
  slot,
  className = "",
  format = "auto",
  layout,
}: {
  slot?: string;
  className?: string;
  format?: "auto" | "autorelaxed" | "fluid";
  layout?: string;
}) {
  useEffect(() => {
    if (!slot) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* 무시 */
    }
  }, [slot]);

  if (!slot) return null;

  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={{ display: "block", ...(format === "fluid" ? { textAlign: "center" as const } : {}) }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      {...(layout ? { "data-ad-layout": layout } : {})}
      {...(format === "auto" ? { "data-full-width-responsive": "true" } : {})}
    />
  );
}
