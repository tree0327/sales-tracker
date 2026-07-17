# 흑백 미니멀 전환 + 매출 탭 복원 + AI 제거 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부부 가계부를 흑백 미니멀 디자인으로 전면 전환하고, 매출관리를 예전 미용실앱 포맷의 독립 탭으로 복원하며, AI 잔여 코드와 `ai_chat` 테이블을 제거한다.

**Architecture:** 디자인은 `src/index.css` 최상단 토큰 레이어만 교체하면 대부분의 화면이 따라오도록 되어 있다(모든 색이 `var(--*)` 참조). 다크모드 블록 3개를 삭제하고 웜톤 토큰을 흑백 토큰으로 교체한 뒤, 소유자 색에 의존하던 곳(`.ava.w/.h/.j`, `.dt.w/.h/.j`, `.seg .s.on.w/.h/.j`)만 텍스트 뱃지로 대체한다. 매출 탭은 데이터를 `transactions`(`flow=income`, `category=매출`)에 그대로 두고, 예전 `analytics.js`가 기대하는 레거시 레코드 형태로 변환하는 순수 어댑터를 끼워 예전 UI를 되살린다.

**Tech Stack:** React 19 + Vite 8 + 순수 CSS + Supabase. Vitest 38개 통과 중.

## Global Constraints

- **스택 변경 금지**: Tailwind·Next.js 도입하지 않는다. `DESIGN.md`의 Tailwind 클래스는 아래 §토큰 매핑표대로 CSS 변수/클래스로 **번역**해서 적용한다. `next/image`·`app/globals.css`·`usePathname` 등 Next 전제 규칙은 적용 대상이 아니다.
- **다크모드 제거**: `@media (prefers-color-scheme: dark)` 블록과 `:root[data-theme="dark"]` 블록을 삭제한다. `:root`에 `color-scheme: light` 고정.
- **4px 그리드**: 모든 margin·padding·gap은 4의 배수. 기존의 `padding: 22px 18px 16px`, `gap: 7px`, `font-size: 12.5px` 같은 비배수 값을 4배수로 정리한다. 예외는 뱃지의 상하 2px 정도만.
- **라운드 3단계만**: `4px`(뱃지·태그) / `12px`(버튼·입력·알림박스) / `16px`(카드·패널·모달) + `50%`(아바타·점). 기존 `20px`, `15px`, `18px`, `13px`, `11px` 등 임의 반경은 이 3단계로 스냅.
- **굵기 400/500/700만**: 기존 `800`은 전부 `700`으로, `600`은 `500`으로 내린다.
- **터치 타깃 ≥ 48px**: 탭 가능한 요소는 `min-height: 48px` 이상. 주요 버튼은 `56px`.
- **포커스 링 필수**: 모든 인터랙티브 요소에 `:focus-visible { outline: 2px solid #171717; outline-offset: 2px; }`.
- **색은 의미가 있을 때만**: 흑백 + 투명도 그레이가 기본. 수입/지출 금액과 성공/오류/경고/정보 상태만 §2 상태색 사용.
- **한국어 UI** 유지.
- **매출 데이터는 `transactions` 단일 소스**: `sales_records` 테이블은 참조하지 않는다(0006에서 이미 이관 완료). 매출 탭 입력은 `flow='income'`, `category='매출'`, `owner='wife'`로 저장되어 홈 잔액에 자동 반영된다.
- **모든 커밋 전 검증**: `npx vitest run` **전부 통과**(실패 0) + `npm run build` 성공. 개수는 Task 1에서 AI 테스트 삭제로 줄고(38→32 예상) Task 5·6에서 늘어난다(→39). 절대 개수가 아니라 "실패 0"이 기준이다.

### 토큰 매핑표 (DESIGN.md Tailwind → 이 프로젝트 CSS 변수)

| DESIGN.md | 값 | 이 프로젝트 변수 |
| --- | --- | --- |
| `--background` | `#ffffff` | `--bg` |
| `--foreground` | `#171717` | `--fg` |
| `text-black/60` | `rgba(0,0,0,.6)` | `--fg-2` |
| `text-black/40` | `rgba(0,0,0,.4)` | `--fg-3` |
| `border-black/10` | `rgba(0,0,0,.1)` | `--line` |
| `bg-black/5` | `rgba(0,0,0,.05)` | `--fill` |
| `bg-black` + `text-white` | `#171717` / `#fff` | `--accent` / `--on-accent` |
| `bg-blue-600` | `#2563eb` | `--accent-primary` (주요 액션) |
| `bg-zinc-800` | `#27272a` | `--accent-2` (보조 액션) |
| `bg-green-50` `text-green-700` | `#f0fdf4` / `#15803d` | `--ok-bg` / `--ok-fg` |
| `bg-red-50` `text-red-700` | `#fef2f2` / `#b91c1c` | `--err-bg` / `--err-fg` |
| `bg-amber-100` `text-amber-700` | `#fef3c7` / `#b45309` | `--warn-bg` / `--warn-fg` |
| `bg-blue-100` `text-blue-700` | `#dbeafe` / `#1d4ed8` | `--info-bg` / `--info-fg` |
| `rounded` / `rounded-xl` / `rounded-2xl` | 4 / 12 / 16px | `--r-sm` / `--r-md` / `--r-lg` |

**수입/지출 금액 색**: `--ok-fg`(수입) / `--err-fg`(지출). DESIGN.md §2의 "컬러는 의미가 있을 때만" 원칙에 해당하는 상태 표현이므로 허용. 그 외 모든 위계는 `--fg` → `--fg-2` → `--fg-3` 투명도로만 표현한다.

### 결정 사항 (설계 판단)

- **소유자 구분**: 색(핑크/블루/앰버) → **텍스트 뱃지**(`아내`/`남편`/`공금`). `bg-black/5` + `text-black/60` + `rounded`(4px). 색만으로 의미를 전달하지 않게 되므로 DESIGN.md §8을 오히려 더 잘 지킨다.
- **급여관리의 위치**: 하단 탭은 5칸(`홈 · 지출 · [+] · 매출 · 기록`)이 최대라 급여는 탭을 얻지 못한다. 급여관리는 **홈의 메뉴 카드에서 진입하는 화면**으로 남긴다(현재도 홈 → `onNav('income')` 경로가 있음). 홈의 "매출/급여관리" 카드 1개를 "매출관리"(→ 매출 탭) / "급여관리"(→ 급여 화면) 2개로 분리한다.
- **테스트 전략**: 이 저장소에는 Supabase 목이나 컴포넌트 테스트 인프라가 없고 기존 38개는 전부 순수 유틸 테스트다. 새 인프라를 들이지 않는다(YAGNI). 대신 **로직을 순수 함수로 뽑아 TDD**하고(`salesAdapter`, `buildUpdatePatch`), 훅 배선과 UI는 Task 11의 브라우저 검증으로 확인한다.

---

## File Structure

**삭제**
- `src/utils/aiClient.js`, `src/utils/aiPayload.js`, `src/utils/aiPayload.test.js`
- `src/utils/chatStore.js`, `src/utils/chatMemory.js`, `src/utils/chatMemory.test.js`
- `supabase/functions/ai/index.ts` (+ 빈 디렉터리)

**생성**
- `supabase/migrations/0009_drop_ai_chat.sql` — `ai_chat` 테이블 제거
- `src/utils/salesAdapter.js` — `transactions` → 레거시 매출 레코드 변환 (순수)
- `src/utils/salesAdapter.test.js`
- `src/components/OwnerBadge.jsx` — 소유자 텍스트 뱃지
- `src/screens/SalesScreen.jsx` — 매출 탭 (예전 `App.jsx` 포맷)
- `src/components/SalesInputModal.jsx` — 매출 입력/수정 (예전 `InputModal` 포맷)
- `src/components/SalesRecordModal.jsx` — 매출 기록 목록/수정/삭제 (예전 `RecordModal` 포맷)

