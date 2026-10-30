'use client';
// ─────────────────────────────────────────────────────────────
// 견본 스타일 고르기 — 2026-10-30
//   스타일 8종 썸네일(320x100)을 가로로 밀어 보며 하나를 고른다. 다시 누르면 해제(= 맡김).
//   제작 대행 신청 마법사와 광고주 카드 [내용 고치기]가 같이 쓴다.
// ─────────────────────────────────────────────────────────────
import { BANNER_STYLES, styleImg } from '@/lib/ads/bannerStyles';

export default function StylePicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <div>
      {/* 가로 스크롤 줄: 카드 폭 180px, 눌렀을 때 테두리로 표시 */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="radiogroup" aria-label="배너 스타일">
        {BANNER_STYLES.map((s) => {
          const on = value === s.key;
          return (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? '' : s.key)}
              className={`w-[180px] shrink-0 rounded-xl border p-2 text-left ${on ? 'border-accent ring-2 ring-accent' : 'border-line'} bg-surface`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={styleImg(s.key, '320x100')} alt={`${s.name} 견본`} width={160} height={50} loading="lazy" className="block h-auto w-full rounded-md" />
              <span className="mt-1.5 block text-[14px] font-semibold text-ink">{s.name}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[13px] text-ink-2">
        {value ? BANNER_STYLES.find((s) => s.key === value)?.desc : '안 골라도 돼요 · 맡기면 어울리게 만들어 드려요'}
      </p>
    </div>
  );
}
