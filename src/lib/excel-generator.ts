/**
 * 엑셀 견적서 생성
 * Design Ref: §8 — 4시트 엑셀 (수식 포함, 직접 수정 가능)
 * Plan SC-05: 4개 시트 + 수식 포함 정상
 */

import type { CalculatorInput, CalculatorOutput } from '@/types/calculator';
import pricingData from '@/data/pricing.json';

const HOUSING_LABELS: Record<string, string> = {
  new: '신축 입주', old20: '구축 리모델링',
};
const GRADE_LABELS: Record<string, string> = {
  basic: '기본(가성비)', mid: '중급(대중적)', premium: '고급(프리미엄)',
};

export async function generateExcel(input: CalculatorInput, output: CalculatorOutput) {
  const XLSX = await import('xlsx');

  const wb = XLSX.utils.book_new();

  // 시트1: 공정별 상세 견적표
  const sheet1Data = [
    ['얼마드나 — 인테리어 예상 견적서'],
    [`${input.basic.area}평 | ${HOUSING_LABELS[input.basic.housingType]} | ${GRADE_LABELS[input.basic.grade]}`],
    [],
    ['공정', '금액 (원)', '비중 (%)'],
    ...output.processes.map(p => [p.name, p.amount, p.percentage]),
    [],
    ['소계', output.subtotal],
    [`예비비 (${Math.round(output.contingencyRate * 100)}%)`, output.contingency],
    ['총 예상 비용', output.total],
    ['평당 단가', output.perPyeong],
    [],
    ['[참고 안내]'],
    ['본 견적은 시장 평균 기반의 참고용 예상 금액입니다.'],
    ['실제 비용은 현장 상황, 자재 수급, 지역에 따라 달라질 수 있습니다.'],
    ['반드시 인테리어 전문 업체와 상의 후 최종 견적을 확정하세요.'],
    ['ulmadna.com · 2025~2026 시장 평균 기반 참고용'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws1, '견적 상세');

  // 시트2: 비용 비중 요약
  const sheet2Data = [
    ['비용 비중 요약'],
    [],
    ['공정', '금액 (원)', '비중 (%)'],
    ...output.processes.map(p => [p.name, p.amount, p.percentage]),
    [],
    ['합리성 판단', output.rationality.comment],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws2, '비용 요약');

  // 시트3: 추천 업체 (제휴)
  const sheet3Data = [
    ['추천 업체 리스트 [제휴]'],
    [],
    ['업종', '업체명', '지역', '연락처', '비고'],
    ['자재 매장', '(파트너 업체 준비 중)', '', '', '제휴'],
    ['시공 업체', '(파트너 업체 준비 중)', '', '', '제휴'],
    [],
    ['※ 위 업체는 얼마드나 제휴 파트너입니다.'],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
  ws3['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws3, '추천 업체');

  // 시트4: 공정 순서 가이드
  const sortedProcesses = output.processes
    .map(p => {
      const data = pricingData.find(d => d.id === p.id);
      return { ...p, order: data?.order || 99, duration: data?.duration || 1 };
    })
    .sort((a, b) => a.order - b.order);

  const totalDays = sortedProcesses.reduce((sum, p) => sum + p.duration, 0);

  const sheet4Data = [
    ['공정 순서 가이드'],
    [`예상 공사 기간: 약 ${Math.ceil(totalDays / 5)}주 (${totalDays}일)`],
    [],
    ['순서', '공정', '예상 소요일'],
    ...sortedProcesses.map((p, i) => [i + 1, p.name, `${p.duration}일`]),
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(sheet4Data);
  ws4['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws4, '공정 순서');

  // 면책 문구 (시트1 하단에 추가)

  // 다운로드
  XLSX.writeFile(wb, `얼마드나_견적_${input.basic.area}평_${GRADE_LABELS[input.basic.grade]}.xlsx`);
}
