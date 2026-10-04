import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/marketing";

// The public pages are open to search engines; the signed-in app, the API and
// the auth callbacks are not worth crawling (they only redirect to log in).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/leads",
        "/quotes",
        "/follow-ups",
        "/pipeline",
        "/settings",
        "/onboarding",
        "/reset-password",
        "/api/",
        "/auth/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
