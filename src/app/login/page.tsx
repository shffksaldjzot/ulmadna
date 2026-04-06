'use client';

import { signIn } from 'next-auth/react';
import Image from 'next/image';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 w-full max-w-sm text-center">
        <Image
          src="/ulmadna_logo.png"
          alt="얼마드나"
          width={120}
          height={40}
          className="mx-auto mb-6"
        />

        <h1 className="text-lg font-bold text-brown mb-1">간편 로그인</h1>
        <p className="text-xs text-gray-400 mb-6">
          로그인하면 견적을 저장하고 다시 불러올 수 있어요
        </p>

        <button
          onClick={() => signIn('kakao', { callbackUrl: '/' })}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-lg text-sm font-medium transition-colors"
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

        <p className="text-[10px] text-gray-300 mt-4">
          개인정보는 수집하지 않아요. 카카오 닉네임만 사용합니다.
        </p>

        <button
          onClick={() => window.history.back()}
          className="mt-4 text-xs text-gray-400 hover:text-brown transition-colors"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
