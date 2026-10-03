// ──────────────────────────────────────────────
// 물어보기 — 내 질문 화면 내용
//
// 탭 두 개: 내 질문(서버에서 내 글만) · 저장한 질문(이 브라우저에 저장한 것)
// 머리 줄에 내 닉네임 + [이름 바꾸기]. 로그인 안 했으면 로그인 화면으로.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import type { AskListItem } from '@/lib/ask/constants';
import { askHref, timeAgo } from '@/lib/ask/format';
import AskCard from './AskCard';
import { readSaved, type SavedAsk } from './saved';

export default function AskMyClient() {
  const { status } = useSession();
  const [tab, setTab] = useState<'mine' | 'saved'>('mine');
  const [nick, setNick] = useState<string | null>(null);
  const [mine, setMine] = useState<AskListItem[] | null>(null); // null = 불러오는 중
  const [saved, setSaved] = useState<SavedAsk[]>([]);

  useEffect(() => {
    // 저장 목록은 브라우저 저장소에 있어 화면이 뜬 뒤에 읽는다(서버 그림과 어긋나지 않게 한 박자 뒤)
    void Promise.resolve().then(() => setSaved(readSaved()));
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      window.location.replace(`/login?callbackUrl=${encodeURIComponent('/ask/my')}`);
      return;
    }
    // 닉네임과 내 질문을 같이 받는다
    fetch('/api/ask/profile', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { nickname?: string | null }) => setNick(d.nickname ?? null))
      .catch(() => {});
    fetch('/api/ask/posts?mine=1', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: AskListItem[] }) => setMine(d.items ?? []))
      .catch(() => setMine([]));
  }, [status]);

  return (
    <main className="app">
      <div className="bhead">
        <div className="eyebrow">얼마드나 물어보기</div>
        <h1 className="t-page">내 질문</h1>
        <p className="lead">
          {nick ? `${nick} · ` : ''}카카오 로그인 ·{' '}
          <Link href="/ask/nickname?next=/ask/my" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            {nick ? '이름 바꾸기' : '이름 정하기'}
          </Link>
        </p>
      </div>

      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
          내 질문{mine ? ` ${mine.length}` : ''}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'saved'} className={tab === 'saved' ? 'on' : ''} onClick={() => setTab('saved')}>
          저장한 질문 {saved.length}
        </button>
      </div>

      {tab === 'mine' ? (
        mine === null ? (
          <div className="empty">불러오는 중…</div>
        ) : mine.length === 0 ? (
          <div className="empty">
            <b>아직 올린 질문이 없어요</b>
            <Link href="/ask/new" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              질문하기
            </Link>
          </div>
        ) : (
          <div className="list">
            {mine.map((it) => (
              <AskCard key={it.id} item={it} hideNick extraTag={it.status === 'hidden' ? '숨김' : undefined} />
            ))}
          </div>
        )
      ) : saved.length === 0 ? (
        <div className="empty">
          <b>아직 저장한 질문이 없어요</b>질문 화면의 저장을 누르면 여기에 모여요
        </div>
      ) : (
        <div className="list">
          {saved.map((s) => (
            <Link key={s.slug} className="q" href={askHref(s.slug)}>
              <div className="ttl">{s.title}</div>
              <div className="meta">
                <span>{timeAgo(new Date(s.at).toISOString())} 저장</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <aside className="aside" />
    </main>
  );
}
