# 챗봇 롤링 요약 메모리 (DB 영구 저장) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** AI 챗봇이 최근 10턴(=메시지 20개)은 통째로, 그 이전 대화는 롤링 요약으로 압축해 맥락을 유지하고, 대화·요약을 Supabase DB에 저장해 새로고침/재접속해도 이어지게 한다.

**Architecture:** 요약 판정은 순수 함수(`chatMemory.js`), 영구 저장은 사용자별 `ai_chat` 테이블(`chatStore.js`), 요약 생성은 Edge Function `ai`의 새 `summarize` 모드. AiChat은 마운트 시 DB 복원 → 전송 시 (필요하면)요약 갱신 → chat 호출 → DB 저장.

**Tech Stack:** React 19, Vite, Supabase(DB + Edge Function), OpenAI gpt-4o-mini, vitest.

## Global Constraints

- **최근 10턴 = 메시지 20개**를 verbatim 유지. 미요약 메시지가 `KEEP_MSGS(20) + BATCH_MSGS(10) = 30`개 이상 쌓이면 가장 오래된 `BATCH_MSGS(10)`개를 요약으로 밀어낸다. 요약된 구간 인덱스는 `summarized_count`로 추적. **미요약 메시지는 전부 verbatim으로 전송(맥락 누락 없음)**.
- LLM 전송 = `[이전 대화 요약]` + `[미요약 메시지 전체(=verbatim)]` + 매출 컨텍스트.
- OpenAI 키는 서버(Edge Function)에만. 클라이언트는 `functions.invoke`만.
- `ai_chat`은 **사용자별 1행**(user_id PK) + RLS로 본인 것만. Korean UI.
- 커밋: `git -c commit.gpgsign=false commit`. --no-verify 금지. YAGNI.
- Edge Function은 단일 파일 유지(대시보드 붙여넣기 배포).

---

## File Structure

| 파일 | 책임 |
|---|---|
| `supabase/migrations/0005_create_ai_chat.sql` (신규) | `ai_chat` 테이블 + RLS |
| `supabase/functions/ai/index.ts` (수정) | `summarize` 모드 추가 + `chat` 모드에 summary 반영 |
| `src/utils/chatMemory.js` (신규) | `planSummarization`/`verbatimFrom` 순수 함수 + 상수 |
| `src/utils/chatMemory.test.js` (신규) | 위 단위 테스트 |
| `src/utils/chatStore.js` (신규) | `loadChat`/`saveChat`/`clearChat` (supabase) |
| `src/components/AiChat.jsx` (수정) | DB 복원·롤링요약·저장·초기화 버튼 |
| `src/components/AiChat.css` (수정) | 헤더/초기화 버튼 스타일 |

---

## Task 1: DB 마이그레이션 `ai_chat`

**Files:** Create `supabase/migrations/0005_create_ai_chat.sql`

**Interfaces:** Produces table `public.ai_chat(user_id uuid pk, messages jsonb, summary text, summarized_count int, updated_at timestamptz)` with own-row RLS.

- [ ] **Step 1: 작성**

Create `supabase/migrations/0005_create_ai_chat.sql`:

```sql
-- AI 챗봇 대화/요약 영구 저장(사용자별 1행). 새로고침·재접속해도 대화 유지.
create table if not exists public.ai_chat (
  user_id uuid primary key default auth.uid(),
  messages jsonb not null default '[]'::jsonb,
  summary text not null default '',
  summarized_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ai_chat enable row level security;

create policy "ai_chat_select_own" on public.ai_chat
  for select to authenticated using (user_id = auth.uid());
create policy "ai_chat_insert_own" on public.ai_chat
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_chat_update_own" on public.ai_chat
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_chat_delete_own" on public.ai_chat
  for delete to authenticated using (user_id = auth.uid());
```

