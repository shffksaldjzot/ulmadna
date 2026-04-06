/**
 * PDF 견적 리포트 생성
 * html2canvas → jsPDF 방식 (A4 HTML 템플릿)
 */

import type { CalculatorInput, CalculatorOutput } from '@/types/calculator';
import { formatWonExact, formatPerPyeong, formatWon, formatPercent } from './format';

const HOUSING_LABELS: Record<string, string> = {
  under10: '10년 미만', ten20: '10~20년', over20: '20년 이상',
};
const GRADE_LABELS: Record<string, string> = {
  basic: '기본(가성비)', mid: '중급(대중적)', premium: '고급(프리미엄)',
};

function buildHtml(input: CalculatorInput, output: CalculatorOutput): string {
  const processRows = output.processes
    .filter(p => p.amount > 0)
    .map(p => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f0ebe3;font-size:12px;color:#3c3c3c;">${p.name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f0ebe3;font-size:11px;color:#666;max-width:180px;word-break:break-all;">${p.selectedOption || '-'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f0ebe3;font-size:12px;color:#3c3c3c;text-align:right;">${formatWonExact(p.amount)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f0ebe3;font-size:12px;color:#999;text-align:right;">${formatPercent(p.percentage)}</td>
      </tr>
    `).join('');

  const marginDisplay = output.margin > 0
    ? `<tr>
        <td colspan="2" style="padding:6px 10px;font-size:12px;color:#3c3c3c;">이윤 (${Math.round(output.marginRate * 100)}%)</td>
        <td style="padding:6px 10px;font-size:12px;color:#3c3c3c;text-align:right;">${formatWonExact(output.margin)}</td>
        <td></td>
      </tr>`
    : '';

  return `
<div id="__pdf_root" style="
  width:794px;
  font-family:'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;
  background:#fff;
  color:#3c3c3c;
  padding:40px 44px;
  box-sizing:border-box;
  line-height:1.6;
">
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
    <div>
      <span style="font-size:22px;font-weight:700;color:#5c3a21;letter-spacing:-0.5px;">얼마드나</span>
      <span style="font-size:13px;color:#999;margin-left:8px;">ulmadna.com</span>
    </div>
    <span style="font-size:14px;color:#c9a96e;font-weight:600;">인테리어 예상 견적서</span>
  </div>
  <div style="height:2px;background:linear-gradient(to right,#5c3a21,#c9a96e);margin-bottom:20px;border-radius:1px;"></div>

  <!-- Conditions -->
  <div style="display:flex;gap:24px;margin-bottom:20px;">
    <div style="background:#faf7f2;border-radius:8px;padding:10px 16px;flex:1;text-align:center;">
      <div style="font-size:10px;color:#999;">평수</div>
      <div style="font-size:16px;font-weight:700;color:#5c3a21;">${input.basic.area}평</div>
    </div>
    <div style="background:#faf7f2;border-radius:8px;padding:10px 16px;flex:1;text-align:center;">
      <div style="font-size:10px;color:#999;">연식</div>
      <div style="font-size:14px;font-weight:600;color:#5c3a21;">${HOUSING_LABELS[input.basic.housingType]}</div>
    </div>
    <div style="background:#faf7f2;border-radius:8px;padding:10px 16px;flex:1;text-align:center;">
      <div style="font-size:10px;color:#999;">등급</div>
      <div style="font-size:14px;font-weight:600;color:#5c3a21;">${GRADE_LABELS[input.basic.grade]}</div>
    </div>
  </div>

  <!-- Total -->
  <div style="background:#5c3a21;border-radius:12px;padding:20px 24px;margin-bottom:20px;color:#fff;">
    <div style="font-size:11px;color:#c9a96e;margin-bottom:4px;">총 예상 비용</div>
    <div style="font-size:28px;font-weight:800;letter-spacing:-1px;">${formatWon(output.total)}</div>
    <div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:rgba(255,255,255,0.7);">
      <span>평당 ${formatPerPyeong(output.perPyeong)}</span>
    </div>
  </div>

  <!-- Cost breakdown -->
  <div style="display:flex;gap:12px;margin-bottom:24px;font-size:11px;">
    <div style="background:#faf7f2;border-radius:8px;padding:8px 14px;flex:1;">
      <span style="color:#999;">공사비 소계</span>
      <span style="float:right;color:#5c3a21;font-weight:600;">${formatWonExact(output.subtotal)}</span>
    </div>
    ${output.margin > 0 ? `
    <div style="background:#faf7f2;border-radius:8px;padding:8px 14px;flex:1;">
      <span style="color:#999;">이윤 (${Math.round(output.marginRate * 100)}%)</span>
      <span style="float:right;color:#5c3a21;font-weight:600;">${formatWonExact(output.margin)}</span>
    </div>` : ''}
    <div style="background:#faf7f2;border-radius:8px;padding:8px 14px;flex:1;">
      <span style="color:#999;">예비비 (${Math.round(output.contingencyRate * 100)}%)</span>
      <span style="float:right;color:#5c3a21;font-weight:600;">${formatWonExact(output.contingency)}</span>
    </div>
  </div>

  <!-- Process Table -->
  <div style="margin-bottom:20px;">
    <div style="font-size:13px;font-weight:700;color:#5c3a21;margin-bottom:8px;">공정별 견적 상세</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#faf7f2;">
          <th style="padding:8px 10px;text-align:left;font-size:10px;color:#999;font-weight:500;">공정</th>
          <th style="padding:8px 10px;text-align:left;font-size:10px;color:#999;font-weight:500;">선택 옵션</th>
          <th style="padding:8px 10px;text-align:right;font-size:10px;color:#999;font-weight:500;">금액</th>
          <th style="padding:8px 10px;text-align:right;font-size:10px;color:#999;font-weight:500;">비중</th>
        </tr>
      </thead>
      <tbody>
        ${processRows}
        <tr style="background:#faf7f2;font-weight:700;">
          <td colspan="2" style="padding:8px 10px;font-size:12px;color:#5c3a21;">공사비 소계</td>
          <td style="padding:8px 10px;font-size:13px;color:#5c3a21;text-align:right;">${formatWonExact(output.subtotal)}</td>
          <td style="padding:8px 10px;font-size:12px;color:#999;text-align:right;">100%</td>
        </tr>
        ${marginDisplay}
        <tr style="font-weight:700;">
          <td colspan="2" style="padding:8px 10px;font-size:12px;color:#3c3c3c;">예비비 (${Math.round(output.contingencyRate * 100)}%)</td>
          <td style="padding:8px 10px;font-size:12px;color:#3c3c3c;text-align:right;">${formatWonExact(output.contingency)}</td>
          <td></td>
        </tr>
        <tr style="border-top:2px solid #5c3a21;">
          <td colspan="2" style="padding:10px 10px;font-size:14px;font-weight:800;color:#5c3a21;">총 예상 비용</td>
          <td style="padding:10px 10px;font-size:14px;font-weight:800;color:#5c3a21;text-align:right;">${formatWonExact(output.total)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Disclaimer -->
  <div style="font-size:9px;color:#bbb;line-height:1.5;margin-bottom:16px;">
    [참고 안내] 본 견적은 시장 평균 기반의 참고용 예상 금액입니다.
    실제 비용은 현장 상황, 자재 수급, 지역에 따라 달라질 수 있습니다.
    반드시 인테리어 전문 업체와 상의 후 최종 견적을 확정하세요.
    <br/>ulmadna.com · 2025~2026 시장 평균 기반 참고용
  </div>

  <!-- Sponsor Banner -->
  <div style="border:1.5px dashed #c9a96e;border-radius:8px;padding:12px 16px;text-align:center;">
    <div style="font-size:10px;color:#c9a96e;">이 서비스는 파트너 브랜드의 후원으로 무료 운영됩니다</div>
    <div style="font-size:9px;color:#ccc;margin-top:2px;">ulmadna.com</div>
  </div>
</div>
`;
}

export async function generatePdf(input: CalculatorInput, output: CalculatorOutput) {
  const html2canvas = (await import('html2canvas')).default;
  const { default: jsPDF } = await import('jspdf');

  // Create hidden container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.zIndex = '-1';
  container.innerHTML = buildHtml(input, output);
  document.body.appendChild(container);

  const root = container.querySelector('#__pdf_root') as HTMLElement;

  try {
    const canvas = await html2canvas(root, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210; // A4 width mm
    const pageHeight = 297; // A4 height mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const doc = new jsPDF('p', 'mm', 'a4');
    let position = 0;
    let heightLeft = imgHeight;

    // First page
    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Additional pages if content overflows
    while (heightLeft > 0) {
      position -= pageHeight;
      doc.addPage();
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    doc.save(`얼마드나_견적_${input.basic.area}평_${GRADE_LABELS[input.basic.grade]}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
