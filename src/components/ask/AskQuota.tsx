// ──────────────────────────────────────────────
// 물어보기 — 오늘 남은 질문 표시 + 질문하기 단추 잠금 (형아 결정 2026년 10월 03일)
//
// 제한: 사이트 전체 하루 10개 선착순 · 회원당 하루 질문 1개 · 회원당 하루 댓글 3개 (한국 자정 기준)
// useAskQuota(): /api/ask/quota 를 한 번 불러 여러 부품이 같이 쓴다.
// <AskQuotaLine/>: 본문 크기 한 줄 "오늘 남은 질문 7개 · 00:00에 다시 10개"(숫자 강조색)
//                  전체 마감이면 "오늘 접수 마감 · 내일 00:00까지 n시간 n분"(1분마다 갱신)
//                  아래 작은 글자: 로그인 뒤 "오늘 내 질문 1개 남음" / 로그인 전 "로그인하면 하루 1개 물어볼 수 있어요"
// <AskAskButton/>: 질문하기 단추 — 전체 마감이거나 내 몫을 다 쓰면 눌리지 않는 회색 단추
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { untilText } from '@/lib/ask/quota';

export interface Quota {
  loggedIn: boolean;
  globalLimit: number;
  globalLeft: number;
  limit: number;
  left: number | null;
  commentLimit: number;
  commentLeft: number | null;
  canAsk: boolean;
  blocked: 'global' | 'user' | null;
  resetAt: string;
}

// 같은 화면에서 여러 부품이 불러도 요청은 한 번만
let shared: Promise<Quota | null> | null = null;
function loadQuota(): Promise<Quota | null> {
  if (!shared) {
    shared = fetch('/api/ask/quota', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Quota>) : null))
      .catch(() => null);
  }
  return shared;
}

/** 남은 수 불러오기(로그인 상태가 바뀌면 다시) — refreshKey가 바뀌어도 다시 */
export function useAskQuota(refreshKey = 0): Quota | null {
  const { status } = useSession();
  const [q, setQ] = useState<Quota | null>(null);
  useEffect(() => {
    if (status === 'loading') return;
    shared = null;
    let alive = true;
    loadQuota().then((d) => alive && setQ(d));
    return () => {
      alive = false;
    };
  }, [status, refreshKey]);
  return q;
}

/** 자정까지 "n시간 n분" — 1분마다 갱신(on일 때만 시계가 돈다) */
function useCountdown(resetAt: string | undefined, on: boolean): string {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!on) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 60 * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [on]);
  return on && resetAt && now != null ? untilText(resetAt, now) : '';
}

/** 남은 질문 한 줄(+ 내 몫 작은 글자) */
export function AskQuotaLine({ quota }: { quota: Quota | null }) {
  const globalZero = !!quota && quota.globalLeft === 0;
  const userZero = !!quota?.loggedIn && quota.left === 0;
  const countdown = useCountdown(quota?.resetAt, globalZero || userZero);
  if (!quota) return null;
  return (
    <div className="ask-quota" role="status">
      <p className="main">
        {globalZero ? (
          <>
            <b>오늘 접수 마감</b> · 내일 00:00까지 {countdown || '…'}
          </>
        ) : (
          <>
            오늘 남은 질문 <b>{quota.globalLeft}개</b> · 00:00에 다시 {quota.globalLimit}개
          </>
        )}
      </p>
      <p className="mine">
        {!quota.loggedIn
          ? `로그인하면 하루 ${quota.limit}개 물어볼 수 있어요`
          : userZero
            ? `오늘 내 질문은 다 썼어요 · 내일 00:00까지 ${countdown || '…'}`
            : `오늘 내 질문 ${quota.left}개 남음`}
      </p>
    </div>
  );
}

/** 질문하기 단추 — 막혔으면 눌리지 않는 회색 */
export function AskAskButton({ quota, className, children }: { quota: Quota | null; className: string; children: ReactNode }) {
  const locked = !!quota && (quota.globalLeft === 0 || (quota.loggedIn && quota.left === 0));
  if (locked)
    return (
      <span className={`${className} is-off`} aria-disabled="true" role="link">
        {children}
      </span>
    );
  return (
    <Link className={className} href="/ask/new">
      {children}
    </Link>
  );
}

/** 막혔는지(질문 올리기 단추 잠금용) */
export function quotaLocked(q: Quota | null): boolean {
  return !!q && (q.globalLeft === 0 || (q.loggedIn && q.left === 0));
}
