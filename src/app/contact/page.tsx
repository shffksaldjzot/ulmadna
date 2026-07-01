// 연락처(Contact) 페이지 — 구글 애드센스가 요구하는 "연락 가능한 창구".
// 별도 이메일 인프라 없이 기존 문의 메일(cs870@naver.com)을 안내한다.
import type { Metadata } from 'next';
import Link from 'next/link';

// 검색엔진/애드센스 크롤러용 메타데이터
export const metadata: Metadata = {
  title: '문의하기 — 얼마드나',
  description:
    '얼마드나 서비스 문의, 견적 데이터 관련 제보, 광고·스폰서 제휴 문의는 cs870@naver.com으로 연락 주세요.',
  alternates: { canonical: 'https://ulmadna.com/contact' },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 lg:px-8 py-12">
        {/* 홈으로 돌아가기 */}
        <Link href="/" className="text-sm text-gold hover:text-brown mb-8 inline-block">← 돌아가기</Link>
        <h1 className="text-2xl font-bold text-brown mb-2">문의하기</h1>
        <p className="text-sm text-gray-500 mb-8">궁금한 점이나 제보가 있으면 편하게 연락 주세요.</p>

        <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-100 space-y-7 text-sm text-gray-600 leading-relaxed">
          {/* 대표 문의 메일 */}
          <section>
            <h2 className="text-base font-semibold text-brown mb-3">이메일 문의</h2>
            <p className="mb-4">
              아래 이메일로 문의를 보내주시면 순차적으로 답변드립니다. 영업일 기준 보통 2~3일 안에 회신드려요.
            </p>
            <a
              href="mailto:cs870@naver.com"
              className="inline-block bg-brown text-cream rounded-xl px-5 py-3 font-medium hover:opacity-90 transition-opacity"
            >
              cs870@naver.com 로 메일 보내기
            </a>
          </section>

          {/* 어떤 문의를 받나 */}
          <section>
            <h2 className="text-base font-semibold text-brown mb-2">이런 문의를 받아요</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>서비스 이용 문의</strong> — 견적 계산기 사용 중 생긴 궁금증·오류 제보</li>
              <li><strong>견적 데이터 제보</strong> — &ldquo;우리 지역·현장은 시세가 다르다&rdquo; 같은 정정 요청</li>
              <li><strong>콘텐츠 문의</strong> — 블로그 글의 정보 정정, 추가로 다뤘으면 하는 주제</li>
              <li><strong>광고·스폰서 제휴</strong> — 배너·스폰서 배치 문의</li>
            </ul>
          </section>

          {/* 문의 시 참고 */}
          <section>
            <h2 className="text-base font-semibold text-brown mb-2">문의 전에 참고하세요</h2>
            <p>
              얼마드나는 <strong>인테리어 업체가 아니며, 시공을 직접 하거나 특정 업체를 알선하지 않습니다.</strong>
              &ldquo;시공해 달라&rdquo; &ldquo;업체를 소개해 달라&rdquo;는 요청에는 도움을 드리기 어렵습니다.
              견적은 어디까지나 <strong>참고용 예상 금액</strong>이며, 정확한 금액은 현장 실측 후 정식 견적서로 확인하셔야 합니다.
            </p>
          </section>

          {/* 운영 정보 */}
          <section>
            <p className="text-xs text-gray-500 leading-relaxed">
              상호: 얼마드나 · 대표: 김지환<br />
              사업자등록번호: 565-58-00717<br />
              이메일: <a href="mailto:cs870@naver.com" className="text-gold hover:text-brown">cs870@naver.com</a>
            </p>
          </section>

          {/* 관련 링크 */}
          <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <Link href="/about" className="text-gold hover:text-brown">얼마드나 소개</Link>
            <Link href="/blog" className="text-gold hover:text-brown">블로그</Link>
            <Link href="/privacy" className="text-gold hover:text-brown">개인정보처리방침</Link>
            <Link href="/terms" className="text-gold hover:text-brown">이용약관</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
