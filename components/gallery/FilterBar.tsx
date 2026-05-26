// components/gallery/FilterBar.tsx
"use client";

import { useState, useEffect } from "react";
import { ArrowUpDown } from "lucide-react";

export interface FilterValues {
  sortBy: "newest" | "oldest";
  status?: string;
}

interface FilterBarProps {
  onChange: (filters: FilterValues) => void;
  showStatusFilter?: boolean;
}

export function FilterBar({ onChange, showStatusFilter = false }: FilterBarProps) {
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [status, setStatus] = useState<string>("approved");

  useEffect(() => {
    onChange({
      sortBy,
      status: showStatusFilter ? status : undefined,
    });
  }, [sortBy, status, showStatusFilter]);

  return (
    <div className="w-full glass border border-[var(--border)] p-4 sm:p-5 select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Left Side: Filter Title/Status */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-[var(--text2)] uppercase tracking-wider">
            ตัวเลือกการแสดงผล
          </span>
          <span className="text-[11px] text-[var(--text3)]">
            จัดการรูปภาพกิจกรรมและปรับแต่งตามเงื่อนไขที่ต้องการ
          </span>
        </div>

        {/* Right Side: Sorting and Status (if visible) */}
        <div className="flex flex-wrap items-center gap-4">
          
          {/* Status Filter */}
          {showStatusFilter && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider">สถานะรูปภาพ</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-[var(--accent-blue)] transition-all"
              >
                <option value="approved">ผ่านเกณฑ์ (Approved)</option>
                <option value="pending">รอการตรวจ (Pending)</option>
                <option value="rejected">ถูกคัดออก (Rejected)</option>
                <option value="all">ทั้งหมด (All)</option>
              </select>
            </div>
          )}

          {/* Sort Dropdown */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3" />
              <span>เรียงลำดับ</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
              className="bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-[var(--accent-blue)] transition-all"
            >
              <option value="newest">ภาพล่าสุด (Newest)</option>
              <option value="oldest">ภาพเก่าสุด (Oldest)</option>
            </select>
          </div>

        </div>

      </div>
    </div>
  );
}

export default FilterBar;
