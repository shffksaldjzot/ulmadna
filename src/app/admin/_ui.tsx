// ──────────────────────────────────────────────
// 관리자 화면 공용 조각 — 2026-10-28
//
// [무슨 기능인가]
//   카드 틀·큰 숫자·기간 칩·가로 막대 목록·일별 막대·"읽지 못함" 안내를 한곳에 모았다.
//   서버 컴포넌트(상태 없음)라 어느 화면에서든 그대로 쓴다. 강조색은 하나(--accent)만 쓴다.
// ──────────────────────────────────────────────
import Link from 'next/link';
import type { Counted } from '@/server/admin/format';

/** 숫자 → 천 단위 쉼표. 못 읽었으면 "-" */
export function fmt(n: number | null | undefined): string {
  return typeof n === 'number' ? n.toLocaleString('ko-KR') : '-';
}

/** 화면 맨 위 제목 + 한 줄 설명 */
export function PageHead({ title, note, right }: { title: string; note?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
      </div>
      {right}
    </div>
  );
}

/** 카드 한 장 틀 */
export function Card({ title, children, right }: { title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 min-w-0">
      {(title || right) && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/** 큰 숫자 + 이름 한 칸 */
export function Stat({ label, value, sub }: { label: string; value: number | null | undefined; sub?: string }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-xl font-bold text-brown tabular-nums">{fmt(value)}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

/** 기간 선택 칩. 주소의 ?d= 값을 바꾼다 */
export function RangeChips({ base, days, options = [7, 28, 90] }: { base: string; days: number; options?: number[] }) {
  return (
    <div className="flex gap-1.5">
      {options.map((d) => (
        <Link
          key={d}
          href={`${base}?d=${d}`}
          className={`px-3 py-1 rounded-full text-xs border ${
            d === days ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
          }`}
        >
          {d}일
        </Link>
      ))}
    </div>
  );
}

/** 읽지 못했을 때 안내(연결 안 됨·표 없음) */
export function Unavailable({ children }: { children?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-dashed border-gray-300 text-sm text-gray-500">
      {children ?? '자료를 읽지 못했어요. Supabase 연결을 확인해 주세요.'}
    </div>
  );
}

/** 가로 막대 목록: 이름 · 막대 · 숫자(+비율) */
export function BarList({ items, name, empty = '아직 쌓인 자료가 없어요' }: { items: Counted[]; name?: (k: string) => string; empty?: string }) {
  if (items.length === 0) return <p className="text-sm text-gray-400">{empty}</p>;
  const max = Math.max(...items.map((i) => i.n), 1);
  const total = items.reduce((s, i) => s + i.n, 0) || 1;
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-2 text-sm">
          <span className="w-16 sm:w-20 shrink-0 truncate text-gray-600">{name ? name(i.key) : i.key}</span>
          <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(2, (i.n / max) * 100)}%` }} />
          </span>
          <span className="w-20 shrink-0 text-right tabular-nums text-gray-500 text-xs">
            {fmt(i.n)} <span className="text-gray-300">{Math.round((i.n / total) * 100)}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 일별 세로 막대(날짜 오래된 순). 28일 넘으면 라벨은 몇 개만 */
export function DayBars({ data }: { data: { day: string; n: number }[] }) {
  const max = Math.max(...data.map((d) => d.n), 1);
  const step = Math.ceil(data.length / 6);
  return (
    <div>
      <div className="flex items-end gap-px h-28">
        {data.map((d) => (
          <div key={d.day} className="flex-1 min-w-0 flex flex-col justify-end h-full" title={`${d.day} · ${d.n.toLocaleString('ko-KR')}`}>
            <div className="w-full rounded-t-sm bg-[var(--accent)]" style={{ height: `${d.n === 0 ? 1 : Math.max(3, (d.n / max) * 100)}%`, opacity: d.n === 0 ? 0.2 : 1 }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        {data.filter((_, i) => i % step === 0).map((d) => (
          <span key={d.day}>{d.day.slice(5)}</span>
        ))}
      </div>
    </div>
  );
}

/** 표 머리글 칸 */
export function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`py-2 px-2 text-[11px] font-medium text-gray-400 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
}
