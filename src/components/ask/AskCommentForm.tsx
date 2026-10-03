// ──────────────────────────────────────────────
// 물어보기 상세 — "이어서 물어보기" 입력줄 (시안 post.html .write)
//
// 로그인 안 했으면: 누르는 순간 카카오 로그인 화면으로(돌아올 곳=이 질문).
// 닉네임이 없으면: 닉네임 정하는 화면으로.
// 보내면 화면을 새로 받아(router.refresh) 내 댓글이 바로 보이게 한다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { showAskToast } from './AskToast';
import { LIMITS } from '@/lib/ask/constants';

export default function AskCommentForm({ postId }: { postId: number }) {
  const { status } = useSession();
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  /** 로그인 화면으로(돌아올 곳 = 지금 질문) */
  function goLogin() {
    window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status !== 'authenticated') return goLogin();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/ask/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, body }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; needNickname?: boolean };
      if (d.needNickname) {
        window.location.href = `/ask/nickname?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!r.ok) throw new Error(d.error || '댓글을 올리지 못했어요');
      setText('');
      showAskToast('올렸어요 · AI가 이어서 답해요');
      router.refresh();
    } catch (err) {
      showAskToast(err instanceof Error ? err.message : '댓글을 올리지 못했어요');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="write" onSubmit={onSubmit}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => {
          // 로그인 안 했으면 칸을 누르는 순간 안내
          if (status === 'unauthenticated') showAskToast('카카오 로그인이 필요해요');
        }}
        maxLength={LIMITS.commentMax}
        placeholder={status === 'authenticated' ? '이어서 물어보기' : '이어서 물어보기 · 로그인 필요'}
        aria-label="이어서 물어보기"
      />
      <button type="submit" disabled={busy}>
        {status === 'authenticated' ? '보내기' : '로그인'}
      </button>
    </form>
  );
}
