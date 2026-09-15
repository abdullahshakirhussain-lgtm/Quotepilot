import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { TimezoneCookie } from "@/components/TimezoneCookie";
import "./globals.css";

// Self-hosted at build time (no runtime font CDN).
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "QuoteLoop — Follow up on every quote. Win more jobs.",
  description:
    "QuoteLoop helps small service businesses follow up on the quotes they send, with reminders and AI-written messages they review and send themselves.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={plex.variable}>
      <body>
        <TimezoneCookie />
        {children}
      </body>
    </html>
  );
}
