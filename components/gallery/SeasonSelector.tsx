// components/gallery/SeasonSelector.tsx
"use client";

import { useEffect, useState } from "react";
import { Layers } from "lucide-react";

interface Season {
  id: string;
  name: string;
  year: number;
  isActive: boolean;
}

interface SeasonSelectorProps {
  selectedSeasonId: string | null;
  onChange: (id: string) => void;
}

export function SeasonSelector({ selectedSeasonId, onChange }: SeasonSelectorProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSeasons() {
      try {
        const res = await fetch("/api/seasons");
        const data = await res.json();
        if (data.success) {
          setSeasons(data.seasons || []);
        }
      } catch (err) {
        console.error("Failed to load seasons in selector:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSeasons();
  }, []);

  if (loading || seasons.length === 0) return null;

  return (
    <div className="flex items-center gap-2 select-none z-20 relative">
      <Layers className="h-4 w-4 text-[var(--accent-blue)]" />
      <span className="text-xs font-bold text-[var(--text2)] uppercase">ปีการศึกษา:</span>
      <select
        value={selectedSeasonId || ""}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-[var(--accent-blue)] transition-all cursor-pointer"
      >
        {seasons.map((season) => (
          <option key={season.id} value={season.id} className="bg-[#0b0d1e] text-white">
            {season.name} {season.isActive ? "(ปัจจุบัน)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

export default SeasonSelector;
