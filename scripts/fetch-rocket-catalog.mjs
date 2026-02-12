import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = "https://rocketbattery.kr";
const ROOTS = [
  { categoryNo: 67, name: "국산차" },
  { categoryNo: 68, name: "수입차" },
];

/**
 * @typedef {{
 *   category_no: number;
 *   category_name: string;
 *   parent_cate_no: number;
 * }} RocketCategory
 */

/**
 * @typedef {{
 *   id: number;
 *   name: string;
 * }} CatalogTrim
 */

/**
 * @typedef {{
 *   id: number;
 *   name: string;
 *   trims: CatalogTrim[];
 * }} CatalogModel
 */

/**
 * @typedef {{
 *   id: number;
 *   name: string;
 *   origin: string;
 *   models: CatalogModel[];
 * }} CatalogBrand
 */

/**
 * @typedef {{
 *   source: {
 *     provider: string;
 *     url: string;
 *     fetchedAt: string;
 *   };
 *   stats: {
 *     brandCount: number;
 *     modelCount: number;
 *     trimCount: number;
 *   };
 *   brands: CatalogBrand[];
 * }} VehicleCatalog
 */

const cache = new Map();

async function fetchSubCategories(parentCategoryNo) {
  if (cache.has(parentCategoryNo)) {
    return cache.get(parentCategoryNo);
  }

  const endpoint = `${BASE_URL}/exec/front/Product/SubCategory?parent_cate_no=${parentCategoryNo}`;
  const response = await fetch(endpoint, {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint} (${response.status})`);
  }

  const rawText = await response.text();
  /** @type {RocketCategory[]} */
  let rows = [];

  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) {
      rows = parsed;
    }
  } catch {
    rows = [];
  }

  const normalized = rows
    .filter((row) => row && Number.isFinite(row.category_no))
    .map((row) => ({
      category_no: Number(row.category_no),
      category_name: String(row.category_name ?? "").trim(),
      parent_cate_no: Number(row.parent_cate_no ?? parentCategoryNo),
    }))
    .sort((a, b) => a.category_name.localeCompare(b.category_name, "ko"));

  cache.set(parentCategoryNo, normalized);
  return normalized;
}

async function buildCatalog() {
  /** @type {CatalogBrand[]} */
  const brands = [];

  for (const root of ROOTS) {
    const makers = await fetchSubCategories(root.categoryNo);

    for (const maker of makers) {
      const models = await fetchSubCategories(maker.category_no);
      /** @type {CatalogModel[]} */
      const normalizedModels = [];

      for (const model of models) {
        const trims = await fetchSubCategories(model.category_no);
        const normalizedTrims = trims.map((trim) => ({
          id: trim.category_no,
          name: trim.category_name,
        }));

        normalizedModels.push({
          id: model.category_no,
          name: model.category_name,
          trims: normalizedTrims,
        });
      }

      brands.push({
        id: maker.category_no,
        name: maker.category_name,
        origin: root.name,
        models: normalizedModels,
      });
    }
  }

  const modelCount = brands.reduce((sum, brand) => sum + brand.models.length, 0);
  const trimCount = brands.reduce(
    (sum, brand) =>
      sum + brand.models.reduce((inner, model) => inner + model.trims.length, 0),
    0,
  );

  /** @type {VehicleCatalog} */
  const catalog = {
    source: {
      provider: "rocketbattery.kr",
      url: "https://rocketbattery.kr/rocket/btr.html",
      fetchedAt: new Date().toISOString(),
    },
    stats: {
      brandCount: brands.length,
      modelCount,
      trimCount,
    },
    brands,
  };

  return catalog;
}

async function main() {
  const catalog = await buildCatalog();
  const outputPath = path.join(process.cwd(), "data", "vehicle-catalog.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

  console.log(
    `Saved ${outputPath} (brands=${catalog.stats.brandCount}, models=${catalog.stats.modelCount}, trims=${catalog.stats.trimCount})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
