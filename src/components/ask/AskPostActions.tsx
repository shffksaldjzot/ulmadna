// ──────────────────────────────────────────────
// 물어보기 상세 — 저장 · 공유 · 신고 단추 줄 (시안 post.html .acts)
//
// 저장: 이 브라우저에 보관(내 질문 화면 "저장한 질문"에 모임)
// 공유: 휴대폰이면 공유 창, 아니면 주소 복사
// 신고: 한 번 확인 뒤 /api/ask/report 로 보냄(글 상태는 그대로)
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import { showAskToast } from './AskToast';
import { isSaved, toggleSaved } from './saved';
import { IcBookmark, IcShare } from './icons';

export default function AskPostActions({ postId, slug, title }: { postId: number; slug: string; title: string }) {
  const [saved, setSaved] = useState(false);
  const [reported, setReported] = useState(false);

  // 화면이 열리면 저장 여부를 브라우저 저장소에서 읽어 단추 색을 맞춘다
  useEffect(() => {
    setSaved(isSaved(slug));
  }, [slug]);

  function onSave() {
    const now = toggleSaved(slug, title);
    setSaved(now);
    showAskToast(now ? '저장했어요' : '저장을 뺐어요');
  }

  async function onShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showAskToast('링크를 복사했어요');
    } catch {
      /* 공유 창을 닫은 경우 등 — 아무것도 안 함 */
    }
  }

  async function onReport() {
    if (reported) {
      showAskToast('이미 신고했어요');
      return;
    }
    if (!window.confirm('이 질문을 신고할까요?')) return;
    try {
      const r = await fetch('/api/ask/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      if (!r.ok) throw new Error();
      setReported(true);
      showAskToast('신고를 받았어요');
    } catch {
      showAskToast('신고를 보내지 못했어요');
    }
  }

  return (
    <div className="acts">
      <button type="button" className={saved ? 'on' : ''} onClick={onSave} aria-label={saved ? '저장 빼기' : '저장'} aria-pressed={saved}>
        <IcBookmark />
      </button>
      <button type="button" onClick={onShare} aria-label="공유">
        <IcShare />
      </button>
      <button type="button" className="txt" onClick={onReport}>
        신고
      </button>
    </div>
  );
}
