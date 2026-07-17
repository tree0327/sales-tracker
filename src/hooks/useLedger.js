import { useState, useEffect, useCallback } from 'react';
import { supabase, TX_TABLE, FIXED_TABLE, CATEGORY_TABLE, BUDGET_TABLE } from '../supabaseClient';
import { computeFinal, buildUpdatePatch } from '../utils/money';

// 부부 가계부 데이터 계층.
// transactions / fixed_expenses / expense_categories 를 로드하고 추가·삭제한다.
// 스키마 미생성 시 needsSetup=true 로 안내 화면을 띄운다.
export function useLedger() {
  const [transactions, setTransactions] = useState([]);
  const [fixed, setFixed] = useState([]);
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [tx, fx, cat, bud] = await Promise.all([
      supabase.from(TX_TABLE).select('*').order('date', { ascending: false }),
      supabase.from(FIXED_TABLE).select('*').order('amount', { ascending: false }),
      supabase.from(CATEGORY_TABLE).select('*').order('sort', { ascending: true }),
      supabase.from(BUDGET_TABLE).select('*'),
    ]);
    // 핵심 3개 테이블이 없으면(마이그레이션 전) 설정 안내. budgets(0007)는 없어도 무시.
    if (missingTable(tx.error) || missingTable(fx.error) || missingTable(cat.error)) {
      setNeedsSetup(true);
      setLoading(false);
      return;
    }
    const err = tx.error || fx.error || cat.error;
    if (err) setError(err.message);
    else setError(null);
    setTransactions(tx.data ?? []);
    setFixed(fx.data ?? []);
    setCategories(cat.data ?? []);
    setBudgets(missingTable(bud.error) ? [] : (bud.data ?? []));
    setLoading(false);
  }, []);

  useEffect(() => {
    // 마운트 시 1회 로드(외부 데이터 동기화). setState 는 await 이후 실행된다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  // --- 거래 추가 ---
  const addTransaction = useCallback(async ({ flow, amount, category, owner, method, memo, date }) => {
    const payload = {
      flow,
      amount: Number(amount) || 0,
      final: computeFinal({ flow, category, method, amount }),
      category,
      owner,
      method: flow === 'income' && category === '급여' ? '계좌' : method,
      memo: (memo || '').trim(),
      date: date || new Date().toISOString(),
    };
    const { data, error: e } = await supabase.from(TX_TABLE).insert(payload).select().single();
    if (e) { setError(e.message); return null; }
    setError(null);
    setTransactions((prev) => [data, ...prev]);
    return data;
  }, []);

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

  const deleteTransaction = useCallback(async (id) => {
    const snap = transactions;
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    const { error: e } = await supabase.from(TX_TABLE).delete().eq('id', id);
    if (e) { setError(e.message); setTransactions(snap); }
  }, [transactions]);

  // --- 고정지출 ---
  const addFixed = useCallback(async ({ name, amount, day, method }) => {
    const payload = { name: name.trim(), amount: Number(amount) || 0, day: Number(day) || 1, method };
    const { data, error: e } = await supabase.from(FIXED_TABLE).insert(payload).select().single();
    if (e) { setError(e.message); return null; }
    setError(null);
    setFixed((prev) => [...prev, data].sort((a, b) => b.amount - a.amount));
    return data;
  }, []);

  const deleteFixed = useCallback(async (id) => {
    const snap = fixed;
    setFixed((prev) => prev.filter((f) => f.id !== id));
    const { error: e } = await supabase.from(FIXED_TABLE).delete().eq('id', id);
    if (e) { setError(e.message); setFixed(snap); }
  }, [fixed]);

  // --- 지출 카테고리 ---
  const addCategory = useCallback(async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const sort = (categories.reduce((m, c) => Math.max(m, c.sort || 0), 0) || 0) + 1;
    const { data, error: e } = await supabase.from(CATEGORY_TABLE).insert({ name: trimmed, sort }).select().single();
    if (e) { setError(e.message); return null; }
    setCategories((prev) => [...prev, data]);
    return data;
  }, [categories]);

  const deleteCategory = useCallback(async (id) => {
    const snap = categories;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    const { error: e } = await supabase.from(CATEGORY_TABLE).delete().eq('id', id);
    if (e) { setError(e.message); setCategories(snap); }
  }, [categories]);

  // --- 월 예산 (scope: '__overall__' 또는 카테고리명) ---
  const setBudget = useCallback(async (scope, amount) => {
    const val = Number(amount) || 0;
    if (val <= 0) {
      setBudgets((prev) => prev.filter((b) => b.scope !== scope));
      await supabase.from(BUDGET_TABLE).delete().eq('scope', scope);
      return;
    }
    const { data, error: e } = await supabase.from(BUDGET_TABLE).upsert({ scope, amount: val }, { onConflict: 'scope' }).select().single();
    if (e) { setError(e.message); return; }
    setBudgets((prev) => [...prev.filter((b) => b.scope !== scope), data]);
  }, []);

  return {
    transactions, fixed, categories, budgets, loading, error, needsSetup,
    reload, addTransaction, updateTransaction, deleteTransaction, addFixed, deleteFixed, addCategory, deleteCategory, setBudget,
  };
}

// PostgREST: 관계(테이블) 없음 = 42P01
function missingTable(err) {
  return !!err && (err.code === '42P01' || /does not exist|schema cache/i.test(err.message || ''));
}
