// app/page.tsx
import { auth } from "@/lib/auth";
import Link from "next/link";
import { NextsyncLogo } from "@/components/shared/NextsyncLogo";
import { NextsyncWordmark } from "@/components/shared/NextsyncWordmark";
import { FeatureCard } from "@/components/shared/FeatureCard";

export default async function IndexPage() {
  const session = await auth();
  const scanHref = session ? "/my-photos" : "/auth/login?next=my-photos";

  return (
    <div className="container select-none">
      <section className="hero">
        <div
          style={{
            marginBottom: 24,
            position: "relative",
            width: 240,
            height: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              background:
                "radial-gradient(circle, rgba(0,242,254,0.35) 0%, transparent 70%)",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              filter: "blur(25px)",
              zIndex: -1,
            }}
          />
          <NextsyncLogo size={200} variant="hero" />
        </div>

        <h1 className="hero-title">
          <NextsyncWordmark variant="hero" />
        </h1>
        <p className="hero-subtitle">ค้นหารูปถ่ายของคุณด้วยใบหน้า - ฟรี - ทันที</p>
        <p className="hero-description">
          ระบบจัดการภาพถ่ายกิจกรรมที่ทำงานร่วมกับระบบจดจำใบหน้า: รองรับภาพถ่ายคุณภาพสูงในกิจกรรมที่ท่านเข้าร่วม
          <br />
          มากกว่า 10,000+ รูป เข้าสู่ระบบด้วยปุ่มค้นหาด้วยใบหน้าได้ตลอดเวลา
        </p>

        <div className="hero-actions">
          <Link href={scanHref} className="btn btn-primary no-underline">
            <svg
              className="btn-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            <span>สแกนใบหน้าค้นหารูปของฉัน</span>
          </Link>
          <Link href="/gallery" className="btn btn-secondary no-underline">
            <svg
              className="btn-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>ดูรูปภาพทั้งหมด</span>
          </Link>
        </div>
      </section>

      <section className="features-grid">
        <FeatureCard
          iconColorClass="icon-cyan"
          title="ค้นหาด้วยใบหน้า"
          description="ระบบประมวลผลสัญญาณจดจำใบหน้า (AI Face Recognition) เพื่อค้นหา ค้นหาภาพถ่ายทุกรูปในใช้งาน"
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
        />
        <FeatureCard
          iconColorClass="icon-red"
          title="10,000+ รูปภาพ"
          description="ครอบคลุมทุกรูปกิจกรรมตลอดการเข้าร่วมจัดในกิจกรรมหลัก ทุกงาน ทุกช่วงเวลาทุกกิจกรรม"
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          }
        />
        <FeatureCard
          iconColorClass="icon-green"
          title="ดาวน์โหลดฟรี"
          description="ดาวน์โหลดภาพถ่ายทุกรูปในความละเอียดสูง ฟรี ไม่มีค่าใช้จ่ายใดๆ เพิ่มเติม"
          icon={
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          }
        />
      </section>
    </div>
  );
}
