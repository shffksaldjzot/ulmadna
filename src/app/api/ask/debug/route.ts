// ──────────────────────────────────────────────
// 물어보기 상세 화면 진단(임시) — 운영 서버에서 어느 단계가 터지는지 알아내기 위한 것.
// CRON_SECRET 머리글이 맞을 때만 동작한다. 원인을 찾으면 이 파일은 지운다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { getComments, getLatestAnswer, getPostById, helpfulCount, similarPosts } from '@/lib/ask/server';
import { renderAnswerMarkdown } from '@/lib/ask/markdown';
import { blogPostRef, blogPostsForTrades } from '@/lib/ask/blogref';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'no' }, { status: 401 });
  }
  const id = Number(new URL(req.url).searchParams.get('id') ?? '10');
  const steps: Record<string, string> = {};
  // 단계마다 따로 감싸서, 어디서 어떤 오류가 나는지 문구와 함께 돌려준다
  async function step(name: string, fn: () => Promise<unknown> | unknown) {
    try {
      const v = await fn();
      steps[name] = 'ok ' + JSON.stringify(v).slice(0, 80);
    } catch (e) {
      const err = e as Error;
      steps[name] = 'ERR ' + (err?.message ?? String(e)) + ' | ' + (err?.stack ?? '').split('\n').slice(0, 3).join(' / ');
    }
  }
  let post: Awaited<ReturnType<typeof getPostById>> = null;
  let answer: Awaited<ReturnType<typeof getLatestAnswer>> = null;
  await step('post', async () => { post = await getPostById(id); return post?.slug; });
  await step('answer', async () => { answer = post ? await getLatestAnswer(post.id) : null; return answer?.id; });
  await step('comments', async () => (post ? (await getComments(post.id)).length : -1));
  await step('helpful', async () => (answer ? helpfulCount(answer.id) : -1));
  await step('similar', async () => (post ? (await similarPosts(post, 5)).length : -1));
  await step('markdown', async () => (answer ? (await renderAnswerMarkdown(answer.body_md)).length : -1));
  await step('blogref', () => blogPostRef('wallpaper-cost')?.title ?? null);
  await step('blogTrades', () => blogPostsForTrades(['도배'], 2).length);
  return NextResponse.json({ id, steps });
}
