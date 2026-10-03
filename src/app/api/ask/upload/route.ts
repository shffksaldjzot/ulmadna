// ──────────────────────────────────────────────
// 물어보기 — 견적서 사진 올리기 "허가증" 발급
//
// POST /api/ask/upload  { size, type }  (로그인 필요)
//   → { path, signedUrl }
//
// [왜 사진을 서버가 직접 받지 않나]
//   Vercel 서버는 한 번에 받을 수 있는 크기가 약 4.5MB라 10MB 사진이 막힌다.
//   그래서 서버는 "이 경로에 한 번 올려도 된다"는 서명된 업로드 주소만 만들어 주고,
//   브라우저가 그 주소로 Supabase 보관함에 바로 올린다.
//
// [어디에 올라가나]
//   비공개 보관함 ask-photos-raw / {회원번호}/{날짜}/{무작위}.{확장자}
//   원본은 전화번호·동호수가 그대로라 공개하지 않는다. 집컴이 가린 사본을 만들어
//   공개 보관함(ask-photos)에 넣으면 그때부터 화면에 보인다.
//   크기(10MB)·형식(jpg·png·heic) 제한은 여기서 한 번, 보관함 설정에서 한 번 더 막는다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { currentUserId, fail } from '@/lib/ask/session';
import { adminOrNull } from '@/lib/ask/server';
import { LIMITS, PHOTO_TYPES } from '@/lib/ask/constants';

export const dynamic = 'force-dynamic';

/** 형식 → 확장자 */
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return fail(401, '로그인이 필요해요');
  const sb = adminOrNull();
  if (!sb) return fail(503, '지금은 사진을 올릴 수 없어요');

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return fail(400, '보낸 내용을 읽지 못했어요');
  }
  const size = Number(input.size);
  const type = typeof input.type === 'string' ? input.type.toLowerCase() : '';
  if (!PHOTO_TYPES.includes(type)) return fail(400, 'jpg · png · heic 사진만 올릴 수 있어요');
  if (!Number.isFinite(size) || size <= 0 || size > LIMITS.photoBytes) return fail(400, '사진은 한 장에 10MB까지예요');

  // 경로: 회원번호/YYYYMMDD/무작위.확장자 — 회원번호로 시작해야 질문 저장 때 "내 사진"으로 인정된다
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const path = `${uid}/${day}/${crypto.randomUUID()}.${EXT[type]}`;

  const { data, error } = await sb.storage.from('ask-photos-raw').createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[ask][upload]', error?.message);
    return fail(500, '사진을 올릴 준비를 못 했어요');
  }
  return NextResponse.json({ path, signedUrl: data.signedUrl }, { headers: { 'Cache-Control': 'no-store' } });
}
