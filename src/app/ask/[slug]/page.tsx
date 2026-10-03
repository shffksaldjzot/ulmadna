// ──────────────────────────────────────────────
// /ask/[번호-제목] — 질문 + 얼마드나 AI 답변 화면 (시안 post.html · post-wait.html)
//
// 서버에서 그린다(제목·본문·답변이 HTML에 그대로 → 검색에 잡힘). 60초마다 새로 그림(ISR).
// 순서: 질문(태그·제목·닉네임·본문) → 사진(가린 사본만) → 조건 칩 → 저장·공유·신고
//       → AI 답변 카드(없으면 "준비 중" 상자) → 이어서 물어본 것(댓글, AI 댓글 강조)
//       → 이어서 물어보기 입력 → 비슷한 질문 5 / PC 오른쪽: 계산해 보기 · 직접 문의
// 검색 노출: 제목+조건 · 설명문=답변 한 줄 요약 · QAPage 구조화 데이터 · 숨김 글은 noindex
// 주소는 "번호-제목"인데 번호만 맞으면 찾고, 제목 부분이 다르면 정식 주소로 옮긴다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import AskShell from '@/components/ask/AskShell';
import AskPostActions from '@/components/ask/AskPostActions';
import AskFeedback from '@/components/ask/AskFeedback';
import AskCommentForm from '@/components/ask/AskCommentForm';
import AskViewPing from '@/components/ask/AskViewPing';
import { IcBack } from '@/components/ask/icons';
import { getComments, getLatestAnswer, getPostById, helpfulCount, maskedPhotoUrl, similarPosts } from '@/lib/ask/server';
import { renderAnswerMarkdown } from '@/lib/ask/markdown';
import { blogPostRef, blogPostsForTrades } from '@/lib/ask/blogref';
import { KIND_LABEL, TRADE_CALC } from '@/lib/ask/constants';
import {
  askHref,
  conditionText,
  fmtDateTime,
  fmtTime,
  idFromSlug,
  minutesBetween,
  pyeongLabel,
  shortDate,
  stripMarkdown,
  timeAgo,
} from '@/lib/ask/format';
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from '@/lib/contact';

// 2026-10-03 운영 500 수리: ISR(정적 + 60초 보관)로 두면 Vercel에서 세션 확인(auth) 같은
// 동적 호출과 충돌해 상세가 500으로 떨어졌다(집컴에서는 재현 안 됨). 요청마다 서버에서
// 그리게 바꾼다 — 검색 노출(서버 렌더 HTML)은 그대로다.
export const dynamic = 'force-dynamic';

const SITE = 'https://ulmadna.com';

/** 주소 조각 → 질문 (같은 요청 안에서 메타·본문이 두 번 읽지 않게 cache) */
const loadPost = cache(async (rawSlug: string) => {
  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    /* 이미 풀린 글자면 그대로 */
  }
  const id = idFromSlug(slug);
  if (!id) return { slug, post: null };
  return { slug, post: await getPostById(id) };
});
/** 질문을 올린 지 30분이 넘었는지(답변 늦어짐 안내용) */
function waitedOver30Min(createdAt: string): boolean {
  return Date.now() - Date.parse(createdAt) > 30 * 60 * 1000;
}

const loadAnswer = cache(async (postId: number) => getLatestAnswer(postId));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug: raw } = await params;
  const { post } = await loadPost(raw);
  if (!post) return { title: '질문을 찾을 수 없어요 — 얼마드나 물어보기', robots: { index: false, follow: false } };
  const answer = await loadAnswer(post.id);
  const cond = conditionText(post.pyeong, post.trades);
  const title = `${post.title}${cond ? ` (${cond})` : ''} — 얼마드나 물어보기`;
  // 설명문: 답변 한 줄 요약 → 없으면 질문 본문 앞부분
  const description = (answer?.summary || stripMarkdown(post.body) || post.title).slice(0, 150);
  const url = `${SITE}${askHref(post.slug)}`;
  const firstPhoto = post.photos.find((p) => p.masked);
  return {
    title,
    description,
    alternates: { canonical: url },
    // 검색 노출은 답변이 달린 글만(지휘관 결정 2026년 10월 03일).
    // 답변 전(queued)은 noindex·follow(링크는 따라가게), 숨김(hidden)은 noindex·nofollow.
    // 답이 달리면 집컴이 /api/ask/revalidate 를 불러 화면이 새로 그려지며 index로 바뀐다.
    ...(post.status === 'hidden'
      ? { robots: { index: false, follow: false } }
      : post.status !== 'answered'
        ? { robots: { index: false, follow: true } }
        : {}),
    openGraph: {
      title: post.title,
      description,
      url,
      type: 'article',
      images: firstPhoto?.masked ? [{ url: maskedPhotoUrl(firstPhoto.masked) }] : undefined,
    },
  };
}

