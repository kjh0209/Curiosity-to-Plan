import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "SkillLoop - Personalized Learning Routine",
  description: "Convert your curiosity into a customized learning plan with AI",
  icons: {
    icon: "/icon.svg",
  },
};

// Inter - Clean, modern, Apple-like typography
// Similar to Apple's SF Pro Display, used by GitHub, Vercel, Linear
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-slate-950 text-slate-50 selection:bg-cyan-500/30`}>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}

