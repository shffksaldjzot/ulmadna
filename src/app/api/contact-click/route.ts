// ──────────────────────────────────────────────
// 문의 클릭 집계 API — POST /api/contact-click
//
// 전화·카톡 버튼을 누르면 화면(lib/contact.ts의 trackContactClick)이 이 주소로
// 가벼운 요청 하나를 보낸다. 여기서는 채널(전화/카톡)만 확인해서 서버 집계
// (recordContactClick)에 1건 넘기고 끝난다 — 개인정보는 아예 받지 않는다.
//
// 실패해도 화면에 영향이 없어야 하는 요청이라 검증을 최소화하고, 어떤 이유로든
// 문제가 생기면 그냥 400/500을 돌려줄 뿐 서버가 죽지 않는다(호출하는 쪽도 실패를 무시함).
//
// 작성일: 2026년 09월 16일
// ──────────────────────────────────────────────

import { NextResponse } from "next/server";
import { recordContactClick } from "@/server/metrics/contactClick";

/** 이 라우트는 매번 새로 처리한다 (캐시 금지) */
export const dynamic = "force-dynamic";

/** 값이 객체인지 확인하는 아주 작은 도우미 */
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** POST — 문의 버튼 클릭 1건 기록 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON 형식이 아닙니다" }, { status: 400 });
  }

  const channel = isObject(body) && (body.channel === "phone" || body.channel === "kakao") ? body.channel : null;
  if (!channel) {
    return NextResponse.json({ ok: false, error: "channel 은 phone 또는 kakao 여야 합니다" }, { status: 400 });
  }

  // service·place 값은 지금은 서버 집계에 쓰지 않는다(채널별 총량만 센다) — 굳이 검증하지 않고 무시한다.
  // 나중에 서비스별·위치별 집계가 필요해지면 여기서 값을 더 읽어 recordContactClick에 넘기면 된다.
  recordContactClick(channel);

  return NextResponse.json({ ok: true });
}

/** GET — 지원하지 않음 (기록은 POST 로만) */
export async function GET() {
  return NextResponse.json(
    { error: "POST 로 요청해 주세요" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
