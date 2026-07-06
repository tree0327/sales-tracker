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
