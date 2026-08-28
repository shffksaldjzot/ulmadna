// 엔진 검증 스크립트 — 실행: npx tsx src/app/v3/test-engine.ts
import { calculateEstimate } from './engine/calculator';
import { calculateQuantity } from './data/quantity';
import { formatPrice } from './engine/formatter';
import type { GradeKey, BayKey } from './data/types';

const grades: GradeKey[] = ['economy', 'standard', 'premium'];
const areas = [59, 74, 84];

// ── 1) 기존 검증: 타입 × 등급 총액 ──
console.log('━━━━━━━━━━ 1. 타입 × 등급 (기본 3Bay·3+알파·확장) ━━━━━━━━━━\n');
for (const area of areas) {
  for (const grade of grades) {
    const r = calculateEstimate(area, grade);
    console.log(`=== ${area}㎡ ${grade.toUpperCase()} ===`);
    console.log(`총액: ${formatPrice(r.grandTotal)} (공사비 ${formatPrice(r.subtotal)} + 예비비 ${formatPrice(r.contingency)})`);
    const enabled = r.processes.filter(p => p.enabled).sort((a, b) => b.total - a.total);
    for (const p of enabled) {
      const items = p.items?.map(i => `${i.name}(${formatPrice(i.total)})`).join(' + ') || '';
      console.log(`  ${p.processName}: ${formatPrice(p.total)}${items ? ' ← ' + items : ''}`);
    }
    const off = r.processes.filter(p => !p.enabled).map(p => p.processName);
    if (off.length > 0) console.log(`  [OFF] ${off.join(', ')}`);
    console.log('');
  }
}

// ── 2) 신규 검증: Bay가 물량·견적을 움직이는가 (84㎡ 중급) ──
console.log('━━━━━━━━━━ 2. Bay별 변동 검증 (84㎡ 중급) ━━━━━━━━━━\n');
console.log('Bay | 창호개소 창호면적 | 도배합계 걸레받이 | 샷시견적 | 총액');
for (const bay of ['2', '3', '4'] as BayKey[]) {
  const q = calculateQuantity(84, { bay });
  const r = calculateEstimate(84, 'standard', { bay });
  const win = r.processes.find(p => p.processId === 'window');
  console.log(
    `${bay}Bay | ${q.quantities.windows}개소 ${q.quantities.window_area}㎡ | ` +
    `${q.quantities.wallpaper_total}㎡ ${q.quantities.baseboard}m | ` +
    `${formatPrice(win?.total ?? 0)} | ${formatPrice(r.grandTotal)}`
  );
}
console.log('\n검증: 데이터 기대값 → 창호 2Bay=6 / 3Bay=7 / 4Bay=8 개소\n');

// ── 3) 신규 검증: 구성(문 개수) ──
console.log('━━━━━━━━━━ 3. 구성별 문 개수 (84㎡) ━━━━━━━━━━\n');
for (const rooms of ['pure3', 'plus', 'four'] as const) {
  const q = calculateQuantity(84, { rooms });
  console.log(`  ${rooms}: 문 ${q.quantities.doors}개`);
}
console.log('  기대값 → 순수3룸=6 / 3+알파=8 / 4룸=9\n');

// ── 4) 신규 검증: 확장 vs 비확장 (84㎡ 중급) ──
console.log('━━━━━━━━━━ 4. 확장 vs 비확장 (84㎡ 중급) ━━━━━━━━━━\n');
for (const expanded of [true, false]) {
  const q = calculateQuantity(84, { expanded });
  const r = calculateEstimate(84, 'standard', { expanded });
  console.log(`  ${expanded ? '확장(기본)' : '비확장'}: 마루 ${q.quantities.floor_wood}㎡ / 도배 ${q.quantities.wallpaper_total}㎡ / 총액 ${formatPrice(r.grandTotal)}`);
}
console.log('  (비확장 = 발코니 편입면적 차감 추정값)\n');
