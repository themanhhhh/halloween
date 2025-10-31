import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const body = Be_Vietnam_Pro({
  weight: ["400", "700"],
  subsets: ["latin", "vietnamese"],
  variable: "--font-geist-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Retro Candy Arcade — Trick or Treat riêng tư",
  description:
    "Trải nghiệm Trick or Treat cá nhân hóa theo phong cách Candy Arcade 8-bit, ấm áp và tinh nghịch.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${body.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
