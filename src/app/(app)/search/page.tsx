"use client";

import { useState, useCallback, useEffect } from "react";
import { SearchFilters } from "@/components/search/search-filters";
import { PhysicianTable } from "@/components/physicians/physician-table";
import { isScoringPending } from "@/lib/scoring-status";
import type { Physician, PhysicianFilters } from "@/types";

export default function SearchPage() {
  const [filters, setFilters] = useState<PhysicianFilters>({ specialty: "Cardiology" });
  const [physicians, setPhysicians] = useState<Physician[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    const res = await fetch(`/api/physicians?${params}`);
    const json = await res.json();
    if (json.success) {
      setPhysicians(json.data.data);
      setTotal(json.data.total);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    if (!physicians.some(isScoringPending)) return;
    const interval = setInterval(search, 5000);
    return () => clearInterval(interval);
  }, [physicians, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-muted-foreground text-sm">
          Advanced physician lead filters — sorted highest score first
        </p>
      </div>
      <SearchFilters filters={filters} onChange={setFilters} onSearch={search} />
      {loading ? (
        <p className="text-muted-foreground">Searching…</p>
      ) : (
        <>
          {total > 0 && (
            <p className="text-sm text-muted-foreground">{total} results</p>
          )}
          <PhysicianTable physicians={physicians} />
        </>
      )}
    </div>
  );
}
