import type { Metadata } from "next";
import { TimezoneCookie } from "@/components/TimezoneCookie";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuotePilot — Win more jobs from the quotes you already send",
  description:
    "QuotePilot helps small service businesses track sent quotes, get follow-up reminders, and generate AI-written follow-up messages so they can win more jobs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TimezoneCookie />
        {children}
      </body>
    </html>
  );
}
