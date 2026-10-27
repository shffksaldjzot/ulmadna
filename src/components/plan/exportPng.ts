// ──────────────────────────────────────────────
// 공용 2D 도면 부품 — 도면을 PNG 그림 파일로 내려받기
//
// 하는 일:
//   1) 화면의 도면 SVG 를 복제해서, 확대·이동 상태와 상관없이 "맞춤" 보기(data-fit)로 되돌린다
//   2) 그 SVG 를 그림(Image)으로 읽어 캔버스에 그린다(흰 바탕)
//   3) 아래쪽에 제목·물량 요약 글줄을 덧붙인다(현장에 카톡으로 보내면 그림 하나로 다 보이게)
//   4) PNG 로 바꿔 내려받기를 띄운다
//
// 외부 라이브러리 없이 브라우저 기본 기능만 쓴다(번들 크기 늘리지 않으려고).
//
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────

'use client';

export interface PngExportOptions {
  /** 내려받을 파일 이름(확장자 빼고) */
  fileName: string;
  /** 그림 위 제목 한 줄 */
  title: string;
  /** 그림 아래 요약 글줄들 */
  lines: string[];
  /** 요약 글줄 아래에 붙일 목록표(이름·수량·금액) — 마지막 줄은 합계처럼 굵게 그리고 싶으면 bold 표시 */
  table?: { title: string; rows: { cols: [string, string, string]; bold?: boolean }[] };
  /** 그림 폭(px) — 기본 1200 */
  width?: number;
}

/** SVG 요소 → PNG 내려받기. 실패하면 false */
export async function exportPlanPng(svg: SVGSVGElement | null, opt: PngExportOptions): Promise<boolean> {
  if (!svg) return false;
  try {
    const W = opt.width ?? 1200;
    const fit = (svg.getAttribute('data-fit') ?? svg.getAttribute('viewBox') ?? '0 0 100 100').split(' ').map(Number);
    const [, , fw, fh] = fit;
    const drawH = Math.round((W * fh) / fw);

    // 1) 복제 + 맞춤 보기 + 크기 지정
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('viewBox', fit.join(' '));
    clone.setAttribute('width', String(W));
    clone.setAttribute('height', String(drawH));
    clone.removeAttribute('class');
    const xml = new XMLSerializer().serializeToString(clone);
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

    // 2) 그림으로 읽기
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('svg load'));
      img.src = url;
    });

    // 3) 캔버스 — 위 제목 칸 + 도면 + 아래 요약 칸
    const scale = 2; // 선명하게(레티나)
    const font = 'Pretendard, -apple-system, "Malgun Gothic", sans-serif';
    const lineH = 34;
    const top = 70;
    const tableRows = opt.table?.rows ?? [];
    const tableH = opt.table && tableRows.length > 0 ? (tableRows.length + 1) * lineH + 24 : 0;
    const bottom = 30 + opt.lines.length * lineH + tableH + 40;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = (top + drawH + bottom) * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, top + drawH + bottom);
    ctx.fillStyle = '#2A2018';
    ctx.font = `700 30px ${font}`;
    ctx.fillText(opt.title, 32, 46);
    ctx.drawImage(img, 0, top, W, drawH);
    ctx.font = `400 24px ${font}`;
    opt.lines.forEach((t, i) => ctx.fillText(t, 32, top + drawH + 30 + (i + 1) * lineH));
    // 자재 목록표 — 이름(왼쪽) · 수량(가운데 오른쪽 맞춤) · 금액(오른쪽 맞춤)
    if (opt.table && tableRows.length > 0) {
      let y = top + drawH + 30 + opt.lines.length * lineH + 24;
      ctx.font = `700 24px ${font}`;
      ctx.textAlign = 'left';
      ctx.fillText(opt.table.title, 32, y + 10);
      y += lineH;
      ctx.strokeStyle = '#E4DDD5';
      ctx.beginPath();
      ctx.moveTo(32, y - 22);
      ctx.lineTo(W - 32, y - 22);
      ctx.stroke();
      tableRows.forEach((r) => {
        ctx.font = `${r.bold ? 700 : 400} 24px ${font}`;
        ctx.textAlign = 'left';
        ctx.fillText(r.cols[0], 32, y + 10);
        ctx.textAlign = 'right';
        ctx.fillText(r.cols[1], W * 0.66, y + 10);
        ctx.fillText(r.cols[2], W - 32, y + 10);
        y += lineH;
      });
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = '#A79C90';
    ctx.font = `400 18px ${font}`;
    ctx.fillText('ulmadna.com/calc/tile-pro', 32, top + drawH + bottom - 16);

    // 4) 내려받기
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${opt.fileName}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}
