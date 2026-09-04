import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { CORE, MORE, SERVICE_CATALOG, featureSlug } from "@/content/services";

const BASE_URL = "https://sharp-voton.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/all-services", changefreq: "weekly", priority: "0.9" },
          { path: "/features", changefreq: "weekly", priority: "0.9" },
          ...[...CORE, ...MORE].map((f) => ({
            path: `/features/${featureSlug(f.name)}`,
            changefreq: "monthly" as const,
            priority: "0.7",
          })),
          { path: "/catalog", changefreq: "monthly", priority: "0.8" },
          ...SERVICE_CATALOG.map((c) => ({
            path: `/catalog/${c.key}`,
            changefreq: "monthly" as const,
            priority: "0.6",
          })),
          { path: "/ai", changefreq: "monthly", priority: "0.7" },
          { path: "/security", changefreq: "monthly", priority: "0.7" },
          { path: "/accessibility", changefreq: "monthly", priority: "0.6" },
          { path: "/guide", changefreq: "monthly", priority: "0.8" },
          { path: "/for-schools", changefreq: "monthly", priority: "0.8" },
          { path: "/help", changefreq: "weekly", priority: "0.7" },
          { path: "/login", changefreq: "monthly", priority: "0.6" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
