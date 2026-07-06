import Login from './components/Login.jsx'
import Shell from './components/Shell.jsx'
import { useAuth } from './useAuth.js'

// 인증 게이트: 세션 없으면 로그인, 있으면 통합 앱(Shell).
// role 분기는 제거됨 — 1인 사용이므로 로그인한 사용자가 입력/분석 화면을 모두 사용한다.
// (향후 직원 권한 분리가 필요하면 role을 app_metadata에 저장해 재도입할 것.)
export default function Root() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-container">
        <p className="empty">불러오는 중...</p>
      </div>
    )
  }
  if (!session) {
    return <Login />
  }
  return <Shell />
}