**수정**
- `src/index.css` — 토큰 레이어 흑백 교체 + 다크 블록 삭제 + 전역 규격 정리
- `src/hooks/useLedger.js` — `updateTransaction` 추가
- `src/utils/money.js` — `buildUpdatePatch` 추가 (순수, TDD 대상)
- `src/utils/money.test.js` — `buildUpdatePatch` 테스트 추가
- `src/components/TabBar.jsx` — `매출·급여` → `매출` 탭 교체
- `src/components/TxRow.jsx` — 소유자 색 → `OwnerBadge`
- `src/Ledger.jsx` — 매출 탭 배선 + `updateTransaction` 전달
- `src/screens/IncomeScreen.jsx` — 급여 전용으로 축소
- `src/screens/HomeScreen.jsx` — 메뉴 카드 분리(매출/급여)
- `src/screens/ExpenseScreen.jsx`, `RecordsScreen.jsx`, `AnalysisView.jsx`, `SettingsScreen.jsx`, `components/InputSheet.jsx`, `components/Login.jsx`, `components/MonthlyReport.jsx` — 소유자 색 제거 + 규격 정리
- `src/supabaseClient.js` — `RECORDS_TABLE` export 제거

---

## Task 1: AI 잔여 코드 · Edge Function · ai_chat 테이블 제거

**Files:**
- Delete: `src/utils/aiClient.js`, `src/utils/aiPayload.js`, `src/utils/aiPayload.test.js`, `src/utils/chatStore.js`, `src/utils/chatMemory.js`, `src/utils/chatMemory.test.js`, `supabase/functions/ai/index.ts`
- Create: `supabase/migrations/0009_drop_ai_chat.sql`
- Modify: `src/supabaseClient.js`

**Interfaces:**
- Consumes: 없음 (독립 작업, 다른 Task와 순서 무관)
- Produces: 없음. 이후 Task는 이 파일들이 사라진 상태를 전제한다.

- [ ] **Step 1: 삭제 대상이 현재 어디서도 import 되지 않는지 확인**

Run:
```bash
grep -rn "aiClient\|aiPayload\|chatStore\|chatMemory\|RECORDS_TABLE" src/ --include=*.jsx --include=*.js \
  | grep -v "^src/utils/aiPayload\|^src/utils/aiClient\|^src/utils/chatStore\|^src/utils/chatMemory\|^src/supabaseClient.js"
```
Expected: 출력 없음(아무 데서도 안 씀). 출력이 있으면 그 파일을 먼저 정리해야 하므로 중단하고 보고할 것.

- [ ] **Step 2: 파일 삭제**

```bash
git rm src/utils/aiClient.js src/utils/aiPayload.js src/utils/aiPayload.test.js \
       src/utils/chatStore.js src/utils/chatMemory.js src/utils/chatMemory.test.js \
       supabase/functions/ai/index.ts
```

- [ ] **Step 3: `src/supabaseClient.js`에서 레거시 export 제거**

아래 2줄을 삭제한다:
```js
// 레거시(미용실 매출) 테이블 — 마이그레이션 후에는 참조하지 않는다.
export const RECORDS_TABLE = 'sales_records';
```

- [ ] **Step 4: 마이그레이션 작성**

`supabase/migrations/0009_drop_ai_chat.sql`:
```sql
-- AI 챗봇 기능 제거. 0005_create_ai_chat.sql 을 되돌린다.
-- 정책은 테이블과 함께 사라지므로 별도 drop policy 불필요.
drop table if exists public.ai_chat;
```

- [ ] **Step 5: 테스트 · 빌드 검증**

Run: `npx vitest run && npm run build`
Expected: 테스트 통과(38 → 32개로 감소: aiPayload 4개 + chatMemory 2개가 빠짐), 빌드 성공.
※ 실제 감소 개수는 실행 결과로 확인하고, 남은 테스트가 전부 통과하면 정상.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "chore: AI 기능 완전 제거 (클라이언트 코드·Edge Function·ai_chat 테이블)"
```

- [ ] **Step 7: 사용자에게 SQL 실행 안내**

`0009_drop_ai_chat.sql`은 자동 적용되지 않는다. 작업 보고 시 "Supabase SQL Editor에서 `0009` 실행 필요(저장된 대화 영구 삭제)"를 명시할 것.

---

## Task 2: 흑백 토큰 레이어 교체 + 다크모드 제거

**Files:**
- Modify: `src/index.css:1-26` (토큰 블록 전체)

**Interfaces:**
- Consumes: 없음
- Produces: 아래 CSS 변수 전부. Task 3·4는 이 이름들을 그대로 쓴다.
  `--bg --fg --fg-2 --fg-3 --line --fill --accent --accent-primary --accent-2 --on-accent --ok-bg --ok-fg --err-bg --err-fg --warn-bg --warn-fg --info-bg --info-fg --r-sm --r-md --r-lg --font --maxw --shadow-sm`

- [ ] **Step 1: `src/index.css`의 1~26줄(:root + @media dark + [data-theme=dark] 3블록)을 아래로 통째 교체**

```css
/* 디자인 토큰 — 흑백 미니멀. DESIGN.md 기준을 이 프로젝트(Vite+순수CSS)에 번역해 적용.
   색은 의미가 있을 때만(수입/지출·상태) 쓰고, 나머지 위계는 투명도 그레이로만 표현한다.
   다크모드는 지원하지 않는다(라이트 고정). */
