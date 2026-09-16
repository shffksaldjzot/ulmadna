// ──────────────────────────────────────────────
// 문의(전화·카톡) 클릭 횟수 서버 집계 — calcCounter.ts와 같은 방식
//
// 왜 필요한가:
//   GA4는 광고 차단기를 쓰는 사람에게는 아예 안 잡힌다. "문의 버튼을 실제로 눌렀는지"는
//   서버가 직접 세는 게 안전해서, 계산기 실행 횟수(calcCounter.ts)와 똑같은 방식으로
//   Upstash Redis에 INCR(숫자 1 증가) 키를 쌓는다. 개인정보는 전혀 담지 않는다 —
//   그날 채널별(전화/카톡) 총 클릭 수뿐이다.
//
//   키 이름 규칙: contact:click:{channel}:{YYYY-MM-DD}
//   (channel = phone | kakao)
//
// 안전장치: calcCounter.ts와 동일 — 응답을 늦추지 않고(after() 사용), 자격증명이 없거나
//   네트워크가 실패해도 절대 예외를 던지지 않는다.
//
// 작성일: 2026년 09월 16일
// ──────────────────────────────────────────────

import { after } from "next/server";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// 40일 뒤 자동 만료 — calcCounter.ts와 같은 값(월간 집계가 월말에 깨지지 않도록 31일+여유)
const TTL_SEC = 60 * 60 * 24 * 40;

/** 지금 이 순간을 한국시간(KST) "YYYY-MM-DD" 문자열로 바꾼다 */
function kstDateStr(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 키 하나를 Upstash Redis 파이프라인으로 INCR + EXPIRE 한다 (실패해도 조용히 삼킨다) */
async function incrKey(key: string): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return; // 자격증명이 없으면(로컬 개발 등) 조용히 건너뜀
  try {
    await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, TTL_SEC],
      ]),
      cache: "no-store",
    });
  } catch {
    // 집계 실패가 문의 기능에 영향을 주면 안 되므로 조용히 무시
  }
}

/**
 * 문의 버튼 클릭 1건을 기록한다. API 라우트(/api/contact-click)가 요청을 받을 때마다 부른다.
 * 응답을 늦추지 않도록 항상 백그라운드로 실행되고, 절대 예외를 던지지 않는다.
 *
 * @param channel 'phone'(전화) | 'kakao'(카톡)
 */
export function recordContactClick(channel: "phone" | "kakao"): void {
  const key = `contact:click:${channel}:${kstDateStr()}`;

  // after()는 "응답을 다 보낸 뒤" 실행되는 Next.js 훅이라 응답 지연이 0이다.
  // 요청 컨텍스트 밖에서 부르면 after()가 예외를 던질 수 있어 그때는 바로 실행한다.
  try {
    after(() => incrKey(key));
  } catch {
    void incrKey(key);
  }
}
