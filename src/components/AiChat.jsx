import { useState, useRef, useEffect } from 'react';
import { callAI } from '../utils/aiClient';
import { buildChatContext } from '../utils/aiPayload';
import './AiChat.css';

export default function AiChat({ salesData, dataLoading }) {
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
    if (dataLoading) return;
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const context = buildChatContext(salesData, new Date());
      // 대화 히스토리(첫 인사 제외) + 컨텍스트 전달, 최근 20개로 제한
      const history = next.filter((m, i) => !(i === 0 && m.role === 'assistant')).slice(-20);
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
        {dataLoading && <p className="ai-chat-notice">데이터를 불러오는 중…</p>}
        <textarea
          rows={1}
          placeholder="메시지를 입력하세요 (Enter 전송)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={dataLoading}
        />
        <button onClick={send} disabled={dataLoading || loading || !input.trim()}>전송</button>
      </div>
    </div>
  );
}
