'use client';

export default function AdminDashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">대시보드</h2>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="오늘 방문자" value="0" sub="GA4 연동 필요" />
        <StatCard label="PDF 다운로드" value="0" sub="이번 주" />
        <StatCard label="회원 수" value="0" sub="카카오 로그인" />
        <StatCard label="저장된 견적" value="0" sub="전체" />
      </div>

      {/* 퀵 링크 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-2">배너 광고</h3>
          <p className="text-sm text-gray-400 mb-3">파트너 배너를 등록하고 노출을 관리합니다.</p>
          <a href="/admin/banners" className="text-sm text-gold hover:text-brown transition-colors">관리하기 →</a>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-2">단가 관리</h3>
          <p className="text-sm text-gray-400 mb-3">공정별 단가를 수정하고 계수를 조정합니다.</p>
          <a href="/admin/pricing" className="text-sm text-gold hover:text-brown transition-colors">관리하기 →</a>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-2">파트너 관리</h3>
          <p className="text-sm text-gray-400 mb-3">제휴 업체 정보를 등록하고 엑셀 시트에 반영합니다.</p>
          <a href="/admin/partners" className="text-sm text-gold hover:text-brown transition-colors">관리하기 →</a>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-2">사이트 설정</h3>
          <p className="text-sm text-gray-400 mb-3">카피, SEO, 사업자 정보 등을 수정합니다.</p>
          <a href="/admin/settings" className="text-sm text-gold hover:text-brown transition-colors">관리하기 →</a>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-brown">{value}</p>
      <p className="text-[10px] text-gray-300 mt-1">{sub}</p>
    </div>
  );
}
