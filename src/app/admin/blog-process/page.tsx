// ──────────────────────────────────────────────
// 관리자 · 글 공정 판정 — 2026년 10월 29일
//
// [무슨 기능인가]
//   블로그 글마다 정해진 공정 묶음(공정 스폰서 광고 AD-P 매칭용)을 모아,
//   공정별 글 수와 판정 근거(sponsor/calculator/키워드) 개수를 표 하나로 보여 준다.
//   공정을 못 정한 "없음" 글은 아래에 제목·주소로 늘어놓는다 — 머리말 sponsor: 로 손볼 대상.
//   관리자 가드는 middleware 가 /admin/* 에 이미 건다.
// ──────────────────────────────────────────────
import { getAllPostMeta } from '@/lib/blog';
import { PROCESS_LABELS, type ProcessBasis } from '@/lib/blog-process';
import { Card, PageHead, Th } from '../_ui';

export const dynamic = 'force-dynamic';

/** 표 칸 순서대로 쓰는 판정 근거 */
const BASES: ProcessBasis[] = ['sponsor', 'calculator', 'keyword'];

export default function BlogProcessPage() {
  // 공개 글만(비공개 초안 제외) — 실제 화면에 광고 자리가 그려지는 글 기준
  const posts = getAllPostMeta();

  // 공정별 [합계, 근거별 개수]
  const rows = PROCESS_LABELS.map((label) => {
    const mine = posts.filter((p) => p.process.process === label);
    return { label, total: mine.length, by: BASES.map((b) => mine.filter((p) => p.process.basis === b).length) };
  });
  // 공정 없음 글(sponsor: none 으로 끈 글 포함)
  const none = posts.filter((p) => !p.process.process);
  const noneBySponsor = none.filter((p) => p.process.basis === 'sponsor').length;
  const pct = posts.length ? Math.round((none.length / posts.length) * 1000) / 10 : 0;

  return (
    <div>
      <PageHead title="글 공정 판정" note={`공개 글 ${posts.length}편 · 없음 ${none.length}편(${pct}%)`} />
      <div className="space-y-4">
        <Card>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <Th>공정</Th><Th right>글</Th><Th right>sponsor</Th><Th right>calculator</Th><Th right>키워드</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-gray-50">
                    <td className="py-2 px-2 text-gray-700">{r.label}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">{r.total}</td>
                    {r.by.map((n, i) => (
                      <td key={BASES[i]} className="py-2 px-2 text-right tabular-nums text-gray-500">{n || '–'}</td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-gray-200">
                  <td className="py-2 px-2 text-gray-500">없음</td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold">{none.length}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-gray-500">{noneBySponsor || '–'}</td>
                  <td className="py-2 px-2 text-right text-gray-300">–</td>
                  <td className="py-2 px-2 text-right text-gray-300">–</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={`없음 ${none.length}편`}>
          {none.length === 0 ? (
            <p className="text-sm text-gray-400">없어요</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {none.map((p) => (
                <li key={p.slug} className="truncate">
                  <a href={`/blog/${p.slug}?ad_preview=all`} className="text-gray-700 hover:text-brown">{p.title}</a>
                  <span className="ml-2 text-xs text-gray-400">{p.slug}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
