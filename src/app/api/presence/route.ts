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
    const r = await pipeline([
      ["ZADD", KEY, String(now), id],
      ["ZREMRANGEBYSCORE", KEY, "0", String(cutoff)],
      ["ZCARD", KEY],
      ["EXPIRE", KEY, "120"],
    ]);
    const count = Array.isArray(r) ? r[2]?.result ?? null : null;
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: null });
  }
}
