// ─────────────────────────────────────────────────────────────
// Supabase 서버 전용 클라이언트 (getSupabaseAdmin)
//
// [무슨 기능인가]
//   견적 저장 API(estimates)와 관리자 통계 API(admin-users)가 쓰는
//   Supabase 접속 창구. service_role 키(관리자 열쇠)를 쓰기 때문에
//   RLS(행 단위 보안 정책)를 그대로 통과해서 읽고 쓸 수 있다.
//
// [왜 anon 키가 아니라 service_role 키인가]
//   2026년 6월부터 견적 저장이 anon 키(누구나 쓸 수 있는 공개 열쇠)로는
//   막혀 있었다 — Supabase의 RLS가 로그인 안 한 익명 insert를 차단해서
//   에러코드 42501(권한 없음)이 계속 났었다.
//
//   saved_estimates 테이블은 "로그인한 사용자만 자기 견적을 저장/조회/
//   삭제"할 수 있어야 하는데, 그 "로그인 확인"은 이미 NextAuth(카카오
//   로그인) 세션이 서버에서 하고 있다. 그래서 Supabase RLS로 한 번 더
//   막을 필요 없이, 서버가 service_role 키로 RLS를 우회하고 대신
//   라우트 코드가 모든 쿼리에 반드시 .eq('user_id', session.user.id)를
//   넣어서 "내 견적만" 보이게 직접 강제한다(다른 사람 견적을 조회하거나
//   지우지 못하게 하는 실질적인 방어선).
//
// [주의 — server-only]
//   service_role 키는 절대로 브라우저(클라이언트)에 노출되면 안 되는
//   마스터 키다(이 키가 있으면 RLS를 전부 무시하고 아무 행이나 만질 수
//   있음). 'server-only' 표식을 맨 위에 넣어서, 실수로 클라이언트
//   컴포넌트에서 이 파일을 import하면 빌드 단계에서 바로 에러가 나서
//   눈치챌 수 있게 막아둔다.
// ─────────────────────────────────────────────────────────────
import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 매 요청마다 새로 만들지 않고 한 번 만든 걸 재사용(서버리스 인스턴스가
// 살아있는 동안은 재사용, 인스턴스가 새로 뜨면 다시 만들어짐 — 정상 동작)
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    // URL은 NEXT_PUBLIC_* 로 이미 있는 값을 그대로 재사용(클라이언트/서버 공통 값이라 문제없음)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) {
      throw new Error('Supabase 환경 변수(NEXT_PUBLIC_SUPABASE_URL)가 설정되지 않았습니다.');
    }
    if (!serviceKey) {
      // 형아가 알아볼 수 있게 "무슨 키가 없는지" 명확히 알려줌 (Vercel 환경변수 누락이 원인인 경우가 대부분)
      throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인하세요.');
    }

    _supabaseAdmin = createClient(url, serviceKey, {
      auth: {
        // 서버는 매 요청이 독립적이라 세션을 브라우저처럼 유지할 필요가 없음
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _supabaseAdmin;
}
