// ── 17. 기타 입주시공 ──
// 근거: ulmadna_db.json (EST-027~035) + ChatGPT 시장가 조사
import type { ProcessData } from '../types';

export const FINISHING: ProcessData = {
  id: 'finishing',
  name: '기타 입주시공',
  order: 17,
  enabled: true,
  unitType: 'custom',
  grades: {
    standard: { label: '기본', desc: '입주시공 항목별', price: 0, unit: '항목별' },
  },
  subItems: [
    {
      id: 'cleaning',
      name: '입주청소',
      quantityKey: 'area_pyeong',
      grades: { standard: { label: '기본', desc: '입주청소', price: 15000, unit: '원/평' } },
      defaultEnabled: true,
    },
    {
      id: 'nano_coating',
      name: '나노코팅',
      grades: { standard: { label: '기본', desc: '욕실/주방/베란다', price: 200000, unit: '원/개소' } },
      defaultEnabled: false,
    },
    {
      id: 'grout_kerafoxy',
      name: '줄눈 (케라폭시)',
      grades: { standard: { label: '케라폭시', desc: '에폭시계 고급 줄눈', price: 325000, unit: '원/욕실' } },
      defaultEnabled: false,
    },
    {
      id: 'grout_polyurea',
      name: '줄눈 (폴리우레아)',
      grades: { standard: { label: '폴리우레아', desc: '폴리우레아 줄눈', price: 175000, unit: '원/욕실' } },
      defaultEnabled: false,
    },
    {
      id: 'consent_agent',
      name: '입주민 동의서 대행',
      grades: { standard: { label: '기본', desc: '동의서 대행', price: 150000, unit: '원/식' } },
      defaultEnabled: true,
    },
    {
      id: 'elevator_protect',
      name: '엘리베이터 보양',
      grades: { standard: { label: '기본', desc: '엘베 보양', price: 150000, unit: '원/식' } },
      defaultEnabled: true,
    },
    {
      id: 'elevator_fee',
      name: '엘리베이터 사용료',
      grades: { standard: { label: '기본', desc: '관리소 부과', price: 150000, unit: '원/식' } },
      defaultEnabled: true,
    },
    {
      id: 'material_lift',
      name: '자재 양중',
      grades: { standard: { label: '기본', desc: '사다리차/인력양중', price: 250000, unit: '원/식' } },
      defaultEnabled: true,
    },
    {
      id: 'handy',
      name: '핸디작업',
      grades: { standard: { label: '기본', desc: '다기능 현장 보수', price: 300000, unit: '원/식' } },
      defaultEnabled: true,
    },
  ],
  note: '입주청소 15,000원/평 확정. 나노코팅·줄눈은 ChatGPT 시장가 기반 임시 확정 (나중에 수정 가능).',
};
