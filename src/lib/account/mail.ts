// ──────────────────────────────────────────────
// 비밀번호 재설정 메일 보내기 (Resend) — 서버 전용
//
// RESEND_API_KEY · RESEND_FROM 두 값이 서버 환경변수에 있을 때만 보낸다.
// 없으면 mailEnabled()가 false → 화면은 "메일 재설정은 준비 중이에요 · 문의로 도와드려요" 안내 모드.
// 키가 없어도 빌드·동작에 문제가 없게 만들었다(이 파일은 키를 읽기만 한다).
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import 'server-only';

/** 메일 발송이 가능한 상태인지 */
export function mailEnabled(): boolean {
  return !!(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim());
}

/** 재설정 메일 본문(글자·HTML) — 짧게, 링크 하나 */
export function resetMailTemplate(username: string, link: string): { subject: string; text: string; html: string } {
  const subject = '[얼마드나] 비밀번호 재설정 링크';
  const text = [
    `${username} 님, 비밀번호 재설정 요청을 받았어요.`,
    '',
    `아래 링크에서 새 비밀번호를 정해 주세요(30분 동안 한 번만 쓸 수 있어요).`,
    link,
    '',
    '직접 요청하지 않았다면 이 메일은 무시하셔도 돼요.',
    '— 얼마드나',
  ].join('\n');
  const safeName = username.replace(/[<>&"]/g, '');
  const html = `<div style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#2A2018">
<p style="font-size:16px;margin:0 0 12px"><b>${safeName}</b> 님, 비밀번호 재설정 요청을 받았어요.</p>
<p style="font-size:14px;color:#6B5D4F;margin:0 0 20px">아래 단추를 눌러 새 비밀번호를 정해 주세요. 30분 동안 한 번만 쓸 수 있어요.</p>
<p style="margin:0 0 20px"><a href="${link}" style="display:inline-block;background:#C0613A;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">새 비밀번호 정하기</a></p>
<p style="font-size:13px;color:#A79C90;margin:0">직접 요청하지 않았다면 이 메일은 무시하셔도 돼요. — 얼마드나</p></div>`;
  return { subject, text, html };
}

/** 보내기 — 성공 여부만 돌려준다(실패 이유에 주소·열쇠를 남기지 않음) */
export async function sendResetMail(to: string, username: string, link: string): Promise<boolean> {
  if (!mailEnabled()) return false;
  const { subject, text, html } = resetMailTemplate(username, link);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM!.trim(), to: [to], subject, text, html }),
      cache: 'no-store',
    });
    if (!r.ok) console.error('[account][mail] 발송 실패', r.status);
    return r.ok;
  } catch {
    console.error('[account][mail] 발송 오류');
    return false;
  }
}
