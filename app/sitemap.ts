import type { MetadataRoute } from "next";
import { getSiteUrl, toAbsoluteUrl } from "@/lib/seo";
import {
  getBrandBatterySlugPath,
  getBrandSlug,
  getCarBatteryLandingPath,
  listAllCatalogBrandModels,
  listCatalogBrands,
} from "@/lib/vehicle-catalog";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const siteUrl = getSiteUrl();

  return [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: toAbsoluteUrl("/battery-map"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: toAbsoluteUrl("/about"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: toAbsoluteUrl("/contact"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: toAbsoluteUrl("/privacy-policy"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...listCatalogBrands().map((brand) => ({
      url: toAbsoluteUrl(getBrandBatterySlugPath(getBrandSlug(brand))),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    })),
    ...listAllCatalogBrandModels().map(({ brand, model }) => ({
      url: toAbsoluteUrl(getCarBatteryLandingPath(brand.id, model.id)),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })),
  ];
}
