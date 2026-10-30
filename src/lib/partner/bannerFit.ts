// ─────────────────────────────────────────────────────────────
// 배너 그림 자동 맞춤 (브라우저 전용, 2026-10-30)
//   광고주가 올린 그림이 자리 규격과 달라도 막지 않고,
//   캔버스로 자리 규격의 2배 크기에 가운데 맞춤 "잘라 채우기(cover)" 해서 PNG 로 바꾼다.
//   용량 한도를 넘으면 JPEG 품질을 낮춰 다시 시도하고, 그래도 크면 1배 크기로 줄인다.
//   서버 검사(checkBanner)는 그대로 — 변환된 그림은 규격에 맞으니 통과한다.
// ─────────────────────────────────────────────────────────────

export type FitResult =
  | { ok: true; file: File; cropped: boolean; changed: boolean }
  | { ok: false; error: string };

/** 가로세로비 차이가 이 값을 넘으면 "가장자리가 잘릴 수 있어요" 안내 */
export const CROP_WARN = 0.25;

/** 캔버스를 파일로(실패하면 null) */
function toBlob(c: HTMLCanvasElement, type: string, q?: number): Promise<Blob | null> {
  return new Promise((res) => c.toBlob(res, type, q));
}

/** 가운데 맞춤 cover 로 w×h 캔버스에 그리기 */
function drawCover(img: ImageBitmap, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const k = Math.max(w / img.width, h / img.height);
  const dw = img.width * k;
  const dh = img.height * k;
  ctx.fillStyle = '#fff'; // 투명 배경은 흰색으로(JPEG 변환 대비)
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}

/**
 * 그림을 자리 규격(size)에 맞춘다.
 * - 이미 1배·2배 크기이고 용량도 맞으면 그대로 돌려준다(changed=false).
 */
export async function fitBanner(file: File, size: { width: number; height: number }, maxKB: number): Promise<FitResult> {
  let img: ImageBitmap;
  try {
    img = await createImageBitmap(file);
  } catch {
    return { ok: false, error: '그림을 읽지 못했어요. PNG 또는 JPG 파일인지 확인해 주세요' };
  }
  const { width: W, height: H } = size;
  const exact = (img.width === W && img.height === H) || (img.width === W * 2 && img.height === H * 2);
  if (exact && file.size <= maxKB * 1024 && (file.type === 'image/png' || file.type === 'image/jpeg')) {
    return { ok: true, file, cropped: false, changed: false };
  }
  const diff = Math.abs(img.width / img.height - W / H) / (W / H);
  const cropped = diff > CROP_WARN;
  const base = file.name.replace(/\.[^.]+$/, '') || 'banner';
  // 2배 → 1배 순으로, 각 크기에서 PNG → JPEG(품질 낮춰 가며)
  for (const scale of [2, 1]) {
    const c = drawCover(img, W * scale, H * scale);
    const png = await toBlob(c, 'image/png');
    if (png && png.size <= maxKB * 1024) {
      return { ok: true, file: new File([png], `${base}.png`, { type: 'image/png' }), cropped, changed: true };
    }
    for (const q of [0.92, 0.85, 0.75, 0.65, 0.5, 0.35]) {
      const jpg = await toBlob(c, 'image/jpeg', q);
      if (jpg && jpg.size <= maxKB * 1024) {
        return { ok: true, file: new File([jpg], `${base}.jpg`, { type: 'image/jpeg' }), cropped, changed: true };
      }
    }
  }
  return { ok: false, error: `그림이 너무 복잡해서 ${maxKB}KB 아래로 줄이지 못했어요. 단순한 그림으로 올려 주세요` };
}
