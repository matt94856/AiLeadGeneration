"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PhysicianFilters } from "@/types";

interface Props {
  filters: PhysicianFilters;
  onChange: (filters: PhysicianFilters) => void;
  onSearch: () => void;
}

export function SearchFilters({ filters, onChange, onSearch }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border p-4 bg-card">
      <div>
        <Label htmlFor="keyword">Keyword</Label>
        <Input
          id="keyword"
          placeholder="Name, org, summary…"
          value={filters.keyword ?? ""}
          onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="state">State</Label>
        <Input
          id="state"
          placeholder="FL"
          maxLength={2}
          value={filters.state ?? ""}
          onChange={(e) => onChange({ ...filters, state: e.target.value.toUpperCase() })}
        />
      </div>
      <div>
        <Label htmlFor="city">City</Label>
        <Input
          id="city"
          value={filters.city ?? ""}
          onChange={(e) => onChange({ ...filters, city: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="specialty">Specialty</Label>
        <Input
          id="specialty"
          placeholder="Cardiology"
          value={filters.specialty ?? ""}
          onChange={(e) => onChange({ ...filters, specialty: e.target.value || undefined })}
        />
      </div>
      <div>
        <Label htmlFor="minScore">Min Lead Score</Label>
        <Input
          id="minScore"
          type="number"
          min={0}
          max={100}
          value={filters.minScore ?? ""}
          onChange={(e) =>
            onChange({ ...filters, minScore: e.target.value ? Number(e.target.value) : undefined })
          }
        />
      </div>
      <div>
        <Label htmlFor="minYears">Min Years Experience</Label>
        <Input
          id="minYears"
          type="number"
          value={filters.minYears ?? ""}
          onChange={(e) =>
            onChange({ ...filters, minYears: e.target.value ? Number(e.target.value) : undefined })
          }
        />
      </div>
      <div>
        <Label htmlFor="organization">Organization</Label>
        <Input
          id="organization"
          value={filters.organization ?? ""}
          onChange={(e) => onChange({ ...filters, organization: e.target.value })}
        />
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
          <input
            type="checkbox"
            className="rounded border"
            checked={filters.status === "researching"}
            onChange={(e) =>
              onChange({
                ...filters,
                status: e.target.checked ? "researching" : undefined,
              })
            }
          />
          Researching only
        </label>
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
          <input
            type="checkbox"
            className="rounded border"
            checked={filters.hasEmail === true}
            onChange={(e) =>
              onChange({ ...filters, hasEmail: e.target.checked ? true : undefined })
            }
          />
          Has email only
        </label>
      </div>
      <div className="flex items-end">
        <Button className="w-full" onClick={onSearch}>
          Search
        </Button>
      </div>
    </div>
  );
}