:root {
  color-scheme: light;

  --bg: #ffffff;
  --fg: #171717;
  --fg-2: rgba(0, 0, 0, .6);
  --fg-3: rgba(0, 0, 0, .4);
  --line: rgba(0, 0, 0, .1);
  --fill: rgba(0, 0, 0, .05);

  --accent: #171717;          /* 뉴트럴 1차 CTA */
  --accent-primary: #2563eb;  /* 가장 중요한 액션 */
  --accent-2: #27272a;        /* 보조 액션 */
  --on-accent: #ffffff;       /* 위 액센트 배경 위 글씨 */

  --ok-bg: #f0fdf4;   --ok-fg: #15803d;    /* 수입·성공 */
  --err-bg: #fef2f2;  --err-fg: #b91c1c;   /* 지출·오류 */
  --warn-bg: #fef3c7; --warn-fg: #b45309;  /* 경고 */
  --info-bg: #dbeafe; --info-fg: #1d4ed8;  /* 정보 */

  /* 라운드 3단계 고정. 이 외의 값 사용 금지. */
  --r-sm: 4px;   /* 뱃지·태그 */
  --r-md: 12px;  /* 버튼·입력·알림박스 */
  --r-lg: 16px;  /* 카드·패널·모달 */

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, .05);
  --font: "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", Roboto, sans-serif;
  --maxw: 480px;
}
```

- [ ] **Step 2: 전역 기본 규칙에 포커스 링·자간·터치 규격 추가**

`* { box-sizing: border-box; ... }` 바로 아래에 추가:
```css
/* 키보드 내비게이션 전용 포커스 링(마우스 클릭엔 안 뜸). DESIGN.md §8 */
:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }
button { touch-action: manipulation; user-select: none; }
body { letter-spacing: -.01em; }
```

- [ ] **Step 3: 기존 웜톤 변수를 참조하는 잔여 지점 전수 조사**

Run:
```bash
grep -rnoE "var\(--(paper|surface|surface-2|ink|ink-2|ink-3|line-2|brand|brand-soft|brand-ink|income|income-soft|expense|expense-soft|husband|husband-soft|wife|wife-soft|joint|joint-soft|shadow)\)" src/ | sort -t: -k3 | uniq -c -f2 | sort -rn
```
Expected: 삭제된 변수를 참조하는 목록이 쭉 나온다. 이게 Task 4의 작업 목록이다. 출력을 저장해 둘 것.

- [ ] **Step 4: 삭제된 변수 → 새 변수 일괄 치환 (index.css 안)**

의미 기준으로 치환한다. 단순 sed 금지 — `--income`/`--expense`는 금액 색이지만 `--income-soft`는 배경이라 대응이 다르다.

| 옛 변수 | 새 변수 |
| --- | --- |
| `--paper` | `--bg` |
| `--surface`, `--surface-2` | `--bg` (카드는 배경 대신 `border`로 구분) |
| `--ink` | `--fg` |
| `--ink-2` | `--fg-2` |
| `--ink-3` | `--fg-3` |
| `--line`, `--line-2` | `--line` |
| `--brand`, `--joint` | `--accent` |
| `--brand-soft`, `--joint-soft`, `--husband-soft`, `--wife-soft` | `--fill` |
| `--brand-ink` | `--fg` |
| `--income` | `--ok-fg` |
| `--income-soft` | `--ok-bg` |
| `--expense` | `--err-fg` |
| `--expense-soft` | `--err-bg` |
| `--husband`, `--wife` | (삭제 — Task 3에서 뱃지로 대체) |
| `--shadow` | `--shadow-sm` |

- [ ] **Step 5: 라운드·굵기·간격을 규격으로 스냅 (index.css 전체)**

- `border-radius`: `20px`/`18px`/`16px`/`15px` → `var(--r-lg)`, `13px`/`12px`/`11px`/`10px` → `var(--r-md)`, `8px` 이하 태그류 → `var(--r-sm)`, `50%`/`999px` 유지.
- `font-weight: 800` → `700`, `600` → `500`.
- `font-size`: `12.5px`→`12px`, `13.5px`→`14px`, `11.5px`→`12px`, `14.5px`→`14px` (소수점 제거).
- padding/gap/margin의 비4배수 → 가장 가까운 4배수(`22px 18px 16px`→`24px 16px 16px`, `gap: 7px`→`gap: 8px`, `gap: 3px`→`gap: 4px`, `padding: 6px 12px 6px 8px`→`padding: 8px 12px`).
- 탭 가능한 요소(`.tb`, `.seg .s`, `.menu-card`, `.add-row`, `.icn`, `.userchip`)에 `min-height: 48px` 부여. `.save`, `.login .primary`, `.fab`는 `min-height: 56px`.
- `box-shadow`가 진한 곳(`0 8px 18px ...`)은 전부 제거. 떠 있는 표면(모달·시트)만 `var(--shadow-sm)`.

- [ ] **Step 6: 빌드 + 눈으로 확인**

Run: `npm run build && npm run dev`
브라우저에서 `http://localhost:5173/sales-tracker/` 로그인 화면이 흰 배경 + 검정 버튼으로 뜨는지 확인.
Expected: 웜톤 앰버가 완전히 사라지고 흑백. 콘솔 에러 0.

- [ ] **Step 7: 커밋**

```bash
git add src/index.css
git commit -m "refactor(design): 디자인 토큰 흑백 미니멀 전환 + 다크모드 제거"
```

---

## Task 3: 소유자 색 → 텍스트 뱃지

**Files:**
- Create: `src/components/OwnerBadge.jsx`
- Modify: `src/components/TxRow.jsx`, `src/index.css`

**Interfaces:**
- Consumes: Task 2의 `--fill`, `--fg-2`, `--r-sm`
- Produces: `<OwnerBadge owner="wife|husband|joint" />` — `아내`/`남편`/`공금` 텍스트 뱃지를 렌더. 다른 owner 값이면 `null` 반환.

- [ ] **Step 1: `src/components/OwnerBadge.jsx` 생성**

```jsx
// 소유자 표시. 예전에는 색(핑크/블루/앰버)으로 구분했지만,
// 색만으로 의미를 전달하지 않도록 텍스트 뱃지로 바꿨다(DESIGN.md §8).
const LABEL = { wife: '아내', husband: '남편', joint: '공금' };

export default function OwnerBadge({ owner }) {
  const label = LABEL[owner];
  if (!label) return null;
  return <span className="owner-badge">{label}</span>;
}
```

- [ ] **Step 2: `src/index.css`에 뱃지 스타일 추가**

```css
.owner-badge {
  display: inline-block; padding: 2px 8px; border-radius: var(--r-sm);
  background: var(--fill); color: var(--fg-2);
  font-size: 12px; font-weight: 400; line-height: 1.5; white-space: nowrap;
}
```

- [ ] **Step 3: `.ava.*` / `.dt.*` / `.seg .s.on.w|h|j` / `.userchip.w|h` / `.fixed-owner.*` / `.who .w2.on.*` 규칙 제거**

Run: `grep -n "\.ava\.\|\.dt\.\|\.on\.w\|\.on\.h\|\.on\.j\|userchip\.\|fixed-owner\.\|w2\.on\." src/index.css`
나온 규칙들에서 `--wife`/`--husband`/`--joint` 참조를 제거한다. 아바타(`.ava`)는 배경 `var(--fill)` + 글씨 `var(--fg-2)` 단색으로 통일하고, 선택 상태(`.seg .s.on`)는 이미 있는 `background: var(--bg); color: var(--fg)` 규칙만 남긴다(소유자별 분기 삭제).

- [ ] **Step 4: `src/components/TxRow.jsx`에서 소유자 색 클래스 → `OwnerBadge`로 교체**

현재 파일을 읽고, `ava.{w|h|j}` 로 소유자를 색칠하던 부분을 `<OwnerBadge owner={tx.owner} />`로 바꾼다. 아바타 자체를 없앨지 유지할지는 Task 4의 화면 정리에서 함께 판단하되, **소유자 정보가 화면에서 사라지지 않게** 할 것.

- [ ] **Step 5: 빌드 + 확인**

Run: `npm run build`
Expected: 성공. dev 서버에서 기록 목록에 `아내`/`남편`/`공금` 뱃지가 보이는지 확인.

- [ ] **Step 6: 커밋**

```bash
git add src/components/OwnerBadge.jsx src/components/TxRow.jsx src/index.css
git commit -m "refactor(design): 소유자 색 구분 → 텍스트 뱃지"
```

---

## Task 4: 화면별 흑백 적용 · 인라인 색 제거

**Files:**
- Modify: `src/screens/HomeScreen.jsx`, `ExpenseScreen.jsx`, `IncomeScreen.jsx`, `RecordsScreen.jsx`, `AnalysisView.jsx`, `SettingsScreen.jsx`, `src/components/InputSheet.jsx`, `Login.jsx`, `MonthlyReport.jsx`

**Interfaces:**
- Consumes: Task 2 토큰, Task 3의 `OwnerBadge`
- Produces: 없음 (화면 정리)

- [ ] **Step 1: 인라인 style에 박힌 옛 변수·하드코딩 색 전수 조사**

Run:
```bash
grep -rn "style={{" src/screens src/components | grep -iE "color|background|var\(--"
```
Expected: `IncomeScreen.jsx:26` 의 `style={{ color: 'var(--income)' }}` 같은 것들이 나온다. 이게 이 Task의 작업 목록이다.

