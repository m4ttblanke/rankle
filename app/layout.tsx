import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// Display face — game moments: headlines, tier letters, result numbers.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["600", "700", "800"],
  display: "swap",
});

// Interface face — body copy, controls, metadata.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rankle",
  description: "A daily social tier-list game. Rank today's list.",
  applicationName: "Rankle",
  icons: {
    icon: [
      { url: "/brand/rankle-mark.svg", type: "image/svg+xml" },
      { url: "/brand/rankle-icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/brand/rankle-apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${hanken.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
