// ──────────────────────────────────────────────
// 물어보기 — 짧은 알림(토스트)
//
// 어디서든 showAskToast('저장했어요') 를 부르면 화면 아래쪽에 1.8초 동안 뜬다.
// 부품끼리 연결선 없이 브라우저 이벤트(ask-toast) 하나로 주고받는다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';

/** 알림 띄우기 — 다른 부품에서 부른다 */
export function showAskToast(message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('ask-toast', { detail: message }));
}

export default function AskToast() {
  const [msg, setMsg] = useState('');
  const [on, setOn] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onToast = (e: Event) => {
      setMsg(String((e as CustomEvent).detail ?? ''));
      setOn(true);
      clearTimeout(timer);
      timer = setTimeout(() => setOn(false), 1800);
    };
    window.addEventListener('ask-toast', onToast);
    return () => {
      window.removeEventListener('ask-toast', onToast);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className={`ask-toast${on ? ' on' : ''}`} role="status" aria-live="polite">
      {msg}
    </div>
  );
}
