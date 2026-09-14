// ──────────────────────────────────────────────
// 블로그 글 "좋아요" 익명 카운트 — Upstash Redis
//
// [왜 서버에 따로 두나]
// 좋아요 숫자를 브라우저에만 저장하면 사람마다 다른 숫자를 본다. 누가 눌렀는지는
// 전혀 모르고(개인정보 없음) "이 글에 좋아요가 총 몇 번 눌렸는지"만 Redis에 숫자 하나로 쌓는다.
//
// [키 이름을 왜 새로 안 만들었나 — 검사관 지적(2026-09-15) 반영]
// 처음엔 "blog:like:{slug}"라는 새 키로 만들었는데, 그러면 예전부터 /api/engagement
// (PostEngagement.tsx가 쓰던 좋아요)가 쌓아온 숫자와 완전히 끊겨서 0부터 다시 세게 된다.
// 같은 값을 세는 카운터이므로 /api/engagement가 쓰던 키 "likes:{slug}"를 그대로 이어 쓴다
// (레디스 INCR/DECR 명령의 의미는 어느 라우트에서 부르든 동일해서 안전하게 공유할 수 있다).
//
// [왜 calcCounter처럼 after()를 안 쓰나]
// calcCounter는 "쌓아두기만" 하면 되고 응답에 숫자가 필요 없어서 fire-and-forget이 맞는다.
// 여기는 토글 버튼을 누른 사람에게 "지금 몇 개인지" 바로 보여줘야 해서 결과를 기다려야 한다.
// 대신 어떤 이유로든 실패하면 null을 돌려주고, 화면(PostActions)은 낙관적으로 계산한 숫자를
// 그대로 유지해서 기능이 끊기지 않는다.
//
// 작성일: 2026년 09월 15일
// ──────────────────────────────────────────────

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** Redis 키 인젝션 방지 — slug는 영문 소문자/숫자/하이픈만 허용 */
function cleanSlug(slug: string): string {
  return (slug || "").replace(/[^a-z0-9-]/gi, "").slice(0, 80);
}

/** Upstash REST 파이프라인으로 명령 하나를 실행하고 결과값만 뽑아온다 (실패하면 null) */
async function redisCmd(cmd: (string | number)[]): Promise<unknown> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null; // 로컬 개발 등 자격증명 없으면 조용히 건너뜀
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([cmd]),
      cache: "no-store",
    });
    const data = await res.json();
    return data?.[0]?.result ?? null;
  } catch {
    return null; // 네트워크 실패 등은 화면에 영향 주지 않도록 조용히 삼킴
  }
}

/**
 * 이 글의 현재 좋아요 수를 읽는다. 글 페이지가 서버에서 렌더될 때 초기값으로 쓴다.
 * Upstash 미설정·실패·아직 아무도 안 누른 글이면 0을 돌려준다(절대 예외를 던지지 않음).
 */
export async function getBlogLikeCount(slug: string): Promise<number> {
  const s = cleanSlug(slug);
  if (!s) return 0;
  const r = await redisCmd(["GET", `likes:${s}`]);
  const n = Number(r);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 좋아요를 켜거나(on=true → +1) 끈다(on=false → -1). 바뀐 뒤 최종 숫자를 돌려준다.
 * 실패하면 null — 이때 클라이언트는 자기가 낙관적으로 계산해둔 숫자를 그대로 쓴다.
 */
export async function toggleBlogLike(slug: string, on: boolean): Promise<number | null> {
  const s = cleanSlug(slug);
  if (!s) return null;
  const key = `likes:${s}`;
  const r = await redisCmd([on ? "INCR" : "DECR", key]);
  const n = Number(r);
  if (!Number.isFinite(n)) return null;
  // 빠르게 반복 클릭하거나 상태가 꼬이면 DECR이 0 밑으로 내려갈 수 있어서 방지선을 둔다
  if (n < 0) {
    await redisCmd(["SET", key, "0"]);
    return 0;
  }
  return n;
}
