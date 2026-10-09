// ──────────────────────────────────────────────
// 물어보기 목록 — 검색 · 칩 · 카드 목록 · 더 보기 (브라우저에서 움직이는 부분)
//
// - 첫 20개는 서버가 그려서 넘겨준다(검색에 잡히게 HTML에 그대로 들어감).
// - 검색: 지금 불러온 질문 안에서 제목·답 한 줄·공정을 글자로 거른다(서버 안 부름).
// - 칩: "전체"면 서버가 준 첫 목록, 종류·공정 칩이면 API에서 그 조건 첫 쪽을 새로 받는다.
// - 더 보기: 마지막 질문 번호(커서) 다음 20개를 API로 받아 뒤에 붙인다.
// - 서버가 빈 목록을 넘겨주면 그대로 믿지 않고 브라우저에서 한 번 더 읽어 본다.
//   (2026-10-10 수리) 서버 그림은 60초 캐시라, 배포 직후나 DB 연결이 잠깐 끊겼을 때 그린
//   "빈 목록" 그림이 첫 손님에게 나갈 수 있다. 첫 손님이 폰이면 "폰에서만 질문이 없다"로 보였다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ASK_CATEGORIES, LIST_TRADES, type AskCategory, type AskListItem } from '@/lib/ask/constants';
import AskCard from './AskCard';
import { IcSearch } from './icons';

/**
 * 필터 두 줄 (형아 지시 2026년 10월 03일 — 네이버 카페식 말머리)
 *   첫째 줄: 전체 + 말머리(ASK_CATEGORIES — constants.ts 에 한 줄 더하면 칩도 자동으로 늘어남)
 *   둘째 줄: 공정(누르면 켜짐, 다시 누르면 꺼짐)
 * 둘 다 안 골랐으면 서버가 처음 그려 준 목록을 그대로 쓴다.
 */
type CatKey = AskCategory | null;

