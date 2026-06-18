"use client";
// 애드센스 디스플레이 광고 단위 (반응형). slot 없으면 렌더 안 함(안전).
import { useEffect } from "react";
import { ADSENSE_CLIENT } from "@/lib/ads/adsense";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdsenseUnit({ slot, className = "" }: { slot?: string; className?: string }) {
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
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
