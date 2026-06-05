"use client";

import { useCallback, useEffect, useState } from "react";
import { PhysicianTable } from "@/components/physicians/physician-table";
import { Pagination } from "@/components/ui/pagination";
import { DEFAULT_PAGE_SIZE, totalPages } from "@/lib/pagination";
import { isScoringPending } from "@/lib/scoring-status";
import type { Physician } from "@/types";

export default function PhysiciansPage() {
  const [physicians, setPhysicians] = useState<Physician[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (pageNum: number) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(DEFAULT_PAGE_SIZE),
    });
    const res = await fetch(`/api/physicians?${params}`);
    const json = await res.json();
    if (json.success) {
      setPhysicians(json.data.data);
      setTotal(json.data.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  useEffect(() => {
    if (!physicians.some(isScoringPending)) return;
    const interval = setInterval(() => load(page), 5000);
    return () => clearInterval(interval);
  }, [physicians, page, load]);

  const pages = totalPages(total, DEFAULT_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Physicians</h1>
        <p className="text-muted-foreground text-sm">
          Your cardiologist lead database — sorted by lead score (highest first)
        </p>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Pagination
            page={page}
            totalPages={pages}
            total={total}
            pageSize={DEFAULT_PAGE_SIZE}
            onPageChange={setPage}
          />
          <PhysicianTable physicians={physicians} />
          <Pagination
            page={page}
            totalPages={pages}
            total={total}
            pageSize={DEFAULT_PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
