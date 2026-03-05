import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  findCatalogBrand,
  getBrandBatterySlugPath,
  getBrandSlug,
  listCatalogBrands,
} from "@/lib/vehicle-catalog";

type PageProps = {
  params: Promise<{ brandId: string }>;
};

export async function generateStaticParams() {
  return listCatalogBrands().map((brand) => ({
    brandId: String(brand.id),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { brandId } = await params;
  const brand = findCatalogBrand(brandId);
  if (!brand) {
    return {
      title: "브랜드 배터리 찾기",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${brand.name} 배터리`,
    robots: { index: false, follow: true },
    alternates: { canonical: getBrandBatterySlugPath(getBrandSlug(brand)) },
  };
}

export default async function CarBatteryBrandIdRedirectPage({ params }: PageProps) {
  const { brandId } = await params;
  const brand = findCatalogBrand(brandId);
  if (!brand) {
    notFound();
  }

  redirect(getBrandBatterySlugPath(getBrandSlug(brand)));
}
