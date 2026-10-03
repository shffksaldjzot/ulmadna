// ──────────────────────────────────────────────
// 물어보기 상세 — 답변 평가 줄 ("AI가 쓴 답이에요 · 참고용" + 도움 됐어요 / 틀렸어요)
//
// 로그인해야 누를 수 있다(한 사람이 한 번). 로그인 안 했으면 로그인 화면으로 보낸다.
// 고른 값은 이 브라우저에도 기억해서 다시 열었을 때 단추가 켜져 보이게 한다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { showAskToast } from './AskToast';

type Kind = 'helpful' | 'wrong';
const memKey = (id: number) => `ulm_ask_fb_${id}`;

export default function AskFeedback({ answerId, helpful }: { answerId: number; helpful: number }) {
  const { status } = useSession();
  const [picked, setPicked] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(false);

  // 예전에 누른 값 기억해 두기(이 브라우저에서만)
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(memKey(answerId));
      if (v === 'helpful' || v === 'wrong') setPicked(v);
    } catch {
      /* 저장소 막힘 — 무시 */
    }
  }, [answerId]);

  async function send(kind: Kind) {
    if (status !== 'authenticated') {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/ask/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerId, kind }),
      });
      if (!r.ok) throw new Error();
      setPicked(kind);
      try {
        window.localStorage.setItem(memKey(answerId), kind);
      } catch {
        /* 무시 */
      }
      showAskToast(kind === 'helpful' ? '고마워요' : '알려 주셔서 고마워요 · 밤에 다시 확인해요');
    } catch {
      showAskToast('저장하지 못했어요');
    } finally {
      setBusy(false);
    }
  }

  // 화면의 "도움 됐어요 N" 숫자 — 방금 내가 눌렀으면 1 더해서 보여 준다(서버 숫자는 60초 뒤 반영)
  const shownHelpful = helpful + (picked === 'helpful' ? 1 : 0);

  return (
    <div className="help">
      <span>AI가 쓴 답이에요 · 참고용 · 현장 실측 뒤 확정</span>
      <span className="btns">
        <button type="button" className={picked === 'helpful' ? 'on' : ''} onClick={() => send('helpful')} aria-pressed={picked === 'helpful'}>
          도움 됐어요{shownHelpful > 0 ? ` ${shownHelpful}` : ''}
        </button>
        <button type="button" className={picked === 'wrong' ? 'on' : ''} onClick={() => send('wrong')} aria-pressed={picked === 'wrong'}>
          틀렸어요
        </button>
      </span>
    </div>
  );
}
