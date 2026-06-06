import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private/authenticated areas and API endpoints should not be indexed.
      disallow: ["/api/", "/admin", "/my-work", "/sessions", "/submissions", "/api-keys", "/login", "/register"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
