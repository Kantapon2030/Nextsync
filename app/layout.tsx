// app/layout.tsx
import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/shared/Navbar";
import { BackgroundEffects } from "@/components/shared/BackgroundEffects";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nextsync — ค้นหารูปถ่ายของคุณด้วยใบหน้า",
  description: "ระบบค้นหารูปภาพงานวิ่งสีด้วย AI ใบหน้า รองรับ 10,000+ รูป",
  icons: {
    icon: "/icon.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&family=Noto+Sans+Thai:wght@300;400;500;600;700&family=Poppins:wght@800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <SessionProvider session={session}>
          <div className="flex flex-col min-h-screen bg-[#060813] text-[#ffffff] selection:bg-[#4facfe]/20 relative overflow-hidden">
            {/* Twinkling background stars, floating parallax particles, glows, and bottom rainbow bar */}
            <BackgroundEffects />

            <Navbar />
            <main className="flex-1 w-full relative z-10">
              {children}
            </main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
