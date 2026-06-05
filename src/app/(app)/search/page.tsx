"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { SearchFilters } from "@/components/search/search-filters";
import { PhysicianTable } from "@/components/physicians/physician-table";
import { Pagination } from "@/components/ui/pagination";
import { DEFAULT_PAGE_SIZE, totalPages } from "@/lib/pagination";
import { isScoringPending } from "@/lib/scoring-status";
import type { Physician, PhysicianFilters } from "@/types";

export default function SearchPage() {
  const [filters, setFilters] = useState<PhysicianFilters>({});
  const [physicians, setPhysicians] = useState<Physician[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const loadPage = useCallback(async (pageNum: number, activeFilters: PhysicianFilters) => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(activeFilters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    params.set("page", String(pageNum));
    params.set("limit", String(DEFAULT_PAGE_SIZE));
    const res = await fetch(`/api/physicians?${params}`);
    const json = await res.json();
    if (json.success) {
      setPhysicians(json.data.data);
      setTotal(json.data.total);
    }
    setLoading(false);
  }, []);

  function runSearch() {
    setPage(1);
    void loadPage(1, filters);
  }

  useEffect(() => {
    void loadPage(page, filtersRef.current);
  }, [page, loadPage]);

  useEffect(() => {
    if (!physicians.some(isScoringPending)) return;
    const interval = setInterval(() => loadPage(page, filtersRef.current), 5000);
    return () => clearInterval(interval);
  }, [physicians, page, loadPage]);

  const pages = totalPages(total, DEFAULT_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-muted-foreground text-sm">
          Filter your leads — sorted highest score first. Use pages below to browse all results.
        </p>
      </div>
      <SearchFilters filters={filters} onChange={setFilters} onSearch={runSearch} />
      {loading ? (
        <p className="text-muted-foreground">Searching…</p>
      ) : (
        <>
          {total > 0 && (
            <Pagination
              page={page}
              totalPages={pages}
              total={total}
              pageSize={DEFAULT_PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
          <PhysicianTable physicians={physicians} />
          {total > 0 && (
            <Pagination
              page={page}
              totalPages={pages}
              total={total}
              pageSize={DEFAULT_PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
          {total === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No physicians match these filters. Try clearing filters and search again.
            </p>
          )}
        </>
      )}
    </div>
  );
}
