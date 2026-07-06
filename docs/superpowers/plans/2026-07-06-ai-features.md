# AI 고도화 (월말 분석 · 챗봇 · 이상치) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** OpenAI gpt-4o-mini를 Supabase Edge Function으로 안전하게 프록시해, (1) AI 월말/월간 매출 분석, (2) 데이터 인지형 + 일반 챗봇, (3) 이상치 감지·원인 추정 3가지 AI 기능을 앱에 추가한다.

**Architecture:** 브라우저 → Supabase Edge Function `ai`(OPENAI_API_KEY 시크릿 보관, 로그인 JWT 검증) → OpenAI. 클라이언트는 `supabase.functions.invoke('ai', ...)`로 호출. 매출 데이터 가공(payload/이상치)은 순수 함수로 분리해 vitest로 테스트. UI: `분석` 탭에 AI 인사이트 섹션 추가, 새 `[AI]` 챗봇 탭 추가.

**Tech Stack:** React 19, Vite 8, Supabase JS(functions.invoke), Supabase Edge Functions(Deno), OpenAI gpt-4o-mini, vitest.

## Global Constraints

- OpenAI 키는 **절대 클라이언트에 노출 금지**. 모든 OpenAI 호출은 Edge Function 서버에서만. 클라이언트 코드/번들/네트워크에 키가 실려서는 안 된다(`VITE_` 접두사 금지).
- 모델은 `gpt-4o-mini` 고정.
- 시간 의존 로직은 `now`를 인자로 주입(기존 관례). `Date.now()` 직접 호출 금지.
- localStorage 접근은 try/catch. Korean UI.
- Edge Function은 Supabase 대시보드 에디터에 붙여넣어 배포하므로 **단일 파일**(로컬 상대 import 금지, Deno 전역/`fetch`만 사용).
- 커밋: `git -c commit.gpgsign=false commit -m "..."`. --no-verify 금지.
- AI 미배포/오류 시 앱이 죽지 않고 에러 메시지를 보여줄 것(우아한 실패).

---

## File Structure

| 파일 | 책임 |
|---|---|
| `supabase/functions/ai/index.ts` (신규) | Edge Function: mode(report/chat/anomaly)별 프롬프트 구성 → gpt-4o-mini 호출 |
| `src/utils/aiClient.js` (신규) | `callAI(mode, payload)` — functions.invoke 래퍼 |
| `src/utils/aiPayload.js` (신규) | `buildReportPayload`/`buildChatContext`/`detectAnomalies` 순수 함수 |
| `src/utils/aiPayload.test.js` (신규) | 위 순수 함수 단위 테스트 |
| `src/components/AiInsights.jsx` (+ css) (신규) | `분석` 탭용 "AI 분석" + "이상치 감지" 섹션 |
| `src/components/AdminDashboard.jsx` (수정) | `<AiInsights salesData=.../>` 배치 |
| `src/components/AiChat.jsx` (+ css) (신규) | `[AI]` 탭 챗봇 UI |
| `src/components/Shell.jsx` (수정) | `[AI]` 탭 추가, AiChat 렌더 |

---

## Task 1: Edge Function `ai` (OpenAI 프록시)

**Files:**
- Create: `supabase/functions/ai/index.ts`

**Interfaces:**
- Consumes: 없음(Deno 런타임 전역 `Deno.env`, `fetch`).
- Produces: HTTP endpoint. 요청 `POST { mode: 'report'|'chat'|'anomaly', payload }` → 응답 `{ text }` 또는 `{ error }`.

- [ ] **Step 1: 함수 작성**

Create `supabase/functions/ai/index.ts`:

```ts
// Supabase Edge Function: ai
// OPENAI_API_KEY(대시보드 시크릿)로 gpt-4o-mini를 호출하는 서버 프록시.
// 키는 서버에만 존재하며 클라이언트로 노출되지 않는다.
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const MODEL = "gpt-4o-mini";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

function messagesFor(mode: string, payload: any): Msg[] | null {
  if (mode === "report") {
    return [
      { role: "system", content: "너는 소상공인 매출 데이터를 분석하는 한국어 비서다. 주어진 매출 지표를 바탕으로 (1) 한 줄 요약 (2) 눈에 띄는 특이점 2~3개 (3) 다음 달을 위한 실용적 조언 1~2개를 간결한 한국어로 제시하라. 금액은 원 단위로." },
      { role: "user", content: `매출 지표(JSON):\n${JSON.stringify(payload)}` },
    ];
  }
  if (mode === "anomaly") {
    return [
      { role: "system", content: "너는 매출 이상치를 해석하는 한국어 비서다. 감지된 이상치 목록과 매출 요약을 보고, 각 이상치의 가능한 원인을 추정하고 구체적 조치를 제안하라. 간결한 한국어로." },
      { role: "user", content: `이상치/요약(JSON):\n${JSON.stringify(payload)}` },
    ];
  }
  if (mode === "chat") {
    const ctx = payload?.context ? `참고용 매출 요약(JSON): ${JSON.stringify(payload.context)}\n` : "";
    const history: any[] = Array.isArray(payload?.messages) ? payload.messages : [];
    return [
      { role: "system", content: `너는 친절한 한국어 비서로 매출 관리 앱에 내장돼 있다. 매출 관련 질문에는 아래 요약 데이터를 근거로 답하고, 일반적인 질문에도 자유롭게 답하라. 요약에 없는 매출 수치는 모른다고 답하라.\n${ctx}` },
      ...history.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.content ?? "") } as Msg)),
    ];
  }
  return null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST만 허용됩니다." }, 405);
  if (!OPENAI_API_KEY) return json({ error: "서버에 OPENAI_API_KEY가 설정되지 않았습니다." }, 500);
  try {
    const { mode, payload } = await req.json();
    const messages = messagesFor(mode, payload);
    if (!messages) return json({ error: `알 수 없는 mode: ${mode}` }, 400);
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.5, max_tokens: 700 }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return json({ error: `OpenAI 오류 ${resp.status}: ${t.slice(0, 300)}` }, 502);
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    return json({ text });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
```

- [ ] **Step 2: 커밋** (빌드/테스트 대상 아님 — Deno 파일이라 vite/vitest가 무시. 존재 확인만)

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm run build 2>&1 | tail -3`
Expected: 빌드 성공(이 파일은 src 밖이라 번들에 포함되지 않음).

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add supabase/functions/ai/index.ts
git -c commit.gpgsign=false commit -m "feat(ai): OpenAI gpt-4o-mini 프록시 Edge Function 추가"
```

---

## Task 2: 클라이언트 AI 배관 (`aiClient` + `aiPayload` + 테스트)

**Files:**
- Create: `src/utils/aiClient.js`
- Create: `src/utils/aiPayload.js`
- Create: `src/utils/aiPayload.test.js`

**Interfaces:**
- Consumes: `supabase`(supabaseClient), analytics `kpiSummary`/`cashCardRatio`/`dailySales`.
- Produces:
  - `callAI(mode, payload) => Promise<string>` (throws on error)
  - `buildReportPayload(report) => object|null`
  - `buildChatContext(salesData, now?) => object`
  - `detectAnomalies(salesData, now?) => Array<{유형, ...}>`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/utils/aiPayload.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildReportPayload, buildChatContext, detectAnomalies } from './aiPayload.js';

const recs = (arr) => arr.map((r, i) => ({ id: i + 1, name: '', ...r }));