- [ ] **Step 2: 커밋** (DB 파일이라 빌드 무관)

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add supabase/migrations/0005_create_ai_chat.sql
git -c commit.gpgsign=false commit -m "feat(chat): ai_chat 대화 저장 테이블 마이그레이션"
```

---

## Task 2: Edge Function `summarize` 모드 + `chat` summary 반영

**Files:** Modify `supabase/functions/ai/index.ts`

**Interfaces:**
- Consumes: 없음.
- Produces: `summarize` 모드 — payload `{ previousSummary?: string, messages: [{role,content}] }` → `{ text }`(갱신 요약). `chat` 모드가 `payload.summary`를 시스템 프롬프트에 포함.

- [ ] **Step 1: `messagesFor`의 `chat` 분기를 아래로 교체(summary 반영)**

기존 `if (mode === "chat") { ... }` 블록을 아래로 교체:

```ts
  if (mode === "chat") {
    const ctx = payload?.context ? `참고용 매출 요약(JSON): ${JSON.stringify(payload.context)}\n` : "";
    const memo = payload?.summary ? `이전 대화 요약: ${payload.summary}\n` : "";
    const history: any[] = Array.isArray(payload?.messages) ? payload.messages : [];
    return [
      { role: "system", content: `너는 친절한 한국어 비서로 매출 관리 앱에 내장돼 있다. 매출 관련 질문에는 아래 요약 데이터를 근거로 답하고, 일반적인 질문에도 자유롭게 답하라. '이전 대화 요약'은 과거 맥락이니 참고하되 최근 메시지를 우선하라. 요약에 없는 매출 수치는 모른다고 답하라.\n${memo}${ctx}` },
      ...history.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.content ?? "") } as Msg)),
    ];
  }
```

- [ ] **Step 2: `return null;` 바로 위(다른 모드들 뒤)에 `summarize` 분기 추가**

`messagesFor` 함수 안, `if (mode === "chat") { ... }` 블록 다음, `return null;` 앞에 추가:

```ts
  if (mode === "summarize") {
    const prev = payload?.previousSummary ? `기존 요약:\n${payload.previousSummary}\n\n` : "";
    const msgs: any[] = Array.isArray(payload?.messages) ? payload.messages : [];
    const convo = msgs
      .map((m) => `${m.role === "user" ? "사용자" : "assistant"}: ${String(m.content ?? "")}`)
      .join("\n");
    return [
      { role: "system", content: "너는 대화 요약 비서다. 기존 요약과 새 대화를 하나로 합쳐, 이후 대화에 필요한 핵심 사실·맥락·사용자 선호를 보존한 간결한 한국어 요약으로 정리하라. 인사말·잡담은 생략하고 사실 위주로." },
      { role: "user", content: `${prev}새 대화:\n${convo}\n\n위 내용을 반영한 하나의 갱신된 요약만 출력.` },
    ];
  }
```

- [ ] **Step 3: 빌드 확인(이 파일은 번들 제외) + 커밋**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm run build 2>&1 | tail -2`
Expected: 빌드 성공.

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add supabase/functions/ai/index.ts
git -c commit.gpgsign=false commit -m "feat(chat): Edge Function summarize 모드 + chat에 이전요약 반영"
```

---

## Task 3: `chatMemory.js` 순수 로직 (TDD)

**Files:** Create `src/utils/chatMemory.js`, `src/utils/chatMemory.test.js`

**Interfaces:**
- Produces:
  - `KEEP_MSGS = 20`, `BATCH_MSGS = 10`
  - `planSummarization(total, summarizedCount, keep?, batch?) => { shouldSummarize, from, to }`
  - `verbatimFrom(messages, summarizedCount) => Array` (미요약 메시지 전체)

- [ ] **Step 1: 실패 테스트 작성**

Create `src/utils/chatMemory.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { planSummarization, verbatimFrom, KEEP_MSGS, BATCH_MSGS } from './chatMemory.js';

