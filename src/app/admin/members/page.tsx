// ──────────────────────────────────────────────
// 관리자 · 회원 관리 — 2026-10-28
//
// [무슨 기능인가]
//   members 표의 회원 목록(최근 로그인 순 300명): 닉네임·로그인 수단(카카오/아이디)·첫/마지막 로그인·횟수·상태,
//   그리고 차단/해제 단추. 카카오 이름 칸은 개인정보 최소 원칙으로 DB 에 닉네임만 있어 닉네임을 보여준다.
//   이메일·전화는 저장하지 않으므로 표시하지 않는다.
// ──────────────────────────────────────────────
import { listMembersForAdmin } from '@/server/admin/stats';
import { getMemberStats } from '@/lib/members/server';
import { Card, PageHead, Stat, Th, Unavailable } from '../_ui';
import ToggleButton from '../ToggleButton';

export const dynamic = 'force-dynamic';

const STATUS_TEXT = { active: '정상', blocked: '차단', withdrawn: '탈퇴' } as const;

/** 한국 시간 날짜+시각 짧게 */
function when(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString();
  return `${d.slice(5, 10)} ${d.slice(11, 16)}`;
}

export default async function MembersPage() {
  const [rows, stats] = await Promise.all([listMembersForAdmin(), getMemberStats()]);

  return (
    <div>
      <PageHead title="회원 관리" note="최근 로그인 순 300명" />
      {!rows ? (
        <Unavailable />
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="전체" value={stats?.total} />
              <Stat label="새 회원 7일" value={stats?.new7} />
              <Stat label="차단" value={stats?.blocked} />
              <Stat label="탈퇴" value={stats?.withdrawn} />
            </div>
          </Card>
          <Card title="회원 목록">
            {rows.length === 0 ? (
              <p className="text-sm text-gray-400">아직 회원이 없어요</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <Th>닉네임</Th><Th>수단</Th><Th>첫 로그인</Th><Th>마지막</Th><Th right>횟수</Th><Th>상태</Th><Th>{' '}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((m) => (
                      <tr key={m.id} className={`border-b border-gray-50 ${m.status === 'withdrawn' ? 'opacity-40' : ''}`}>
                        <td className="py-2 px-2 text-gray-700 whitespace-nowrap">{m.nickname ?? '(없음)'}</td>
                        <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{m.provider === 'kakao' ? '카카오' : '아이디'}</td>
                        <td className="py-2 px-2 text-gray-400 text-xs whitespace-nowrap">{when(m.first_login_at)}</td>
                        <td className="py-2 px-2 text-gray-400 text-xs whitespace-nowrap">{when(m.last_login_at)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-gray-500">{m.login_count}</td>
                        <td className={`py-2 px-2 whitespace-nowrap ${m.status === 'blocked' ? 'text-red-700' : 'text-gray-600'}`}>{STATUS_TEXT[m.status] ?? m.status}</td>
                        <td className="py-2 px-2">
                          {m.status !== 'withdrawn' && (
                            <ToggleButton
                              url="/api/admin/member-blocked"
                              body={{ id: m.id, blocked: m.status !== 'blocked' }}
                              label={m.status === 'blocked' ? '해제' : '차단'}
                              danger={m.status !== 'blocked'}
                              confirmText={m.status === 'blocked' ? undefined : `${m.nickname ?? '이 회원'}을(를) 차단할까요?`}
                            />
                          )}
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
