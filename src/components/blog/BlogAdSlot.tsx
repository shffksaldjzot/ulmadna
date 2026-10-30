// ─────────────────────────────────────────────────────────────
// 블로그 글 화면용 광고 자리 감싸개 — 2026년 10월 29일
//
// [무슨 기능인가]
//   공용 광고 자리 부품(AdSlot)을 블로그 글 안에 넣을 때 한 겹 감싼다.
//   - 광고 전역 스위치(ADS_ENABLED)가 꺼져 있고 주소에 ?ad_preview= 도 없으면 아무것도 그리지 않는다.
//     (AD-R 은 광고가 켜졌을 때 자체 광고(House Ad)로 채우는 자리라, 스위치가 꺼진 동안
//      블로그 방문자에게 무엇이든 보이는 일이 없도록 여기서 한 번 더 막는다. AdSlot 자체는 손대지 않는다.)
//   - ?ad_preview=all(관리자 자리 표시 모드)·?ad_preview=<주문번호>(배너 미리보기)일 때만 AdSlot 에 넘긴다.
//     관리자 확인·미리보기 판정은 AdSlot 안에서 서버에 물어 처리한다.
//   - process 가 없는 AD-P 는 그리지 않고, 표시 모드(관리자)에서만 "AD-P 없음" 한 줄을 보여 준다.
//   - AD-T(토탈 인테리어 스폰서, 2026-10-29): 공정 판정이 "토탈"인 총론 글의 본문 중간 자리.
// ─────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import AdSlot from '@/components/ads/AdSlot';
import { ADS_ENABLED } from '@/lib/ads/config';
import { useAdMapMode } from '@/lib/ads/useServedAd';

/** 주소에 ?ad_preview= 가 붙어 있는지(값 종류는 AdSlot 이 따로 판단) */
function hasPreviewQuery(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('ad_preview');
  } catch {
    return false;
  }
}

interface BlogAdSlotProps {
  /** 광고 자리 종류 — 공정 스폰서(AD-P)·토탈 인테리어 스폰서(AD-T, 총론 글)·본문 끝 큰 자리(AD-R)·글 맨 위 띠(AD-H)·글 맨 아래 띠(AD-F, 2026-10-30) */
  id: 'AD-P' | 'AD-T' | 'AD-R' | 'AD-H' | 'AD-F';
  /** AD-P 전용 — 이 글의 공정 묶음 라벨(없으면 null) */
  process?: string | null;
}

export function BlogAdSlot({ id, process }: BlogAdSlotProps) {
  // 처음 그릴 때(서버 그림과 맞추려고)는 항상 false → 화면에 붙은 뒤 주소를 보고 정한다
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    setPreview(hasPreviewQuery());
  }, []);

  // 광고 스위치 꺼짐 + 미리보기 아님 → 일반 방문자: 아무것도 없음
  if (!ADS_ENABLED && !preview) return null;

  // 공정이 없는 글의 AD-P → 관리자 표시 모드에서만 안내 한 줄
  if (id === 'AD-P' && !process) return <NoProcessNote />;

  if (id === 'AD-P') return <AdSlot id="AD-P" processGroup={process!} adPPageIndex={0} />;
  return <AdSlot id={id} />;
}

/** 공정 미판정 글 — 관리자 표시 모드(?ad_preview=all)에서만 보이는 한 줄 */
function NoProcessNote() {
  const mapMode = useAdMapMode();
  if (!mapMode) return null;
  return (
    <div
      data-ad-kind="map-none"
      style={{ margin: '12px auto', maxWidth: 320, fontSize: 12, color: '#9a3412', textAlign: 'center', border: '1px dashed #fdba74', borderRadius: 6, padding: 6 }}
    >
      AD-P 없음(공정 미판정)
    </div>
  );
}