export default function AskListClient({
  initialItems,
  initialNext,
  total,
}: {
  initialItems: AskListItem[];
  initialNext: number | null;
  total: number;
}) {
  const [cat, setCat] = useState<CatKey>(null); // 고른 말머리(null=전체)
  const [trade, setTrade] = useState<string | null>(null); // 고른 공정(null=전체)
  // 기본 목록("전체"일 때 보여 줄 첫 쪽) — 처음엔 서버가 준 것, 다시 읽어 오면 그걸로 바뀐다
  const [base, setBase] = useState({ items: initialItems, next: initialNext });
  const [items, setItems] = useState(initialItems);
  const [next, setNext] = useState<number | null>(initialNext);
  const [loading, setLoading] = useState(false);
  // 서버가 빈 목록을 줬을 때 "진짜 0건인지" 다시 확인하는 중이면 true (그동안 "질문이 없어요" 대신 "불러오는 중…")
  const [checking, setChecking] = useState(initialItems.length === 0);
  // 다시 읽기마저 실패했으면 true — "질문이 없어요"(거짓말) 대신 "못 불러왔어요"를 보인다
  const [loadFailed, setLoadFailed] = useState(false);
  const [q, setQ] = useState('');
  // 지금 칩(말머리·공정)으로 거르는 중인지 — 다시 읽기 응답이 늦게 와도 거른 화면을 덮지 않게
  const filtering = useRef(false);

  /** API에서 한 쪽 받아오기 — 실패(서버 오류·연결 끊김)면 null */
  async function fetchPage(c: CatKey, t: string | null, cursor: number | null) {
    const sp = new URLSearchParams();
    if (cursor) sp.set('cursor', String(cursor));
    if (c) sp.set('category', c);
    if (t) sp.set('trade', t);
    try {
      const r = await fetch(`/api/ask/posts?${sp.toString()}`);
      if (!r.ok) return null;
      return (await r.json()) as { items: AskListItem[]; next: number | null };
    } catch {
      return null;
    }
  }

  // 서버가 빈 목록을 줬으면 브라우저에서 첫 쪽을 한 번 더 읽는다(빈 캐시 그림 대비).
  // 읽어 온 게 있으면 그걸로 바꾸고, 진짜 0건이거나 실패면 그대로 둔다.
  useEffect(() => {
    if (initialItems.length > 0) return;
    let alive = true; // 화면을 떠난 뒤 도착한 응답은 버린다
    fetchPage(null, null, null).then((res) => {
      if (!alive) return;
      if (res && res.items.length > 0) {
        setBase({ items: res.items, next: res.next });
        // 그사이 사람이 칩을 눌렀으면(거르는 중) 지금 화면은 건드리지 않는다
        if (!filtering.current) {
          setItems(res.items);
          setNext(res.next);
        }
      }
      if (!res) setLoadFailed(true);
      setChecking(false);
    });
    return () => {
      alive = false;
    };
    // 처음 한 번만 — 서버가 준 첫 목록 기준
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 필터 바꾸기 — 둘 다 비면 처음 목록으로, 아니면 그 조건 첫 쪽을 새로 받기 */
  async function applyFilter(c: CatKey, t: string | null) {
    setCat(c);
    setTrade(t);
    filtering.current = !!(c || t);
    if (!c && !t) {
      setItems(base.items);
      setNext(base.next);
      return;
    }
    setLoading(true);
    try {
      const res = (await fetchPage(c, t, null)) ?? { items: [], next: null };
      setItems(res.items);
      setNext(res.next);
    } finally {
      setLoading(false);
    }
  }

  /** 더 보기 */
  async function loadMore() {
    if (!next || loading) return;
    setLoading(true);
    try {
      const res = await fetchPage(cat, trade, next);
      if (!res) return; // 실패면 있던 목록 그대로(더 보기 단추도 그대로 남아 다시 누를 수 있음)
      setItems((prev) => [...prev, ...res.items.filter((x) => !prev.some((p) => p.id === x.id))]);
      setNext(res.next);
    } finally {
      setLoading(false);
    }
  }

  // 검색어로 거르기 — 띄어쓰기 무시하고 제목·답 한 줄·공정에서 찾는다
  const shown = useMemo(() => {
    const needle = q.replace(/\s+/g, '').toLowerCase();
    if (!needle) return items;
    return items.filter((it) =>
      [it.title, it.summary ?? '', it.trades.join('')].join('').replace(/\s+/g, '').toLowerCase().includes(needle),
    );
  }, [items, q]);

  return (
    <>
      <label className="search">
        <IcSearch />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="34평 실크 도배 얼마…" aria-label="질문 검색" />
      </label>
      {/* 첫째 줄: 전체 + 말머리 */}
      <div className="chips" role="tablist" aria-label="말머리">
        <button type="button" role="tab" aria-selected={cat === null} className={`chip${cat === null ? ' on' : ''}`} onClick={() => applyFilter(null, trade)}>
          전체
        </button>
        {ASK_CATEGORIES.map((c) => (
          <button key={c.key} type="button" role="tab" aria-selected={cat === c.key} className={`chip${cat === c.key ? ' on' : ''}`} onClick={() => applyFilter(c.key, trade)}>
            {c.label}
          </button>
        ))}
      </div>
      {/* 둘째 줄: 공정(작은 칩, 다시 누르면 꺼짐) */}
      <div className="chips chips-sub" aria-label="공정">
        {LIST_TRADES.map((t) => (
          <button key={t} type="button" aria-pressed={trade === t} className={`chip sm${trade === t ? ' sel' : ''}`} onClick={() => applyFilter(cat, trade === t ? null : t)}>
            {t}
          </button>
        ))}
      </div>

      {shown.length > 0 ? (
        <div className="list">
          {shown.map((it) => (
            <AskCard key={it.id} item={it} />
          ))}
        </div>
      ) : (
        <div className="empty">
          {loading || (checking && !cat && !trade) ? (
            '불러오는 중…'
          ) : loadFailed && !cat && !trade && !q ? (
            <>
              <b>목록을 불러오지 못했어요</b>잠시 뒤 새로고침해 주세요
            </>
          ) : q ? (
            <>
              <b>찾는 질문이 아직 없어요</b>직접 물어보면 5~10분 뒤 답이 와요
            </>
          ) : (
            <>
              <b>아직 질문이 없어요</b>첫 질문을 올려 보세요
            </>
          )}
        </div>
      )}

      {next && !q && (
        <button type="button" className="more" onClick={loadMore} disabled={loading}>
          {loading ? '불러오는 중…' : '더 보기'}{' '}
          {!cat && !trade && total > 0 && (
            <span className="n">
              {items.length} / {total.toLocaleString()}
            </span>
          )}
        </button>
      )}
    </>
  );
}
