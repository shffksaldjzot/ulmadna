// ──────────────────────────────────────────────
// v1 허브 — 공정별 물량 계산기 타일 (2026-09-09 형아 지시: 롤백 전 홈 히어로를 /calc 에 보여주기)
//
// 원래 베타 홈(src/app/page.tsx) 히어로에 넣었다가 롤백한 화면을 그대로 옮겨 왔다.
// 도배·바닥재만 열려 있고 나머지는 회색 "준비 중"(클릭 불가). 모바일 3열 → PC 5열.
// 순서는 개발 예정 순서(미장 → 조적 → 방수 → 커튼 → 바닥재 → 샷시 → 욕실 → 주방 → 전기).
// 2026-09-10: 바닥재 계산기(U 지시서) 완성으로 href 추가
// ──────────────────────────────────────────────

/** href 가 있으면 열린 계산기, 없으면 회색 "준비 중" 타일 */
const PROCESS_TILES: { name: string; href?: string }[] = [
  { name: '도배', href: '/calc/wallpaper' },
  { name: '미장' },
  { name: '조적' },
  { name: '방수' },
  { name: '커튼' },
  { name: '바닥재', href: '/calc/flooring' },
  { name: '샷시' },
  { name: '욕실' },
  { name: '주방' },
  { name: '전기' },
];

export default function ProcessTiles() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[20px] font-bold text-foreground">공정별 물량 계산기</h2>
      <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2" aria-label="공정별 계산기">
        {PROCESS_TILES.map((tile) =>
          tile.href ? (
            <li key={tile.name}>
              <a
                href={tile.href}
                className="flex flex-col items-center justify-center h-16 rounded-xl border border-gold/60 bg-white text-brown text-sm font-semibold hover:bg-v1-card-soft transition-colors"
              >
                {tile.name}
                <span className="text-[10px] font-medium text-gold mt-0.5">지금 계산</span>
              </a>
            </li>
          ) : (
            <li key={tile.name}>
              <div
                aria-disabled="true"
                className="flex flex-col items-center justify-center h-16 rounded-xl border border-gray-200 bg-gray-100 text-gray-400 text-sm font-medium cursor-not-allowed select-none"
              >
                {tile.name}
                <span className="text-[10px] mt-0.5">준비 중</span>
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
