import { useState } from 'react';
import { OVERALL } from '../utils/ledger';

const INC_CATS = ['매출', '급여', '기타수입'];

function BudgetInput({ label, value, onSave }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{label}</span>
      <input className="memo-input" style={{ width: 130, textAlign: 'right', padding: '9px 12px' }}
        type="number" inputMode="numeric" defaultValue={value || ''} placeholder="0"
        onBlur={(e) => onSave(e.target.value)} />
      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>원</span>
    </div>
  );
}

// 설정: 월 예산, 지출 카테고리 추가/삭제, 계정/로그아웃
export default function SettingsScreen({ categories, budgets, member, onNav, onSetBudget, onAddCategory, onDeleteCategory, onLogout }) {
  const [name, setName] = useState('');
  const add = () => {
    const v = name.trim();
    if (!v) return;
    onAddCategory(v);
    setName('');
  };
  return (
    <div>
      <header className="app-head">
        <button className="title" onClick={() => onNav('home')}><span className="chev">‹</span> 설정</button>
      </header>
      <div className="body">
        <div className="set-card">
          <h3>월 예산</h3>
          <p className="desc">이번 달 변동지출 예산이에요. 홈에 사용률 게이지로 표시됩니다. (0 또는 비우면 해제)</p>
          <BudgetInput label="전체 예산" value={budgets[OVERALL]} onSave={(v) => onSetBudget(OVERALL, v)} />
          {categories.map((c) => (
            <BudgetInput key={c.id} label={c.name} value={budgets[c.name]} onSave={(v) => onSetBudget(c.name, v)} />
          ))}
        </div>

        <div className="set-card">
          <h3>지출 카테고리 관리</h3>
          <p className="desc">입력할 때 고를 지출 카테고리예요. ×로 지우고, 아래에서 추가하세요.</p>
          <div className="catlist">
            {categories.map((c) => (
              <span className="cchip" key={c.id}>{c.name}<button className="x" aria-label="삭제" onClick={() => onDeleteCategory(c.id)}>×</button></span>
            ))}
          </div>
          <div className="addcat">
            <input placeholder="새 카테고리 (예: 병원)" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
            <button onClick={add}>추가</button>
          </div>
        </div>

        <div className="set-card">
          <h3>수입 카테고리</h3>
          <p className="desc">수입은 구조상 고정입니다 (매출=아내 미용실, 급여=남편).</p>
          <div className="catlist">
            {INC_CATS.map((c) => <span className="cchip" key={c} style={{ opacity: 0.7 }}>{c}</span>)}
          </div>
        </div>

        <div className="set-card">
          <h3>계정</h3>
          <p className="desc">현재 <b style={{ color: 'var(--ink)' }}>{member.name}</b>로 로그인됨</p>
          <button className="set-logout" onClick={onLogout}>로그아웃</button>
        </div>
      </div>
    </div>
  );
}
