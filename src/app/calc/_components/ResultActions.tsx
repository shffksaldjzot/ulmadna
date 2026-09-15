// ──────────────────────────────────────────────
// v1 허브 — 계산기 결과 화면의 인터랙션 부분(클라이언트) 공용 컴포넌트.
// 원래 도배 계산기(wallpaper/result/ResultActions.tsx)에만 있던 것을 레미탈·바닥재도
// 그대로 쓸 수 있게 계산기 종류에 안 묶이는 공용 위치(_components)로 옮겼다.
//
// 게시판 체크박스(동작 없음, 표시만) + 저장·공유 플로팅 풍선.
// 저장: 비로그인이면 로그인 화면으로, 로그인 상태면 "저장됨"으로만 전환
//   (2026-09-15 확인: 백엔드 저장이 아직 없는 화면 표시 전용 스텁 — TODO는 그대로 남겨둔다).
// 공유: 링크 복사. 카카오 JS 키가 있으면 카카오 공유 SDK도 시도.
//
// 작성일: 2026년 09월 09일(도배 전용으로 최초 작성)
// 2026년 09월 15일: 디자인 통일 작업 — 레미탈·바닥재 결과 화면도 같이 쓰도록 공용화.
//   공유 문구(shareText)만 계산기마다 다르게 받고 나머지 동작은 완전히 같다.
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Checkbox from '@/components/v1/Checkbox';
import Fab from '@/components/v1/Fab';
import Toast, { showToast } from '@/components/v1/Toast';
import { IconLockClosed } from '@/components/v1/icons';

export function PostToBoardCheckbox() {
  // "게시판에 올리기"는 지금은 저장 동작이 없다(설계 정본 화면 상 표시만).
  // 그래도 체크박스 자체는 눌러 보는 느낌이 있어야 해서 로컬 상태로만 토글한다.
  const [checked, setChecked] = useState(false);
  return (
    <div className="flex items-center gap-[10px] min-h-11">
      <Checkbox checked={checked} onChange={setChecked} label="게시판에 올리기" />
      <span className="inline-flex items-center gap-[5px] text-[14px] text-v1-text-secondary">
        <IconLockClosed />
        비공개
      </span>
    </div>
  );
}

interface ResultFabProps {
  /** 카카오톡 공유 시 보여줄 한 줄 소개 — 계산기마다 다르게 넣는다 */
  shareText: string;
}

export function ResultFab({ shareText }: ResultFabProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function handleSave() {
    if (!session?.user) {
      // 2026-09-11 검사관 지적: /calc/login 화면을 없애고 루트 로그인 화면을 그대로 쓰기로 해서
      // 여기서도 리다이렉트를 한 번 거치지 않게 처음부터 /login 으로 바로 보낸다
      router.push('/login');
      return;
    }
    // TODO: 저장한 계산 목록에 실제로 담는 백엔드 연결(내 정보 > 저장한 계산)
    setSaved((v) => !v);
    showToast(setToast, saved ? '저장을 취소했어요' : '저장했어요');
  }

  async function handleShare() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      showToast(setToast, '링크를 복사했어요');
    } catch {
      showToast(setToast, '복사에 실패했어요');
    }

    // 카카오 공유 — 키가 있고 SDK가 이미 로드돼 있을 때만 시도(없어도 링크 복사는 됨)
    const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    const kakao = (window as unknown as { Kakao?: { isInitialized: () => boolean; init: (k: string) => void; Share: { sendDefault: (opts: unknown) => void } } }).Kakao;
    if (kakaoKey && kakao) {
      try {
        if (!kakao.isInitialized()) kakao.init(kakaoKey);
        kakao.Share.sendDefault({
          objectType: 'text',
          text: shareText,
          link: { mobileWebUrl: url, webUrl: url },
        });
      } catch {
        // 카카오 공유는 실패해도 링크 복사는 이미 됐으니 조용히 넘어간다
      }
    }
  }

  return (
    <>
      <Fab saved={saved} onSave={handleSave} onShare={handleShare} />
      <Toast message={toast} />
    </>
  );
}
