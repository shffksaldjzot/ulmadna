// ─────────────────────────────────────────────────────────────
// 시험용 가짜 Supabase — 메모리 안 표 + 보관함 (2026년 11월 24일)
//
// [왜 만들었나]
//   결제 확인(finalizePayment)·배너 자동 제작은 DB 와 보관함을 여러 번 읽고 쓴다.
//   운영 DB 에 쓰지 않고도 "두 번 와도 한 번만 처리되는지", "그리기가 실패해도 결제가 남는지"를
//   확인하려고, 이 파일이 쓰는 만큼만 흉내 낸 가짜 클라이언트를 둔다.
//   (실제 supabase-js 의 모든 기능을 흉내 내지 않는다 — 시험이 쓰는 select·insert·update·eq·neq·is·in·limit·order·
//    single·maybeSingle·rpc·storage.upload/getPublicUrl/download 만)
// ─────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

/** 가짜 클라이언트를 만든다. tables 는 처음 넣어 둘 줄, rpc 는 이름별 답 */
export function makeFakeSupabase(opts: { tables?: Record<string, Row[]>; rpc?: Record<string, unknown> } = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [k, v] of Object.entries(opts.tables ?? {})) tables[k] = v.map((r) => ({ ...r }));
  /** 보관함: "통이름/경로" → 바이트 */
  const files = new Map<string, Uint8Array>();
  /** 올리기 호출 기록(몇 번 올렸는지 보기 위해) */
  const uploads: { bucket: string; path: string; upsert: boolean }[] = [];
  /** 다음 올리기를 일부러 실패시킬지(시험용 스위치) */
  const fail = { upload: false, insertTable: '' as string };
  const nextId: Record<string, number> = {};

  const tableOf = (name: string) => (tables[name] = tables[name] ?? []);

  /** 질의 하나(체인 방식). await 하면 { data, error } 를 돌려준다 */
  function query(name: string) {
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Row | Row[] | null = null;
    let wantRows = false; // insert/update 뒤 .select() 를 불렀는지
    let single: 'one' | 'maybe' | null = null;
    let head = false;
    let limitN: number | null = null;
    const filters: Filter[] = [];

    const run = (): { data: unknown; error: unknown; count?: number } => {
      const t = tableOf(name);
      if (op === 'insert') {
        if (fail.insertTable === name) return { data: null, error: { message: 'insert failed' } };
        const list = Array.isArray(payload) ? payload : [payload as Row];
        const made = list.map((r) => {
          const id = (nextId[name] = (nextId[name] ?? t.length) + 1);
          const row = { id, ...r };
          t.push(row);
          return { ...row };
        });
        return finish(made);
      }
      let rows = t.filter((r) => filters.every((f) => f(r)));
      if (op === 'update') {
        for (const r of rows) Object.assign(r, payload as Row);
        return wantRows ? finish(rows.map((r) => ({ ...r }))) : { data: null, error: null };
      }
      if (op === 'delete') {
        tables[name] = t.filter((r) => !rows.includes(r));
        return { data: null, error: null };
      }
      if (limitN != null) rows = rows.slice(0, limitN);
      if (head) return { data: null, error: null, count: rows.length };
      return finish(rows.map((r) => ({ ...r })));
    };
    const finish = (rows: Row[]) => {
      if (single === 'one') return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: 'not single' } };
      if (single === 'maybe') return { data: rows[0] ?? null, error: null };
      return { data: rows, error: null };
    };

    const q = {
      select(_cols?: string, o?: { count?: string; head?: boolean }) {
        if (op === 'select') head = !!o?.head;
        else wantRows = true;
        return q;
      },
      insert(v: Row | Row[]) { op = 'insert'; payload = v; return q; },
      update(v: Row) { op = 'update'; payload = v; return q; },
      delete() { op = 'delete'; return q; },
      eq(k: string, v: unknown) { filters.push((r) => r[k] === v); return q; },
      neq(k: string, v: unknown) { filters.push((r) => r[k] !== v); return q; },
      is(k: string, v: unknown) { filters.push((r) => (v === null ? r[k] == null : r[k] === v)); return q; },
      in(k: string, vs: unknown[]) { filters.push((r) => vs.includes(r[k])); return q; },
      lt() { return q; }, lte() { return q; }, gte() { return q; }, not() { return q; }, or() { return q; },
      order() { return q; },
      limit(n: number) { limitN = n; return q; },
      single() { single = 'one'; return q; },
      maybeSingle() { single = 'maybe'; return q; },
      then<T>(res: (v: { data: unknown; error: unknown; count?: number }) => T, rej?: (e: unknown) => T) {
        try { return Promise.resolve(run()).then(res, rej); } catch (e) { return Promise.reject(e).then(res, rej); }
      },
    };
    return q;
  }

  const client = {
    from: (name: string) => query(name),
    rpc: async (fn: string) => ({ data: opts.rpc?.[fn] ?? true, error: null }),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, bytes: Uint8Array, o?: { upsert?: boolean }) => {
          uploads.push({ bucket, path, upsert: !!o?.upsert });
          if (fail.upload) return { data: null, error: { message: 'upload failed' } };
          const key = `${bucket}/${path}`;
          if (files.has(key) && !o?.upsert) return { data: null, error: { message: 'exists' } };
          files.set(key, bytes);
          return { data: { path }, error: null };
        },
        download: async (path: string) => {
          const b = files.get(`${bucket}/${path}`);
          return b ? { data: new Blob([new Uint8Array(b)]), error: null } : { data: null, error: { message: 'missing' } };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://fake.storage/${bucket}/${path}` } }),
      }),
    },
  };
  return { client, tables, files, uploads, fail };
}
