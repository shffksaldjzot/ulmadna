// 개인정보처리방침 페이지.
//
// 2026-09-15 디자인 통일 작업: 공용 틀(SiteHeader·Container·SiteFooter)로 교체.
// 법률 문구는 한 글자도 바꾸지 않았고, 색·글자크기 클래스만 공용 토큰으로 맞췄다.
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import Container from '@/components/layout/Container';

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <Container as="main">
        {/* max-w-3xl로 폭만 제한하고 mx-auto는 쓰지 않는다 — 왼쪽 시작선을 Container(로고)와 맞추기 위함 */}
        <div className="max-w-3xl py-12">
          <h1 className="t-page text-ink mb-8">개인정보처리방침</h1>

          <div className="bg-surface rounded-card p-6 lg:p-8 border border-line space-y-6 t-body text-ink-2 leading-relaxed">
            <section>
              <h2 className="t-section text-ink mb-2">1. 개인정보 수집 항목</h2>
              <p>얼마드나는 최소한의 개인정보만 수집합니다.</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>비회원:</strong> 개인정보를 일절 수집하지 않습니다. 견적 계산, PDF/엑셀 다운로드, 카카오톡 공유 모두 개인정보 없이 이용 가능합니다.</li>
                <li><strong>카카오 로그인 회원:</strong> 카카오 계정 닉네임, 카카오 고유 ID만 수집합니다. 이메일, 전화번호, 주소 등은 수집하지 않습니다.</li>
              </ul>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">2. 수집 목적</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>견적 저장 및 불러오기 기능 제공</li>
                <li>저장된 견적 비교 기능 제공</li>
              </ul>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">3. 보유 및 이용 기간</h2>
              <p>회원 탈퇴 시 즉시 삭제됩니다. 저장된 견적 데이터도 함께 삭제됩니다.</p>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">4. 제3자 제공</h2>
              <p>수집된 개인정보는 제3자에게 제공하지 않습니다.</p>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">5. 쿠키 및 분석 도구</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Google Analytics 4:</strong> 익명의 방문 통계(페이지뷰, 체류시간 등)를 수집합니다. 개인을 식별하지 않습니다.</li>
                <li><strong>카카오 SDK:</strong> 카카오톡 공유 기능을 위해 사용됩니다.</li>
              </ul>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">6. 이용자의 권리</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>카카오 로그인 연결 해제 시 저장된 모든 데이터가 삭제됩니다.</li>
                <li>개인정보 관련 문의: cs870@naver.com</li>
              </ul>
            </section>

            <section>
              <h2 className="t-section text-ink mb-2">7. 개인정보 보호책임자</h2>
              <p>성명: 김지환<br/>이메일: cs870@naver.com</p>
            </section>

            <p className="t-sub text-ink-2/70 pt-4 border-t border-line">시행일: 2026년 4월 6일 · 얼마드나 (사업자등록번호 565-58-00717)</p>
          </div>
        </div>
      </Container>
      <SiteFooter />
    </>
  );
}
