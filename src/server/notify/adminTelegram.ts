// ─────────────────────────────────────────────────────────────
// 관리자 텔레그램 알림 한 줄 (서버 전용) — 2026년 11월 24일
//
//   이미 쓰고 있는 알림 수단(킵얼라이브 크론 src/app/api/cron/supabase-keepalive/route.ts 의 notifyTelegram)과
//   같은 환경변수(TELEGRAM_BOT_TOKEN · TELEGRAM_CHAT_ID)·같은 방식으로 보낸다. 새 알림 채널을 만들지 않는다.
//   환경변수가 없거나 전송이 실패해도 조용히 넘어간다(부르는 쪽 처리에 영향 없음). 5초 넘게 걸리면 끊는다.
// ─────────────────────────────────────────────────────────────
import 'server-only';

/** 텔레그램으로 관리자에게 한 줄 보낸다. 보냈으면 true */
export async function notifyAdminTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false; // 설정 안 된 환경(로컬·시험)은 보내지 않음
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' }, // 한글 깨짐 방지
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
