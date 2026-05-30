# 정산 기간 변경 + Supabase 영속화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 누적매출 정산 기준을 "매월 1일~다음달 1일(달력월)"로 바꾸고, 모든 매출 기록을 Supabase DB에 영속화한다.

**Architecture:** 순수 유틸(`salesPeriod.js`)에서 정산 기간/그룹 키를 달력월 기준으로 계산. `useSalesData` 훅을 localStorage 단독에서 Supabase 주 저장소(+localStorage 캐시/1회 마이그레이션, 낙관적 업데이트+롤백)로 전환. 기존 데이터 모델(`original`/`final`/카드 10% 수수료)은 보존.

**Tech Stack:** Vite, React 19, @supabase/supabase-js v2, Supabase Postgres(RLS). 테스트 러너 미설치 → 순수 함수는 `node` ESM 스크립트로 검증, 나머지는 `npm run build`/eslint/MCP DB 왕복으로 검증.

---

## File Structure

- `src/utils/salesPeriod.js` (수정) — `getSalesPeriod()`/`getPeriodKey()`를 달력월 기준으로.
- `src/App.jsx` (수정) — 이번 달 필터 경계 `<= end` → `< end`.
- `src/components/RecordModal.jsx` (수정) — 인라인 `getSalesPeriod` 제거 후 공용 import, 필터 경계 `< end`.
- `src/supabaseClient.js` (이미 존재, 확인/유지) — Supabase 클라이언트 + `RECORDS_TABLE`.
- `src/hooks/useSalesData.js` (재작성) — Supabase CRUD + 마이그레이션 + 낙관적 업데이트.
- `.env.local` (수정) — 실제 publishable 키 기록(MCP로 확보).
- `.env.example` (이미 존재, 유지).
- `supabase/migrations/0001_create_sales_records.sql` (생성) — 테이블 DDL 사본.

전제: Supabase MCP 프로젝트 쓰기 권한. 막히면 Task 5에서 대시보드 수동 절차로 폴백.

---

## Task 1: 정산 기간/그룹 키를 달력월로 변경

**Files:**
- Modify: `src/utils/salesPeriod.js`
- Test: `tmp/period_test.mjs` (임시, 검증 후 삭제)

- [ ] **Step 1: 실패하는 테스트 작성** (`tmp/period_test.mjs`)

```js
import { getPeriodKey } from '../src/utils/salesPeriod.js';

const cases = [
  ['2024-01-01', '2024-01'],
  ['2024-01-10', '2024-01'], // 구 규칙이면 2023-12
  ['2024-01-31', '2024-01'],
  ['2024-02-01', '2024-02'], // 구 규칙이면 2024-01
  ['2024-12-15', '2024-12'],
  ['2025-01-05', '2025-01'], // 구 규칙이면 2024-12
];
let fail = 0;
for (const [input, expected] of cases) {
  const got = getPeriodKey(input);
  const ok = got === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${input} -> ${got} (expected ${expected})`);
  if (!ok) fail++;
}
console.log(`\n${cases.length - fail} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd "C:\Users\User\OneDrive\문서\test_repo" && node tmp/period_test.mjs`
Expected: `2024-01-10`, `2025-01-05` 등에서 FAIL (구 규칙은 전월로 귀속).

- [ ] **Step 3: `salesPeriod.js` 구현**

```js
// 매출 정산 기간 계산 유틸리티
// 정산 주기: 매월 1일 ~ 다음달 1일 (달력상 한 달)

/**
 * 현재 정산 기간(이번 달 1일 ~ 다음달 1일)을 반환.
 * end 는 미포함 경계(다음달 1일 00:00) — 필터는 `date < end` 로 비교.
 * @returns {{ start: Date, end: Date }}
 */
export function getSalesPeriod() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 1, 0, 0, 0);
    const end = new Date(year, month + 1, 1, 0, 0, 0);
    return { start, end };
}

/**
 * 주어진 날짜가 속한 정산월 키("YYYY-MM"). 달력상 연-월 그대로.
 * @param {string} dateString
 * @returns {string}
 */
export function getPeriodKey(dateString) {
    const dt = new Date(dateString);
    const y = dt.getFullYear();
    const m = dt.getMonth();
    return `${y}-${String(m + 1).padStart(2, '0')}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node tmp/period_test.mjs`
Expected: `6 PASS / 0 FAIL`, exit 0.

- [ ] **Step 5: 임시 테스트 삭제 후 커밋**

```bash
rm -rf tmp
git add src/utils/salesPeriod.js
git commit -m "feat: 정산기간을 1일~다음달1일(달력월)로 변경"
```

---

## Task 2: 호출부 필터 경계 수정 (App.jsx, RecordModal.jsx)

**Files:**
- Modify: `src/App.jsx` (이번 달 필터)
- Modify: `src/components/RecordModal.jsx` (인라인 함수 제거 + 필터)

- [ ] **Step 1: App.jsx 필터 경계 수정**

`src/App.jsx`에서:
```js
    return itemDate >= period.start && itemDate <= period.end;
```
를 다음으로 변경:
```js
    return itemDate >= period.start && itemDate < period.end;
```

- [ ] **Step 2: RecordModal.jsx import 변경**

`src/components/RecordModal.jsx` 상단:
```js
import { getPeriodKey } from '../utils/salesPeriod';
```
를:
```js
import { getSalesPeriod, getPeriodKey } from '../utils/salesPeriod';
```

- [ ] **Step 3: RecordModal.jsx 인라인 getSalesPeriod 제거**

다음 블록을 삭제하고 `const period = getSalesPeriod();` 한 줄만 남긴다:
```js
  const getSalesPeriod = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = now.getDate();

    let start, end;
    if (date <= 10) {
      start = new Date(year, month - 1, 11, 0, 0, 0);
      end = new Date(year, month, 10, 23, 59, 59);
    } else {
      start = new Date(year, month, 11, 0, 0, 0);
      end = new Date(year, month + 1, 10, 23, 59, 59);
    }
    return { start, end };
  };

  const period = getSalesPeriod();
