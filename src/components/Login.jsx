import { useState } from 'react';
import { supabase } from '../supabaseClient';

// 이메일+비밀번호 로그인. 가입 경로 없음(계정은 Supabase 대시보드에서 생성).
// '@'가 없으면 기본 도메인을 붙여 아이디만으로도 로그인 가능.
const DEFAULT_DOMAIN = '@home.local';
function toEmail(input) {
  const v = input.trim();
  return v.includes('@') ? v : v + DEFAULT_DOMAIN;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setStatus('submitting');
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(email), password });
    if (error) {
      setStatus('error');
      setMessage('로그인에 실패했습니다. 아이디 또는 비밀번호를 확인하세요.');
    }
    // 성공 시 onAuthStateChange 가 세션을 잡아 자동 전환
  };

  return (
    <form className="login" onSubmit={submit}>
      <div className="brand" aria-hidden="true">
        <svg width="72" height="72" viewBox="0 0 512 512" role="img">
          <defs>
            <clipPath id="lh" clipPathUnits="userSpaceOnUse"><rect x="0" y="0" width="12" height="24" /></clipPath>
            <clipPath id="rh" clipPathUnits="userSpaceOnUse"><rect x="12" y="0" width="12" height="24" /></clipPath>
          </defs>
          <circle cx="256" cy="256" r="248" fill="#C8842A" />
          <g transform="translate(148,154) scale(9)">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#D65B82" clipPath="url(#lh)" />
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#3D74B0" clipPath="url(#rh)" />
          </g>
        </svg>
      </div>
      <h2>부부 가계부</h2>
      <p className="lead">각자 아이디로 로그인하세요</p>
      <div className="lfield">
        <label>아이디</label>
        <input type="text" placeholder="아이디 또는 이메일" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
      </div>
      <div className="lfield">
        <label>비밀번호</label>
        <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      <button className="primary" type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? '로그인 중…' : '로그인'}
      </button>
      {status === 'error' && <p className="lmsg error">{message}</p>}
    </form>
  );
}
