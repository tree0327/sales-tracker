import { useState, useEffect, useCallback } from 'react';
import { supabase, RECORDS_TABLE } from '../supabaseClient';

// 주 저장소: Supabase. localStorage 는 오프라인 캐시 + 기존 데이터 1회 마이그레이션.
const CACHE_KEY = 'salesData';
const MIGRATION_FLAG = 'salesData_migrated_to_supabase';

// 결제수단별 최종액: 현금=원금, 카드=수수료 10% 차감
function computeFinal(type, original) {
  return type === '현금' ? original : Math.floor(original * 0.9);
}

function readCache() {
  try {
    const item = window.localStorage.getItem(CACHE_KEY);
    return item ? JSON.parse(item) : [];
  } catch (e) {
    console.error('Failed to read sales cache:', e);
    return [];
  }
}

export const useSalesData = () => {
  const [salesData, setSalesData] = useState(readCache);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 상태 + 로컬 캐시를 함께 갱신
  const persist = useCallback((updater) => {
    setSalesData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to write sales cache:', e);
      }
      return next;
    });
  }, []);

  // 마운트 시 Supabase 에서 전체 기록 로드.
  // DB 가 비어 있고 기존 localStorage 기록이 있으면 1회 업로드(마이그레이션).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from(RECORDS_TABLE)
        .select('*')
        .order('date', { ascending: false });
      if (cancelled) return;

      if (fetchErr) {
        // DB 연결 실패 시 로컬 캐시 유지(폴백)
        setError(fetchErr.message);
        setLoading(false);
        return;
      }

      let rows = data ?? [];
      const localRows = readCache();
      const alreadyMigrated = window.localStorage.getItem(MIGRATION_FLAG);

      if (rows.length === 0 && localRows.length > 0 && !alreadyMigrated) {
        const toInsert = localRows.map((r) => {
          const original = Number(r.original) || 0;
          return {
            id: String(r.id),
            type: r.type,
            original,
            final: Number(r.final ?? computeFinal(r.type, original)),
            name: r.name || '',
            date: r.date,
          };
        });
        const { data: inserted, error: insErr } = await supabase
          .from(RECORDS_TABLE)
          .insert(toInsert)
          .select();
        if (cancelled) return;
        if (insErr) {
          setError(insErr.message);
        } else {
          window.localStorage.setItem(MIGRATION_FLAG, '1');
          rows = (inserted ?? toInsert).sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );
        }
      }

      setError(null);
      persist(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [persist]);

  const addRecord = useCallback(
    async (type, originalAmount, name = '') => {
      const original = Number(originalAmount) || 0;
      const record = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now()),
        type,
        original,
        final: computeFinal(type, original),
        name: (name || '').trim(),
        date: new Date().toISOString(),
      };
      // 낙관적 업데이트
      persist((prev) => [record, ...prev]);

      const { error: insErr } = await supabase.from(RECORDS_TABLE).insert(record);
      if (insErr) {
        setError(insErr.message);
        persist((prev) => prev.filter((r) => r.id !== record.id)); // 롤백
      } else {
        setError(null);
      }
    },
    [persist]
  );

  const updateRecord = useCallback(
    async (id, type, newOriginalAmount, name = '') => {
      const original = Number(newOriginalAmount) || 0;
      const patch = {
        type,
        original,
        final: computeFinal(type, original),
        name: (name || '').trim(),
      };
      let snapshot;
      persist((prev) => {
        snapshot = prev;
        return prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      });

      const { error: updErr } = await supabase
        .from(RECORDS_TABLE)
        .update(patch)
        .eq('id', id);
      if (updErr) {
        setError(updErr.message);
        if (snapshot) persist(snapshot); // 롤백
      } else {
        setError(null);
      }
    },
    [persist]
  );

  const deleteRecord = useCallback(
    async (id) => {
      let snapshot;
      persist((prev) => {
        snapshot = prev;
        return prev.filter((r) => r.id !== id);
      });

      const { error: delErr } = await supabase
        .from(RECORDS_TABLE)
        .delete()
        .eq('id', id);
      if (delErr) {
        setError(delErr.message);
        if (snapshot) persist(snapshot); // 롤백
      } else {
        setError(null);
      }
    },
    [persist]
  );

  return { salesData, addRecord, updateRecord, deleteRecord, loading, error };
};
