import { useState, useEffect, useCallback } from 'react';
import { supabase, TX_TABLE, FIXED_TABLE, CATEGORY_TABLE } from '../supabaseClient';
import { computeFinal } from '../utils/money';

// 부부 가계부 데이터 계층.
// transactions / fixed_expenses / expense_categories 를 로드하고 추가·삭제한다.
// 스키마 미생성 시 needsSetup=true 로 안내 화면을 띄운다.
export function useLedger() {
  const [transactions, setTransactions] = useState([]);
  const [fixed, setFixed] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [tx, fx, cat] = await Promise.all([
      supabase.from(TX_TABLE).select('*').order('date', { ascending: false }),
      supabase.from(FIXED_TABLE).select('*').order('amount', { ascending: false }),
      supabase.from(CATEGORY_TABLE).select('*').order('sort', { ascending: true }),
    ]);
    // 테이블이 없으면(마이그레이션 전) 설정 안내
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

  return {
    transactions, fixed, categories, loading, error, needsSetup,
    reload, addTransaction, deleteTransaction, addFixed, deleteFixed, addCategory, deleteCategory,
  };
}

// PostgREST: 관계(테이블) 없음 = 42P01
function missingTable(err) {
  return !!err && (err.code === '42P01' || /does not exist|schema cache/i.test(err.message || ''));
}
