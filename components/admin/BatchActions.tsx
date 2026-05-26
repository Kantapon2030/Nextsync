// components/admin/BatchActions.tsx
"use client";

import { useState } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2, Play, Layers } from "lucide-react";

export function BatchActions() {
  const [sourceStatus, setSourceStatus] = useState<string>("pending");
  const [targetAction, setTargetAction] = useState<string>("approve");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleBatchExecution = async () => {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะรันการปรับปรุงสถานะแบบกลุ่ม? การกระทำนี้ไม่สามารถย้อนกลับได้")) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const query = new URLSearchParams({
        status: sourceStatus,
        limit: "100", // Bulk limit
        eventId: "colorrun_2024",
      });

      const getRes = await fetch(`/api/photos?${query.toString()}`);
      const getData = await getRes.json();

      if (!getData.success) {
        throw new Error(getData.error || "ดึงข้อมูลรูปภาพล้มเหลว");
      }

      const photoIds = getData.photos.map((p: any) => p.id);
      if (photoIds.length === 0) {
        setMessage({ type: "error", text: "ไม่พบรูปภาพใดๆ ที่เข้าเงื่อนไขในการดำเนินการกลุ่มนี้" });
        setLoading(false);
        return;
      }

      const res = await fetch("/api/admin/photos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoIds,
          action: targetAction,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: `ดำเนินการกับรูปภาพสำเร็จจำนวน ${data.updated} รูป (จากคิว ${photoIds.length} รูป)`,
        });
      } else {
        setMessage({ type: "error", text: data.error || "เกิดข้อผิดพลาดในการดำเนินการกลุ่ม" });
      }
    } catch (error: any) {
      console.error(error);
      setMessage({ type: "error", text: error.message || "การเชื่อมต่อขัดข้อง" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass border border-[var(--border)] overflow-hidden select-none">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border)] flex items-center gap-2 bg-black/25">
        <Layers className="h-5 w-5 text-[var(--accent-purple)]" />
        <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">ตัวควบคุมการดำเนินการแบบกลุ่ม (Batch Processing)</h3>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        <p className="text-xs text-[var(--text2)] leading-normal">
          ฟังก์ชันเครื่องมือลัดสำหรับการเปลี่ยนสถานะรูปภาพปริมาณมากพร้อมกัน โดยสแกนตามสถานะเริ่มต้นจากคลังรูปภาพและปรับปรุงสถานะปลายทางทันที
        </p>

        {message && (
          <div
            className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${
              message.type === "success"
                ? "bg-green-950/20 border-green-900/30 text-[var(--accent-green)]"
                : "bg-red-950/20 border-red-900/30 text-[var(--accent-red)]"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Step 1: Select Initial Status */}
          <div className="p-4 bg-black/35 border border-[var(--border)] rounded-2xl space-y-3">
            <label className="text-xs font-bold text-[var(--text2)] uppercase tracking-wider block">1. ค้นหาสถานะเริ่มต้น</label>
            <div className="space-y-2">
              {[
                { val: "pending", name: "รูปที่รอการตรวจสอบ (Pending)" },
                { val: "rejected", name: "รูปที่ถูกคัดกรองออก (Rejected)" },
                { val: "approved", name: "รูปที่อนุมัติแล้ว (Approved)" },
              ].map((s) => (
                <label
                  key={s.val}
                  className="flex items-center gap-2.5 p-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="batch-source"
                    checked={sourceStatus === s.val}
                    onChange={() => setSourceStatus(s.val)}
                    className="accent-[var(--accent-purple)] h-3.5 w-3.5"
                  />
                  <span className="text-xs font-semibold text-[var(--text2)]">{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Step 2: Select Action Target */}
          <div className="p-4 bg-black/35 border border-[var(--border)] rounded-2xl space-y-3">
            <label className="text-xs font-bold text-[var(--text2)] uppercase tracking-wider block">2. ดำเนินการปลายทาง</label>
            <div className="space-y-2">
              {[
                { val: "approve", name: "ปรับปรุงเป็น: อนุมัติและเผยแพร่" },
                { val: "reject", name: "ปรับปรุงเป็น: คัดแยกออก (Reject)" },
              ].map((a) => (
                <label
                  key={a.val}
                  className="flex items-center gap-2.5 p-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="batch-action"
                    checked={targetAction === a.val}
                    onChange={() => setTargetAction(a.val)}
                    className="accent-[var(--accent-purple)] h-3.5 w-3.5"
                  />
                  <span className="text-xs font-semibold text-[var(--text2)]">{a.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Warning Indicator */}
        <div className="p-4 bg-amber-950/20 border border-amber-900/30 text-[var(--accent-yellow)] rounded-2xl text-xs flex gap-2 font-medium">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--accent-yellow)]" />
          <div>
            <p className="font-bold">ข้อควรระวัง:</p>
            <p className="mt-0.5">
              การกระทำนี้จะดึงข้อมูลรูปภาพทีละสูงสุด 100 รูปแรกที่ตรงตามฟิลเตอร์ คอนเฟิร์มการแก้ไขสถานะแบบตรงเป้าหมาย กรุณาตรวจสอบขั้นตอนด้านบนให้ถี่ถ้วนก่อนรันระบบ
            </p>
          </div>
        </div>

        {/* Start Processing Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleBatchExecution}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 text-xs font-bold text-white bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:brightness-110 rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-white" />
            )}
            <span>เริ่มการปรับปรุงคิวรูปภาพแบบกลุ่ม</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default BatchActions;
