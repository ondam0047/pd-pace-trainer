import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Noto_Sans_KR,
  Fraunces,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  weight: ["300", "400", "500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
});
const fraunces = Fraunces({
  variable: "--font-fraunces",
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "대림대학교 Voice Lab",
  description: "음성·말 평가 및 치료를 위한 통합 허브",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansKR.variable} ${fraunces.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
        {/* 비의료기기 면책 — 개별 페이지가 빠뜨릴 수 없도록 루트에서 1회 고정 노출 */}
        <p
          role="note"
          className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-center text-[11px] leading-relaxed text-slate-500"
        >
          본 도구는 교육·임상·연구 보조용이며 진단 도구가 아닙니다. 표기되는
          참고 범위·절단점은 해석을 돕기 위한 것으로 정상·비정상 판정이 아니며,
          임상 판단은 전문가 확인을 거쳐야 합니다.
        </p>
      </body>
    </html>
  );
}