export default async function AskPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const { slug, post } = await loadPost(raw);
  if (!post) notFound();
  // 제목 부분이 다르면(옛 주소·잘린 주소) 정식 주소로 영구 이동
  if (slug !== post.slug) permanentRedirect(askHref(post.slug));

  const answer = await loadAnswer(post.id);
  const [comments, similar, helpful, answerHtml] = await Promise.all([
    getComments(post.id),
    similarPosts(post, 5),
    answer ? helpfulCount(answer.id) : Promise.resolve(0),
    answer ? renderAnswerMarkdown(answer.body_md) : Promise.resolve(''),
  ]);

  const kindLabel = KIND_LABEL[post.kind];
  const cond = conditionText(post.pyeong, post.trades);
  const answeredMin = answer ? minutesBetween(post.created_at, answer.created_at) : null;
  // 공정에서 바로 열 수 있는 계산기(답변 근거에 따로 적혀 있으면 그걸 우선)
  const calcs = answer?.basis.calcs?.length
    ? answer.basis.calcs
    : post.trades.map((t) => TRADE_CALC[t]).filter((c): c is { label: string; href: string } => !!c);
  const fromBlog = blogPostRef(post.from_slug);
  // 답변 준비 중일 때 읽을거리: 온 블로그 글 + 공정 관련 글
  const waitReads = answer ? [] : [...(fromBlog ? [fromBlog] : []), ...blogPostsForTrades(post.trades, 2, fromBlog?.slug)].slice(0, 2);
  const photoAlt = (i: number) => `${cond || '인테리어'} 견적서 ${i + 1}`;
  // 오래 기다렸는데 아직 답이 없으면(30분+) 솔직하게 "늦어지고 있어요"
  const late = !answer && waitedOver30Min(post.created_at);

  // ── 검색엔진용 구조화 데이터(QAPage): 질문 + 채택 답변(=AI 답변) ──
  const qaLd = answer
    ? {
        '@context': 'https://schema.org',
        '@type': 'QAPage',
        mainEntity: {
          '@type': 'Question',
          name: post.title,
          text: post.body || post.title,
          answerCount: 1 + comments.filter((c) => c.is_ai).length,
          dateCreated: post.created_at,
          author: { '@type': 'Person', name: post.nickname },
          acceptedAnswer: {
            '@type': 'Answer',
            text: stripMarkdown(answer.body_md).slice(0, 3000),
            dateCreated: answer.created_at,
            url: `${SITE}${askHref(post.slug)}#answer`,
            author: { '@type': 'Organization', name: '얼마드나 AI', url: SITE },
            upvoteCount: helpful,
          },
        },
      }
    : null;

  return (
    <AskShell>
      <AskViewPing id={post.id} />
      <main className="app">
        <div className="sub">
          <Link href="/ask">
            <IcBack />
            물어보기
          </Link>
          <span>›</span>
          <span className="cur">{kindLabel}</span>
        </div>

        {/* 질문 */}
        <article className="post">
          <div className="tags">
            <span className="tag">{kindLabel}</span>
            {post.trades.length > 0 && <span className="tag">{post.trades.join(' · ')}</span>}
          </div>
          <h1>
            {post.title}
            {post.photos.length > 0 ? ` (사진 ${post.photos.length}장)` : ''}
          </h1>
          <div className="meta">
            <span className="nick">{post.nickname}</span>
            <span>·</span>
            <span>{fmtDateTime(post.created_at)}</span>
            {post.view_count > 0 && (
              <>
                <span>·</span>
                <span>조회 {post.view_count.toLocaleString()}</span>
              </>
            )}
            {answeredMin != null && <span className="rt">AI 답변 {answeredMin}분</span>}
          </div>
          {post.body && <div className="body">{post.body}</div>}

          {/* 사진: 전화번호·동호수·개인 이름을 가린 사본만 보여 준다. 아직 가리기 전이면 자리만 */}
          {post.photos.length > 0 && (
            <div className="photos" aria-label="올린 견적서 사진">
              {post.photos.map((p, i) =>
                p.masked ? (
                  <a key={i} href={maskedPhotoUrl(p.masked)} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={maskedPhotoUrl(p.masked)} alt={photoAlt(i)} loading="lazy" />
                  </a>
                ) : (
                  <div key={i}>
                    견적서 {i + 1}장
                    <br />
                    <small>전화번호 · 동호수 가리는 중</small>
                  </div>
                ),
              )}
            </div>
          )}

          <div className="facts">
            {post.pyeong && <span>{pyeongLabel(post.pyeong, post.type_code)}</span>}
            {post.region && <span>{post.region}</span>}
            {post.trades.length > 0 && <span>{post.trades.join(' · ')}</span>}
          </div>
          <AskPostActions postId={post.id} slug={post.slug} title={post.title} />
        </article>

        {/* 얼마드나 AI 답변 — 없으면 준비 중 상자 */}
        {answer ? (
          <section className="answer" id="answer" aria-label="얼마드나 AI 답변">
            <div className="who">
              <div className="av-ai">
                얼마
                <br />
                드나
              </div>
              <div>
                <b>얼마드나 AI</b>
                <small>
                  {fmtTime(answer.created_at)}
                  {answeredMin != null ? ` · ${answeredMin}분 만에 답함` : ''}
                  {answer.version > 1 ? ` · ${shortDate(answer.created_at.slice(0, 10))} 수정됨` : ''}
                </small>
              </div>
              {answer.basis.n ? <span className="badge">비슷한 견적서 {answer.basis.n.toLocaleString()}건 기준</span> : null}
            </div>
            <div className="body">
              <div dangerouslySetInnerHTML={{ __html: answerHtml }} />
              {(answer.basis.n || calcs.length > 0 || (answer.basis.posts?.length ?? 0) > 0) && (
                <div className="ref">
                  {answer.basis.n ? (
                    <span>
                      근거 · {[answer.basis.period, answer.basis.region].filter(Boolean).join(' ')} 견적서 {answer.basis.n.toLocaleString()}건
                    </span>
                  ) : null}
                  {calcs.length > 0 && (
                    <span>
                      관련 계산기 ·{' '}
                      {calcs.map((c, i) => (
                        <span key={c.href}>
                          {i > 0 && ' · '}
                          <Link href={c.href}>{c.label}</Link>
                        </span>
                      ))}
                    </span>
                  )}
                  {(answer.basis.posts?.length ?? 0) > 0 && (
                    <span>
                      관련 글 ·{' '}
                      {answer.basis.posts!.map((p, i) => (
                        <span key={p.slug}>
                          {i > 0 && ' · '}
                          <Link href={`/blog/${p.slug}`}>{p.title}</Link>
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              )}
              <AskFeedback answerId={answer.id} helpful={helpful} />
            </div>
          </section>
        ) : (
          <div className="waitbox" role="status">
            <span className="dot" aria-hidden="true" />
            <span>
              <b>{late ? '답변이 늦어지고 있어요' : 'AI가 비슷한 견적서를 찾고 있어요'}</b>
              <br />
              {late ? '차례대로 답하고 있어요 · 조금만 기다려 주세요' : '실시간이 아니라 5~10분 걸려요 · 새로 고침하면 답이 보여요'}
            </span>
          </div>
        )}

        {/* 이어서 물어본 것 — AI 재답변은 강조 테두리 */}
        {comments.length > 0 && (
          <section className="thread">
            <h3>이어서 물어본 것 {comments.length}</h3>
            {comments.map((c) => (
              <div key={c.id} className={`c${c.is_ai ? ' ul' : ''}`}>
                <div className="who">
                  <span className="av">{c.is_ai ? 'AI' : c.nickname.slice(0, 1)}</span>
                  <b>{c.is_ai ? '얼마드나 AI' : c.nickname}</b>
                  <span>{fmtTime(c.created_at)}</span>
                </div>
                <p>{c.body}</p>
              </div>
            ))}
          </section>
        )}
        {post.status !== 'hidden' && <AskCommentForm postId={post.id} />}

        {/* 답변 준비 중이면 "기다리는 동안" 읽을거리, 아니면 비슷한 질문 */}
        {waitReads.length > 0 && (
          <section className="related">
            <h3>기다리는 동안</h3>
            <div className="card rows">
              {waitReads.map((b) => (
                <Link key={b.slug} href={`/blog/${b.slug}`}>
                  {b.title}
                  <small>블로그 · {b.readingTime}분</small>
                </Link>
              ))}
            </div>
          </section>
        )}
        {similar.length > 0 && (
          <section className="related">
            <h3>비슷한 질문</h3>
            <div className="card rows">
              {similar.map((s) => (
                <Link key={s.id} href={askHref(s.slug)}>
                  {s.title}
                  <small suppressHydrationWarning>AI 답변 · {timeAgo(s.created_at)}</small>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* PC 오른쪽 */}
        <aside className="aside">
          {calcs.length > 0 && (
            <div className="card pc-only">
              <div className="ttl">이 질문의 조건으로 계산해 보기</div>
              {cond && <div className="t-sub">{cond}</div>}
              {calcs.slice(0, 2).map((c) => (
                <Link key={c.href} className="btn p" href={c.href} style={{ marginTop: 10 }}>
                  {c.label} 열기
                </Link>
              ))}
            </div>
          )}
          <div className="card pc-only">
            <div className="ttl">직접 문의</div>
            <div className="t-sub">도토리스튜디오 시공팀 · {CONTACT_PHONE_DISPLAY}</div>
            <a className="btn o" href={CONTACT_PHONE_TEL} style={{ marginTop: 10 }}>
              전화
            </a>
          </div>
        </aside>
      </main>

      {qaLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(qaLd).replace(/</g, '\\u003c') }} />}
    </AskShell>
  );
}