- [ ] **Step 2: 인라인 색을 CSS 클래스로 이관**

인라인 `style`에 색을 직접 넣지 말고 `.pos`(수입) / `.neg`(지출) / `.calm` 클래스를 쓴다. 이미 `index.css`에 정의돼 있다:
```css
.pos { color: var(--ok-fg); } .neg { color: var(--err-fg); } .calm { color: var(--fg); }
```

- [ ] **Step 3: `AnalysisView.jsx`의 SVG 그래프 색 확인**

Run: `grep -n "fill=\|stroke=\|#[0-9A-Fa-f]\{3,6\}" src/screens/AnalysisView.jsx`
자체 SVG 그래프에 하드코딩된 색이 있으면 `var(--fg)` / `var(--fg-3)` / `var(--fill)`로 교체한다. 막대는 단색(`var(--fg)`), 예산 초과분만 `var(--err-fg)`.

- [ ] **Step 4: 각 화면의 4px 그리드·라운드·터치 타깃 확인**

Step 1~3에서 건드린 화면마다 인라인 `style`의 padding/margin/gap/fontSize/borderRadius가 Global Constraints를 지키는지 점검하고 어긋나면 스냅한다.

- [ ] **Step 5: 빌드 + 전 화면 육안 확인**

Run: `npm run build && npm run dev`
로그인 후 홈·지출·기록·설정을 모두 눌러보고 웜톤 잔재(앰버/핑크/블루 배경)가 없는지 확인.
Expected: 콘솔 에러 0, 색은 흑백 + 수입 초록/지출 빨강만.

- [ ] **Step 6: 커밋**

```bash
git add src/screens src/components
git commit -m "refactor(design): 전 화면 흑백 적용 · 인라인 색 제거"
```

---

## Task 5: `buildUpdatePatch` 순수 함수 + `updateTransaction` 추가

**Files:**
- Modify: `src/utils/money.js`, `src/utils/money.test.js`, `src/hooks/useLedger.js`

**Interfaces:**
- Consumes: 기존 `computeFinal({ flow, category, method, amount })`
- Produces:
  - `buildUpdatePatch({ flow, category, method, amount, memo, date })` → `{ amount:number, final:number, method:string, memo:string, date:string }`
  - `useLedger().updateTransaction({ id, flow, category, method, amount, memo, date })` → 갱신된 row 객체 또는 실패 시 `null`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/utils/money.test.js` 끝에 추가:
```js
import { buildUpdatePatch } from './money';

