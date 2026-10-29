// ─────────────────────────────────────────────────────────────
// vercel-env-set.mjs — Vercel 환경변수 값을 바꾸고 운영 재배포를 건다 (2026-10-29)
//   사용: node scripts/vercel-env-set.mjs <변수이름> <환경변수이름(.env.local에서 값을 읽음)> [--redeploy]
//   예:   node scripts/vercel-env-set.mjs ADMIN_PASSWORD ADMIN_PASSWORD --redeploy
//   열쇠: .env.local 의 VERCEL_TOKEN(얼마드나 팀 토큰). 값은 화면에 절대 찍지 않는다.
//   프로젝트/팀 id 는 .vercel/project.json 에서 읽는다.
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const { projectId, orgId } = JSON.parse(fs.readFileSync(path.join(root, '.vercel/project.json'), 'utf8'));
const token = env.VERCEL_TOKEN;
if (!token) { console.error('VERCEL_TOKEN 없음'); process.exit(1); }

const [name, fromKey, flag] = process.argv.slice(2);
if (!name || !fromKey) { console.error('사용법: <변수이름> <.env.local 키> [--redeploy]'); process.exit(1); }
const value = env[fromKey];
if (!value) { console.error(`.env.local 에 ${fromKey} 없음`); process.exit(1); }

const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const api = (p, init) => fetch(`https://api.vercel.com${p}${p.includes('?') ? '&' : '?'}teamId=${orgId}`, { ...init, headers: H });

// 1) 기존 변수 찾기
const list = await (await api(`/v9/projects/${projectId}/env`)).json();
const found = (list.envs ?? []).filter((e) => e.key === name);
console.log(`${name}: 기존 ${found.length}개 (환경: ${found.map((e) => e.target.join('/')).join(', ') || '없음'})`);

// 2) 있으면 값 교체(환경 유지), 없으면 production/preview/development 에 새로 만듦
if (found.length) {
  for (const e of found) {
    const r = await api(`/v9/projects/${projectId}/env/${e.id}`, { method: 'PATCH', body: JSON.stringify({ value }) });
    console.log(`교체 ${e.target.join('/')}: ${r.status}`);
    if (!r.ok) { console.error((await r.text()).slice(0, 300)); process.exit(1); }
  }
} else {
  const r = await api(`/v10/projects/${projectId}/env`, { method: 'POST', body: JSON.stringify({ key: name, value, type: 'encrypted', target: ['production', 'preview', 'development'] }) });
  console.log(`생성: ${r.status}`);
  if (!r.ok) { console.error((await r.text()).slice(0, 300)); process.exit(1); }
}

// 3) 재배포: 가장 최근 운영 배포를 같은 커밋으로 다시 굽는다
if (flag === '--redeploy') {
  const d = await (await api(`/v6/deployments?projectId=${projectId}&target=production&limit=1`)).json();
  const last = d.deployments?.[0];
  if (!last) { console.error('운영 배포 없음'); process.exit(1); }
  const r = await api(`/v13/deployments?forceNew=1`, { method: 'POST', body: JSON.stringify({ name: last.name, deploymentId: last.uid, target: 'production', meta: { note: `${name} 교체 재배포` } }) });
  const j = await r.json();
  console.log(`재배포: ${r.status} ${j.id ?? ''} ${j.readyState ?? j.error?.message ?? ''}`);
}
