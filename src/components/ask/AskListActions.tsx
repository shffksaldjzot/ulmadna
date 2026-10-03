// ──────────────────────────────────────────────
// 물어보기 목록 — 질문하기 단추들 + 오늘 남은 질문 한 줄 (브라우저 부품)
//
// 목록 화면 자체는 서버가 그리는 정적 화면이라, 로그인한 사람마다 다른 "남은 수"는
// 이 부품이 화면에서 따로 불러 채운다.
//   variant="title" : PC 제목 오른쪽 단추
//   variant="row"   : 목록 위 PC 단추
//   variant="quota" : 머리 안 "오늘 남은 질문" 한 줄
//   variant="fab"   : 모바일 떠 있는 "+ 질문하기"
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { AskAskButton, AskQuotaLine, useAskQuota } from './AskQuota';
import { IcPlus } from './icons';

export default function AskListActions({ variant }: { variant: 'title' | 'row' | 'fab' | 'quota' }) {
  const quota = useAskQuota();
  const label = (
    <>
      <IcPlus />
      질문하기
    </>
  );
  if (variant === 'quota') return <AskQuotaLine quota={quota} />;
  if (variant === 'fab') return <AskAskButton quota={quota} className="fab">{label}</AskAskButton>;
  if (variant === 'title') return <AskAskButton quota={quota} className="btn p ask-btn-pc">{label}</AskAskButton>;
  return (
    <div className="list-top">
      <AskAskButton quota={quota} className="btn p ask-btn-pc">
        {label}
      </AskAskButton>
    </div>
  );
}
