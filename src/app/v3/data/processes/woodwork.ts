// ── 6. 목공 ──
// 근거: ulmadna_db.json (EST-027~035) + ChatGPT 시장가 검증
import type { ProcessData } from '../types';

export const WOODWORK: ProcessData = {
  id: 'woodwork',
  name: '목공',
  order: 6,
  enabled: true,
  unitType: 'custom',  // 하위 품목별로 단위가 다름
  grades: {
    economy:  { label: '가성비', desc: '보급형 몰딩+방문', price: 0, unit: '항목별' },
    standard: { label: '중급',   desc: '마이너스몰딩+예림방문', price: 0, unit: '항목별' },
    premium:  { label: '고급',   desc: '슬림몰딩+ABS방문+아트월', price: 0, unit: '항목별' },
  },
  subItems: [
    // 몰딩+걸레받이 (평당)
    {
      id: 'molding',
      name: '몰딩+걸레받이',
      quantityKey: 'area_pyeong',  // 전용면적 평수 기준
      grades: {
        economy:  { label: '보급 (3전)',       desc: '3전 몰딩+4전 걸레받이', price: 20000, unit: '원/평' },
        standard: { label: '마이너스 25mm',    desc: '마이너스몰딩+30mm',     price: 33000, unit: '원/평' },
        premium:  { label: '슬림형',           desc: '슬림몰딩+45mm',         price: 42000, unit: '원/평' },
      },
      defaultEnabled: true,
    },
    // 방문 (조당)
    {
      id: 'doors',
      name: '방문 교체',
      quantityKey: 'doors',  // 문 개수 (타입별 7~8개)
      grades: {
        economy:  { label: '보급 (리움)',      desc: '리움/보급형',                  price: 250000, unit: '원/조' },
        standard: { label: '예림',            desc: '예림 문짝+합판문틀 제작',       price: 370000, unit: '원/조' },
        premium:  { label: 'ABS+도무스',      desc: 'ABS문+9MM문선+도무스',          price: 500000, unit: '원/조' },
      },
      defaultEnabled: true,
    },
    // TV 매립 (1식)
    {
      id: 'tv_wall',
      name: 'TV 매립/아트월',
      grades: {
        economy:  { label: '브라켓매립',       desc: 'TV 브라켓 벽 매립',       price: 700000,  unit: '원/식' },
        standard: { label: '반매립+하부띄움',   desc: 'TV반매립+하부띄움',       price: 1500000, unit: '원/식' },
        premium:  { label: '아트월+반매립 MDF', desc: '아트월 MDF+TV반매립',     price: 2000000, unit: '원/식' },
      },
      defaultEnabled: false,
    },
    // 천장 (1식)
    {
      id: 'ceiling',
      name: '천장',
      grades: {
        economy:  { label: '등박스 평탄화',           desc: '등박스 평탄화',                    price: 600000,  unit: '원/식' },
        standard: { label: '거실+주방 전체',          desc: '거실+주방 전체 천장',              price: 2500000, unit: '원/식' },
        premium:  { label: '우물천장+커튼라인+라인조명', desc: '우물천장+커튼라인+라인조명',        price: 2200000, unit: '원/식' },
      },
      defaultEnabled: false,
    },
    // 에어컨 단내림 (실당)
    {
      id: 'ac_box',
      name: '에어컨 단내림 목공',
      grades: {
        standard: { label: '기본', desc: '배관 숨김 박스', price: 350000, unit: '원/실' },
      },
      defaultEnabled: false,
    },
  ],
  note: '방문 개수: 59타입 7개, 74/84타입 8개. 몰딩은 면적 기반(평당), 방문은 개수 기반(조당).',
};
