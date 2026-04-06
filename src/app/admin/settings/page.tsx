'use client';

export default function SettingsAdmin() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">사이트 설정</h2>

      <div className="space-y-6">
        {/* SEO 설정 */}
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">SEO 설정</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">페이지 타이틀</label>
              <input
                type="text"
                defaultValue="얼마드나 — 무료 인테리어 견적 계산기 | 회원가입 없이 바로 사용"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">메타 설명</label>
              <textarea
                defaultValue="평형, 자재 등급, 공정만 선택하면 인테리어 예상 견적이 바로 나옵니다. 회원가입·전화번호 입력 없이 완전 무료."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:border-gold"
              />
            </div>
          </div>
        </div>

        {/* 사업자 정보 */}
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">사업자 정보 (푸터)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">상호</label>
              <input type="text" defaultValue="얼마드나" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">대표자</label>
              <input type="text" defaultValue="김지환" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">사업자등록번호</label>
              <input type="text" defaultValue="000-00-00000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">이메일</label>
              <input type="text" defaultValue="contact@ulmadna.com" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
            </div>
          </div>
        </div>

        {/* 카피 설정 */}
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">메인 카피</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">메인 헤드라인</label>
              <input type="text" defaultValue="우리 집 인테리어, 얼마 드나?" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">서브 카피</label>
              <input type="text" defaultValue="회원가입과 개인정보 없이 누구나 쉽게! 10년 노하우를 담은 현장 경험을 토대로 견적서를 뽑아드립니다." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">면책 문구</label>
              <textarea
                defaultValue="본 견적은 참고용 예상 금액이며, 실제 시공비는 현장 실측에 따라 달라질 수 있습니다."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:border-gold"
              />
            </div>
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="flex justify-end">
          <button className="bg-brown text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brown/90 transition-colors">
            설정 저장
          </button>
        </div>
      </div>
    </div>
  );
}
