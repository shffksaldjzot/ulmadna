// ── 10. 도장 ──
// 근거: ulmadna_db.json — 8건 교차검증 완료
// 상태: 확정
// 성격: 고급 사양 단일 / ON/OFF 자유 / 어떤 등급에서든 추가 가능
import type { ProcessData } from '../types';

export const PAINTING: ProcessData = {
  id: 'painting',
  name: '도장',
  order: 10,
  enabled: false,  // 기본 OFF, 사용자가 ON해야 활성화
  unitType: 'custom',
  grades: {
    // 등급 선택 없이 개소 수만 선택
    standard: { label: '스페셜페인트', desc: '안티스타코/벤자민무어/던에드워드 등', price: 0, unit: '개소별' },
  },
  subItems: [
    {
      id: 'coat_1_2',
      name: '탄성코트 1~2개소',
      grades: { standard: { label: '1~2개소', desc: '세라믹/바이오세라믹', price: 700000, unit: '원' } },
      defaultEnabled: true,
    },
    {
      id: 'coat_bio',
      name: '바이오세라믹 2개소',
      grades: { standard: { label: '바이오세라믹', desc: '바이오세라믹 코팅', price: 900000, unit: '원' } },
      defaultEnabled: false,
    },
    {
      id: 'coat_5_6',
      name: '탄성코트 5~6개소',
      grades: { standard: { label: '5~6개소', desc: '전체 도장', price: 1050000, unit: '원' } },
      defaultEnabled: false,
    },
  ],
  // 4뎁스 도장재 선택
  products: [
    { id: 'antistacco',  label: '안티스타코',         price: 60000,  unit: '원/㎡', source: 'estimated' },
    { id: 'benjamin',    label: '벤자민무어 스커프X',  price: 55000,  unit: '원/㎡', source: 'estimated' },
    { id: 'dunn',        label: '던에드워드',         price: 48000,  unit: '원/㎡', source: 'estimated' },
    { id: 'general',     label: '일반 페인트',        price: 25000,  unit: '원/㎡', source: 'estimated' },
  ],
  note: '도장은 고급 사양만 존재. ON/OFF는 자유. 개소당 14~23만 범위. 8건 교차검증 완료.',
};
