// ──────────────────────────────────────────────
// 물어보기 — 질문 카드 한 장 (목록·내 질문 화면 공용)
//
// 시안 index.html 의 .q 카드 그대로:
//   배지(AI 답변 / 답변 준비 중) · 종류 · 공정 → 제목 → 답 한 줄 → 닉네임 · 시각 · 댓글 수
// 상태(state)가 없는 부품이라 서버·브라우저 어디서든 그릴 수 있다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import Link from 'next/link';
import { KIND_LABEL, type AskListItem } from '@/lib/ask/constants';
import { askHref, timeAgo } from '@/lib/ask/format';
import { IcBubble } from './icons';

export default function AskCard({ item, hideNick = false, extraTag }: { item: AskListItem; hideNick?: boolean; extraTag?: string }) {
  const answered = item.status === 'answered';
  return (
    <Link className="q" href={askHref(item.slug)}>
      <div className="tags">
        {answered ? <span className="tag ans">AI 답변</span> : <span className="tag wait">답변 준비 중</span>}
        <span className="tag">{KIND_LABEL[item.kind]}</span>
        {item.trades.length > 0 && <span className="tag">{item.trades.join(' · ')}</span>}
        {extraTag && <span className="tag mine">{extraTag}</span>}
      </div>
      <div className="ttl">
        {item.title}
        {item.photoCount > 0 ? ` (사진 ${item.photoCount}장)` : ''}
      </div>
      {answered && item.summary && <div className="prev">답변: {item.summary}</div>}
      <div className="meta">
        {!hideNick && (
          <>
            <span className="nick">{item.nickname}</span>
            <span>·</span>
          </>
        )}
        {/* "12분 전"은 서버가 그린 시각과 브라우저 시각이 조금 달라도 경고를 내지 않게 */}
        <span suppressHydrationWarning>{timeAgo(item.created_at)}</span>
        {item.comment_count > 0 && (
          <span className="cm" aria-label={`댓글 ${item.comment_count}개`}>
            <IcBubble />
            {item.comment_count}
          </span>
        )}
      </div>
    </Link>
  );
}
