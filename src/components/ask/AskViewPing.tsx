// ──────────────────────────────────────────────
// 물어보기 상세 — 조회수 세기(화면엔 아무것도 안 그림)
//
// 같은 탭에서 새로 고침할 때마다 올라가지 않게, 이 탭에서 한 번 센 질문은 기억해 둔다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useEffect } from 'react';

export default function AskViewPing({ id }: { id: number }) {
  useEffect(() => {
    const key = `ulm_ask_v_${id}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      /* 저장소 막힘 — 그냥 한 번 센다 */
    }
    fetch('/api/ask/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      keepalive: true,
    }).catch(() => {});
  }, [id]);
  return null;
}