```
→ 결과:
```js
  const period = getSalesPeriod();
```

- [ ] **Step 4: RecordModal.jsx 필터 경계 수정**

```js
      return dt >= period.start && dt <= period.end;
```
를:
```js
      return dt >= period.start && dt < period.end;
```

- [ ] **Step 5: 빌드로 컴파일 확인 후 커밋**

Run: `cd "C:\Users\User\OneDrive\문서\test_repo" && npm run build`
Expected: `✓ built`, exit 0.
```bash
git add src/App.jsx src/components/RecordModal.jsx
git commit -m "feat: 정산 필터를 달력월 미포함 경계(< end)로 정렬"
```

---

## Task 3: Supabase 테이블 생성 (MCP) + DDL 사본

**Files:**
- Create: `supabase/migrations/0001_create_sales_records.sql`
- DB: `public.sales_records` (MCP `apply_migration`)

- [ ] **Step 1: DDL 사본 파일 작성** (`supabase/migrations/0001_create_sales_records.sql`)

```sql
-- 매출 기록 테이블. Supabase SQL Editor 에 붙여넣어 수동 실행도 가능.
create table if not exists public.sales_records (
  id          text primary key,
  type        text not null,
  original    numeric not null default 0,
  final       numeric not null default 0,
  name        text not null default '',
  date        timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists sales_records_date_idx on public.sales_records (date desc);
alter table public.sales_records enable row level security;
drop policy if exists "public_select_sales_records" on public.sales_records;
drop policy if exists "public_insert_sales_records" on public.sales_records;
drop policy if exists "public_update_sales_records" on public.sales_records;
drop policy if exists "public_delete_sales_records" on public.sales_records;
create policy "public_select_sales_records" on public.sales_records for select to anon, authenticated using (true);
create policy "public_insert_sales_records" on public.sales_records for insert to anon, authenticated with check (true);
create policy "public_update_sales_records" on public.sales_records for update to anon, authenticated using (true) with check (true);
create policy "public_delete_sales_records" on public.sales_records for delete to anon, authenticated using (true);
```

- [ ] **Step 2: MCP로 테이블 생성**

`apply_migration(project_id="jvtwxjkfntxnuepkfcuq", name="create_sales_records", query=<위 SQL>)`
Expected: 성공.
**폴백**: 권한 거부 시 → 사용자에게 위 SQL을 Supabase 대시보드 SQL Editor에서 실행하도록 요청.

- [ ] **Step 3: 테이블 검증**

`list_tables(project_id, schemas=["public"], verbose=true)` 또는
`execute_sql("select column_name,data_type from information_schema.columns where table_name='sales_records' order by ordinal_position")`
Expected: id/type/original/final/name/date/created_at 컬럼 확인.

- [ ] **Step 4: 보안 advisor 확인**

`get_advisors(project_id, type="security")`
Expected: RLS 관련 치명 경고 없음.

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0001_create_sales_records.sql
git commit -m "feat: sales_records 테이블 마이그레이션 추가"
```

---

## Task 4: Supabase 클라이언트 + 실제 키 설정

**Files:**
- Verify/keep: `src/supabaseClient.js`
- Modify: `.env.local` (실제 키)
- Keep: `.env.example`

- [ ] **Step 1: `src/supabaseClient.js` 내용 확인/보정**

내용이 아래와 일치하는지 확인(불일치 시 덮어쓰기):
```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase 환경변수가 없습니다. .env.local 을 확인하세요.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
export const RECORDS_TABLE = 'sales_records';
```

- [ ] **Step 2: 실제 publishable 키 확보**

`get_publishable_keys(project_id="jvtwxjkfntxnuepkfcuq")` → `disabled:false`인 `sb_publishable_...`(또는 anon) 키 복사.
`get_project_url(project_id)` → URL 확인(`https://jvtwxjkfntxnuepkfcuq.supabase.co`).
**폴백**: 권한 거부 시 → 사용자에게 Settings>API에서 키를 복사해 `.env.local`에 붙여넣도록 요청.

- [ ] **Step 3: `.env.local` 갱신**

```
VITE_SUPABASE_URL=https://jvtwxjkfntxnuepkfcuq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<Step 2에서 받은 실제 키>
```
(주의: 코드/대화에 키를 추측해서 넣지 말 것. 실제로 받은 값만 기록.)

- [ ] **Step 4: 커밋** (`.env.local`은 gitignore되므로 제외)

```bash
git add src/supabaseClient.js
git commit -m "feat: Supabase 클라이언트 설정" --allow-empty
```

---

## Task 5: useSalesData 훅 재작성 (Supabase 영속화)

**Files:**
- Rewrite: `src/hooks/useSalesData.js`

- [ ] **Step 1: 훅 전체 재작성**

```js
import { useState, useEffect, useCallback } from 'react';
import { supabase, RECORDS_TABLE } from '../supabaseClient';

// 주 저장소: Supabase. localStorage 는 오프라인 캐시 + 기존 데이터 1회 마이그레이션.
const CACHE_KEY = 'salesData';
const MIGRATION_FLAG = 'salesData_migrated_to_supabase';

// 결제수단별 최종액: 현금=원금, 카드=수수료 10% 차감
function computeFinal(type, original) {
  return type === '현금' ? original : Math.floor(original * 0.9);
}

function readCache() {
  try {
    const item = window.localStorage.getItem(CACHE_KEY);
    return item ? JSON.parse(item) : [];
  } catch (e) {
    console.error('Failed to read sales cache:', e);
    return [];
  }
}

export const useSalesData = () => {
  const [salesData, setSalesData] = useState(readCache);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const persist = useCallback((updater) => {
    setSalesData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to write sales cache:', e);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from(RECORDS_TABLE)
        .select('*')
        .order('date', { ascending: false });
      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr.message);
        setLoading(false);
        return;
      }
      let rows = data ?? [];
      const localRows = readCache();
      const alreadyMigrated = window.localStorage.getItem(MIGRATION_FLAG);
      if (rows.length === 0 && localRows.length > 0 && !alreadyMigrated) {
        const toInsert = localRows.map((r) => {
          const original = Number(r.original) || 0;
          return {
            id: String(r.id),
            type: r.type,
            original,
            final: Number(r.final ?? computeFinal(r.type, original)),
            name: r.name || '',
            date: r.date,
          };
        });
        const { data: inserted, error: insErr } = await supabase
          .from(RECORDS_TABLE)
          .insert(toInsert)
          .select();
        if (cancelled) return;
        if (insErr) {
          setError(insErr.message);
        } else {
          window.localStorage.setItem(MIGRATION_FLAG, '1');
          rows = (inserted ?? toInsert).sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );
        }
      }
      setError(null);
      persist(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [persist]);

  const addRecord = useCallback(async (type, originalAmount, name = '') => {
    const original = Number(originalAmount) || 0;
    const record = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID() : String(Date.now()),
      type,
      original,
      final: computeFinal(type, original),
      name: (name || '').trim(),
      date: new Date().toISOString(),
    };
    persist((prev) => [record, ...prev]);
    const { error: insErr } = await supabase.from(RECORDS_TABLE).insert(record);
    if (insErr) {
      setError(insErr.message);
      persist((prev) => prev.filter((r) => r.id !== record.id));
    } else {
      setError(null);
    }
  }, [persist]);

  const updateRecord = useCallback(async (id, type, newOriginalAmount, name = '') => {
    const original = Number(newOriginalAmount) || 0;
    const patch = {
      type, original,
      final: computeFinal(type, original),
      name: (name || '').trim(),
    };
    let snapshot;
    persist((prev) => {
      snapshot = prev;
      return prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
    });
    const { error: updErr } = await supabase.from(RECORDS_TABLE).update(patch).eq('id', id);
    if (updErr) {
      setError(updErr.message);
      if (snapshot) persist(snapshot);
    } else {
      setError(null);
    }
  }, [persist]);

  const deleteRecord = useCallback(async (id) => {
    let snapshot;
    persist((prev) => {
      snapshot = prev;
      return prev.filter((r) => r.id !== id);
    });
    const { error: delErr } = await supabase.from(RECORDS_TABLE).delete().eq('id', id);
    if (delErr) {
      setError(delErr.message);
      if (snapshot) persist(snapshot);
    } else {
      setError(null);
    }
  }, [persist]);

  return { salesData, addRecord, updateRecord, deleteRecord, loading, error };
};
```

- [ ] **Step 2: 빌드 확인**

Run: `cd "C:\Users\User\OneDrive\문서\test_repo" && npm run build`
Expected: `✓ built`, exit 0.

- [ ] **Step 3: 변경 파일 lint 확인**

Run: `npx eslint src/utils/salesPeriod.js src/hooks/useSalesData.js src/supabaseClient.js`
Expected: 에러 없음(기존 RecordModal/ModalContext의 사전 존재 경고는 무관).

- [ ] **Step 4: 커밋**

```bash
git add src/hooks/useSalesData.js
git commit -m "feat: useSalesData를 Supabase 영속화로 전환(+1회 마이그레이션)"
```

---

## Task 6: 엔드투엔드 검증

**Files:** 없음(검증만)

- [ ] **Step 1: DB 왕복 테스트 (MCP)**

`execute_sql`로 임시 행 insert → select → delete:
```sql
insert into public.sales_records (id, type, original, final, name, date)
values ('test-e2e', '카드', 10000, 9000, 'E2E', now());
select id, type, original, final from public.sales_records where id='test-e2e';
delete from public.sales_records where id='test-e2e';
```
Expected: insert/select(1행, final=9000)/delete 성공.
**폴백**: MCP 막히면 사용자에게 앱 실행 후 매출 추가→새로고침→유지 확인 요청.

- [ ] **Step 2: 최종 빌드**

Run: `npm run build`
Expected: `✓ built`.

- [ ] **Step 3: 변경 요약 및 git 상태 확인**

Run: `git status --short && git log --oneline -6`
Expected: 작업 트리 정리됨, 커밋 6개 내외.

---

## Self-Review (작성자 점검 결과)

- **Spec 커버리지**: 정산기간 변경(Task1) / 호출부·재정렬(Task1·2) / 테이블(Task3) / 클라이언트·키(Task4) / 영속화·마이그레이션(Task5) / 검증(Task6) — spec 전 섹션 매핑됨.
- **Placeholder**: 모든 코드 단계에 실제 코드 포함. 키 값만 런타임에 MCP로 확보(추측 금지 명시).
- **타입/시그니처 일관성**: `computeFinal(type, original)`, 레코드 필드 `{id,type,original,final,name,date}`, 훅 반환 `{salesData,addRecord,updateRecord,deleteRecord,loading,error}` — Task 간 일치. `getSalesPeriod()`/`getPeriodKey(string)` 시그니처 호출부와 일치.
- **위험요소**: Supabase MCP 프로젝트 권한이 간헐적/거부됨 → Task3·4·6에 대시보드 수동 폴백 명시.
