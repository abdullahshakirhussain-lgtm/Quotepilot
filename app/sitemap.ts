import type { MetadataRoute } from "next";
import { SITE_URL, TRADES } from "@/lib/marketing";

/** The public pages: the landing page, one page per trade, sign-up and the legal pages. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...TRADES.map((trade) => ({ url: `${SITE_URL}/for/${trade.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${SITE_URL}/signup`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
