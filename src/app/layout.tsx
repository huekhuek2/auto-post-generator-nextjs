import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "오전 8시 뉴스레터",
  description: "매일 아침 8시, 당신에게 필요한 경제 뉴스를 배달합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <div className="flex-grow">
          {children}
        </div>
        <footer className="py-6 text-center text-sm text-gray-500 border-t mt-10">
          <p>© {new Date().getFullYear()} 오전 8시 뉴스레터. All rights reserved.</p>
          <div className="mt-2 space-x-4">
            <a href="/privacy" className="hover:underline">개인정보처리방침</a>
            <a href="/terms" className="hover:underline">이용약관</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
