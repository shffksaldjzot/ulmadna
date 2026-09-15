'use client';

// 카카오 간편 로그인 페이지.
//
// 2026-09-15 디자인 통일 작업: 페이지 전용 헤더 없이 화면 전체를 카드로 채우던 방식을
// 걷어내고 공용 틀(SiteHeader·Container·SiteFooter)로 교체. 로고·"돌아가기" 버튼은
// 이제 공용 헤더가 대신하므로 카드 안에서는 뺐다(로고 중복 방지).
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import Container from '@/components/layout/Container';

export default function LoginPage() {
  // 로그인 실패 시 NextAuth가 /login?error=... 로 되돌려 보낸다.
  // (useSearchParams 대신 주소창을 직접 읽어서 Suspense 없이 처리)
  const [errCode, setErrCode] = useState<string | null>(null);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setErrCode(code);
  }, []);

  return (
    <>
      <SiteHeader />
      <Container as="main" className="py-16 flex justify-center">
        <div className="bg-surface rounded-card p-8 border border-line w-full max-w-sm text-center">
          <h1 className="t-page text-ink mb-1">간편 로그인</h1>
          <p className="t-sub text-ink-2 mb-6">
            로그인하면 견적을 저장하고 다시 불러올 수 있어요
          </p>

          {/* 로그인 실패 안내 — 한 줄만, 오류코드는 작게(문의용) */}
          {errCode && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2 t-sub text-danger">
              로그인에 실패했어요. 다시 시도해 주세요.
              <span className="block text-[10px] text-danger/60 mt-0.5">{errCode}</span>
            </div>
          )}

          <button
            onClick={() => signIn('kakao', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-card text-sm font-medium transition-colors"
            style={{ backgroundColor: '#FEE500', color: '#191919' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9 0.5C4.029 0.5 0 3.588 0 7.392c0 2.442 1.633 4.587 4.085 5.792-.13.488-.837 3.14-.864 3.338 0 0-.018.147.078.203.096.056.208.013.208.013.274-.038 3.175-2.076 3.674-2.432.264.037.534.056.81.056 4.971 0 9-3.088 9-6.892S13.971.5 9 .5"
                fill="#191919"
              />
            </svg>
            카카오로 시작하기
          </button>

          <p className="text-[10px] text-ink-2/70 mt-4">
            개인정보는 수집하지 않아요. 카카오 닉네임만 사용합니다.
          </p>
        </div>
      </Container>
      <SiteFooter />
    </>
  );
}
