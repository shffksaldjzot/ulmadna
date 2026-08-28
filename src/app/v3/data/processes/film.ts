// ── 11. 필름 ──
// 근거: ulmadna_db.json (EST-029~035) + ChatGPT 시장가 검증
import type { ProcessData } from '../types';

export const FILM: ProcessData = {
  id: 'film',
  name: '필름',
  order: 11,
  enabled: true,
  unitType: 'set',  // 세트 단가
  grades: {
    economy:  { label: '가성비', desc: '방문틀+신발장+욕실문틀',                     price: 890000,  unit: '원/식' },
    standard: { label: '중급',   desc: '방문+틀+화장대+싱크대서라운드+현관',           price: 1700000, unit: '원/식' },
    premium:  { label: '고급',   desc: '전체 창호+서라운드+아트월+붙박이',             price: 3240000, unit: '원/식' },
  },
  note: '자재비 13,000원/M (예림 발렌불랑) + 기공 일당 300,000원/일. 가성비 58만→89만 보정(2026.04.14)',
};
