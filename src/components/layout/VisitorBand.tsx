// ──────────────────────────────────────────────
// 방문자 띠 — 상단바 바로 아래 한 줄 "전체 123,456 · 오늘 1,234"
//
// [형아 결정 2026-10-30] 네이버 블로그 위젯처럼 모든 페이지 상단에 방문자 수를 보여 준다.
//   숫자는 GA4 실제 방문자(/api/visitors, 서버 1시간 캐시). 설명글 없이 라벨 "전체·오늘" 과 숫자만.
//
// [레이아웃 밀림 방지] 숫자를 받기 전에도 띠 높이(26px)를 미리 잡아 둔다 → 숫자가 들어와도 아래가 안 밀림.
//   GA 실패·0명이면 띠를 통째로 접는다(빈 자리 없음). 실패는 드문 경우라 그때만 한 번 접힌다.
// [호출 줄이기] 페이지를 옮겨 다녀도 같은 탭 안에서는 한 번 받은 숫자를 재사용(아래 memo).
// [위치] 상단바(sticky) 밖, 바로 아래에 둔다 — 스크롤하면 같이 올라가 사라지고,
//   계산기 제목 줄(TopNav, sticky top-14)의 위치 계산도 흔들지 않는다.
// ──────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import Container from './Container';

/** 서버가 주는 모양 — 실패면 total 이 null */
type Counts = { total: number; today: number };

/** 'loading' = 받는 중(높이만 잡음) · null = 실패(띠 숨김) · 숫자 = 표시 */
type State = 'loading' | Counts | null;

/** 같은 탭 안에서 한 번 받은 결과를 기억(페이지 이동 때마다 다시 안 부르게) */
let memo: Promise<Counts | null> | null = null;

/** /api/visitors 를 한 번만 부르고, 이상한 응답은 null(=숨김)로 바꾼다 */
function loadCounts(): Promise<Counts | null> {
  if (!memo) {
    memo = fetch('/api/visitors')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { total?: unknown; today?: unknown } | null) =>
        d && typeof d.total === 'number' && d.total > 0 && typeof d.today === 'number'
          ? { total: d.total, today: d.today }
          : null,
      )
      .catch(() => {
        memo = null; // 네트워크 실패면 다음 페이지에서 다시 시도
        return null;
      });
  }
  return memo;
}

/** 123456 → "123,456" (한국식 천 단위 쉼표) */
const fmt = (n: number) => n.toLocaleString('ko-KR');

export default function VisitorBand() {
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    let alive = true; // 화면을 떠난 뒤 늦게 온 응답은 무시
    loadCounts().then((c) => alive && setState(c));
    return () => {
      alive = false;
    };
  }, []);

  // 실패·0명 → 띠 자체를 안 그림
  if (state === null) return null;

  return (
    <div className="bg-bg border-b border-line" aria-label="방문자 수">
      {/* 높이 26px 고정 — 받는 중에도 같은 높이라 밀림 없음. 오른쪽 정렬(상단바 로그인 버튼 아래 줄) */}
      <Container className="h-[26px] flex items-center justify-end">
        {state !== 'loading' && (
          <p className="text-[12px] leading-none text-ink-2 whitespace-nowrap tabular-nums">
            전체 <span className="font-semibold text-ink">{fmt(state.total)}</span>
            <span className="mx-1.5 text-ink-2/50" aria-hidden>·</span>
            오늘 <span className="font-semibold text-accent">{fmt(state.today)}</span>
          </p>
        )}
      </Container>
    </div>
  );
}
