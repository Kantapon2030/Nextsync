// app/admin/reject-queue/page.tsx
import { RejectQueue } from "@/components/admin/RejectQueue";
import { Trash2 } from "lucide-react";

export default function AdminRejectQueuePage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-screen">
      {/* Background glow */}
      <div className="gemini-bg opacity-30" />

      {/* Title Header */}
      <div className="relative z-10 p-5 glass border border-[var(--border)] select-none">
        <h2 className="text-xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
          <Trash2 className="h-5.5 w-5.5 text-[var(--accent-red)] animate-pulse" />
          <span>คิวรูปภาพที่ถูกปฏิเสธ (Rejected Photo Queue)</span>
        </h2>
        <p className="text-xs text-[var(--text2)] mt-1">
          คลังภาพที่ไม่ผ่านการคัดกรองคุณภาพอัตโนมัติ (เช่น ความเบลอ แสงมืด/จ้า) ท่านสามารถตรวจสอบสิทธิ์อนุมัติข้อยกเว้น หรือลบภาพทิ้งแบบถาวรได้
        </p>
      </div>

      {/* RejectQueue Component */}
      <div className="relative z-10">
        <RejectQueue />
      </div>
    </div>
  );
}