describe('planSummarization', () => {
  it('미요약이 keep+batch 미만이면 요약 안 함', () => {
    expect(planSummarization(20, 0).shouldSummarize).toBe(false); // 20 < 30
    expect(planSummarization(29, 0).shouldSummarize).toBe(false); // 29 < 30
  });
  it('미요약이 keep+batch 이상이면 가장 오래된 batch를 요약', () => {
    const p = planSummarization(30, 0); // 30 >= 30
    expect(p.shouldSummarize).toBe(true);
    expect(p.from).toBe(0);
    expect(p.to).toBe(BATCH_MSGS); // 0..10
  });
  it('이미 일부 요약된 뒤 다시 임계 도달', () => {
    // summarizedCount=10, total=40 → 미요약 30 >= 30 → 10..20 요약
    const p = planSummarization(40, 10);
    expect(p.shouldSummarize).toBe(true);
    expect(p.from).toBe(10);
    expect(p.to).toBe(20);
  });
  it('요약 직후(미요약 < 임계)엔 다시 요약 안 함', () => {
    // summarizedCount=10, total=39 → 미요약 29 < 30
    expect(planSummarization(39, 10).shouldSummarize).toBe(false);
  });
});

describe('verbatimFrom', () => {
  it('summarizedCount 이후의 미요약 메시지 전체를 반환', () => {
    const msgs = Array.from({ length: 25 }, (_, i) => ({ role: 'user', content: String(i) }));
    expect(verbatimFrom(msgs, 10).length).toBe(15);
    expect(verbatimFrom(msgs, 10)[0].content).toBe('10');
  });
  it('상수값 확인', () => {
    expect(KEEP_MSGS).toBe(20);
    expect(BATCH_MSGS).toBe(10);
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npx vitest run src/utils/chatMemory.test.js`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

Create `src/utils/chatMemory.js`:

```js
// 챗봇 롤링 요약 메모리 정책(순수 함수).
// 최근 10턴(=메시지 20개)은 통째로 유지. 미요약 메시지가 KEEP+BATCH개 이상 쌓이면
// 가장 오래된 BATCH개를 요약으로 밀어낸다.
export const KEEP_MSGS = 20;  // 최근 10턴(대화 10쌍) 유지 목표
export const BATCH_MSGS = 10; // 초과분이 이만큼 쌓이면 한 번에 요약(5턴)

// 반환: { shouldSummarize, from, to } — messages.slice(from, to)가 요약 대상.
export function planSummarization(total, summarizedCount, keep = KEEP_MSGS, batch = BATCH_MSGS) {
  const unsummarized = total - summarizedCount;
  if (unsummarized >= keep + batch) {
    return { shouldSummarize: true, from: summarizedCount, to: summarizedCount + batch };
  }
  return { shouldSummarize: false, from: summarizedCount, to: summarizedCount };
}

// 아직 요약되지 않은 메시지 전체(=LLM에 verbatim으로 전달할 부분).
export function verbatimFrom(messages, summarizedCount) {
  return messages.slice(summarizedCount);
}
```

- [ ] **Step 4: 통과 확인 + 커밋**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm test`
Expected: 전체 PASS.

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add src/utils/chatMemory.js src/utils/chatMemory.test.js
git -c commit.gpgsign=false commit -m "feat(chat): 롤링 요약 메모리 순수 로직(+테스트)"
```

---

## Task 4: `chatStore.js` (Supabase 저장/복원)

**Files:** Create `src/utils/chatStore.js`

**Interfaces:**
- Consumes: `supabase`.
- Produces:
  - `loadChat() => Promise<{messages, summary, summarizedCount}|null>`
  - `saveChat({messages, summary, summarizedCount}) => Promise<void>`
  - `clearChat() => Promise<void>`

- [ ] **Step 1: 구현**

Create `src/utils/chatStore.js`:

```js
import { supabase } from '../supabaseClient';

const TABLE = 'ai_chat';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// 로그인 사용자의 저장된 대화 복원. 없으면 null.
export async function loadChat() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('messages, summary, summarized_count')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    messages: Array.isArray(data.messages) ? data.messages : [],
    summary: data.summary ?? '',
    summarizedCount: data.summarized_count ?? 0,
  };
}

// 대화/요약 upsert(사용자별 1행).
export async function saveChat({ messages, summary, summarizedCount }) {
  const uid = await currentUserId();
  if (!uid) throw new Error('로그인이 필요합니다.');
  const { error } = await supabase.from(TABLE).upsert({
    user_id: uid,
    messages,
    summary,
    summarized_count: summarizedCount,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

// 대화 초기화(행 삭제).
export async function clearChat() {
  const uid = await currentUserId();
  if (!uid) return;
  const { error } = await supabase.from(TABLE).delete().eq('user_id', uid);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: 빌드 확인 + 커밋**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm run build 2>&1 | tail -2`
Expected: 빌드 성공.

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add src/utils/chatStore.js
git -c commit.gpgsign=false commit -m "feat(chat): chatStore(supabase 대화 저장/복원/초기화)"
```

---

## Task 5: `AiChat` 개편 (복원·롤링요약·저장·초기화)

**Files:** Modify `src/components/AiChat.jsx`, `src/components/AiChat.css`

**Interfaces:**
- Consumes: `callAI`(chat/summarize), `buildChatContext`, `planSummarization`/`verbatimFrom`(Task 3), `loadChat`/`saveChat`/`clearChat`(Task 4).
- Produces: `<AiChat salesData dataLoading />` (props 동일). 정적 인사말 + 실제 대화(messages) + 요약 상태를 DB와 동기화.

- [ ] **Step 1: `AiChat.jsx` 전체 교체**

Replace `src/components/AiChat.jsx` with:

```jsx
import { useState, useRef, useEffect } from 'react';
import { callAI } from '../utils/aiClient';
import { buildChatContext } from '../utils/aiPayload';
import { planSummarization, verbatimFrom } from '../utils/chatMemory';
import { loadChat, saveChat, clearChat } from '../utils/chatStore';
import './AiChat.css';

const GREETING = '안녕하세요! 매출에 대해 무엇이든 물어보세요. 일반적인 질문도 괜찮아요.';

export default function AiChat({ salesData, dataLoading }) {
  const [messages, setMessages] = useState([]); // 실제 대화(인사말 제외)
  const [summary, setSummary] = useState('');
  const [summarizedCount, setSummarizedCount] = useState(0);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false); // AI 요청 중
  const [booting, setBooting] = useState(true);   // 최초 DB 복원 중
  const [error, setError] = useState('');
  const endRef = useRef(null);

  // 마운트 시 DB에서 대화 복원
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadChat();
        if (cancelled) return;
        if (saved) {
          setMessages(saved.messages);
          setSummary(saved.summary);
          setSummarizedCount(saved.summarizedCount);
        }
      } catch {
        // 복원 실패 시 빈 대화로 시작(치명적 아님)
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    if (dataLoading || booting) return;
    const text = input.trim();
    if (!text || loading) return;
    const withUser = [...messages, { role: 'user', content: text }];
    setMessages(withUser);
    setInput('');
    setLoading(true);
    setError('');
    try {
      // 1) 필요하면 오래된 구간을 요약으로 밀어내기
      let nextSummary = summary;
      let nextCount = summarizedCount;
      const plan = planSummarization(withUser.length, summarizedCount);
      if (plan.shouldSummarize) {
        nextSummary = await callAI('summarize', {
          previousSummary: summary,
          messages: withUser.slice(plan.from, plan.to),
        });
        nextCount = plan.to;
      }
      // 2) 이전요약 + 미요약 전체(verbatim) + 매출 컨텍스트로 chat 호출
      const context = buildChatContext(salesData, new Date());
      const verbatim = verbatimFrom(withUser, nextCount);
      const reply = await callAI('chat', { messages: verbatim, context, summary: nextSummary });
      const finalMsgs = [...withUser, { role: 'assistant', content: reply }];
      setMessages(finalMsgs);
      setSummary(nextSummary);
      setSummarizedCount(nextCount);
      // 3) DB 저장(실패해도 대화는 유지)
      saveChat({ messages: finalMsgs, summary: nextSummary, summarizedCount: nextCount }).catch(() => {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = async () => {
    setMessages([]);
    setSummary('');
    setSummarizedCount(0);
    setError('');
    try { await clearChat(); } catch { /* 무시 */ }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="ai-chat">
      <div className="ai-chat-head">
        <span className="ai-chat-title">AI 비서</span>
        <button className="ai-chat-reset" onClick={resetChat} disabled={loading || booting}>대화 초기화</button>
      </div>
      <div className="ai-chat-log">
        <div className="ai-msg assistant"><div className="ai-bubble">{GREETING}</div></div>
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            <div className="ai-bubble">{m.content}</div>
          </div>
        ))}
        {loading && <div className="ai-msg assistant"><div className="ai-bubble ai-typing">입력 중…</div></div>}
        {error && <p className="ai-error">{error}</p>}
        <div ref={endRef} />
      </div>
      <div className="ai-chat-input">
        {(dataLoading || booting) && <p className="ai-chat-notice">{booting ? '대화를 불러오는 중…' : '데이터를 불러오는 중…'}</p>}
        <textarea
          rows={1}
          placeholder="메시지를 입력하세요 (Enter 전송)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={dataLoading || booting}
        />
        <button onClick={send} disabled={dataLoading || booting || loading || !input.trim()}>전송</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `AiChat.css`에 헤더/초기화 버튼 스타일 추가**

`src/components/AiChat.css` 파일 **맨 위**에 추가:

```css
.ai-chat-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px 10px; }
.ai-chat-title { font-size: 15px; font-weight: 800; }
.ai-chat-reset {
  padding: 6px 12px; border: none; border-radius: 999px; cursor: pointer;
  font-size: 13px; font-weight: 600; background: var(--input-bg, #f0f0f3); color: var(--text-secondary, #666);
}
.ai-chat-reset:disabled { opacity: 0.5; cursor: default; }
.ai-chat-notice { margin: 0 0 6px; font-size: 12px; color: var(--text-secondary, #888); }
```

- [ ] **Step 3: 빌드 + 테스트**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm run build 2>&1 | tail -2 && npm test 2>&1 | grep -E "Tests "`
Expected: 빌드 성공, 모든 단위 테스트 통과.

- [ ] **Step 4: 커밋**

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add src/components/AiChat.jsx src/components/AiChat.css
git -c commit.gpgsign=false commit -m "feat(chat): 대화 DB 복원·롤링 요약·저장·초기화 버튼"
```

---

## Self-Review

- **스펙 커버리지:** 10턴 verbatim + 롤링요약 → Task 3(정책) + Task 5(적용). DB 영구저장 → Task 1(테이블) + Task 4(store) + Task 5(load/save). 요약 생성 → Task 2(summarize 모드). 초기화 → Task 4 clearChat + Task 5 버튼.
- **타입 일관성:** `planSummarization(total, summarizedCount)`/`verbatimFrom(messages, count)` Task 3 정의 = Task 5 사용. `loadChat/saveChat/clearChat` Task 4 = Task 5. `callAI('summarize', {previousSummary, messages})` Task 2 서버 = Task 5 클라이언트. `summarized_count`(DB) ↔ `summarizedCount`(JS) 매핑은 Task 4에서 처리.
- **플레이스홀더:** 없음.
- **미검증 경계:** summarize/저장은 `ai_chat` 테이블 생성 + Edge Function 재배포 후에만 라이브 검증 가능(사장님 대시보드 작업). 미배포 시 chat은 기존대로 작동, 저장 실패는 조용히 무시.
