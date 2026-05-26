import { Loader2, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";

interface SyncStatusBadgeProps {
  status: string | null;
}

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  switch (status) {
    case "syncing":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/40 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20 animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>กำลังซิงค์... (Syncing)</span>
        </span>
      );
    case "done":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-950/40 text-[var(--accent-green)] border border-[var(--accent-green)]/20">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>ซิงค์สำเร็จ (Done)</span>
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-950/40 text-[var(--accent-red)] border border-[var(--accent-red)]/20">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>ล้มเหลว (Error)</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-900/40 text-slate-400 border border-slate-700/20">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>รอซิงค์ (Idle)</span>
        </span>
      );
  }
}
