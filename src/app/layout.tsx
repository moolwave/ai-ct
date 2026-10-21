import type { Metadata } from "next";
import { Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { configuredToken } from "@/lib/session";
import "./globals.css";

const sans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans-kr",
  display: "swap",
});

const serif = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-serif-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ai ct — 납품 검수",
  description:
    "발주처가 받은 AI 챗봇을 질문셋으로 대조하고, 사람이 판정한 결과만 확인서로 남기는 납품 검수.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${sans.variable} ${serif.variable}`}>
      <body className="antialiased">
        <div className="flex min-h-screen flex-col">
          <SiteHeader authEnabled={Boolean(configuredToken())} />
          <div className="flex-1">{children}</div>
          <footer className="no-print border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
            확인서는 인증이 아닙니다. ai ct는 외부 API를 호출하지 않고, 검수
            기록은 이 서버의 data/store.json에만 둡니다.
          </footer>
        </div>
      </body>
    </html>
  );
}
