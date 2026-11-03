import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { TimezoneCookie } from "@/components/TimezoneCookie";
import { SITE_URL } from "@/lib/marketing";
import "./globals.css";

// Self-hosted at build time (no runtime font CDN). Rubik for everything:
// soft corners, sturdy numbers, easy to read at small sizes. Headings and
// amounts use the same family (the display variable points at it too).
const sans = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute addresses for share images and canonical links.
  metadataBase: new URL(SITE_URL),
  title: "QuoteLoop | Follow up on every quote. Win more jobs.",
  description:
    "QuoteLoop helps small service businesses follow up on the quotes they send, with reminders and AI-written messages they review and send themselves.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <TimezoneCookie />
        {children}
      </body>
    </html>
  );
}
