import { useAuth } from './useAuth';
import Login from './components/Login';
import Ledger from './Ledger';

// 인증 게이트: 세션 없으면 로그인, 있으면 가계부.
export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="app">
        <div className="setup"><div style={{ fontSize: 34 }}>👛</div><p>불러오는 중…</p></div>
      </div>
    );
  }
  if (!session) return <Login />;
  return <Ledger user={session.user} />;
}
