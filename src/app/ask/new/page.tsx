// ──────────────────────────────────────────────
// /ask/new — 질문하기 화면 (시안 new.html)
//
// 서버는 "블로그 글에서 왔는지(?from=글주소)"만 확인해 글 제목을 찾아 넘기고,
// 나머지(로그인 확인·사진 올리기·입력·보내기)는 전부 브라우저 부품(AskNewForm)이 한다.
// 검색에 넣을 화면이 아니라 noindex.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import type { Metadata } from 'next';
import AskShell from '@/components/ask/AskShell';
import AskNewForm from '@/components/ask/AskNewForm';
import { blogPostRef } from '@/lib/ask/blogref';

export const metadata: Metadata = {
  title: '질문하기 — 얼마드나 물어보기',
  robots: { index: false, follow: false },
};

export default async function AskNewPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  // 글 주소 모양이 맞을 때만 찾아본다(아무 글자나 넣어도 안전하게)
  const safe = typeof from === 'string' && /^[0-9A-Za-z가-힣_-]{1,120}$/.test(from) ? from : null;
  const blog = blogPostRef(safe);
  return (
    <AskShell>
      <AskNewForm fromSlug={blog?.slug ?? null} fromTitle={blog?.title ?? null} />
    </AskShell>
  );
}
