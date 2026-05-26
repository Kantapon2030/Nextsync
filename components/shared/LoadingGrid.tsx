// components/shared/LoadingGrid.tsx
import { cn } from "@/lib/utils";

interface LoadingGridProps {
  count?: number;
  className?: string;
}

export function LoadingGrid({ count = 8, className }: LoadingGridProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6", className)}>
      {Array.from({ length: count }).map((_, idx) => (
        <div 
          key={idx} 
          className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden animate-pulse flex flex-col"
        >
          {/* Mock photo aspect ratio */}
          <div className="bg-white/5 aspect-[4/3] w-full shrink-0" />
          
          <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
            <div className="h-4 bg-white/5 rounded w-2/3" />
            <div className="flex justify-between items-center pt-2">
              <div className="h-5 bg-white/5 rounded-full w-20" />
              <div className="h-8 bg-white/5 rounded-lg w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
export default LoadingGrid;
