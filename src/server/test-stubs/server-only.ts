// 테스트에서 'server-only' 자리에 끼워 넣는 빈 모듈.
//
// 'server-only' 패키지는 클라이언트 번들에 섞이면 에러를 던지도록 만들어진 표식이라
// Next.js 밖(vitest)에서 그냥 불러오면 곧바로 에러가 난다.
// vitest.config.ts 에서 이 파일로 바꿔치기해 테스트가 정상 실행되게 한다.
export {};
