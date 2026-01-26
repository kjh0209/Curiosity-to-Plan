import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkillLoop - 14-Day Learning Routine",
  description: "Convert your curiosity into a structured 14-day learning plan",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
