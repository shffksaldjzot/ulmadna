// ──────────────────────────────────────────────
// 관리자 · 물어보기 관리 — 2026-10-28
//
// [무슨 기능인가]
//   실제 질문 글 목록(예시 seed 글 제외, 최근 200건)과 답변 여부·글쓴이 읽음·도움됐어요/아쉬워요를 보여주고,
//   글을 숨기거나 다시 표시하는 단추를 둔다(숨김 = 공개 화면에서 안 보임, 되돌릴 수 있음).
// ──────────────────────────────────────────────
import { listAskForAdmin } from '@/server/admin/stats';
import { Card, PageHead, Stat, Th, Unavailable } from '../_ui';
import ToggleButton from '../ToggleButton';

export const dynamic = 'force-dynamic';

const STATUS_TEXT = { queued: '대기', answered: '답변됨', hidden: '숨김' } as const;

export default async function AskAdminPage() {
  const rows = await listAskForAdmin();

  return (
    <div>
      <PageHead title="물어보기 관리" note="예시 글은 빼고 실제 글만 · 최근 200건" />
      {!rows ? (
        <Unavailable />
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="글" value={rows.filter((r) => r.status !== 'hidden').length} />
              <Stat label="답변됨" value={rows.filter((r) => r.answered && r.status !== 'hidden').length} />
              <Stat label="답변 읽음" value={rows.filter((r) => r.read).length} />
              <Stat label="숨김" value={rows.filter((r) => r.status === 'hidden').length} />
            </div>
          </Card>
          <Card title="글 목록">
            {rows.length === 0 ? (
              <p className="text-sm text-gray-400">아직 실제 질문이 없어요</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <Th>글</Th><Th>상태</Th><Th>읽음</Th><Th>평가</Th><Th right>조회</Th><Th right>댓글</Th><Th>작성</Th><Th>{' '}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className={`border-b border-gray-50 ${r.status === 'hidden' ? 'opacity-50' : ''}`}>
                        <td className="py-2 px-2 max-w-[14rem] sm:max-w-sm">
                          <a href={`/ask/${r.slug}`} className="block truncate text-gray-700 hover:text-brown">{r.title}</a>
                          <span className="text-[11px] text-gray-400">{r.nickname}</span>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap text-gray-600">{STATUS_TEXT[r.status] ?? r.status}</td>
                        <td className="py-2 px-2 whitespace-nowrap text-gray-500">{r.answered ? (r.read ? '읽음' : '안 읽음') : '-'}</td>
                        <td className="py-2 px-2 whitespace-nowrap text-gray-500">{r.helpful === true ? '도움됐어요' : r.helpful === false ? '아쉬워요' : '-'}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-gray-500">{r.views}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-gray-500">{r.comments}</td>
                        <td className="py-2 px-2 whitespace-nowrap text-gray-400 text-xs">{r.created_at.slice(0, 10)}</td>
                        <td className="py-2 px-2">
                          <ToggleButton
                            url="/api/admin/ask-hidden"
                            body={{ id: r.id, hidden: r.status !== 'hidden' }}
                            label={r.status === 'hidden' ? '표시' : '숨김'}
                            confirmText={r.status === 'hidden' ? undefined : '이 글을 공개 화면에서 숨길까요?'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
