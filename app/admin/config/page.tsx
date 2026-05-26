// app/admin/config/page.tsx
import { ThresholdSliders } from "@/components/admin/ThresholdSliders";
import { Sliders } from "lucide-react";

export default function AdminConfigPage() {
  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="p-5 glass border border-[var(--border)] select-none">
        <h2 className="text-xl font-extrabold text-[var(--text)] tracking-tight flex items-center gap-2">
          <Sliders className="h-5.5 w-5.5 text-[var(--accent-purple)]" />
          <span>ตั้งค่าเกณฑ์การกรองคุณภาพ (Quality Filter Thresholds)</span>
        </h2>
        <p className="text-xs text-[var(--text2)] mt-1">
          ปรับจูนความไวของเกณฑ์ปัญญาประดิษฐ์และค่าเบี่ยงเบนความคมชัด แสงสว่าง อัตราหลับตา สำหรับการยอมรับรูปภาพเข้าสู่แกลเลอรีแบบอัตโนมัติ
        </p>
      </div>

      {/* ThresholdSliders */}
      <ThresholdSliders />
    </div>
  );
}

