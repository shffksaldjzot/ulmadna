import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 lg:px-8 py-12">
        <Link href="/" className="text-sm text-gold hover:text-brown mb-8 inline-block">← 돌아가기</Link>
        <h1 className="text-2xl font-bold text-brown mb-8">이용약관</h1>

        <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-100 space-y-6 text-sm text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-brown mb-2">제1조 (목적)</h2>
            <p>이 약관은 얼마드나(이하 &ldquo;서비스&rdquo;)가 제공하는 인테리어 견적 계산 서비스의 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brown mb-2">제2조 (서비스 내용)</h2>
            <p>서비스는 인테리어 예상 견적을 시장 평균 기반으로 산출하는 무료 계산 도구입니다. 회원가입 없이 누구나 이용할 수 있으며, 카카오 로그인을 통해 견적을 저장할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brown mb-2">제3조 (면책 조항)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>서비스가 제공하는 견적 정보는 <strong>참고용 예상 금액</strong>이며, 실제 시공비와 차이가 있을 수 있습니다.</li>
              <li>실제 비용은 현장 상황, 자재 수급, 시공 업체, 지역 등에 따라 달라집니다.</li>
              <li>서비스는 견적 정보의 정확성을 보증하지 않으며, 이를 근거로 한 의사결정에 대해 책임지지 않습니다.</li>
              <li>반드시 인테리어 전문 업체와 상의 후 최종 견적을 확정하시기 바랍니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brown mb-2">제4조 (광고 및 제휴)</h2>
            <p>서비스에는 파트너 브랜드의 배너 광고가 포함될 수 있으며, 자재 등급 선택 시 참고 브랜드가 표시될 수 있습니다. 이는 특정 브랜드의 사용을 강제하는 것이 아닌 참고 정보입니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brown mb-2">제5조 (저작권)</h2>
            <p>서비스의 디자인, 콘텐츠, 계산 로직 등 모든 지적재산권은 얼마드나에 귀속됩니다. 상업적 목적의 무단 복제 및 배포를 금지합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brown mb-2">제6조 (약관 변경)</h2>
            <p>이 약관은 서비스 운영상 필요한 경우 변경될 수 있으며, 변경 시 서비스 내 공지합니다.</p>
          </section>

          <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">시행일: 2026년 4월 6일 · 얼마드나 (사업자등록번호 565-58-00717)</p>
        </div>
      </div>
    </div>
  );
}
