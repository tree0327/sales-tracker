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
