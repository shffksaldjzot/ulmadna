// ─────────────────────────────────────────────────────────────
// 배너 글자 다루기 — 지우기·폭 재기·줄 나누기·크기 맞추기 (2026년 11월 24일)
//
// [왜 필요한가]
//   서버 그리기 도구(satori)는 글자가 넘쳐도 알아서 줄이지 않는다.
//   광고주가 긴 상호·긴 문구를 넣어도 배너 밖으로 넘치거나 잘린 채 나가지 않게,
//   그리기 전에 여기서 글자 폭을 재서 (1) 줄을 나누고 (2) 안 들어가면 글자를 조금씩 줄이고
//   (3) 가장 작게 해도 안 들어가면 마지막 줄 끝을 "…" 로 줄인다.
//   글자 폭은 실제 글꼴 파일에서 뽑은 표(assets/banner-fonts/metrics.json)를 쓴다.
//
//   한자·이모지처럼 글꼴에 없는 글자는 네모(깨진 글자)로 나오므로 그리기 전에 지운다.
// ─────────────────────────────────────────────────────────────
import metricsJson from '../../../assets/banner-fonts/metrics.json';

/** 글꼴 파일별 폭 표: hangul = 한글 한 글자 폭(1em 비율), chars = 그 밖 글자별 폭 */
type FontMetrics = { hangul: number; uniform?: boolean; chars: Record<string, number> };
const METRICS = metricsJson as Record<string, FontMetrics>;

/** 글꼴 이름(그리기 때 쓰는 이름) → 굵기별 파일 이름. bannerFonts.ts 와 같아야 한다 */
export const FONT_FILES: Record<string, Record<number, string>> = {
  NotoKR: { 400: 'NotoSansKR-400.ttf', 700: 'NotoSansKR-700.ttf', 800: 'NotoSansKR-800.ttf', 900: 'NotoSansKR-900.ttf' },
  NotoSerif: { 400: 'NotoSerifKR-400.ttf', 700: 'NotoSerifKR-700.ttf' },
  BlackHan: { 400: 'BlackHanSans-400.ttf' },
  Gmarket: { 700: 'GmarketSans-700.ttf' },
  PretLight: { 300: 'Pretendard-300.otf' },
  PretBlack: { 900: 'Pretendard-900.otf' },
  // 검은고딕에 없는 드문 한글을 대신 그릴 굵은 고딕(검은고딕은 굵기가 400 하나라 보통 고딕 400 으로 대신 나오면 너무 가늘다)
  NotoKRHeavy: { 400: 'NotoSansKR-900.ttf' },
};

/** 글꼴 이름 → 그리기 때 쓰는 글꼴 줄(없는 글자를 대신 그릴 고딕을 뒤에 붙인다) */
export function familyStack(family: string): string {
  if (family === 'NotoKR') return 'NotoKR';
  return family === 'BlackHan' ? 'BlackHan, NotoKRHeavy' : `${family}, NotoKR`;
}

/**
 * 그 굵기에 실제로 쓰일 파일을 고른다(CSS 굵기 고르기 규칙과 같게).
 *   400~500 을 원하면 그 아래부터, 500 넘으면 그 위부터 찾는다.
 */
export function fontFileFor(family: string, weight: number): string {
  const table = FONT_FILES[family] ?? FONT_FILES.NotoKR;
  const ws = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (table[weight]) return table[weight];
  const below = ws.filter((w) => w < weight).reverse();
  const above = ws.filter((w) => w > weight);
  const order = weight <= 500 ? [...below, ...above] : [...above, ...below];
  return table[order[0]];
}

/** 글꼴에 있는 글자인가(build-banner-fonts.py 의 RANGES 와 같은 범위) */
function isDrawable(cp: number): boolean {
  return (
    (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) ||
    (cp >= 0x2010 && cp <= 0x2027) || (cp >= 0x2030 && cp <= 0x203b) ||
    cp === 0x2116 || cp === 0x2122 || (cp >= 0x2190 && cp <= 0x2193) ||
    (cp >= 0x25a0 && cp <= 0x25ff) || (cp >= 0x3000 && cp <= 0x303f) ||
    (cp >= 0x3131 && cp <= 0x318e) || (cp >= 0x3200 && cp <= 0x327f) ||
    (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xff01 && cp <= 0xff5e)
  );
}

