// ── 15. 가전 ──
// 근거: ChatGPT 2차 조사 — 다나와/삼성닷컴/LG공식 등 공개가
// 성격: 총예산 참고용 (소비자 직접 구매가 일반적)
import type { ProcessData } from '../types';

export const APPLIANCE: ProcessData = {
  id: 'appliance',
  name: '가전',
  order: 15,
  enabled: false,  // 총예산 참고용이라 기본 OFF
  unitType: 'custom',
  grades: {
    economy:  { label: '가성비',  desc: '국산 보급형',            price: 0, unit: '항목별' },
    standard: { label: '중급',    desc: '삼성 비스포크/LG 오브제', price: 0, unit: '항목별' },
    premium:  { label: '고급',    desc: '밀레/수입',              price: 0, unit: '항목별' },
  },
  subItems: [
    // 냉장고
    {
      id: 'fridge',
      name: '냉장고',
      grades: {
        economy:  { label: '프리스탠딩 4도어',   desc: '삼성 비스포크 875L',   price: 2620000,  unit: '원' },
        standard: { label: '키친핏 4도어',       desc: '삼성 키친핏 600L',     price: 3450000,  unit: '원' },
        premium:  { label: '키친핏 4+3 조합',    desc: 'LG 4도어+김치 조합',   price: 5070000,  unit: '원' },
      },
      defaultEnabled: true,
    },
    // 세탁기/건조기
    {
      id: 'washer',
      name: '세탁기+건조기',
      grades: {
        economy:  { label: '삼성 그랑데AI 세트',  desc: '24kg+19kg',          price: 2250000, unit: '원' },
        standard: { label: 'LG 워시타워',         desc: '25kg+22kg 일체형',   price: 3630000, unit: '원' },
        premium:  { label: '삼성 올인원 AI콤보',   desc: '세탁건조 일체형',     price: 3450000, unit: '원' },
      },
      defaultEnabled: true,
    },
    // 식기세척기
    {
      id: 'dishwasher',
      name: '식기세척기',
      grades: {
        economy:  { label: 'LG 14인용',   desc: 'DUE6BGL2E',     price: 1330000, unit: '원' },
        standard: { label: '삼성 14인용',  desc: 'DW60BB837',     price: 1650000, unit: '원' },
        premium:  { label: '밀레 G7000',   desc: 'G7104~G7314',   price: 2110000, unit: '원' },
      },
      defaultEnabled: false,
    },
    // 빌트인오븐
    {
      id: 'oven',
      name: '빌트인오븐',
      grades: {
        economy:  { label: '보쉬 Serie 8',        desc: '독일산',           price: 2500000, unit: '원' },
        standard: { label: '삼성 인피니트 75L',     desc: 'NV75T9879CD',    price: 2190000, unit: '원' },
        premium:  { label: '밀레 H7860 BP',        desc: '프리미엄',        price: 5840000, unit: '원' },
      },
      defaultEnabled: false,
    },
    // 인덕션
    {
      id: 'induction',
      name: '인덕션 3구',
      grades: {
        economy:  { label: '쿠첸 3구',           desc: '빌트인',           price: 420000,  unit: '원' },
        standard: { label: '삼성 비스포크',        desc: 'CC80F63X1Z',     price: 793000,  unit: '원' },
        premium:  { label: '밀레 KM7000',         desc: 'KM7220 FL',      price: 2100000, unit: '원' },
      },
      defaultEnabled: false,
    },
    // 의류관리기
    {
      id: 'styler',
      name: '의류관리기',
      grades: {
        economy:  { label: '삼성 에어드레서 슬림',  desc: 'DF18CB8600ER',  price: 990000,  unit: '원' },
        standard: { label: 'LG 스타일러 S5',       desc: '5벌',           price: 1520000, unit: '원' },
        premium:  { label: '삼성 에어드레서 대형',   desc: 'DF10B9500CS',  price: 1480000, unit: '원' },
      },
      defaultEnabled: false,
    },
  ],
  note: '가전은 소비자 직접 구매가 일반적. 총예산 참고용. 설치비 별도.',
};
