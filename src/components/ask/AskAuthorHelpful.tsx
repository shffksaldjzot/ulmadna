// ──────────────────────────────────────────────
// 물어보기 상세 - 글쓴이 본인 전용 "도움됐어요 / 아쉬워요" 두 단추
//
// 서버 화면이 글쓴이 본인일 때만 이 컴포넌트를 그린다(다른 사람에겐 아예 안 나옴).
// 한 번 고른 뒤에도 다른 쪽을 눌러 바꿀 수 있다. 단추 모양은 기존 평가 줄(.help)과 같다.
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────
'use client';

import { useState } from 'react';
import { showAskToast } from './AskToast';

export default function AskAuthorHelpful({ answerId, initial }: { answerId: number; initial: boolean | null }) {
  // 현재 고른 값: true=도움됐어요, false=아쉬워요, null=안 고름
  const [picked, setPicked] = useState<boolean | null>(initial);
  const [busy, setBusy] = useState(false);

  /** 고른 값을 서버에 저장 */
  async function send(value: boolean) {
    if (busy || picked === value) return;
    setBusy(true);
    try {
      const r = await fetch('/api/ask/helpful', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerId, helpful: value }),
      });
      if (!r.ok) throw new Error();
      setPicked(value);
    } catch {
      showAskToast('저장하지 못했어요');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="help">
      <span className="btns" style={{ marginLeft: 0 }}>
        <button type="button" className={picked === true ? 'on' : ''} onClick={() => send(true)} aria-pressed={picked === true}>
          도움됐어요
        </button>
        <button type="button" className={picked === false ? 'on' : ''} onClick={() => send(false)} aria-pressed={picked === false}>
          아쉬워요
        </button>
      </span>
    </div>
  );
}
