/**
 * PDF 견적 리포트 생성
 * Design Ref: §8 — A4 리포트 (공정별 견적표 + 합리성 판단)
 * Plan SC-04: 비회원 즉시 다운로드
 */

import type { CalculatorInput, CalculatorOutput } from '@/types/calculator';
import { formatWonExact, formatPerPyeong, formatWon, formatPercent } from './format';

const HOUSING_LABELS: Record<string, string> = {
  under10: '10년 미만', ten20: '10~20년', over20: '20년 이상',
};
const GRADE_LABELS: Record<string, string> = {
  basic: '기본(가성비)', mid: '중급(대중적)', premium: '고급(프리미엄)',
};

export async function generatePdf(input: CalculatorInput, output: CalculatorOutput) {
  const { default: jsPDF } = await import('jspdf');

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // 제목
  doc.setFontSize(18);
  doc.setTextColor(92, 58, 33); // brown
  doc.text('얼마드나 — 인테리어 예상 견적서', margin, y);
  y += 10;

  // 조건 요약
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${input.basic.area}평 | ${HOUSING_LABELS[input.basic.housingType]} | ${GRADE_LABELS[input.basic.grade]}`,
    margin, y
  );
  y += 10;

  // 구분선
  doc.setDrawColor(201, 169, 110); // gold
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // 총 예상 비용
  doc.setFontSize(14);
  doc.setTextColor(92, 58, 33);
  doc.text(`총 예상 비용: ${formatWon(output.total)}`, margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(201, 169, 110);
  doc.text(`평당 ${formatPerPyeong(output.perPyeong)}`, margin, y);
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`(공사비 ${formatWonExact(output.subtotal)} + 예비비 15% ${formatWonExact(output.contingency)})`, margin, y);
  y += 10;

  // 합리성 판단
  doc.setFontSize(10);
  doc.setTextColor(
    output.rationality.level === 'good' ? 46 : output.rationality.level === 'normal' ? 212 : 192,
    output.rationality.level === 'good' ? 125 : output.rationality.level === 'normal' ? 160 : 57,
    output.rationality.level === 'good' ? 91 : output.rationality.level === 'normal' ? 23 : 43,
  );
  doc.text(`[${output.rationality.level === 'good' ? '합리적' : output.rationality.level === 'normal' ? '적정' : '다소 높음'}] ${output.rationality.comment}`, margin, y);
  y += 10;

  // 공정별 견적표
  doc.setFontSize(11);
  doc.setTextColor(92, 58, 33);
  doc.text('공정별 견적 상세', margin, y);
  y += 6;

  // 테이블 헤더
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('공정', margin, y);
  doc.text('금액', margin + contentWidth * 0.5, y);
  doc.text('비중', margin + contentWidth * 0.8, y);
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // 테이블 행
  doc.setTextColor(60, 60, 60);
  for (const p of output.processes) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(p.name, margin, y);
    doc.text(formatWonExact(p.amount), margin + contentWidth * 0.5, y);
    doc.text(formatPercent(p.percentage), margin + contentWidth * 0.8, y);
    y += 5;
  }

  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // 숨은 비용 알림
  if (output.hiddenCosts && output.hiddenCosts.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(212, 160, 23);
    doc.text('⚠ 숨은 비용 알림', margin, y);
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    for (const cost of output.hiddenCosts) {
      doc.text(`[${cost.category}]`, margin, y);
      y += 4;
      for (const item of cost.items) {
        doc.text(`  ${item.label}: ${formatWonExact(item.amount)}`, margin, y);
        y += 4;
      }
      doc.text(`  소계: ${formatWonExact(cost.total)}`, margin, y);
      y += 5;
    }
    y += 3;
  }

  // 면책 + 푸터
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text('[참고 안내] 본 견적은 시장 평균 기반의 참고용 예상 금액입니다.', margin, 276);
  doc.text('실제 비용은 현장 상황, 자재 수급, 지역에 따라 달라질 수 있습니다.', margin, 280);
  doc.text('반드시 인테리어 전문 업체와 상의 후 최종 견적을 확정하세요.', margin, 284);
  doc.text('ulmadna.com · 2025~2026 시장 평균 기반', margin, 290);
  doc.text('ulmadna.com', pageWidth - margin - 20, 286);

  doc.save(`얼마드나_견적_${input.basic.area}평_${GRADE_LABELS[input.basic.grade]}.pdf`);
}
