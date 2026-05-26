// components/admin/StatsCards.tsx
"use client";

import { Users, Image, CheckCircle, Clock, Trash2, ShieldCheck } from "lucide-react";

interface StatsData {
  totalUsers: number;
  photos: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
  };
}

export function StatsCards({ data }: { data: StatsData }) {
  const primaryCards = [
    {
      title: "ผู้สมัครสมาชิกทั้งหมด",
      value: data.totalUsers,
      desc: "ผู้ใช้งานและนักเรียนในระบบ",
      icon: Users,
      glowClass: "from-[var(--accent-blue)] to-[var(--accent-purple)]",
      textColor: "text-[var(--accent-blue)]",
    },
    {
      title: "รูปถ่ายอัปโหลดทั้งหมด",
      value: data.photos.total,
      desc: "รูปทั้งหมดจากกล้องช่างภาพ",
      icon: Image,
      glowClass: "from-[var(--accent-purple)] to-[var(--accent-red)]",
      textColor: "text-[var(--accent-purple)]",
    },
    {
      title: "รูปที่ผ่านเกณฑ์",
      value: data.photos.approved,
      desc: "เผยแพร่แล้วในแกลเลอรี",
      icon: CheckCircle,
      glowClass: "from-[var(--accent-green)] to-[var(--accent-blue)]",
      textColor: "text-[var(--accent-green)]",
    },
    {
      title: "รูปที่รอการตรวจ",
      value: data.photos.pending,
      desc: "คิวรอการตรวจสอบคุณภาพ",
      icon: Clock,
      glowClass: "from-[var(--accent-yellow)] to-[var(--accent-purple)]",
      textColor: "text-[var(--accent-yellow)]",
    },
  ];

  return (
    <div className="space-y-6 select-none">
      {/* 4 Cards Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {primaryCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="p-5 glass border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-3xl flex flex-col justify-between gap-4 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-[var(--text2)] uppercase tracking-wider">{card.title}</span>
                <span className="p-2 bg-black/45 border border-[var(--border)] rounded-xl">
                  <Icon className="h-4.5 w-4.5 text-[var(--text)]" />
                </span>
              </div>
              <div>
                <p className={`text-2xl sm:text-3xl font-display font-extrabold text-[var(--text)]`}>
                  {card.value.toLocaleString("th-TH")}
                </p>
                <p className="text-[10px] text-[var(--text3)] font-medium mt-1">{card.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Quality summary */}
        <div className="p-6 glass border border-[var(--border)] bg-[var(--surface)] rounded-3xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-[var(--accent-blue)]" />
              <span>ประสิทธิภาพการทำงานของระบบคัดกรอง</span>
            </h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-black/35 rounded-2xl border border-[var(--border)]">
              <span className="text-[10px] font-bold text-[var(--text2)] block uppercase">ผ่านเกณฑ์แกลเลอรี</span>
              <span className="text-xl font-display font-extrabold text-[var(--accent-green)] mt-1 block">
                {data.photos.total > 0
                  ? `${((data.photos.approved / data.photos.total) * 100).toFixed(1)}%`
                  : "0.0%"}
              </span>
            </div>
            <div className="p-4 bg-black/35 rounded-2xl border border-[var(--border)]">
              <span className="text-[10px] font-bold text-[var(--text2)] block uppercase">คัดออกระบบอัตโนมัติ</span>
              <span className="text-xl font-display font-extrabold text-[var(--accent-red)] mt-1 block">
                {data.photos.total > 0
                  ? `${((data.photos.rejected / data.photos.total) * 100).toFixed(1)}%`
                  : "0.0%"}
              </span>
            </div>
          </div>
        </div>

        {/* Quality parameters */}
        <div className="p-6 glass border border-[var(--border)] bg-[var(--surface)] rounded-3xl flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
                <Trash2 className="h-4.5 w-4.5 text-[var(--accent-red)]" />
                <span>สถิติการปฏิเสธรูปภาพ</span>
              </h3>
            </div>
            
            <div className="flex items-center justify-between text-xs text-[var(--text2)]">
              <span>จำนวนรูปภาพที่ถูกคัดออกทั้งหมด</span>
              <span className="font-bold text-[var(--text)]">{data.photos.rejected.toLocaleString("th-TH")} รูป</span>
            </div>
          </div>

          <p className="text-[10px] text-[var(--text3)] italic">
            * สถิตินี้ถูกกรองและวิเคราะห์ผ่านตัวกรองคุณภาพอัจฉริยะ (ความสว่างของแสง, ความเบลอของชัตเตอร์ และจำนวนใบหน้าที่พบ)
          </p>
        </div>

      </div>
    </div>
  );
}

export default StatsCards;
