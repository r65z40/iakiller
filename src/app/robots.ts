import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/r/", "/m/", "/invitation", "/dev"] }],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