describe('buildReportPayload', () => {
  it('report 객체에서 핵심 필드를 뽑는다', () => {
    const p = buildReportPayload({
      ym: '2026-06', total: 1000, count: 4, avgPerTxn: 250, momRatePct: 20,
      cash: 600, card: 400, cardFee: 40, bestDay: { day: 3, total: 500 },
      top3: [{ name: '김', type: '카드', final: 300 }],
    });
    expect(p.월).toBe('2026-06');
    expect(p.총매출).toBe(1000);
    expect(p.카드수수료).toBe(40);
    expect(p.최고거래).toEqual([{ 이름: '김', 금액: 300 }]);
  });
  it('report가 없으면 null', () => {
    expect(buildReportPayload(null)).toBe(null);
  });
});

describe('detectAnomalies', () => {
  it('전월 대비 30% 이상 급변을 감지', () => {
    // 2026-06: 10000, 2026-05: 1000 → +900%
    const data = recs([
      { type: '현금', original: 10000, final: 10000, date: '2026-06-10T09:00:00.000Z' },
      { type: '현금', original: 1000, final: 1000, date: '2026-05-10T09:00:00.000Z' },
    ]);
    const out = detectAnomalies(data, new Date(2026, 5, 15));
    expect(out.some((a) => a.유형 === '전월대비급변')).toBe(true);
  });
  it('이상치 없으면 빈 배열', () => {
    const data = recs([{ type: '현금', original: 1000, final: 1000, date: '2026-06-10T09:00:00.000Z' }]);
    // 단일 기록, 전월 없음 → momRatePct null, 일별 3건 미만
    expect(detectAnomalies(data, new Date(2026, 5, 15))).toEqual([]);
  });
});

