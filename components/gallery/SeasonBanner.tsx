// components/gallery/SeasonBanner.tsx
import { Calendar, Layers, Image as ImageIcon } from "lucide-react";

interface SeasonBannerProps {
  seasonName: string;
  year: number;
  eventCount: number;
  photoCount: number;
}

export function SeasonBanner({ seasonName, year, eventCount, photoCount }: SeasonBannerProps) {
  return (
    <div className="relative z-10 glass border border-[var(--border)] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none overflow-hidden">
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20">
          <Calendar className="h-3 w-3" />
          <span>ปีการศึกษา {year}</span>
        </div>
        <h1 className="text-lg sm:text-xl font-extrabold text-[var(--text)] tracking-tight">
          {seasonName}
        </h1>
      </div>

      <div className="flex items-center gap-6 sm:gap-8 text-xs font-semibold text-[var(--text2)] bg-black/20 px-4 py-2.5 rounded-xl border border-[var(--border)] shrink-0 self-start sm:self-auto">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[var(--accent-blue)]" />
          <div>
            <div className="text-[10px] text-[var(--text3)] uppercase">กิจกรรม</div>
            <div className="text-[13px] font-bold text-[var(--text)]">{eventCount} งาน</div>
          </div>
        </div>
        <div className="h-6 w-px bg-[var(--border)]" />
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-[var(--accent-purple)]" />
          <div>
            <div className="text-[10px] text-[var(--text3)] uppercase">รูปภาพรวม</div>
            <div className="text-[13px] font-bold text-[var(--text)]">{photoCount.toLocaleString()} รูป</div>
          </div>
        </div>
      </div>
    </div>
  );
}