describe('buildUpdatePatch', () => {
  it('매출 카드는 수수료 10%를 뗀 final을 만든다', () => {
    const patch = buildUpdatePatch({
      flow: 'income', category: '매출', method: '카드',
      amount: 100000, memo: ' 염색 ', date: '2026-07-16T03:00:00Z',
    });
    expect(patch).toEqual({
      amount: 100000, final: 90000, method: '카드',
      memo: '염색', date: '2026-07-16T03:00:00Z',
    });
  });

  it('매출 현금은 원금 그대로다', () => {
    const patch = buildUpdatePatch({
      flow: 'income', category: '매출', method: '현금', amount: 70000, memo: '', date: '2026-07-16T03:00:00Z',
    });
    expect(patch.final).toBe(70000);
  });

  it('금액이 비어 있으면 0으로 정규화한다', () => {
    const patch = buildUpdatePatch({
      flow: 'income', category: '매출', method: '현금', amount: '', memo: null, date: '2026-07-16T03:00:00Z',
    });
    expect(patch.amount).toBe(0);
    expect(patch.final).toBe(0);
    expect(patch.memo).toBe('');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/utils/money.test.js`
Expected: FAIL — `buildUpdatePatch is not a function`

- [ ] **Step 3: 최소 구현**

`src/utils/money.js` 끝에 추가:
```js
// 거래 수정 시 DB에 보낼 패치. addTransaction 의 payload 규칙과 동일하게 final 을 재계산한다.
export function buildUpdatePatch({ flow, category, method, amount, memo, date }) {
  return {
    amount: Number(amount) || 0,
    final: computeFinal({ flow, category, method, amount }),
    method,
    memo: (memo || '').trim(),
    date,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/utils/money.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: `useLedger`에 `updateTransaction` 추가**

`src/hooks/useLedger.js`의 import에 `buildUpdatePatch`를 추가하고, `deleteTransaction` 바로 위에 삽입:
```js
  const updateTransaction = useCallback(async ({ id, flow, category, method, amount, memo, date }) => {
    const patch = buildUpdatePatch({ flow, category, method, amount, memo, date });
    const snap = transactions;
    // 낙관적 갱신 후 실패하면 스냅샷으로 되돌린다(deleteTransaction 과 동일한 패턴).
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { data, error: e } = await supabase.from(TX_TABLE).update(patch).eq('id', id).select().single();
    if (e) { setError(e.message); setTransactions(snap); return null; }
    setError(null);
    setTransactions((prev) => prev.map((t) => (t.id === id ? data : t)));
    return data;
  }, [transactions]);
```
그리고 반환 객체에 `updateTransaction` 추가:
```js
    reload, addTransaction, updateTransaction, deleteTransaction, addFixed, deleteFixed, addCategory, deleteCategory, setBudget,
```

- [ ] **Step 6: 전체 테스트 + 빌드**

Run: `npx vitest run && npm run build`
Expected: 전부 통과.

- [ ] **Step 7: 커밋**

```bash
git add src/utils/money.js src/utils/money.test.js src/hooks/useLedger.js
git commit -m "feat(ledger): 거래 수정(updateTransaction) 지원"
```

---

## Task 6: 매출 어댑터 (`transactions` ↔ 레거시 레코드)

**Files:**
- Create: `src/utils/salesAdapter.js`, `src/utils/salesAdapter.test.js`

**Interfaces:**
- Consumes: 없음 (순수)
- Produces:
  - `toSalesRecord(tx)` → `{ id, type, original, final, name, date }`
  - `salesRecords(transactions)` → 위 형태 배열 (`flow==='income' && category==='매출'` 만)

**배경:** `src/utils/analytics.js`(409줄, `todayTotal`/`thisWeekTotal`/`dayDetail` 등)는 예전 스키마 필드(`type`/`original`/`name`)를 기대한다. 현재 `transactions`는 `method`/`amount`/`memo`를 쓴다. analytics.js를 고치는 대신 어댑터를 끼워 예전 UI와 분석 함수를 그대로 재사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/utils/salesAdapter.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { toSalesRecord, salesRecords } from './salesAdapter';

const 매출카드 = { id: 2, flow: 'income', category: '매출', owner: 'wife', amount: 100000, final: 90000, method: '카드', date: '2026-07-16T03:00:00Z', memo: '염색' };
const 매출현금 = { id: 3, flow: 'income', category: '매출', owner: 'wife', amount: 70000, final: 70000, method: '현금', date: '2026-07-16T03:00:00Z', memo: '' };
const 급여 = { id: 1, flow: 'income', category: '급여', owner: 'husband', amount: 3000000, final: 3000000, method: '계좌', date: '2026-07-15T03:00:00Z', memo: '7월 월급' };
const 지출 = { id: 4, flow: 'expense', category: '생활', owner: 'joint', amount: 64300, method: '카드', date: '2026-07-16T03:00:00Z', memo: '장보기' };
const 충전 = { id: 8, flow: 'transfer', category: '공금충전', owner: 'wife', amount: 200000, final: 200000, method: '계좌', date: '2026-07-01T03:00:00Z', memo: '' };

describe('toSalesRecord', () => {
  it('method→type, amount→original, memo→name 으로 매핑한다', () => {
    expect(toSalesRecord(매출카드)).toEqual({
      id: 2, type: '카드', original: 100000, final: 90000, name: '염색', date: '2026-07-16T03:00:00Z',
    });
  });

  it('memo 가 없으면 name 은 빈 문자열이다', () => {
    expect(toSalesRecord(매출현금).name).toBe('');
  });
});

describe('salesRecords', () => {
  it('매출만 남기고 급여·지출·공금충전은 제외한다', () => {
    const out = salesRecords([매출카드, 매출현금, 급여, 지출, 충전]);
    expect(out.map((r) => r.id)).toEqual([2, 3]);
  });

  it('매출이 없으면 빈 배열이다', () => {
    expect(salesRecords([급여, 지출])).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/utils/salesAdapter.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 최소 구현**

`src/utils/salesAdapter.js`:
```js
// analytics.js 는 예전 미용실앱 스키마(type/original/name)를 기대하고,
// 현재 데이터는 transactions(method/amount/memo)에 산다.
// 매출 탭이 예전 UI·분석 함수를 그대로 재사용하도록 형태만 바꿔주는 순수 어댑터.

export function toSalesRecord(tx) {
  return {
    id: tx.id,
    type: tx.method,
    original: tx.amount,
    final: tx.final,
    name: tx.memo || '',
    date: tx.date,
  };
}

export function salesRecords(transactions) {
  return transactions
    .filter((t) => t.flow === 'income' && t.category === '매출')
    .map(toSalesRecord);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/utils/salesAdapter.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/utils/salesAdapter.js src/utils/salesAdapter.test.js
git commit -m "feat(sales): transactions→레거시 매출 레코드 어댑터"
```

---

## Task 7: 매출 입력/수정 모달

**Files:**
- Create: `src/components/SalesInputModal.jsx`
- Modify: `src/index.css` (모달 스타일)

**Interfaces:**
- Consumes: `CARD_FEE_RATE`, `cardFinal` (`src/utils/money.js`), `buildRecordDateISO` (`src/utils/recordDate.js`)
- Produces: `<SalesInputModal isOpen type initialData onClose onSave />`
  - `type`: `'현금' | '카드'`
  - `initialData`: `null`(신규) 또는 `{ id, original, name, date }`(수정)
  - `onSave(type, amount, name, dateISO)` 호출 후 `onClose()`

**참고:** 예전 `InputModal`(`git show b4e0e98^:src/components/InputModal.jsx`)의 포맷을 그대로 따르되, `useModal` 컨텍스트(삭제됨) 대신 인라인 오류 문구를 쓰고, 스타일은 DESIGN.md §6 모달 패턴으로 맞춘다.

- [ ] **Step 1: 컴포넌트 작성**

```jsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CARD_FEE_RATE, cardFinal } from '../utils/money';
import { buildRecordDateISO } from '../utils/recordDate';

// 매출 입력/수정. 부모가 열 때마다 key 를 바꿔 리마운트하므로 초기값은 useState 초기화로 한 번만 계산한다.
export default function SalesInputModal({ isOpen, type, initialData, onClose, onSave }) {
  const [amount, setAmount] = useState(initialData ? String(initialData.original || '') : '');
  const [name, setName] = useState(initialData?.name || '');
  const [date, setDate] = useState(
    initialData?.date ? initialData.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [err, setErr] = useState('');

  if (!isOpen) return null;

  const display = amount ? Number(amount).toLocaleString() : '';

  const onAmount = (e) => {
    setAmount(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, ''));
    setErr('');
  };

  const save = () => {
    if (!amount || Number(amount) <= 0) { setErr('금액을 입력해주세요.'); return; }
    // 신규는 현재 시각, 수정은 원래 기록의 시각을 보존하고 날짜만 바꾼다.
    onSave(type, Number(amount), name, buildRecordDateISO(date, initialData?.date ?? null));
    onClose();
  };

  return createPortal(
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="sales-input-title"
        onClick={(e) => e.stopPropagation()}>
        <h2 id="sales-input-title" className="modal-title">{type} 매출 {initialData ? '수정' : '입력'}</h2>

        <label className="field">
          <span className="field-label">날짜</span>
          <input type="date" value={date} max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">고객명 / 메모 (선택)</span>
          <input type="text" placeholder="예: 홍길동, VIP" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">금액 (필수)</span>
          <input type="text" inputMode="numeric" placeholder="0" value={display} onChange={onAmount} autoFocus />
        </label>

        {type === '카드' && amount > 0 && (
          <p className="field-hint">
            수수료 {CARD_FEE_RATE * 100}% 차감 후 실수령{' '}
            <b className="num">{cardFinal(Number(amount)).toLocaleString()}원</b>
          </p>
        )}

        {err && <p className="msg err" role="alert">{err}</p>}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={save}>저장</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 2: `src/index.css`에 모달·폼 스타일 추가 (DESIGN.md §6 패턴)**

```css
.modal-scrim { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.4); padding: 24px; }
.modal-card { width: 100%; max-width: 384px; background: var(--bg); border-radius: var(--r-lg); padding: 24px; box-shadow: var(--shadow-sm); max-height: 90dvh; overflow-y: auto; }
.modal-title { margin: 0 0 16px; font-size: 16px; font-weight: 700; }
.field { display: block; margin-bottom: 16px; }
.field-label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; }
.field input { width: 100%; min-height: 48px; padding: 12px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg); color: var(--fg); font-size: 16px; }
.field-hint { margin: -8px 0 16px; font-size: 12px; color: var(--fg-2); }
.msg { margin: 0 0 16px; padding: 16px; border-radius: var(--r-md); font-size: 14px; }
.msg.err { background: var(--err-bg); color: var(--err-fg); }
.msg.ok { background: var(--ok-bg); color: var(--ok-fg); }
.modal-actions { display: flex; gap: 12px; margin-top: 24px; }
.btn-ghost, .btn-primary { flex: 1; min-height: 48px; border-radius: var(--r-md); font-size: 16px; font-weight: 500; cursor: pointer; transition: background-color .15s; }
.btn-ghost { border: 1px solid var(--line); background: var(--bg); color: var(--fg); }
.btn-ghost:hover { background: var(--fill); }
.btn-primary { border: none; background: var(--accent); color: var(--on-accent); }
.btn-primary:hover { background: rgba(23,23,23,.8); }
.btn-primary:disabled { opacity: .6; cursor: not-allowed; }
```

- [ ] **Step 3: 빌드**

Run: `npm run build`
Expected: 성공 (아직 아무 데서도 안 쓰므로 화면 변화는 없다)

- [ ] **Step 4: 커밋**

```bash
git add src/components/SalesInputModal.jsx src/index.css
git commit -m "feat(sales): 매출 입력/수정 모달"
```

---

## Task 8: 매출 기록 모달 (목록·수정·삭제)

**Files:**
- Create: `src/components/SalesRecordModal.jsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: Task 6의 `salesRecords` 결과 형태(`{ id, type, original, final, name, date }`), Task 7의 모달 스타일
- Produces: `<SalesRecordModal isOpen records viewType onClose onEdit onDelete />`
  - `viewType`: `'current'`(이번 달) | `'all'`(전체)
  - `onEdit(record)` — 부모가 `SalesInputModal`을 수정 모드로 연다
  - `onDelete(id)`

**참고:** 예전 `RecordModal`(`git show b4e0e98^:src/components/RecordModal.jsx`) 포맷.

- [ ] **Step 1: 예전 RecordModal 확인**

Run: `git show b4e0e98^:src/components/RecordModal.jsx`
목록 구성·날짜 그룹핑·수정/삭제 동선을 파악한 뒤 아래를 작성한다.

- [ ] **Step 2: 컴포넌트 작성**

```jsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getSalesPeriod } from '../utils/salesPeriod';

const won = (n) => `${(Number(n) || 0).toLocaleString()}원`;
const md = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };
const hm = (iso) => new Date(iso).toTimeString().slice(0, 5);

// 매출 기록 목록. 이번 달(current) 또는 전체(all).
export default function SalesRecordModal({ isOpen, records, viewType, onClose, onEdit, onDelete }) {
  const [confirmId, setConfirmId] = useState(null);
  if (!isOpen) return null;

  const period = getSalesPeriod();
  const list = (viewType === 'current'
    ? records.filter((r) => { const t = new Date(r.date); return t >= period.start && t < period.end; })
    : records
  ).slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  const total = list.reduce((s, r) => s + (Number(r.final) || 0), 0);

  return createPortal(
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card sales-records" role="dialog" aria-modal="true" aria-labelledby="sales-rec-title"
        onClick={(e) => e.stopPropagation()}>
        <h2 id="sales-rec-title" className="modal-title">
          {viewType === 'current' ? '이번 달 매출 기록' : '전체 매출 기록'}
          <span className="modal-sub">{list.length}건 · {won(total)}</span>
        </h2>

        {list.length === 0 && <p className="empty">아직 매출 기록이 없어요.</p>}

        <ul className="rec-list">
          {list.map((r) => (
            <li key={r.id} className="rec-item">
              <div className="rec-main">
                <span className="rec-when num">{md(r.date)} {hm(r.date)}</span>
                <span className="rec-name">{r.name || '—'}</span>
                <span className="owner-badge">{r.type}</span>
              </div>
              <div className="rec-right">
                <span className="rec-amt num pos">{won(r.final)}</span>
                {r.type === '카드' && r.original !== r.final && (
                  <span className="rec-org num">원금 {won(r.original)}</span>
                )}
              </div>
              <div className="rec-actions">
                <button className="btn-mini" onClick={() => onEdit(r)}>수정</button>
                <button className="btn-mini danger" onClick={() => setConfirmId(r.id)}>삭제</button>
              </div>
            </li>
          ))}
        </ul>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
        </div>

        {confirmId !== null && (
          <div className="modal-scrim" onClick={() => setConfirmId(null)}>
            <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="del-title"
              onClick={(e) => e.stopPropagation()}>
              <h2 id="del-title" className="modal-title">기록을 삭제할까요?</h2>
              <p className="modal-body">되돌릴 수 없습니다.</p>
              <div className="modal-actions">
                <button className="btn-ghost" onClick={() => setConfirmId(null)}>취소</button>
                <button className="btn-primary" onClick={() => { onDelete(confirmId); setConfirmId(null); }}>삭제</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 3: 스타일 추가**

```css
.modal-sub { display: block; margin-top: 4px; font-size: 12px; font-weight: 400; color: var(--fg-2); }
.modal-body { margin: 0 0 8px; font-size: 14px; color: var(--fg-2); line-height: 1.6; }
.rec-list { list-style: none; margin: 0; padding: 0; }
.rec-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.rec-main { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
.rec-when { font-size: 12px; color: var(--fg-3); white-space: nowrap; }
.rec-name { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rec-right { text-align: right; }
.rec-amt { display: block; font-size: 14px; font-weight: 700; }
.rec-org { display: block; font-size: 12px; color: var(--fg-3); }
.rec-actions { display: flex; gap: 4px; }
.btn-mini { min-height: 48px; padding: 0 12px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg); color: var(--fg-2); font-size: 12px; cursor: pointer; }
.btn-mini.danger { color: var(--err-fg); }
```

- [ ] **Step 4: 빌드 + 커밋**

Run: `npm run build`
```bash
git add src/components/SalesRecordModal.jsx src/index.css
git commit -m "feat(sales): 매출 기록 모달(수정·삭제)"
```

---

## Task 9: 매출 탭 화면 + 탭바 교체 + 배선

**Files:**
- Create: `src/screens/SalesScreen.jsx`
- Modify: `src/components/TabBar.jsx`, `src/Ledger.jsx`, `src/index.css`

**Interfaces:**
- Consumes: `salesRecords` (Task 6), `SalesInputModal` (Task 7), `SalesRecordModal` (Task 8), `updateTransaction` (Task 5), `todayTotal`/`thisWeekTotal` (`src/utils/analytics.js`), `getSalesPeriod`/`getPeriodEndDay` (`src/utils/salesPeriod.js`)
- Produces: `<SalesScreen transactions onAdd onUpdate onDelete />` — 탭 키는 `'sales'`

- [ ] **Step 1: `SalesScreen.jsx` 작성 (예전 App.jsx 포맷)**

```jsx
import { useMemo, useState } from 'react';
import { salesRecords } from '../utils/salesAdapter';
import { todayTotal, thisWeekTotal } from '../utils/analytics';
import { getSalesPeriod, getPeriodEndDay } from '../utils/salesPeriod';
import SalesInputModal from '../components/SalesInputModal';
import SalesRecordModal from '../components/SalesRecordModal';

const won = (n) => (Number(n) || 0).toLocaleString();
const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

// 매출관리 — 예전 미용실앱 '입력' 화면 포맷.
// 데이터는 transactions(flow=income, category=매출)에 그대로 저장되어 가계부 잔액에 반영된다.
export default function SalesScreen({ transactions, onAdd, onUpdate, onDelete }) {
  const records = useMemo(() => salesRecords(transactions), [transactions]);
  const [input, setInput] = useState(null);   // { type, initialData } | null
  const [recView, setRecView] = useState(null); // 'current' | 'all' | null
  const [seq, setSeq] = useState(0);

  const now = new Date();
  const period = getSalesPeriod();
  const inPeriod = records.filter((r) => { const t = new Date(r.date); return t >= period.start && t < period.end; });
  const monthTotal = inPeriod.reduce((s, r) => s + r.final, 0);
  const monthCash = inPeriod.filter((r) => r.type === '현금').reduce((s, r) => s + r.final, 0);
  const monthCard = inPeriod.filter((r) => r.type === '카드').reduce((s, r) => s + r.final, 0);
  const today = todayTotal(records, now);
  const week = thisWeekTotal(records, now);

  const openNew = (type) => { setSeq((k) => k + 1); setInput({ type, initialData: null }); };
  const openEdit = (rec) => { setRecView(null); setSeq((k) => k + 1); setInput({ type: rec.type, initialData: rec }); };

  const save = (type, amount, name, dateISO) => {
    if (input?.initialData) onUpdate({ id: input.initialData.id, method: type, amount, memo: name, date: dateISO });
    else onAdd({ method: type, amount, memo: name, date: dateISO });
  };

  return (
    <div>
      <header className="app-head"><span className="title">매출관리</span></header>
      <div className="body">
        <div className="sales-buttons">
          <button className="sq-btn" onClick={() => openNew('현금')}>
            <span className="sq-icon" aria-hidden="true">￦</span>
            <span>현금</span>
          </button>
          <button className="sq-btn" onClick={() => openNew('카드')}>
            <span className="sq-icon" aria-hidden="true">▭</span>
            <span>카드</span>
          </button>
        </div>

        <div className="sales-summary">
          <div className="sum-card">
            <span className="sum-label">오늘 일매출</span>
            <span className="sum-value num">{won(today)}<em>원</em></span>
          </div>
          <div className="sum-card">
            <span className="sum-label">이번 주 매출 <em>{week.rangeLabel}</em></span>
            <span className="sum-value num">{won(week.total)}<em>원</em></span>
          </div>
        </div>

        <button className="sales-total" onClick={() => setRecView('current')}>
          <span className="st-period num">{md(period.start)} ~ {md(getPeriodEndDay(period.start))}</span>
          <span className="st-label">이번 달 누적 매출</span>
          <span className="st-amount num">{won(monthTotal)}<em>원</em></span>
          <span className="st-subs num">현금 {won(monthCash)}원 · 카드 {won(monthCard)}원</span>
          <span className="st-hint">터치해서 기록 확인 및 수정</span>
        </button>

        <button className="add-row" onClick={() => setRecView('all')}>전체 기록 보기</button>
      </div>

      <SalesInputModal key={seq} isOpen={!!input} type={input?.type} initialData={input?.initialData}
        onClose={() => setInput(null)} onSave={save} />

      <SalesRecordModal isOpen={!!recView} records={records} viewType={recView}
        onClose={() => setRecView(null)} onEdit={openEdit} onDelete={onDelete} />
    </div>
  );
}
```

- [ ] **Step 2: 스타일 추가**

```css
.sales-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.sq-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 96px; border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--bg); color: var(--fg); font-size: 16px; font-weight: 500; cursor: pointer; transition: background-color .15s; }
.sq-btn:hover { background: var(--fill); }
.sq-icon { font-size: 28px; line-height: 1; }
.sales-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
.sum-card { border: 1px solid var(--line); border-radius: var(--r-lg); padding: 16px; }
.sum-label { display: block; font-size: 12px; color: var(--fg-2); }
.sum-label em { color: var(--fg-3); font-style: normal; }
.sum-value { display: block; margin-top: 4px; font-size: 20px; font-weight: 700; }
.sum-value em { margin-left: 2px; font-size: 12px; font-style: normal; color: var(--fg-2); }
.sales-total { display: block; width: 100%; text-align: left; margin-top: 16px; border: 1px solid var(--line); border-radius: var(--r-lg); padding: 24px; background: var(--bg); cursor: pointer; transition: background-color .15s; }
.sales-total:hover { background: var(--fill); }
.st-period { display: block; font-size: 12px; color: var(--fg-3); }
.st-label { display: block; margin-top: 4px; font-size: 14px; color: var(--fg-2); }
.st-amount { display: block; margin-top: 4px; font-size: 32px; font-weight: 700; letter-spacing: -.02em; }
.st-amount em { margin-left: 4px; font-size: 16px; font-style: normal; color: var(--fg-2); }
.st-subs { display: block; margin-top: 8px; font-size: 12px; color: var(--fg-2); }
.st-hint { display: block; margin-top: 8px; font-size: 12px; color: var(--fg-3); }
```

- [ ] **Step 3: `TabBar.jsx` 교체 — `income` → `sales`**

```jsx
// 하단 탭바: 홈 · 지출 · ＋(입력) · 매출 · 기록. ＋는 가운데 FAB.
export default function TabBar({ tab, onNav, onAdd }) {
  return (
    <nav className="tabbar">
      <button className={`tb ${tab === 'home' ? 'active' : ''}`} onClick={() => onNav('home')}><i>◆</i>홈</button>
      <button className={`tb ${tab === 'expense' ? 'active' : ''}`} onClick={() => onNav('expense')}><i>−</i>지출</button>
      <button className="fab" aria-label="입력" onClick={onAdd}>+</button>
      <button className={`tb ${tab === 'sales' ? 'active' : ''}`} onClick={() => onNav('sales')}><i>＋</i>매출</button>
      <button className={`tb ${tab === 'records' ? 'active' : ''}`} onClick={() => onNav('records')}><i>≣</i>기록</button>
    </nav>
  );
}
```

- [ ] **Step 4: `Ledger.jsx` 배선**

import 추가:
```js
import SalesScreen from './screens/SalesScreen';
```
매출 저장/수정/삭제 핸들러를 `saveTransfer` 아래에 추가:
```js
  // 매출 탭 전용. 매출은 항상 아내 소유 · income/매출 로 저장된다.
  const addSales = async ({ method, amount, memo, date }) => {
    const row = await ledger.addTransaction({ flow: 'income', category: '매출', owner: 'wife', method, amount, memo, date });
    if (row) notify('매출 저장!');
  };
  const updateSales = async ({ id, method, amount, memo, date }) => {
    const row = await ledger.updateTransaction({ id, flow: 'income', category: '매출', method, amount, memo, date });
    if (row) notify('매출 수정!');
  };
```
화면 라우팅에서 `income` 줄을 아래로 교체:
```jsx
      {tab === 'sales' && (
        <SalesScreen transactions={transactions} onAdd={addSales} onUpdate={updateSales} onDelete={ledger.deleteTransaction} />
      )}
      {tab === 'income' && <IncomeScreen transactions={monthTx} onAddIncome={openInput} />}
```
※ `SalesScreen`은 `monthTx`가 아니라 **전체 `transactions`**를 받는다(전체 기록 보기·주간 집계에 필요).
※ `incomeKind` state와 `onKind` prop은 Task 10에서 제거되므로 여기서는 그대로 둔다.

- [ ] **Step 5: 빌드 + 브라우저 확인**

Run: `npm run build && npm run dev`
매출 탭 → 현금 버튼 → 금액 입력 → 저장 → 홈 잔액에 반영되는지, 누적 카드 터치 → 기록 모달 → 수정/삭제가 되는지 확인.
Expected: 콘솔 에러 0. 카드 10만원 입력 시 실수령 9만원 안내가 뜨고 저장 후 매출에 90,000이 잡힌다.

- [ ] **Step 6: 커밋**

```bash
git add src/screens/SalesScreen.jsx src/components/TabBar.jsx src/Ledger.jsx src/index.css
git commit -m "feat(sales): 매출관리 독립 탭 복원(예전 입력/기록 포맷)"
```

---

## Task 10: 급여 화면 축소 + 홈 메뉴 카드 분리

**Files:**
- Modify: `src/screens/IncomeScreen.jsx`, `src/screens/HomeScreen.jsx`, `src/Ledger.jsx`

**Interfaces:**
- Consumes: Task 9의 `'sales'` 탭 키
- Produces: `<IncomeScreen transactions onAddIncome />` — `kind`/`onKind` prop 제거(급여 전용)

- [ ] **Step 1: `IncomeScreen.jsx`를 급여 전용으로 축소**

```jsx
import { fmt } from '../utils/money';
import { incomeList, sumFinal } from '../utils/ledger';
import TxRow from '../components/TxRow';

// 급여관리(남편). 매출관리는 별도 탭(SalesScreen)으로 분리됐다.
export default function IncomeScreen({ transactions, onAddIncome }) {
  const list = incomeList(transactions).filter((t) => t.category === '급여');
  const tot = sumFinal(list);

  return (
    <div>
      <header className="app-head"><span className="title">급여관리</span></header>
      <div className="body">
        <div className="mini-hero">
          <div>
            <div className="k">이번 달 급여</div>
            <div className="v num pos">{fmt(tot)}<span className="unit">원</span></div>
          </div>
          <div className="r"><span className="owner-badge">남편</span><br /><b>실수령</b></div>
        </div>
        <button className="add-row" onClick={() => onAddIncome('급여')}>＋ 급여 입력 (금액만)</button>

        <div className="sec-title">급여 내역 <span className="r">{list.length}건</span></div>
        {list.length === 0 && <div className="empty">아직 내역이 없어요.</div>}
        {list.map((t) => <TxRow key={t.id} tx={t} showCategory={false} />)}
      </div>
    </div>
  );
}
```
`.unit` 스타일이 없으면 추가: `.unit { margin-left: 2px; font-size: 14px; color: var(--fg-2); }`

- [ ] **Step 2: `Ledger.jsx`에서 `incomeKind` state 제거**

- `const [incomeKind, setIncomeKind] = useState('매출');` 삭제
- `<IncomeScreen ... kind={incomeKind} onKind={setIncomeKind} ... />` 에서 두 prop 삭제 (Task 9 Step 4에서 이미 제거했다면 확인만)

- [ ] **Step 3: `HomeScreen.jsx`의 메뉴 카드 분리**

현재 "매출/급여관리" 카드 1개(`onNav('income')`)를 2개로 나눈다:
- `매출관리` → `onNav('sales')` — 금액은 이번 달 매출 합계
- `급여관리` → `onNav('income')` — 금액은 이번 달 급여 합계

`HomeScreen`이 받는 `flow` 객체에 두 값이 이미 있는지 `src/utils/ledger.js`의 `monthlyFlow`를 읽어 확인하고, 없으면 `flow.salon`/`flow.salary`를 추가한다. 추가할 경우 `monthlyFlow`의 기존 반환 필드를 깨지 않도록 **추가만** 할 것.

- [ ] **Step 4: 테스트 + 빌드 + 확인**

Run: `npx vitest run && npm run build && npm run dev`
홈에서 두 카드가 각각 매출 탭 / 급여 화면으로 가는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/screens/IncomeScreen.jsx src/screens/HomeScreen.jsx src/Ledger.jsx src/index.css
git commit -m "feat(nav): 급여관리 화면 분리 + 홈 메뉴 카드 매출/급여 분리"
```

---

## Task 11: 사용성 점검 · 최종 검증 · 배포

**Files:**
- Modify: 점검에서 발견된 파일

**Interfaces:**
- Consumes: Task 1~10 전부
- Produces: 배포된 앱

- [ ] **Step 1: 사용성 점검 — 아래를 실제로 눌러보고 문제를 기록**

dev 서버에서 전 화면을 돌며 확인:
1. 하단 탭 5개 모두 `min-height: 48px` 이상이고 오탭 없이 눌리는가
2. 매출 입력이 3탭 이내(매출 탭 → 현금/카드 → 금액 → 저장)에 끝나는가
3. 기록 수정/삭제 후 홈 잔액이 즉시 갱신되는가
4. 삭제 확인 모달 없이 사라지는 파괴적 동작이 남아 있는가
5. 오류(네트워크 끊김 등)가 `.msg.err`로 보이는가 — DevTools Network를 Offline으로 두고 저장 시도
6. 키보드 Tab으로 순회할 때 포커스 링이 모든 인터랙티브 요소에 보이는가
7. 빈 상태(기록 0건)에서 안내 문구가 나오는가

- [ ] **Step 2: 발견된 문제 수정**

Step 1의 각 항목을 고친다. 수정 범위가 크면 사용자에게 보고하고 별도 Task로 뺄 것.

- [ ] **Step 3: 대비 실측 (Task 2에서 색을 전부 바꿨으므로 재검증 필수)**

브라우저 콘솔에서 실행:
```js
const lin=(v)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};
const L=(c)=>{const[r,g,b]=c.match(/\d+/g).map(Number);return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)};
const R=(a,b)=>{const[x,y]=[L(a),L(b)].sort((p,q)=>q-p);return((x+0.05)/(y+0.05)).toFixed(2)};
[...document.querySelectorAll('button,a,.owner-badge,.rec-amt,.st-amount')].map(el=>{
  const s=getComputedStyle(el);let bg=s.backgroundColor,n=el;
  while((bg==='rgba(0, 0, 0, 0)'||bg==='transparent')&&n.parentElement){n=n.parentElement;bg=getComputedStyle(n).backgroundColor}
  return `${el.className||el.tagName} ${R(s.color,bg)}:1`;
}).join('\n');
```
Expected: 모든 값이 **4.5:1 이상**. 미달이면 해당 토큰을 조정한다.
※ `--fg-3`(black/40)은 흰 배경에서 약 4.6:1 로 통과하지만, `--fill` 배경 위에서는 미달할 수 있으니 뱃지 대비를 꼭 확인할 것.

- [ ] **Step 4: 전체 테스트 + 빌드**

Run: `npx vitest run && npm run build`
Expected: 전부 통과.

- [ ] **Step 5: 잔여 조사 — 옛 토큰·AI·다크모드 흔적이 없는지**

Run:
```bash
grep -rn "prefers-color-scheme\|data-theme\|--paper\|--ink\|--brand\|--wife\|--husband\|--joint\|aiClient\|chatStore\|RECORDS_TABLE" src/ || echo "잔여 없음"
```
Expected: `잔여 없음`

- [ ] **Step 6: 커밋 · 푸시 · 배포**

```bash
git add -A
git commit -m "polish: 사용성 점검 반영 + 대비 재검증"
git push origin main
npm run deploy
```

- [ ] **Step 7: 배포 검증**

`https://tree0327.github.io/sales-tracker/` 에 새 CSS 해시가 반영될 때까지 확인한 뒤(로컬 `dist/assets/*.css` 파일명과 라이브 `index.html` 참조를 비교), 로그인 화면이 흑백으로 뜨는지 확인.

- [ ] **Step 8: 사용자 안내**

`0009_drop_ai_chat.sql`을 Supabase SQL Editor에서 실행해야 함을 반드시 보고할 것.

---

## Self-Review

**1. 스펙 커버리지**

| 요청 | 담당 Task |
| --- | --- |
| (1) DESIGN.md 기반 디자인 전면 수정 | Task 2(토큰·다크모드 제거), 3(소유자 뱃지), 4(전 화면), 7·8·9(신규 화면도 규격 준수) |
| (2) 매출관리 별도 탭 · 기존 포맷 · 기존 방식 관리 | Task 5(수정 지원), 6(어댑터), 7(입력 모달), 8(기록 모달), 9(화면·탭·배선), 10(급여 분리) |
| (2) AI 기능 제거 | Task 1 |
| (3) 사용성 재고민 | Task 10(진입 동선), Task 11(점검·대비·접근성) |

**2. 플레이스홀더 스캔**: Task 3 Step 4(TxRow 아바타 유지 여부)와 Task 4 Step 2~4, Task 10 Step 3(`monthlyFlow` 필드 확인)은 현재 파일을 읽어야 확정되는 부분이라 "읽고 판단" 지시로 남겼다. 나머지 코드 단계는 전부 실제 코드를 포함한다.

**3. 타입 일관성**
- `salesRecords`/`toSalesRecord` 반환 `{ id, type, original, final, name, date }` — Task 6 정의 = Task 8·9 사용처 일치
- `updateTransaction({ id, flow, category, method, amount, memo, date })` — Task 5 정의 = Task 9 `updateSales` 호출 일치
- `SalesInputModal.onSave(type, amount, name, dateISO)` — Task 7 정의 = Task 9 `save` 시그니처 일치
- `OwnerBadge({ owner })` — Task 3 정의 = Task 10 사용처는 텍스트 직접 사용(`<span className="owner-badge">남편</span>`)이라 컴포넌트 미사용, 의도된 것(정적 라벨)

**4. 위험**
- Task 2·4는 210줄 CSS 전면 수정이라 회귀 위험이 가장 크다. Task 11 Step 3의 대비 실측이 안전망이다.
- `analytics.js`는 손대지 않는다(어댑터로 우회). 기존 테스트 그대로 통과해야 한다.
