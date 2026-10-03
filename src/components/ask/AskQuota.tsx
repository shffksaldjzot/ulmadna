// ──────────────────────────────────────────────
// 물어보기 — 오늘 남은 질문 수 한 줄 + 0개일 때 자정까지 카운트다운
//
// useAskQuota(): /api/ask/quota 를 불러 남은 수·자정 시각을 들고 있는다(여러 부품이 같이 씀).
// <AskQuotaLine/>: "오늘 남은 질문 2개 · 자정(00:00)에 다시 3개"
//                  0개면 "내일 00:00까지 n시간 n분"(1분마다 갱신)
//                  로그인 전이면 "로그인하면 하루 3개까지 물어볼 수 있어요"
// <AskAskButton/>: 질문하기 단추 — 남은 수가 0이면 눌리지 않게(회색) 바뀐다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

export interface Quota {
  loggedIn: boolean;
  limit: number;
  left?: number;
  resetAt: string;
}

// 같은 화면 안에서 여러 부품이 불러도 한 번만 요청하게 모아 둔다
let shared: Promise<Quota | null> | null = null;
function loadQuota(): Promise<Quota | null> {
  if (!shared) {
    shared = fetch('/api/ask/quota', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Quota>) : null))
      .catch(() => null);
  }
  return shared;
}

/** 남은 질문 수 불러오기(로그인 상태가 바뀌면 다시) */
export function useAskQuota(): Quota | null {
  const { status } = useSession();
  const [q, setQ] = useState<Quota | null>(null);
  useEffect(() => {
    if (status === 'loading') return;
    shared = null; // 로그인 상태가 바뀌었을 수 있으니 새로
    let alive = true;
    loadQuota().then((d) => alive && setQ(d));
    return () => {
      alive = false;
    };
  }, [status]);
  return q;
}

/** 지금부터 자정까지 "n시간 n분" — 1분마다 갱신 */
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
  if (!on || !resetAt || now == null) return '';
  const ms = Math.max(0, Date.parse(resetAt) - now);
  const h = Math.floor(ms / 3600000);
  const m = Math.ceil((ms % 3600000) / 60000);
  return m === 60 ? `${h + 1}시간 0분` : `${h}시간 ${m}분`;
}

/** 남은 질문 한 줄 */
export function AskQuotaLine({ quota, className = '' }: { quota: Quota | null; className?: string }) {
  const zero = !!quota?.loggedIn && quota.left === 0;
  const countdown = useCountdown(quota?.resetAt, zero);
  if (!quota) return null;
  let body: ReactNode;
  if (!quota.loggedIn) body = <>로그인하면 하루 {quota.limit}개까지 물어볼 수 있어요</>;
  else if (zero) body = <>오늘 질문을 다 썼어요 · 내일 00:00까지 <b>{countdown || '…'}</b></>;
  else
    body = (
      <>
        오늘 남은 질문 <b>{quota.left}개</b> · 자정(00:00)에 다시 {quota.limit}개
      </>
    );
  return (
    <p className={`ask-quota ${className}`} role="status">
      {body}
    </p>
  );
}

/** 질문하기 단추 — 0개면 비활성(누를 수 없는 회색 단추) */
export function AskAskButton({ quota, className, children }: { quota: Quota | null; className: string; children: ReactNode }) {
  const zero = !!quota?.loggedIn && quota.left === 0;
  if (zero)
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
