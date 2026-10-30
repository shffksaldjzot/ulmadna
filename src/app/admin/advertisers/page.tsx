// ──────────────────────────────────────────────
// 관리자 · 광고주 관리 — 2026년 10월 30일
//
// [무슨 기능인가]
//   광고주 셀프 가입이 생겨서 만든 관리 화면. 목록(검색·칩)에서 줄을 누르면 아래로 상세가 펼쳐진다.
//   서버 컴포넌트가 목록을 읽어 넘기고, 검색·펼침·단추는 클라이언트 조각(AdvertisersView)이 맡는다.
//   표를 못 읽으면 안내 한 줄만 보인다.
// ──────────────────────────────────────────────
import { listAdminAdvertisers } from '@/server/admin/advertisers';
import { Card, PageHead } from '../_ui';
import AdvertisersView from './AdvertisersView';

export const dynamic = 'force-dynamic';

export default async function AdvertisersPage() {
  const rows = await listAdminAdvertisers();
  if (!rows) {
    return (
      <div>
        <PageHead title="광고주" />
        <Card><p className="text-sm text-gray-500">광고주 표를 읽지 못했어요. Supabase 연결을 확인해 주세요.</p></Card>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <PageHead title="광고주" note={`가입 ${rows.length}곳 · 가입일 최신순`} />
      <AdvertisersView rows={rows} />
    </div>
  );
}
