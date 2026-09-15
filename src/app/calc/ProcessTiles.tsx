// ──────────────────────────────────────────────
// 살아 있는 계산기 카드 — 홈(/)과 계산기 허브(/calc)가 같이 쓴다.
//
// 2026-09-15 형아 지시(디자인 통일 작업 A): 예전엔 공정 10개를 작은 타일로 나열해서
// 실제로 쓸 수 있는 3개(도배·미장·바닥재)와 준비 중 7개가 똑같은 무게로 보였다.
// 그래서 "지금 쓸 수 있는 것"만 크게 카드로 보여주고, 나머지는 회색 안내 한 줄로 뺐다.
// ──────────────────────────────────────────────

import Link from 'next/link';

/** 실제로 열려 있는 계산기 3개 — 카드로 크게 보여준다 */
const LIVE_CALCULATORS = [
  { name: '도배', href: '/calc/wallpaper', desc: '벽지 롤수와 비용' },
  { name: '미장', href: '/calc/mortar', desc: '레미탈 포대수와 비용' },
  { name: '바닥재', href: '/calc/flooring', desc: '바닥재 수량과 비용' },
];

/** 아직 없는 공정 — 칸을 만들지 않고 회색 한 줄로만 안내 */
const COMING_SOON = ['조적', '방수', '커튼', '샷시', '욕실', '주방', '전기'];

export default function ProcessTiles() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="t-section text-ink">공정별 물량 계산기</h2>

      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="공정별 계산기">
        {LIVE_CALCULATORS.map((calc) => (
          <li key={calc.name}>
            <Link
              href={calc.href}
              className="flex flex-col gap-1 h-full rounded-card border border-line bg-surface px-5 py-4 hover:border-accent transition-colors"
            >
              <span className="t-body font-bold text-ink">{calc.name}</span>
              <span className="t-sub text-ink-2">{calc.desc}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="t-sub text-ink-2">준비 중: {COMING_SOON.join(' · ')}</p>
    </section>
  );
}
