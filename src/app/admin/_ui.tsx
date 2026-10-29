// ──────────────────────────────────────────────
// 관리자 화면 공용 조각 — 2026-10-28 (2026-10-30 막대 차트·호버 반응 보강)
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

/** 카드 한 장 틀 — 마우스를 올리면 테두리가 살짝 진해지고 아주 옅은 그림자 */
export function Card({ title, children, right }: { title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 min-w-0 transition-[border-color,box-shadow] duration-150 hover:border-gray-200 hover:shadow-[0_1px_4px_rgba(92,58,30,0.06)]">
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
            d === days
              ? 'bg-[var(--accent)] text-white border-[var(--accent)] hover:bg-[var(--accent-press)]'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800'
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

/** 가로 막대 목록: 이름 · 막대 · 숫자(+비율)
 *  - 막대 두께 10px, 금색(--gold) 한 색. 마우스를 올린 줄은 바탕이 옅어지고 막대가 진해진다.
 *  - 막대 길이는 가장 큰 값을 꽉 찬 길이(100%)로 놓고 비례해서 그린다. */
export function BarList({ items, name, empty = '아직 쌓인 자료가 없어요' }: { items: Counted[]; name?: (k: string) => string; empty?: string }) {
  if (items.length === 0) return <p className="text-sm text-gray-400">{empty}</p>;
  const max = Math.max(...items.map((i) => i.n), 1);
  const total = items.reduce((s, i) => s + i.n, 0) || 1;
  return (
    <ul className="-mx-2">
      {items.map((i) => {
        const label = name ? name(i.key) : i.key;
        const pct = Math.round((i.n / total) * 100);
        return (
          <li
            key={i.key}
            className="group flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-[#faf6f0]"
            title={`${label} · ${fmt(i.n)} (${pct}%)`}
          >
            {/* 항목 이름 */}
            <span className="w-16 sm:w-24 shrink-0 truncate text-gray-600 transition-colors duration-150 group-hover:text-gray-900">{label}</span>
            {/* 막대(바탕 회색 줄 위에 갈색 막대) */}
            <span className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <span
                className="block h-full rounded-full bg-gold transition-colors duration-150 group-hover:bg-brown"
                style={{ width: `${Math.max(2, (i.n / max) * 100)}%` }}
              />
            </span>
            {/* 숫자 + 비율 */}
            <span className="w-20 shrink-0 text-right tabular-nums text-xs text-gray-500 transition-colors duration-150 group-hover:text-gray-900">
              {fmt(i.n)} <span className="text-gray-300 group-hover:text-gray-500">{pct}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** 세로축 최댓값을 보기 좋은 숫자(1·2·4·6·8·10 × 10의 거듭제곱)로 올린다. 반값 눈금이 정수가 되게 최소 2 */
function niceMax(m: number): number {
  if (m <= 2) return 2;
  const pow = Math.pow(10, Math.floor(Math.log10(m)));
  for (const f of [1, 2, 4, 6, 8, 10]) if (f * pow >= m) return f * pow;
  return 10 * pow;
}

/** 요일 한 글자(일~토) */
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
/** 'YYYY-MM-DD' → 요일. 날짜 글자만 보고 계산하므로 서버 시간대와 무관 */
function weekdayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return '';
  return WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** 일별 세로 막대(날짜 오래된 순)
 *  - 차트 높이 176px, 세로축은 0부터 시작하고 눈금선 3개(0·반값·최댓값)를 깐다.
 *  - 막대는 칸을 꽉 채우되 너비는 최대 36px 로 묶어 자료가 적어도 뭉툭하지 않게.
 *  - 최댓값 막대와 마지막(최근) 막대 위에만 숫자를 늘 띄우고, 나머지는 마우스를 올리면
 *    "10-29 · 37건" 말풍선이 뜬다. 키보드 Tab 으로도 막대를 하나씩 옮겨 볼 수 있다.
 *  - 아래 날짜 줄: 7일 이하면 매일(요일 포함), 14일 이하 2일마다, 31일 이하 7일마다, 그 이상 14일마다.
 *    늘 마지막 날(오늘 쪽)을 기준으로 거꾸로 세어 찍는다. */
export function DayBars({ data, unit = '건' }: { data: { day: string; n: number }[]; unit?: string }) {
  if (data.length === 0) return <p className="text-sm text-gray-400">아직 쌓인 자료가 없어요</p>;
  const realMax = Math.max(...data.map((d) => d.n), 0); // 실제 가장 큰 값
  const top = niceMax(realMax); // 세로축 꼭대기(보기 좋은 숫자)
  const ticks = [top, top / 2, 0]; // 눈금 3개
  const len = data.length;
  const step = len <= 7 ? 1 : len <= 14 ? 2 : len <= 31 ? 7 : 14; // 날짜 글자 간격
  const maxIdx = data.findIndex((d) => d.n === realMax); // 최댓값 막대 위치
  const showDow = len <= 7; // 7일 이하면 요일도 표시
  // 막대 사이 간격: 자료가 많으면 1px, 적으면 넉넉히
  const gap = len > 45 ? 'gap-px' : len > 20 ? 'gap-0.5' : 'gap-1.5 sm:gap-3';

  return (
    <div className="flex gap-2">
      {/* 세로축 숫자(눈금 3개) */}
      <div className="relative w-8 shrink-0 h-44 text-[10px] text-gray-400 tabular-nums" aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 leading-none translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
            {fmt(t)}
          </span>
        ))}
      </div>

      <div className="flex-1 min-w-0">
        {/* 막대 그림 영역 */}
        <div className="relative h-44">
          {/* 눈금선: 0 은 실선, 나머지는 옅은 점선 */}
          {ticks.map((t) => (
            <div
              key={t}
              className={`absolute inset-x-0 border-t ${t === 0 ? 'border-gray-200' : 'border-dashed border-gray-100'}`}
              style={{ bottom: `${(t / top) * 100}%` }}
              aria-hidden
            />
          ))}
          <div className={`relative flex items-end h-full ${gap}`} role="list" aria-label="일별 막대">
            {data.map((d, i) => {
              const h = d.n === 0 ? 0 : Math.max(1.5, (d.n / top) * 100); // 막대 높이(%)
              const pinned = d.n > 0 && (i === maxIdx || i === len - 1); // 늘 숫자를 띄우는 막대
              // 말풍선이 카드 밖으로 안 나가게: 앞쪽 막대는 왼쪽 맞춤, 뒤쪽은 오른쪽 맞춤
              const tipPos = i < len * 0.2 ? 'left-0' : i >= len * 0.8 ? 'right-0' : 'left-1/2 -translate-x-1/2';
              return (
                <div
                  key={d.day}
                  role="listitem"
                  tabIndex={0}
                  data-daybar
                  aria-label={`${d.day.slice(5)} ${fmt(d.n)}${unit}`}
                  className="group relative flex-1 min-w-0 h-full flex flex-col justify-end items-center outline-none cursor-default"
                >
                  {/* 마우스를 올리면 칸 전체가 옅게 깔려 어느 날을 보는지 보인다 */}
                  <div
                    className="absolute inset-0 rounded-sm transition-colors duration-150 group-hover:bg-[#faf6f0] group-focus-visible:bg-[#faf6f0]"
                    aria-hidden
                  />
                  {/* 막대 본체 */}
                  <div
                    className={`relative w-full max-w-9 rounded-t-[3px] transition-colors duration-150 ${
                      d.n === 0 ? 'bg-gold/30' : 'bg-gold group-hover:bg-brown group-focus-visible:bg-brown'
                    }`}
                    style={{ height: d.n === 0 ? '2px' : `${h}%` }}
                  >
                    {/* 늘 보이는 숫자(최댓값·최근) — 말풍선이 뜨면 숨긴다 */}
                    {pinned && (
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-[10px] font-semibold text-brown tabular-nums whitespace-nowrap group-hover:invisible group-focus-visible:invisible">
                        {fmt(d.n)}
                      </span>
                    )}
                    {/* 말풍선: 마우스를 올렸거나 키보드 초점일 때만 */}
                    <span
                      className={`pointer-events-none absolute bottom-full mb-1.5 z-10 hidden group-hover:block group-focus-visible:block whitespace-nowrap rounded-md bg-brown px-2 py-1 text-[11px] text-cream tabular-nums shadow-sm ${tipPos}`}
                    >
                      {d.day.slice(5)}
                      {showDow && ` (${weekdayOf(d.day)})`} · <b className="font-semibold">{fmt(d.n)}</b>
                      {unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 날짜 줄: 막대와 같은 칸 나눔이라 글자가 막대 바로 아래에 온다 */}
        <div className={`flex ${gap} mt-1.5 text-[10px] text-gray-400 tabular-nums`} aria-hidden>
          {data.map((d, i) => {
            const show = (len - 1 - i) % step === 0; // 마지막 날부터 거꾸로 step 칸마다
            return (
              <div key={d.day} className="flex-1 min-w-0 flex justify-center whitespace-nowrap">
                {show && (
                  <span className={`text-center ${i === len - 1 ? 'text-gray-600' : ''}`}>
                    {d.day.slice(5)}
                    {showDow && <span className="block text-gray-300">{weekdayOf(d.day)}</span>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 표 머리글 칸 */
export function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`py-2 px-2 text-[11px] font-medium text-gray-400 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
}
