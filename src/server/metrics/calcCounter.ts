// ──────────────────────────────────────────────
// 계산기 실행 횟수 서버 집계 (calcCounter)
//
// 왜 필요한가:
//   GA4(구글 애널리틱스)는 브라우저에서 스크립트가 실행돼야 잡히는데, 광고 차단기를
//   쓰는 사람은 그 스크립트가 아예 안 돈다. 그래서 "실제로 서버가 계산을 성공시킨"
//   순간에 숫자를 올려두면, 광고 차단 여부와 무관하게 진짜 사용량을 알 수 있다.
//   개인정보는 전혀 담지 않는다 — 그날 총 횟수 / 모드별 횟수 / 평형대별 횟수뿐이다.
//
//   Upstash Redis(카카오 로그인 오류 진단용 authDiag.ts와 같은 서비스)에
//   INCR(숫자 1 증가) 명령으로 키를 쌓는다. 키 이름 규칙:
//     calc:run:{공정}:{YYYY-MM-DD}            → 그날 전체 실행 횟수
//     calc:run:{공정}:{YYYY-MM-DD}:{모드}      → quick(즉답) / precise(정밀) 모드별
//     calc:run:{공정}:{YYYY-MM-DD}:py:{평형대} → 10평 단위 버킷(20·30·40 …), 없으면 na
//
// 안전장치:
//   - 절대 계산 응답을 늦추거나 막지 않는다. Next.js의 after()로 "응답을 다 보낸 뒤"
//     백그라운드에서 실행하고, after()를 못 쓰는 상황(요청 컨텍스트 밖)이면 그냥
//     await 없이 바로 던져둔다(fire-and-forget).
//   - Upstash 환경변수가 없으면(로컬 개발 등) 아무 일도 안 하고 조용히 끝낸다.
//   - 네트워크 실패 등 어떤 이유로든 실패해도 예외를 절대 밖으로 던지지 않는다.
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

import { after } from 'next/server';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// 집계 키는 40일이 지나면 자동으로 사라지게 한다(계속 쌓여서 Redis 용량을 먹지 않도록).
// 검사관 권고(2026-09-14): 30일이면 월말에 그 달 첫날 키가 만료돼 월간 집계가 깨질 수
// 있어서, 한 달 + 여유(최대 31일 + 약 열흘)를 두고 40일로 늘렸다.
const TTL_SEC = 60 * 60 * 24 * 40;

/** 지금 이 순간을 한국시간(KST) "YYYY-MM-DD" 문자열로 바꾼다 */
function kstDateStr(): string {
  // UTC 시각에 9시간을 더한 뒤 UTC 필드로 읽으면 "한국 날짜"가 나오는 흔한 트릭
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 평(pyeong)을 10평 단위 버킷 문자열로 바꾼다 (예: 34 → "30"). 없으면 "na" */
function pyeongBucket(pyeong: number | undefined): string {
  if (pyeong === undefined || !Number.isFinite(pyeong)) return 'na';
  return String(Math.max(Math.floor(pyeong / 10) * 10, 0));
}

/** 주어진 키들을 Upstash Redis 파이프라인으로 한 번에 INCR + EXPIRE 한다 (실패해도 삼킨다) */
async function incrKeys(keys: string[]): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return; // 자격증명이 없으면 조용히 건너뜀(로컬 개발 등)
  try {
    // 키마다 [INCR, EXPIRE] 두 명령을 넣어 한 번의 HTTP 요청으로 다 처리한다
    const commands = keys.flatMap((k) => [
      ['INCR', k],
      ['EXPIRE', k, TTL_SEC],
    ]);
    await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      cache: 'no-store',
    });
  } catch {
    // 집계 실패가 계산 기능에 영향을 주면 안 되므로 조용히 무시
  }
}

/**
 * 계산 성공 1건을 기록한다. API 라우트에서 계산이 성공했을 때 딱 한 번 호출한다.
 * 응답을 늦추지 않도록 항상 백그라운드로 실행되고, 절대 예외를 던지지 않는다.
 *
 * @param processName 공정 이름 — 'wallpaper'(도배) | 'flooring'(바닥재)
 * @param mode '평형' 입력 모드면 '즉답'에 해당하는 'quick', 그 외(실측·면적)는 'precise'
 * @param pyeong 평형 입력값 — 평형 모드가 아니면 undefined(버킷은 'na'로 기록됨)
 */
export function recordCalcRun(
  processName: 'wallpaper' | 'flooring',
  mode: 'quick' | 'precise',
  pyeong?: number,
): void {
  const date = kstDateStr();
  const bucket = pyeongBucket(pyeong);
  const keys = [
    `calc:run:${processName}:${date}`,
    `calc:run:${processName}:${date}:${mode}`,
    `calc:run:${processName}:${date}:py:${bucket}`,
  ];

  // after()는 "응답을 사용자에게 다 보낸 뒤" 실행해 주는 Next.js 훅이라 응답 지연이 0이다.
  // 요청 컨텍스트 밖(예: 스크립트에서 직접 호출)에서 부르면 after()가 예외를 던질 수 있으니
  // 그때는 그냥 기다리지 않고 바로 실행한다(둘 다 실패해도 위 incrKeys 안에서 조용히 삼켜짐).
  try {
    after(() => incrKeys(keys));
  } catch {
    void incrKeys(keys);
  }
}
