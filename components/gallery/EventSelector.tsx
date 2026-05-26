// components/gallery/EventSelector.tsx
import { Sparkles, Calendar, Sun, Sunset } from "lucide-react";

export interface Event {
  id: string;
  seasonId: string;
  name: string;
  type: "indoor" | "outdoor";
  date: string | null;
  sortOrder: number;
  description: string | null;
  coverUrl: string | null;
  photoCount: number;
}

interface EventSelectorProps {
  events: Event[];
  selectedEventId: string | null;
  onEventChange: (id: string | null) => void;
  selectedTimeslot: string | null;
  onTimeslotChange: (timeslot: string | null) => void;
}

export function EventSelector({
  events,
  selectedEventId,
  onEventChange,
  selectedTimeslot,
  onTimeslotChange,
}: EventSelectorProps) {
  
  const activeEvent = events.find((e) => e.id === selectedEventId);
  const showTimeslots = activeEvent?.type === "outdoor";

  return (
    <div className="relative z-10 space-y-4 select-none">
      {/* Event Scroll List */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin pr-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {/* All/ทั้งหมด pill */}
        <button
          onClick={() => {
            onEventChange(null);
            onTimeslotChange(null);
          }}
          className={`shrink-0 text-xs font-bold px-4 py-2 rounded-xl border transition-all ${
            selectedEventId === null
              ? "bg-gradient-to-r from-[var(--accent-blue)]/20 to-[var(--accent-purple)]/20 border-[var(--accent-blue)] text-white shadow-sm shadow-[var(--glow-blue)]"
              : "bg-[var(--surface)] border-[var(--border)] text-[var(--text2)] hover:text-white hover:bg-[var(--surface-hover)]"
          }`}
        >
          ทั้งหมด
        </button>

        {/* Dynamic event pills */}
        {events.map((event) => {
          const isActive = selectedEventId === event.id;
          const isIndoor = event.type === "indoor";
          
          let borderStyle = "border-[var(--border)] bg-[var(--surface)] text-[var(--text2)] hover:text-white hover:bg-[var(--surface-hover)]";
          if (isActive) {
            borderStyle = isIndoor
              ? "bg-teal-950/20 border-teal-500 text-teal-300 shadow-sm shadow-teal-500/10"
              : "bg-amber-950/20 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/10";
          }

          return (
            <button
              key={event.id}
              onClick={() => {
                onEventChange(event.id);
                onTimeslotChange(null); // Reset timeslot on event change
              }}
              className={`shrink-0 text-xs font-bold px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${borderStyle}`}
            >
              <span>{event.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                isActive
                  ? isIndoor ? "bg-teal-950/40 text-teal-400" : "bg-amber-950/40 text-amber-400"
                  : "bg-black/30 text-[var(--text3)]"
              }`}>
                {event.photoCount || 0} รูป
              </span>
            </button>
          );
        })}
      </div>

      {/* Timeslot sub-chips for outdoor events */}
      {showTimeslots && (
        <div className="flex items-center gap-2 pl-4 border-l-2 border-amber-500/40 animate-fade-in py-1">
          <button
            onClick={() => onTimeslotChange(null)}
            className={`text-[11px] font-bold px-3 py-1 rounded-lg border transition-all ${
              selectedTimeslot === null
                ? "bg-amber-500/20 border-amber-500 text-amber-300"
                : "bg-black/25 border-[var(--border)] text-[var(--text3)] hover:text-white"
            }`}
          >
            ทุกช่วงเวลา
          </button>
          
          <button
            onClick={() => onTimeslotChange("morning")}
            className={`text-[11px] font-bold px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
              selectedTimeslot === "morning"
                ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm"
                : "bg-black/25 border-[var(--border)] text-[var(--text3)] hover:text-white"
            }`}
          >
            <Sun className="h-3.5 w-3.5 text-amber-400" />
            <span>ช่วงเช้า</span>
          </button>

          <button
            onClick={() => onTimeslotChange("afternoon")}
            className={`text-[11px] font-bold px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
              selectedTimeslot === "afternoon"
                ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm"
                : "bg-black/25 border-[var(--border)] text-[var(--text3)] hover:text-white"
            }`}
          >
            <Sunset className="h-3.5 w-3.5 text-orange-400" />
            <span>ช่วงบ่าย</span>
          </button>
        </div>
      )}
    </div>
  );
}
