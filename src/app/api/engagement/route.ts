// 블로그 조회수 + 좋아요 — Upstash Redis(무료)
//   GET  ?slug=X        → {views, likes} (읽기만)
//   GET  ?slug=X&hit=1  → 조회수 +1 후 {views, likes}  (글 볼 때 1회)
//   POST ?slug=X        → 좋아요 +1 후 {likes}          (로그인 없이, 브라우저당 1회는 클라가 제어)
// 환경변수(UPSTASH_REDIS_REST_URL/TOKEN) 없으면 null 반환 → UI 자동 숨김
import { NextRequest, NextResponse } from "next/server";

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function pipeline(cmds: unknown[][]) {
  const res = await fetch(`${URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  return res.json();
}

// slug 검증 (Redis 키 인젝션 방지)
function clean(slug: string | null) {
  return (slug || "").replace(/[^a-z0-9-]/gi, "").slice(0, 80);
}
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

export async function GET(req: NextRequest) {
  if (!URL || !TOKEN) return NextResponse.json({ views: null, likes: null });
  const slug = clean(req.nextUrl.searchParams.get("slug"));
  if (!slug) return NextResponse.json({ views: null, likes: null });
  const hit = req.nextUrl.searchParams.get("hit") === "1";
  try {
    const r = hit
      ? await pipeline([["INCR", `views:${slug}`], ["GET", `likes:${slug}`]])
      : await pipeline([["GET", `views:${slug}`], ["GET", `likes:${slug}`]]);
    return NextResponse.json({ views: num(r?.[0]?.result), likes: num(r?.[1]?.result) });
  } catch {
    return NextResponse.json({ views: null, likes: null });
  }
}

export async function POST(req: NextRequest) {
  if (!URL || !TOKEN) return NextResponse.json({ likes: null });
  const slug = clean(req.nextUrl.searchParams.get("slug"));
  if (!slug) return NextResponse.json({ likes: null });
  try {
    const r = await pipeline([["INCR", `likes:${slug}`]]);
    return NextResponse.json({ likes: num(r?.[0]?.result) });
  } catch {
    return NextResponse.json({ likes: null });
  }
}
