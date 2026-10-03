// ──────────────────────────────────────────────
// 물어보기 — AI 답변 마크다운 → HTML 바꾸기
//
// 블로그(lib/blog.ts)와 같은 도구(unified + remark-gfm)를 쓴다. 표도 그대로 그려진다.
// 다른 점 하나: 블로그는 글 안의 HTML 태그를 그대로 살리지만(rehype-raw),
// 여기 답변은 회원 질문을 바탕으로 만들어지는 글이라 HTML 태그를 살리지 않는다
// (누가 질문에 <script> 같은 걸 넣어 답변에 섞여 들어와도 글자로만 보이게 — 안전장치).
//
// 표 꾸미기: "판단" 칸 글자가 "범위 안/적정"이면 초록, "높음/비쌈"이면 강조색으로
// 칠할 수 있게 칸에 이름표(ok / hi)를 붙이고, "~" 가 든 범위 칸은 회색(rng)으로.
// 좁은 화면에서 표가 넘치면 표 안에서만 가로로 밀리게 감싼다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import 'server-only';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

export async function renderAnswerMarkdown(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    // 물결 하나(~)는 "150만~195만" 같은 범위 표기라 취소선으로 바꾸지 않는다(블로그와 같은 이유)
    .use(remarkGfm, { singleTilde: false })
    .use(remarkRehype) // HTML 태그는 살리지 않음(안전)
    .use(rehypeStringify)
    .process(md);

  let html = String(file);

  // 표 칸 꾸미기 — 첫 칸(항목 이름)은 건드리지 않고, 판단·범위 칸만 이름표를 붙인다
  html = html.replace(/<td([^>]*)>([\s\S]*?)<\/td>/g, (whole, attrs: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    let cls = '';
    if (/^(범위 안|적정|보통|평균)/.test(text)) cls = 'ok';
    else if (/^(높음|비쌈|범위 위|과다)/.test(text)) cls = 'hi';
    else if (/~/.test(text) && text.length <= 20) cls = 'rng';
    if (!cls) return whole;
    return `<td${attrs} class="${cls}">${inner}</td>`;
  });

  // 표는 가로 스크롤 상자로 감싼다(본문 폭은 절대 안 넘치게)
  html = html.replace(/<table>/g, '<div class="ask-table-wrap"><table>').replace(/<\/table>/g, '</table></div>');

  // 바깥 주소는 새 창으로
  html = html.replace(/<a href="(https?:\/\/[^"]*)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');
  return html;
}
