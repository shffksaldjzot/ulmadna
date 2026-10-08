// 동시 접속자 수 — Upstash Redis(무료) 정렬셋 heartbeat. 환경변수 없으면 count:null
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
import { NextRequest, NextResponse } from "next/server";

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "presence";
const WINDOW = 30;

async function pipeline(cmds: unknown[][]) {
  const res = await fetch(`${URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  return res.json();
}

export async function GET(req: NextRequest) {
  if (!URL || !TOKEN) return NextResponse.json({ count: null });
  const id = req.nextUrl.searchParams.get("id") || "anon";
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - WINDOW;
  try {
    // 2026-10-08: EXPIRE를 매 핑마다 보내면 Upstash 요청 수(월 50만 건 한도)를 더 빨리 태운다.
    // 키 안전망(EXPIRE)은 매번 할 필요 없이 10번에 1번만 보내도 충분 — 명령 수를 줄여 한도를 아낀다.
    const cmds: unknown[][] = [
      ["ZADD", KEY, String(now), id],
      ["ZREMRANGEBYSCORE", KEY, "0", String(cutoff)],
      ["ZCARD", KEY],
    ];
    if (Math.random() < 0.1) cmds.push(["EXPIRE", KEY, "120"]);
    const r = await pipeline(cmds);
    const count = Array.isArray(r) ? r[2]?.result ?? null : null;
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: null });
  }
}
