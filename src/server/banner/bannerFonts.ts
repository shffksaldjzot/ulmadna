// ─────────────────────────────────────────────────────────────
// 배너 그리기용 글꼴 읽기 (서버 전용) — 2026년 11월 24일
//
//   assets/banner-fonts/ 의 글꼴 파일을 처음 한 번만 읽어 서버 메모리에 담아 둔다
//   (같은 서버가 다음 배너를 그릴 때는 다시 읽지 않음).
//   배포 때 이 폴더가 함수에 같이 실리도록 next.config.ts 의 outputFileTracingIncludes 에 적어 두었다.
//   스타일마다 쓰는 글꼴만 넘긴다(그리기 도구가 글꼴을 읽는 시간이 줄어든다).
// ─────────────────────────────────────────────────────────────
import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { FONT_FILES } from './bannerText';

/** 그리기 도구(satori)에 넘기는 글꼴 한 개 */
export interface SatoriFont {
  name: string;
  data: ArrayBuffer;
  weight: 300 | 400 | 700 | 800 | 900;
  style: 'normal';
}

/** 글꼴 폴더(프로젝트 뿌리 기준) */
const DIR = path.join(process.cwd(), 'assets', 'banner-fonts');
/** 읽어 둔 글꼴(파일 이름 → 내용) */
const cache = new Map<string, Promise<ArrayBuffer>>();

/** 파일 하나 읽기(같은 파일은 한 번만) */
function load(file: string): Promise<ArrayBuffer> {
  let p = cache.get(file);
  if (!p) {
    p = readFile(path.join(DIR, file)).then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
    // 읽기에 실패하면 다음 번에 다시 시도하도록 담아 둔 것을 지운다
    p.catch(() => cache.delete(file));
    cache.set(file, p);
  }
  return p;
}

/**
 * 글꼴 이름 목록 → satori 글꼴 목록. 고딕(NotoKR)은 늘 넣는다
 *   (다른 글꼴에 없는 글자 — 명조·검은고딕의 드문 한글 등 — 를 고딕이 대신 그린다)
 */
export async function fontsFor(families: string[]): Promise<SatoriFont[]> {
  const want = new Set([...families, 'NotoKR']);
  // 검은고딕 스타일이면 드문 한글을 대신 그릴 굵은 고딕도 싣는다(bannerText.ts familyStack)
  if (want.has('BlackHan')) want.add('NotoKRHeavy');
  const jobs: Promise<SatoriFont>[] = [];
  for (const fam of want) {
    for (const [w, file] of Object.entries(FONT_FILES[fam] ?? {})) {
      jobs.push(load(file).then((data) => ({ name: fam, data, weight: Number(w) as SatoriFont['weight'], style: 'normal' as const })));
    }
  }
  return Promise.all(jobs);
}