/** 그릴 수 없는 글자(한자·이모지 등)를 지우고 빈칸을 하나로 모은다 */
export function cleanBannerText(v: unknown, max = 80): string {
  if (typeof v !== 'string') return '';
  // 한글 자모가 따로 들어온 경우(맥 등에서 풀어진 한글)를 완성형으로 합친다
  const s = v.normalize('NFC');
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    out += isDrawable(cp) ? ch : cp <= 0x20 || ch === '　' ? ' ' : '';
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * 글자 하나 폭(1em 비율)
 *   그 글꼴에 없는 글자(예: 검은고딕의 숫자·%·!)는 그릴 때 고딕(Noto Sans KR)이 대신 그리므로 고딕 폭으로 잰다.
 */
function charEm(m: FontMetrics, ch: string, fallback: FontMetrics): number {
  if (m.chars[ch] != null) return m.chars[ch];
  const cp = ch.codePointAt(0) ?? 0;
  const isHangul = cp >= 0xac00 && cp <= 0xd7a3;
  // 한글 폭이 하나로 같은 글꼴(uniform)은 표에 한글을 따로 적지 않았다(hangul 한 값)
  if (isHangul && m.uniform !== false) return m.hangul;
  if (fallback.chars[ch] != null) return fallback.chars[ch];
  if (isHangul) return fallback.hangul;
  return 1; // 어디에도 없으면 넉넉하게 1em
}

/** 글자 모양 하나: 글꼴·굵기·크기(px)·글자 간격(em) */
export interface TextFont {
  family: string;
  weight: number;
  size: number;
  /** 글자 간격(em 단위, 예: -0.02) */
  spacing?: number;
}

/** 글줄 폭(px) */
export function textWidth(text: string, f: TextFont): number {
  // 그 글꼴에 없는 글자를 대신 그리는 고딕의 폭(검은고딕이면 굵은 고딕)
  const fb = METRICS[f.family === 'BlackHan' ? 'NotoSansKR-900.ttf' : fontFileFor('NotoKR', f.weight)] ?? METRICS['NotoSansKR-400.ttf'];
  const m = METRICS[fontFileFor(f.family, f.weight)] ?? fb;
  let em = 0;
  let n = 0;
  for (const ch of text) {
    em += charEm(m, ch, fb);
    n++;
  }
  return (em + (f.spacing ?? 0) * n) * f.size;
}

/** 강조가 섞인 글 조각 */
export interface Seg {
  text: string;
  em: boolean;
}

/**
 * 강조할 곳 고르기:
 *   1) 광고주가 *글자* 로 감쌌으면 그곳
 *   2) 아니면 숫자가 든 첫 낱말(예: 30%, 15년)
 *   3) 아니면 두 낱말 이상일 때 마지막 낱말(견본처럼 "벽지 한 장도 *정직하게*")
 */
export function emphasize(text: string): Seg[] {
  if (/\*[^*]+\*/.test(text)) {
    const out: Seg[] = [];
    text.split(/(\*[^*]+\*)/).forEach((p) => {
      if (!p) return;
      const em = /^\*[^*]+\*$/.test(p);
      out.push({ text: em ? p.slice(1, -1) : p.replace(/\*/g, ''), em });
    });
    return out.filter((s) => s.text);
  }
  const words = text.split(' ');
  let idx = words.findIndex((w) => /\d/.test(w));
  if (idx < 0 && words.length >= 2) idx = words.length - 1;
  if (idx < 0) return [{ text, em: false }];
  const out: Seg[] = [];
  const before = words.slice(0, idx).join(' ');
  const after = words.slice(idx + 1).join(' ');
  if (before) out.push({ text: `${before} `, em: false });
  out.push({ text: words[idx], em: true });
  if (after) out.push({ text: ` ${after}`, em: false });
  return out;
}

/** 줄 하나 = 조각 목록 */
export type Line = Seg[];

/** 조각 폭(강조 조각은 강조 글꼴·배율로) */
function segWidth(s: Seg, base: TextFont, emFont: TextFont): number {
  return textWidth(s.text, s.em ? emFont : base);
}

/** 조각 목록을 낱말 단위(빈칸 포함) 토막으로 쪼갠다 — 한국어 줄바꿈은 낱말 단위(keep-all)로 */
function tokens(segs: Seg[]): Seg[] {
  const out: Seg[] = [];
  for (const s of segs) {
    for (const t of s.text.split(/(\s+)/)) if (t) out.push({ text: t, em: s.em });
  }
  return out;
}

/** 줄 끝 빈칸 지우기 */
function trimLine(l: Line): Line {
  const c = l.map((s) => ({ ...s }));
  while (c.length && !c[c.length - 1].text.trim()) c.pop();
  if (c.length) c[c.length - 1].text = c[c.length - 1].text.replace(/\s+$/, '');
  while (c.length && !c[0].text.trim()) c.shift();
  return c;
}

/** 폭에 맞춰 줄 나누기. 한 낱말이 한 줄보다 길면 글자 단위로 자른다 */
export function wrapSegs(segs: Seg[], width: number, base: TextFont, emFont: TextFont): Line[] {
  const lines: Line[] = [];
  let cur: Line = [];
  let w = 0;
  const push = () => {
    const t = trimLine(cur);
    if (t.length) lines.push(t);
    cur = [];
    w = 0;
  };
  for (const tk of tokens(segs)) {
    const tw = segWidth(tk, base, emFont);
    if (!tk.text.trim()) {
      if (cur.length) { cur.push(tk); w += tw; }
      continue;
    }
    if (w + tw <= width) { cur.push(tk); w += tw; continue; }
    if (cur.length) push();
    if (tw <= width) { cur.push(tk); w = tw; continue; }
    // 낱말 하나가 줄보다 길다 → 글자 단위로 끊는다
    let piece = '';
    for (const ch of tk.text) {
      const cw = segWidth({ text: piece + ch, em: tk.em }, base, emFont);
      if (cw > width && piece) {
        cur.push({ text: piece, em: tk.em });
        push();
        piece = ch;
      } else piece += ch;
    }
    if (piece) { cur.push({ text: piece, em: tk.em }); w = segWidth({ text: piece, em: tk.em }, base, emFont); }
  }
  push();
  return lines;
}

/** 줄 폭 */
export function lineWidth(l: Line, base: TextFont, emFont: TextFont): number {
  return l.reduce((a, s) => a + segWidth(s, base, emFont), 0);
}

/** 한 줄을 폭에 맞게 끝을 "…" 로 줄인다 */
export function ellipsizeLine(l: Line, width: number, base: TextFont, emFont: TextFont): Line {
  if (lineWidth(l, base, emFont) <= width) return l;
  const flat: { ch: string; em: boolean }[] = [];
  for (const s of l) for (const ch of s.text) flat.push({ ch, em: s.em });
  while (flat.length) {
    flat.pop();
    while (flat.length && flat[flat.length - 1].ch === ' ') flat.pop();
    const out: Line = [];
    for (const f of flat) {
      const last = out[out.length - 1];
      if (last && last.em === f.em) last.text += f.ch;
      else out.push({ text: f.ch, em: f.em });
    }
    const em = out.length ? out[out.length - 1].em : false;
    const withDots: Line = [...out.map((s) => ({ ...s }))];
    if (withDots.length && withDots[withDots.length - 1].em === em) withDots[withDots.length - 1].text += '…';
    else withDots.push({ text: '…', em });
    if (lineWidth(withDots, base, emFont) <= width) return withDots;
  }
  return [{ text: '…', em: false }];
}

/** 맞추기 결과: 쓸 글자 크기(px)와 줄들 */
export interface Fitted {
  size: number;
  lines: Line[];
  /** 끝을 "…" 로 줄였는지(시험·점검용) */
  cut: boolean;
}

/**
 * 글을 칸(폭 width, 줄 수 maxLines)에 맞춘다.
 *   글자 크기를 base.size 부터 minSize 까지 0.5px 씩 줄여 보며 다 들어가는 가장 큰 크기를 고른다.
 *   가장 작게 해도 안 들어가면 maxLines 줄까지만 두고 마지막 줄 끝을 "…" 로 줄인다.
 *   emScale = 강조 글자 배율(견본의 1.15em 등), emFamily = 강조 글꼴(없으면 같은 글꼴)
 */
export function fitText(
  segs: Seg[],
  opt: { width: number; maxLines: number; base: TextFont; minSize: number; emScale?: number; emFamily?: string; emWeight?: number },
): Fitted {
  const mk = (size: number) => {
    const base = { ...opt.base, size };
    const emFont = { ...opt.base, family: opt.emFamily ?? opt.base.family, weight: opt.emWeight ?? opt.base.weight, size: size * (opt.emScale ?? 1) };
    return { base, emFont };
  };
  for (let size = opt.base.size; size >= opt.minSize - 1e-9; size -= 0.5) {
    const { base, emFont } = mk(size);
    const lines = wrapSegs(segs, opt.width, base, emFont);
    if (lines.length <= opt.maxLines) return { size, lines, cut: false };
  }
  const { base, emFont } = mk(opt.minSize);
  const lines = wrapSegs(segs, opt.width, base, emFont).slice(0, opt.maxLines);
  if (!lines.length) return { size: opt.minSize, lines: [], cut: false };
  // 남은 글이 있었다는 표시로 마지막 줄 끝에 … 를 붙인다(폭이 넘치면 더 줄임)
  const last = lines[lines.length - 1].map((s) => ({ ...s }));
  last[last.length - 1].text += '…';
  lines[lines.length - 1] = ellipsizeLine(last, opt.width, base, emFont);
  return { size: opt.minSize, lines, cut: true };
}
