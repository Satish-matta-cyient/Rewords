import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounced } from './useDebounced';

export interface FilterState extends Record<string, string | number | undefined> {
  page: number;
  pageSize: number;
  search?: string;
}

/**
 * One filtering implementation shared by every list screen.
 * State lives in the URL so filtered views are shareable and survive a refresh.
 */
export function useFilters(defaults: Partial<FilterState> = {}) {
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get('search') ?? '');
  const debouncedSearch = useDebounced(searchInput);

  const filters = useMemo<FilterState>(() => {
    const entries: Record<string, string | number | undefined> = {};
    params.forEach((value, key) => { entries[key] = value; });
    return {
      ...defaults,
      ...entries,
      page: Number(params.get('page')) || 1,
      pageSize: Number(params.get('pageSize')) || Number(defaults.pageSize) || 25,
      search: debouncedSearch || undefined,
    };
  }, [params, debouncedSearch, defaults]);

  const setFilter = useCallback((key: string, value: string | number | undefined) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === undefined || value === '' || value === 'ALL') next.delete(key);
      else next.set(key, String(value));
      // Any filter change resets pagination — page 4 of a new filter is meaningless.
      if (key !== 'page') next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams]);

  const setPage = useCallback((page: number) => setFilter('page', page), [setFilter]);

  const reset = useCallback(() => {
    setSearchInput('');
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  const activeCount = [...params.keys()].filter((k) => !['page', 'pageSize'].includes(k)).length;

  return { filters, setFilter, setPage, reset, searchInput, setSearchInput, activeCount };
}
