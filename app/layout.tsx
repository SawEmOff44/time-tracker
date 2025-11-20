import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Time Tracker",
  description: "GPS-based employee time tracking",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
