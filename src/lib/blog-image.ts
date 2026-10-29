// ──────────────────────────────────────────────
// 블로그 이미지 도우미 (서버 전용 — 파일을 직접 읽음)
//
// 1) smallThumb  : 목록 카드·관련 글처럼 작게 보이는 자리에 쓸 "작은 썸네일" 주소
//    - 빌드 전에 scripts/gen-blog-thumbs.mjs 가 hero.jpg(1080px, 약 110KB) 옆에
//      thumb.webp(480px, 약 12KB)를 만들어 둔다.
//    - 작은 파일이 실제로 있을 때만 그 주소를 주고, 없으면(새 글이 막 올라와 아직 안 만들어진 경우 등)
//      원래 큰 이미지 주소를 그대로 돌려줘서 그림이 깨지는 일이 없게 한다.
// 2) imageSize   : public 폴더 그림의 가로·세로 픽셀(jpg·png·svg)을 동기로 읽음
//    - 글 상단 대표 이미지·본문 이미지에 width/height 를 박아 화면 흔들림(CLS)을 막는 데 쓴다.
// 3) addImgDims  : 본문 HTML 속 <img> 에 width/height·지연 로딩 속성을 붙여 줌
//
// 작성일: 2026년 10월 29일 (폴리싱 묶음 C)
// ──────────────────────────────────────────────

import fs from "fs";
import path from "path";

const PUBLIC_DIR = path.join(process.cwd(), "public");

/** "/blog/글주소/hero.jpg" → 같은 폴더의 thumb.webp (있을 때만). 아니면 원래 주소 그대로 */
export function smallThumb(thumbnail: string | null): string | null {
  if (!thumbnail) return null;
  const m = /^\/blog\/([^/]+)\/hero\.jpg$/.exec(thumbnail);
  if (!m) return thumbnail; // svg 대표 그림 등은 원래 가벼우니 그대로
  const small = `/blog/${m[1]}/thumb.webp`;
  try {
    if (fs.existsSync(path.join(PUBLIC_DIR, small))) return small;
  } catch {
    /* 파일 확인 실패 = 원래 그림으로 */
  }
  return thumbnail;
}

/** 같은 그림을 여러 번 재지 않게 기억해 두는 곳(빌드 한 번 동안만 유지) */
const sizeCache = new Map<string, { width: number; height: number } | null>();

/** public 기준 주소(예: "/blog/a/hero.jpg")의 가로·세로. 모르면 null */
export function imageSize(publicPath: string): { width: number; height: number } | null {
  if (sizeCache.has(publicPath)) return sizeCache.get(publicPath)!;
  let result: { width: number; height: number } | null = null;
  try {
    // 바깥 주소(http…)나 ../ 같은 이상한 경로는 재지 않음
    if (publicPath.startsWith("/") && !publicPath.includes("..")) {
      const file = path.join(PUBLIC_DIR, decodeURIComponent(publicPath));
      if (fs.existsSync(file)) {
        const ext = path.extname(file).toLowerCase();
        if (ext === ".svg") result = svgSize(fs.readFileSync(file, "utf8"));
        else if (ext === ".png") result = pngSize(fs.readFileSync(file));
        else if (ext === ".jpg" || ext === ".jpeg") result = jpegSize(fs.readFileSync(file));
      }
    }
  } catch {
    result = null;
  }
  sizeCache.set(publicPath, result);
  return result;
}

/** SVG — viewBox 를 먼저 보고, 없으면 width/height 속성 */
function svgSize(text: string) {
  const head = text.slice(0, 2000);
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(head);
  if (vb) return { width: Math.round(+vb[1]), height: Math.round(+vb[2]) };
  const w = /<svg[^>]*\swidth\s*=\s*["']([\d.]+)/i.exec(head);
  const h = /<svg[^>]*\sheight\s*=\s*["']([\d.]+)/i.exec(head);
  if (w && h) return { width: Math.round(+w[1]), height: Math.round(+h[1]) };
  return null;
}

/** PNG — 16바이트째부터 가로(4바이트)·세로(4바이트) */
function pngSize(buf: Buffer) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** JPEG — 표식(마커)들을 건너뛰다 크기 정보 칸(SOF)을 만나면 세로·가로를 읽음 */
function jpegSize(buf: Buffer) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    // SOF0~SOF15 중 크기 정보가 든 것들(DHT·JPG·DAC 표식 C4·C8·CC 는 제외)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

/**
 * 본문 HTML 의 <img> 에 width/height(그림 원래 비율) + loading="lazy" + decoding="async" 를 붙인다.
 *  - 브라우저가 그림이 오기 전에 자리를 미리 잡아 둬서, 그림이 뜰 때 글이 아래로 밀리지 않는다(CLS 방지).
 *  - 이미 width 가 적힌 <img> 는 건드리지 않는다.
 *  - 글 파일(md) 자체는 그대로 두고 화면을 만들 때만 붙인다.
 */
export function addImgDims(html: string): string {
  return html.replace(/<img\b([^>]*?)(\/?)>/gi, (whole, attrs: string, slash: string) => {
    if (/\swidth\s*=/i.test(attrs)) return whole;
    const src = /\ssrc\s*=\s*"([^"]+)"/i.exec(attrs)?.[1];
    if (!src) return whole;
    const size = imageSize(src);
    let extra = "";
    if (size) extra += ` width="${size.width}" height="${size.height}"`;
    if (!/\sloading\s*=/i.test(attrs)) extra += ` loading="lazy"`;
    if (!/\sdecoding\s*=/i.test(attrs)) extra += ` decoding="async"`;
    return `<img${attrs}${extra}${slash}>`;
  });
}
