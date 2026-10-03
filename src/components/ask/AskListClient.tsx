// ──────────────────────────────────────────────
// 물어보기 목록 — 검색 · 칩 · 카드 목록 · 더 보기 (브라우저에서 움직이는 부분)
//
// - 첫 20개는 서버가 그려서 넘겨준다(검색에 잡히게 HTML에 그대로 들어감).
// - 검색: 지금 불러온 질문 안에서 제목·답 한 줄·공정을 글자로 거른다(서버 안 부름).
// - 칩: "전체"면 서버가 준 첫 목록, 종류·공정 칩이면 API에서 그 조건 첫 쪽을 새로 받는다.
// - 더 보기: 마지막 질문 번호(커서) 다음 20개를 API로 받아 뒤에 붙인다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useMemo, useState } from 'react';
import { LIST_TRADES, type AskListItem } from '@/lib/ask/constants';
import AskCard from './AskCard';
import { IcSearch } from './icons';

/** 칩 하나 — 이름과 API 조건 */
interface ChipDef {
  label: string;
  kind?: 'estimate' | 'cost';
  trade?: string;
}
const CHIPS: ChipDef[] = [
  { label: '전체' },
  { label: '견적서 봐주세요', kind: 'estimate' },
  { label: '비용 질문', kind: 'cost' },
  ...LIST_TRADES.map((t) => ({ label: t, trade: t })),
];

export default function AskListClient({
  initialItems,
  initialNext,
  total,
}: {
  initialItems: AskListItem[];
  initialNext: number | null;
  total: number;
}) {
  const [chip, setChip] = useState(0); // 고른 칩 번호
  const [items, setItems] = useState(initialItems);
  const [next, setNext] = useState<number | null>(initialNext);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  /** API에서 한 쪽 받아오기 */
  async function fetchPage(def: ChipDef, cursor: number | null) {
    const sp = new URLSearchParams();
    if (cursor) sp.set('cursor', String(cursor));
    if (def.kind) sp.set('kind', def.kind);
    if (def.trade) sp.set('trade', def.trade);
    const r = await fetch(`/api/ask/posts?${sp.toString()}`);
    if (!r.ok) return { items: [] as AskListItem[], next: null };
    return (await r.json()) as { items: AskListItem[]; next: number | null };
  }

  /** 칩 누름 — 전체면 처음 목록으로, 아니면 그 조건으로 새로 받기 */
  async function pickChip(i: number) {
    if (i === chip) return;
    setChip(i);
    if (i === 0) {
      setItems(initialItems);
      setNext(initialNext);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchPage(CHIPS[i], null);
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
      const res = await fetchPage(CHIPS[chip], next);
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
      <div className="chips" role="tablist" aria-label="질문 고르기">
        {CHIPS.map((c, i) => (
          <button key={c.label} type="button" role="tab" aria-selected={i === chip} className={`chip${i === chip ? ' on' : ''}`} onClick={() => pickChip(i)}>
            {c.label}
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
          {loading ? (
            '불러오는 중…'
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
          {chip === 0 && total > 0 && (
            <span className="n">
              {items.length} / {total.toLocaleString()}
            </span>
          )}
        </button>
      )}
    </>
  );
}