describe('buildChatContext', () => {
  it('요약 컨텍스트 키를 포함', () => {
    const data = recs([{ type: '카드', original: 1000, final: 900, date: '2026-06-10T09:00:00.000Z' }]);
    const c = buildChatContext(data, new Date(2026, 5, 15));
    expect(c).toHaveProperty('이번달총매출');
    expect(c).toHaveProperty('이번달카드');
    expect(c.이번달총매출).toBe(900);
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npx vitest run src/utils/aiPayload.test.js`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `aiPayload.js` 구현**

Create `src/utils/aiPayload.js`:

```js
import { kpiSummary, cashCardRatio, dailySales } from './analytics.js';

// 월 리포트 객체 → AI 전송용 compact payload
export function buildReportPayload(report) {
  if (!report) return null;
  return {
    월: report.ym,
    총매출: report.total,
    거래건수: report.count,
    건당평균: report.avgPerTxn,
    전월대비퍼센트: report.momRatePct,
    현금: report.cash,
    카드: report.card,
    카드수수료: report.cardFee,
    최고매출일: report.bestDay,
    최고거래: (report.top3 || []).map((r) => ({ 이름: r.name || r.type, 금액: r.final })),
  };
}

// 챗봇용 매출 요약 컨텍스트(토큰 절약을 위해 compact)
export function buildChatContext(salesData, now = new Date()) {
  const k = kpiSummary(salesData, now);
  const ratio = cashCardRatio(salesData, 'month', now);
  return {
    이번달총매출: k.thisMonthTotal,
    전월총매출: k.lastMonthTotal,
    전월대비퍼센트: k.momRatePct,
    거래건수: k.count,
    건당평균: k.avgPerTxn,
    누적총매출: k.cumulativeTotal,
    이번달현금: ratio.cash,
    이번달카드: ratio.card,
    최고매출일: k.bestDay,
  };
}

// 이상치 감지(순수): 전월 대비 급변(±30%↑) + 이번 달 일별 스파이크(평균 2배↑)
export function detectAnomalies(salesData, now = new Date()) {
  const out = [];
  const k = kpiSummary(salesData, now);
  if (k.momRatePct !== null && Math.abs(k.momRatePct) >= 30) {
    out.push({
      유형: '전월대비급변',
      방향: k.momRatePct < 0 ? '급감' : '급등',
      상세: `전월 대비 ${k.momRatePct > 0 ? '+' : ''}${k.momRatePct}% (이번달 ${k.thisMonthTotal}원, 전월 ${k.lastMonthTotal}원)`,
    });
  }
  const daily = dailySales(salesData, now).filter((d) => d.total > 0);
  if (daily.length >= 3) {
    const mean = daily.reduce((s, d) => s + d.total, 0) / daily.length;
    for (const d of daily) {
      if (d.total >= mean * 2) {
        out.push({ 유형: '일별급등', 상세: `${d.day}일 매출 ${d.total}원 (평균의 ${(d.total / mean).toFixed(1)}배)` });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: `aiClient.js` 구현**

Create `src/utils/aiClient.js`:

```js
import { supabase } from '../supabaseClient';

// Edge Function 'ai' 호출. mode: 'report' | 'chat' | 'anomaly'
// 성공 시 생성 텍스트(string) 반환, 실패 시 throw.
export async function callAI(mode, payload) {
  const { data, error } = await supabase.functions.invoke('ai', { body: { mode, payload } });
  if (error) throw new Error(error.message || 'AI 요청에 실패했습니다.');
  if (data?.error) throw new Error(data.error);
  return data?.text ?? '';
}
```

- [ ] **Step 5: 실행해 통과 확인 + 빌드**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm test && npm run build 2>&1 | tail -3`
Expected: 모든 테스트 PASS, 빌드 성공.

- [ ] **Step 6: 커밋**

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add src/utils/aiClient.js src/utils/aiPayload.js src/utils/aiPayload.test.js
git -c commit.gpgsign=false commit -m "feat(ai): aiClient + payload/이상치 순수함수(+테스트)"
```

---

## Task 3: `AiInsights` — 분석 탭의 AI 분석 + 이상치 섹션

**Files:**
- Create: `src/components/AiInsights.jsx`
- Create: `src/components/AiInsights.css`
- Modify: `src/components/AdminDashboard.jsx`

**Interfaces:**
- Consumes: `callAI`(Task 2), `buildReportPayload`/`buildChatContext`/`detectAnomalies`(Task 2), `monthlyReport`(analytics), `salesData` prop.
- Produces: `<AiInsights salesData={...} />`.

- [ ] **Step 1: 컴포넌트 작성**

Create `src/components/AiInsights.jsx`:

```jsx
import { useState } from 'react';
import { monthlyReport } from '../utils/analytics';
import { callAI } from '../utils/aiClient';
import { buildReportPayload, buildChatContext, detectAnomalies } from '../utils/aiPayload';
import './AiInsights.css';

export default function AiInsights({ salesData }) {
  const now = new Date();
  const [report, setReport] = useState({ loading: false, text: '', error: '' });
  const [anomaly, setAnomaly] = useState({ loading: false, text: '', error: '' });

  const anomalies = detectAnomalies(salesData, now);

  const runReport = async () => {
    setReport({ loading: true, text: '', error: '' });
    try {
      const payload = buildReportPayload(monthlyReport(salesData, now));
      const text = await callAI('report', payload);
      setReport({ loading: false, text, error: '' });
    } catch (e) {
      setReport({ loading: false, text: '', error: e.message });
    }
  };

  const runAnomaly = async () => {
    setAnomaly({ loading: true, text: '', error: '' });
    try {
      const text = await callAI('anomaly', { 이상치: anomalies, 요약: buildChatContext(salesData, now) });
      setAnomaly({ loading: false, text, error: '' });
    } catch (e) {
      setAnomaly({ loading: false, text: '', error: e.message });
    }
  };

  return (
    <>
      <div className="admin-section ai-section">
        <h2>AI 매출 분석</h2>
        <button className="ai-btn" onClick={runReport} disabled={report.loading}>
          {report.loading ? '분석 중…' : '이번 달 AI 분석 생성'}
        </button>
        {report.error && <p className="ai-error">{report.error}</p>}
        {report.text && <div className="ai-result">{report.text}</div>}
      </div>

      <div className="admin-section ai-section">
        <h2>이상치 감지</h2>
        {anomalies.length === 0 ? (
          <p className="muted">특이 사항이 감지되지 않았습니다.</p>
        ) : (
          <>
            <ul className="ai-anomaly-list">
              {anomalies.map((a, i) => (
                <li key={i}><strong>{a.유형}</strong> — {a.상세}</li>
              ))}
            </ul>
            <button className="ai-btn" onClick={runAnomaly} disabled={anomaly.loading}>
              {anomaly.loading ? '분석 중…' : 'AI 원인 분석'}
            </button>
            {anomaly.error && <p className="ai-error">{anomaly.error}</p>}
            {anomaly.text && <div className="ai-result">{anomaly.text}</div>}
          </>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: 스타일 작성**

Create `src/components/AiInsights.css`:

```css
.ai-section h2 { display: flex; align-items: center; gap: 6px; }
.ai-btn {
  padding: 10px 16px; border: none; border-radius: 12px; cursor: pointer;
  font-size: 14px; font-weight: 700; color: #fff;
  background: linear-gradient(135deg, #7c5cff, #5b8cff);
}
.ai-btn:disabled { opacity: 0.6; cursor: default; }
.ai-result {
  margin-top: 12px; padding: 14px; border-radius: 12px;
  background: var(--input-bg, #f5f5f7); font-size: 14px; line-height: 1.6;
  white-space: pre-wrap;
}
.ai-error { margin-top: 10px; color: var(--danger, #ff3b30); font-size: 13px; }
.ai-anomaly-list { list-style: none; padding: 0; margin: 0 0 12px; display: flex; flex-direction: column; gap: 6px; }
.ai-anomaly-list li { font-size: 14px; }
```

- [ ] **Step 3: AdminDashboard에 배치**

In `src/components/AdminDashboard.jsx`:
1. 상단 import에 추가:
```jsx
import AiInsights from './AiInsights';
```
2. `고객별 집계` 섹션과 `기간 조회 & 내보내기` 섹션 사이(또는 `기간 조회` 섹션 바로 앞)에 삽입:
```jsx
      <AiInsights salesData={salesData} />

```
(정확히 `<div className="admin-section">` 로 시작하는 `기간 조회 & 내보내기` 블록 바로 위 줄에 추가)

- [ ] **Step 4: 빌드 검증**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm run build 2>&1 | tail -3`
Expected: 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add src/components/AiInsights.jsx src/components/AiInsights.css src/components/AdminDashboard.jsx
git -c commit.gpgsign=false commit -m "feat(ai): 분석 탭에 AI 매출 분석 + 이상치 감지 섹션"
```

---

## Task 4: `AiChat` — `[AI]` 챗봇 탭

**Files:**
- Create: `src/components/AiChat.jsx`
- Create: `src/components/AiChat.css`
- Modify: `src/components/Shell.jsx`

**Interfaces:**
- Consumes: `callAI`(Task 2), `buildChatContext`(Task 2), `salesData` prop.
- Produces: `<AiChat salesData={...} />`; Shell 탭 `'ai'`.

- [ ] **Step 1: 챗봇 컴포넌트 작성**

Create `src/components/AiChat.jsx`:

```jsx
import { useState, useRef, useEffect } from 'react';
import { callAI } from '../utils/aiClient';
import { buildChatContext } from '../utils/aiPayload';
import './AiChat.css';

export default function AiChat({ salesData }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕하세요! 매출에 대해 무엇이든 물어보세요. 일반적인 질문도 괜찮아요.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const context = buildChatContext(salesData, new Date());
      // 대화 히스토리(첫 인사 제외) + 컨텍스트 전달
      const history = next.filter((m, i) => !(i === 0 && m.role === 'assistant'));
      const reply = await callAI('chat', { messages: history, context });
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="ai-chat">
      <div className="ai-chat-log">
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
        <textarea
          rows={1}
          placeholder="메시지를 입력하세요 (Enter 전송)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button onClick={send} disabled={loading || !input.trim()}>전송</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 스타일 작성**

Create `src/components/AiChat.css`:

```css
.ai-chat { display: flex; flex-direction: column; height: 100%; padding: 12px; box-sizing: border-box; }
.ai-chat-log { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-bottom: 8px; }
.ai-msg { display: flex; }
.ai-msg.user { justify-content: flex-end; }
.ai-msg.assistant { justify-content: flex-start; }
.ai-bubble {
  max-width: 78%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5;
  white-space: pre-wrap; word-break: break-word;
}
.ai-msg.user .ai-bubble { background: var(--primary, #007aff); color: #fff; border-bottom-right-radius: 4px; }
.ai-msg.assistant .ai-bubble { background: var(--input-bg, #f0f0f3); color: var(--text-primary, #111); border-bottom-left-radius: 4px; }
.ai-typing { opacity: 0.7; font-style: italic; }
.ai-error { color: var(--danger, #ff3b30); font-size: 13px; }
.ai-chat-input { display: flex; gap: 8px; align-items: flex-end; padding-top: 8px; }
.ai-chat-input textarea {
  flex: 1; resize: none; padding: 10px 12px; border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.12); font-size: 15px; font-family: inherit; max-height: 120px;
}
.ai-chat-input button {
  padding: 10px 18px; border: none; border-radius: 12px; cursor: pointer;
  font-size: 15px; font-weight: 700; color: #fff; background: var(--primary, #007aff);
}
.ai-chat-input button:disabled { opacity: 0.5; cursor: default; }
```

- [ ] **Step 3: Shell에 `[AI]` 탭 추가**

In `src/components/Shell.jsx`:
1. import 추가:
```jsx
import AiChat from './AiChat.jsx';
```
2. 탭 바(`.shell-tabs`)에서 `분석` 버튼 다음, `로그아웃` 버튼 앞에 AI 탭 버튼 추가:
```jsx
        <button
          className={`shell-tab ${tab === 'ai' ? 'active' : ''}`}
          onClick={() => setTab('ai')}
        >AI</button>
```
3. 본문 렌더 분기를 3분기로 교체:
```jsx
      <div className="shell-body">
        {tab === 'input' && <App sales={sales} />}
        {tab === 'dashboard' && <AdminDashboard salesData={sales.salesData} loading={sales.loading} />}
        {tab === 'ai' && <AiChat salesData={sales.salesData} />}
      </div>
```
(기존 `{tab === 'input' ? <App .../> : <AdminDashboard .../>}` 삼항을 위 3분기로 대체)

- [ ] **Step 4: 빌드 + 테스트 검증**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm run build 2>&1 | tail -3 && npm test 2>&1 | grep -E "Tests "`
Expected: 빌드 성공, 모든 단위 테스트 통과.

- [ ] **Step 5: 커밋**

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add src/components/AiChat.jsx src/components/AiChat.css src/components/Shell.jsx
git -c commit.gpgsign=false commit -m "feat(ai): [AI] 챗봇 탭 추가(데이터 인지 + 일반 대화)"
```

---

## Self-Review

- **스펙 커버리지:** (1) AI 월말/월간 분석 → Task 3 runReport, (2) 챗봇(데이터+일반) → Task 4, (3) 이상치 감지+원인 → Task 2 detectAnomalies + Task 3 runAnomaly. 백엔드 → Task 1. 키 비노출(서버 전용) → Task 1(Edge Function) + Task 2(functions.invoke, VITE_ 미사용).
- **타입 일관성:** `callAI(mode, payload)` Task 2 정의, Task 3·4 사용 동일. `buildReportPayload`/`buildChatContext`/`detectAnomalies` 시그니처 일치. Shell `sales` prop은 기존 구조 유지.
- **플레이스홀더:** 없음(모든 코드 블록 완성).
- **미검증 경계:** OpenAI 실호출은 Edge Function 배포 후에만 검증 가능(사장님 대시보드 배포 필요) — UI는 미배포 시 에러 메시지로 우아하게 처리.
