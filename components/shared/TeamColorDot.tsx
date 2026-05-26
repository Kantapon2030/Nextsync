// components/shared/TeamColorDot.tsx
import { cn } from "@/lib/utils";

interface TeamColorDotProps {
  color: "blue" | "green" | "red" | "yellow" | string;
  className?: string;
}

export function TeamColorDot({ color, className }: TeamColorDotProps) {
  const bgClasses: Record<string, string> = {
    blue: "bg-team-blue",
    green: "bg-team-green",
    red: "bg-team-red",
    yellow: "bg-team-yellow",
  };

  return (
    <span
      className={cn(
        "inline-block h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm shrink-0",
        bgClasses[color.toLowerCase()] || "bg-gray-400",
        className
      )}
    />
  );
}
export default TeamColorDot;
